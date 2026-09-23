// BillingReconciliationService — nightly production-readiness safety net
// (C1 + C2 + C4 of the billing hardening plan).
//
// Why this exists: our DB and Stripe CAN drift. Every drift we've ever seen
// produced the same silent failure — weekly invoices 402 with
// code=missing while our DB said everything was fine:
//   • DB stripeDefaultPaymentMethodId set, Stripe's invoice_settings default
//     never stuck (the old best-effort webhook write) → DEFAULT_PM_DRIFT.
//   • Card saved on a NEW Stripe customer while the $0 anchor subscription
//     still bills the OLD one → SUBSCRIPTION_CUSTOMER_MISMATCH.
//   • Default card deleted/detached after being set → PM_NOT_ATTACHED.
// A nightly audit catches all three within 24h instead of "when someone
// opens the Stripe health tab".
//
// What it does each run:
//   C1 — Audit every WEEKLY_POSTPAID dealer's Stripe objects vs our DB.
//   C2 — Auto-repair the SAFE cases (see AUTO-REPAIR below), record
//        everything else as findings for admins.
//   C4 — Invoice-state backfill: re-run the idempotent invoice.* webhook
//        handlers for recent invoices whose DB rows are stale (covers a
//        missed/dropped webhook delivery).
//
// Design rules:
//   • Never charges anything. The only Stripe WRITE here is re-pointing
//     invoice_settings.default_payment_method to a card we already believe
//     is the dealer's default (AUTO-REPAIR) — the exact call the card-save
//     webhook makes.
//   • Every check is idempotent — re-running is always safe.
//   • Findings are deduped per (customer, check) — a persistent issue
//     doesn't create a new row every night; a changed issue does.
import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { MailService } from "../common/mail/mail.service";
import { PostpaidBillingService } from "./postpaidBilling.service";

const BACKFILL_WINDOW_HOURS = 48;
const FINDING_RETENTION_DAYS = 30;
const AUDIT_BATCH_LIMIT = 500;

// Severity levels
const SEV_AUTO_REPAIRED = "AUTO_REPAIRED";
const SEV_WARNING = "WARNING";
const SEV_CRITICAL = "CRITICAL";

// Check identifiers (stored in BillingAuditFinding.check — the Billing
// Health page and the runbook group on these exact strings)
const CHECK = {
  NO_SAVED_CARD: "NO_SAVED_CARD",
  DEFAULT_PM_DRIFT: "DEFAULT_PM_DRIFT",
  PM_NOT_ATTACHED: "PM_NOT_ATTACHED",
  STRIPE_CUSTOMER_MISSING: "STRIPE_CUSTOMER_MISSING",
  SUBSCRIPTION_MISSING: "SUBSCRIPTION_MISSING",
  SUBSCRIPTION_CUSTOMER_MISMATCH: "SUBSCRIPTION_CUSTOMER_MISMATCH",
  SUBSCRIPTION_CANCELED: "SUBSCRIPTION_CANCELED",
} as const;

interface AuditSummary {
  dealersAudited: number;
  healthy: number;
  findingsCreated: number;
  autoRepaired: number;
  resolved: number;
  errors: number;
}

interface BackfillSummary {
  invoicesScanned: number;
  repairedPaid: number;
  repairedClosed: number;
  errors: number;
}

@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Optional — mirrors PostpaidBillingService's injection style so cold
    // start / test containers without Stripe don't crash this module.
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
    // Same-module injection — the invoice handlers are public and idempotent.
    @Optional() @Inject(PostpaidBillingService)
    private readonly postpaidBilling?: PostpaidBillingService,
    // D3: ops digest email. Both optional so tests / SMTP-less envs work —
    // without BILLING_OPS_EMAIL or SMTP the digest simply logs and skips.
    @Optional() @Inject(MailService)
    private readonly mailService?: MailService,
    @Optional() @Inject(ConfigService)
    private readonly configService?: ConfigService,
  ) {}

  // ── C1 + C2: nightly audit + safe auto-repair ────────────────────

  async runNightlyReconciliation(): Promise<AuditSummary> {
    const summary: AuditSummary = {
      dealersAudited: 0,
      healthy: 0,
      findingsCreated: 0,
      autoRepaired: 0,
      resolved: 0,
      errors: 0,
    };

    if (!this.stripeService) {
      this.logger.warn("Reconciliation skipped — StripeService unavailable");
      return summary;
    }

    const dealers = await this.prisma.customer.findMany({
      where: { postpaidEnabled: true, billingMode: "WEEKLY_POSTPAID" },
      select: {
        id: true,
        businessName: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeDefaultPaymentMethodId: true,
      },
      take: AUDIT_BATCH_LIMIT,
    });

    for (const dealer of dealers) {
      try {
        const passedChecks = await this.auditDealer(dealer, summary);
        // Anything the dealer passed this run resolves prior open findings
        // for that same check (the issue fixed itself or was repaired).
        if (passedChecks.length > 0) {
          const res = await this.prisma.billingAuditFinding.updateMany({
            where: {
              customerId: dealer.id,
              check: { in: passedChecks },
              resolvedAt: null,
            },
            data: { resolvedAt: new Date() },
          });
          summary.resolved += res.count;
        }
        summary.dealersAudited++;
      } catch (err: any) {
        summary.errors++;
        this.logger.error(
          `Reconciliation error for dealer ${dealer.id} (${dealer.businessName ?? "?"}): ${err?.message}`,
        );
      }
    }

    // Retention: findings older than the window are history — purge them so
    // the table stays small. Unresolved old findings are purged too: if an
    // issue persisted this long, the CURRENT run re-created it if still real.
    const cutoff = new Date(Date.now() - FINDING_RETENTION_DAYS * 24 * 3600 * 1000);
    await this.prisma.billingAuditFinding.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `Billing reconciliation: ${summary.dealersAudited} dealer(s) audited — ` +
        `${summary.healthy} healthy, ${summary.findingsCreated} finding(s) recorded, ` +
        `${summary.autoRepaired} auto-repaired, ${summary.resolved} resolved, ${summary.errors} error(s)`,
    );
    return summary;
  }

  /**
   * Audit one dealer. Returns the list of checks that PASSED (so the caller
   * can resolve stale findings for them). Appends findings via recordFinding
   * (deduped) and performs safe auto-repairs inline.
   */
  private async auditDealer(
    dealer: {
      id: string;
      businessName: string | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripeDefaultPaymentMethodId: string | null;
    },
    summary: AuditSummary,
  ): Promise<string[]> {
    const passed: string[] = [];
    const label = `${dealer.businessName ?? dealer.id}`;

    // ── Check: Stripe customer exists ──
    if (!dealer.stripeCustomerId) {
      await this.recordFinding(dealer.id, CHECK.STRIPE_CUSTOMER_MISSING, SEV_CRITICAL,
        `${label} has postpaid billing but no Stripe customer id in our DB — billing was never onboarded or the row was cleared.`,
        "cus_…", null);
      return passed; // nothing else is checkable without the customer
    }

    let stripeCustomer: any;
    try {
      stripeCustomer = await this.stripeService!.stripe.customers.retrieve(dealer.stripeCustomerId);
    } catch (err: any) {
      await this.recordFinding(dealer.id, CHECK.STRIPE_CUSTOMER_MISSING, SEV_CRITICAL,
        `Stripe customer ${dealer.stripeCustomerId} could not be retrieved (${err?.message ?? "unknown"}) — it may have been deleted in the Stripe dashboard.`,
        "cus_…", dealer.stripeCustomerId);
      return passed;
    }

    // ── Check: subscription exists, belongs to THIS customer, not canceled ──
    if (!dealer.stripeSubscriptionId) {
      await this.recordFinding(dealer.id, CHECK.SUBSCRIPTION_MISSING, SEV_WARNING,
        `${label} is on weekly postpaid but has no anchor subscription — weekly invoices will never be generated. Re-run the postpaid setup.`,
        "sub_…", null);
    } else {
      try {
        const sub: any = await this.stripeService!.stripe.subscriptions.retrieve(dealer.stripeSubscriptionId);
        if (sub.customer !== dealer.stripeCustomerId) {
          // The Farragut-class bug: card/default is fine on one customer,
          // but the subscription invoices ANOTHER one. No auto-repair —
          // re-pointing or recreating a subscription is a deliberate
          // admin action (D2 button / runbook).
          await this.recordFinding(dealer.id, CHECK.SUBSCRIPTION_CUSTOMER_MISMATCH, SEV_CRITICAL,
            `${label}'s anchor subscription bills Stripe customer ${sub.customer}, but our DB points at ${dealer.stripeCustomerId}. Cards saved/defaulted on our customer never reach the invoices. Fix: re-point the subscription or re-create it on the current customer.`,
            dealer.stripeCustomerId, sub.customer);
        } else {
          passed.push(CHECK.SUBSCRIPTION_CUSTOMER_MISMATCH);
          if (sub.status === "canceled") {
            await this.recordFinding(dealer.id, CHECK.SUBSCRIPTION_CANCELED, SEV_CRITICAL,
              `${label}'s anchor subscription is CANCELED — no further weekly invoices will be generated. Re-run the postpaid setup to restore billing.`,
              "active/trialing/past_due", "canceled");
          } else {
            passed.push(CHECK.SUBSCRIPTION_CANCELED);
          }
        }
      } catch (err: any) {
        await this.recordFinding(dealer.id, CHECK.SUBSCRIPTION_MISSING, SEV_CRITICAL,
          `Anchor subscription ${dealer.stripeSubscriptionId} could not be retrieved (${err?.message ?? "unknown"}) — it may have been deleted. Re-run the postpaid setup.`,
          "sub_…", dealer.stripeSubscriptionId);
      }
    }

    // ── Check: default payment method (DB vs Stripe's invoice_settings) ──
    const rawStripeDefault = stripeCustomer.invoice_settings?.default_payment_method;
    const stripeDefault = typeof rawStripeDefault === "string" ? rawStripeDefault : rawStripeDefault?.id ?? null;
    const dbPm = dealer.stripeDefaultPaymentMethodId;

    if (!stripeDefault && !dbPm) {
      // Expected for not-yet-onboarded dealers (the CARD_REQUIRED gate stops
      // them from creating deliveries) — a WARNING so it stays visible in
      // Billing Health without paging anyone.
      await this.recordFinding(dealer.id, CHECK.NO_SAVED_CARD, SEV_WARNING,
        `${label} has no saved card on the Stripe customer (and none in our DB). Deliveries are blocked by the CARD_REQUIRED gate until one is saved.`,
        null, null);
    } else if (!stripeDefault && dbPm) {
      // DB says a card, Stripe says nothing → the Farragut drift. If our card
      // is still attached to this customer, re-setting the default is exactly
      // what the card-save webhook would do — safe to automate (AUTO-REPAIR).
      const attachedTo = await this.pmAttachedCustomer(dbPm).catch(() => null);
      if (attachedTo === dealer.stripeCustomerId) {
        try {
          await this.stripeService!.stripe.customers.update(dealer.stripeCustomerId, {
            invoice_settings: { default_payment_method: dbPm },
          });
          summary.autoRepaired++;
          await this.recordFinding(dealer.id, CHECK.DEFAULT_PM_DRIFT, SEV_AUTO_REPAIRED,
            `Stripe customer ${dealer.stripeCustomerId} had NO default_payment_method while our DB had ${dbPm} — re-set automatically (same write the card-save webhook makes).`,
            dbPm, null, new Date());
          this.logger.warn(
            `Auto-repaired DEFAULT_PM_DRIFT for dealer ${dealer.id}: Stripe default re-set to ${dbPm}`,
          );
        } catch (err: any) {
          await this.recordFinding(dealer.id, CHECK.DEFAULT_PM_DRIFT, SEV_CRITICAL,
            `Auto-repair FAILED: could not re-set the Stripe default for ${dealer.stripeCustomerId} (${err?.message ?? "unknown"}). Set it manually in the Stripe dashboard.`,
            dbPm, null);
        }
      } else {
        await this.recordFinding(dealer.id, CHECK.PM_NOT_ATTACHED, SEV_CRITICAL,
          `Card ${dbPm} in our DB is not attached to the dealer's Stripe customer ${dealer.stripeCustomerId} (attached to ${attachedTo ?? "nothing"}). The dealer must re-save their card.`,
          dealer.stripeCustomerId, attachedTo);
      }
    } else if (stripeDefault && stripeDefault !== dbPm) {
      // Stripe's default is the charging truth — align our mirror to it.
      // Covers "card replaced via dashboard" and the reverse-drift case.
      await this.prisma.customer.update({
        where: { id: dealer.id },
        data: { stripeDefaultPaymentMethodId: stripeDefault },
      });
      summary.autoRepaired++;
      await this.recordFinding(dealer.id, CHECK.DEFAULT_PM_DRIFT, SEV_AUTO_REPAIRED,
        `Our DB default (${dbPm ?? "null"}) differed from Stripe's (${stripeDefault}) — DB aligned to Stripe (the field invoices actually charge).`,
        stripeDefault, dbPm, new Date());
    } else {
      passed.push(CHECK.DEFAULT_PM_DRIFT, CHECK.PM_NOT_ATTACHED, CHECK.NO_SAVED_CARD);
      summary.healthy++;
    }

    return passed;
  }

  /** Which customer a PaymentMethod is attached to (null if detached/unknown). */
  private async pmAttachedCustomer(pmId: string): Promise<string | null> {
    try {
      const pm: any = await this.stripeService!.stripe.paymentMethods.retrieve(pmId);
      return typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Deduped finding writer: one open finding per (customer, check). If the
   * same issue is still open with the same values, don't spam a new row; if
   * the values changed, resolve the old one and record the new state.
   */
  private async recordFinding(
    customerId: string,
    check: string,
    severity: string,
    detail: string,
    expectedValue: string | null,
    actualValue: string | null,
    repairedAt?: Date,
  ): Promise<void> {
    const open = await this.prisma.billingAuditFinding.findFirst({
      where: { customerId, check, resolvedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (open && open.expectedValue === expectedValue && open.actualValue === actualValue) {
      // Same issue, still open — refresh severity/detail in place only if
      // it got WORSE (WARNING → CRITICAL) or became repaired.
      if (severity !== open.severity || repairedAt) {
        await this.prisma.billingAuditFinding.update({
          where: { id: open.id },
          data: { severity, detail, repairedAt: repairedAt ?? open.repairedAt },
        });
      }
      return;
    }

    if (open) {
      // Issue changed shape — close the old record so history stays accurate.
      await this.prisma.billingAuditFinding.update({
        where: { id: open.id },
        data: { resolvedAt: new Date() },
      });
    }

    await this.prisma.billingAuditFinding.create({
      data: { customerId, check, severity, detail, expectedValue, actualValue, repairedAt: repairedAt ?? null },
    });
  }

  // ── C4: invoice-state backfill (missed-webhook recovery) ─────────

  /**
   * Re-runs the idempotent invoice.* webhook handlers for recent invoices
   * whose DB rows look stale — the recovery path for a webhook that never
   * arrived (endpoint down, event unticked, network). Covers the money-
   * critical states: paid-but-rows-stale and closed-but-rows-open.
   */
  async runInvoiceStateBackfill(): Promise<BackfillSummary> {
    const summary: BackfillSummary = { invoicesScanned: 0, repairedPaid: 0, repairedClosed: 0, errors: 0 };

    if (!this.stripeService) {
      this.logger.warn("Invoice backfill skipped — StripeService unavailable");
      return summary;
    }

    const sinceSeconds = Math.floor(Date.now() / 1000) - BACKFILL_WINDOW_HOURS * 3600;
    const invoices = await this.stripeService.stripe.invoices.list({
      created: { gte: sinceSeconds },
      limit: 100,
    });

    for (const inv of invoices.data) {
      summary.invoicesScanned++;
      try {
        // Schema-proof extraction (dahlia lives the id at
        // parent.invoice_item_details.invoice_item — the legacy flat field
        // is always undefined on our pinned API version).
        const itemIds = this.postpaidBilling
          ? this.postpaidBilling.extractInvoiceItemIds(inv)
          : [];
        if (itemIds.length === 0) continue; // $0 anchor-only invoice — nothing to sync

        if (inv.status === "paid") {
          // Stale = any row for this invoice's items that isn't PAID yet.
          const stale = await this.prisma.payment.findFirst({
            where: {
              stripeInvoiceItemId: { in: itemIds },
              status: { not: "PAID" },
            },
            select: { id: true },
          });
          if (stale) {
            await this.postpaidBilling!.handleInvoicePaymentSucceeded(inv.id);
            summary.repairedPaid++;
            this.logger.warn(
              `Backfill: re-ran payment_succeeded for invoice ${inv.id} — DB rows were stale (missed webhook?)`,
            );
          }
        } else if (inv.status === "void" || inv.status === "uncollectible") {
          // Closed invoice — re-run the matching write-off handler so rows
          // don't sit in CHARGE_FAILED forever (unfixable by retry).
          const rows = await this.prisma.payment.findFirst({
            where: { stripeInvoiceItemId: { in: itemIds } },
            select: { id: true },
          });
          if (rows) {
            if (inv.status === "void") {
              await this.postpaidBilling!.handleInvoiceVoided(inv.id);
            } else {
              await this.postpaidBilling!.handleInvoiceMarkedUncollectible(inv.id);
            }
            summary.repairedClosed++;
            this.logger.warn(
              `Backfill: re-ran ${inv.status} handler for invoice ${inv.id} (missed webhook?)`,
            );
          }
        }
      } catch (err: any) {
        summary.errors++;
        this.logger.error(`Backfill error for invoice ${inv.id}: ${err?.message}`);
      }
    }

    this.logger.log(
      `Invoice state backfill: ${summary.invoicesScanned} invoice(s) scanned — ` +
        `${summary.repairedPaid} paid-state repair(s), ${summary.repairedClosed} closed-state repair(s), ${summary.errors} error(s)`,
    );
    return summary;
  }

  // ── Stuck-usage reconciliation (dahlia webhook-bug heal) ─────────

  /**
   * Heal USAGE_REPORTED rows whose InvoiceItem was already swept into a
   * finalized invoice — the exact drift the dahlia line-schema webhook
   * bug left behind (extractInvoiceItemIds returning [] meant
   * payment_succeeded never marked any row PAID, while Stripe collected
   * the money normally).
   *
   * For each stuck row (status=USAGE_REPORTED, stripeInvoiceItemId set):
   *   • InvoiceItem still pending (invoice=null)     → leave; rides next invoice
   *   • swept into a PAID invoice                    → re-run the idempotent
   *     payment_succeeded handler → row(s) marked PAID + stamped
   *   • swept into a voided/uncollectible invoice    → re-run the matching
   *     write-off handler (row → VOIDED, excluded from outstanding)
   *   • swept into an open/draft invoice             → leave; charge in flight
   *
   * Idempotent, bounded by `limit` (oldest first). Runs nightly in the
   * billing reconciliation cron and on demand via the admin endpoint.
   */
  async reconcileStuckUsageReported(limit = 50): Promise<{
    checked: number;
    healedPaid: number;
    healedClosed: number;
    stillPending: number;
    errors: number;
  }> {
    const summary = {
      checked: 0,
      healedPaid: 0,
      healedClosed: 0,
      stillPending: 0,
      errors: 0,
    };
    if (!this.stripeService) {
      this.logger.warn("Stuck-usage reconciliation skipped — StripeService unavailable");
      return summary;
    }

    const stuck = await this.prisma.payment.findMany({
      where: {
        status: "USAGE_REPORTED",
        stripeInvoiceItemId: { not: null },
      },
      select: { id: true, stripeInvoiceItemId: true },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });

    for (const row of stuck) {
      summary.checked++;
      try {
        const item = (await this.stripeService.stripe.invoiceItems.retrieve(
          row.stripeInvoiceItemId!,
        )) as any;
        const invoiceId = item.invoice as string | null;
        if (!invoiceId) {
          // Still pending — will ride the next weekly invoice.
          summary.stillPending++;
          continue;
        }
        const invoice = await this.stripeService.stripe.invoices.retrieve(invoiceId);
        if (invoice.status === "paid") {
          if (!this.postpaidBilling) {
            summary.errors++;
            continue;
          }
          // Idempotent: re-marks every row on this invoice, stamps
          // stripeInvoiceId + paidAt, and auto-unfreezes a
          // CHARGE_FAILED-frozen dealer.
          await this.postpaidBilling.handleInvoicePaymentSucceeded(invoiceId);
          summary.healedPaid++;
          this.logger.warn(
            `Reconcile: re-ran payment_succeeded for invoice ${invoiceId} — item ${row.stripeInvoiceItemId} was swept but the webhook never marked it (dahlia bug heal)`,
          );
        } else if (invoice.status === "void") {
          await this.postpaidBilling?.handleInvoiceVoided(invoiceId);
          summary.healedClosed++;
        } else if (invoice.status === "uncollectible") {
          await this.postpaidBilling?.handleInvoiceMarkedUncollectible(invoiceId);
          summary.healedClosed++;
        } else {
          // open / draft — payment in flight, leave alone
          summary.stillPending++;
        }
      } catch (err: any) {
        // InvoiceItem deleted in Stripe, or fetch failed — count and move on.
        summary.errors++;
        this.logger.error(
          `Reconcile error for payment ${row.id} (item ${row.stripeInvoiceItemId}): ${err?.message}`,
        );
      }
    }

    if (summary.checked > 0) {
      this.logger.log(
        `Stuck-usage reconciliation: ${summary.checked} checked, ` +
          `${summary.healedPaid} healed→PAID, ${summary.healedClosed} healed→VOIDED, ` +
          `${summary.stillPending} still pending/in-flight, ${summary.errors} error(s)`,
      );
    }
    return summary;
  }

  // ── D3: daily ops digest email ───────────────────────────────────

  /**
   * One email a day that answers "is anything wrong with billing?" without
   * opening a dashboard. Goes to BILLING_OPS_EMAIL — silently skipped (with
   * a log line) when unset or when SMTP isn't configured. Nothing is sent
   * when everything is quiet, to avoid alarm fatigue.
   */
  async sendDailyOpsDigest(): Promise<{ sent: boolean; reason?: string }> {
    const opsEmail = this.configService?.get<string>("BILLING_OPS_EMAIL");
    if (!opsEmail) {
      this.logger.log("Ops digest skipped — BILLING_OPS_EMAIL not configured");
      return { sent: false, reason: "no recipient" };
    }

    const [frozen, openFindings, noCardDealers] = await Promise.all([
      this.prisma.customer.findMany({
        where: { billingFrozen: true },
        select: { businessName: true },
        orderBy: { billingFrozenAt: "asc" },
      }),
      this.prisma.billingAuditFinding.findMany({
        where: { resolvedAt: null, severity: { not: "AUTO_REPAIRED" } },
        select: {
          severity: true,
          check: true,
          detail: true,
          customer: { select: { businessName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.customer.findMany({
        where: {
          postpaidEnabled: true,
          billingMode: "WEEKLY_POSTPAID",
          stripeDefaultPaymentMethodId: null,
        },
        select: { businessName: true },
      }),
    ]);

    const critical = openFindings.filter((f) => f.severity === "CRITICAL");
    const warnings = openFindings.filter((f) => f.severity === "WARNING");

    const quiet =
      frozen.length === 0 &&
      critical.length === 0 &&
      warnings.length === 0 &&
      noCardDealers.length === 0;
    if (quiet) {
      this.logger.log("Ops digest: all quiet — no email sent");
      return { sent: false, reason: "quiet" };
    }

    const nameList = (rows: Array<{ businessName: string | null }>, max = 10) =>
      rows
        .slice(0, max)
        .map((r) => `  • ${r.businessName ?? "Unnamed dealer"}`)
        .join("\n") + (rows.length > max ? `\n  • …and ${rows.length - max} more` : "");

    const findingList = (rows: typeof critical) =>
      rows
        .slice(0, 15)
        .map(
          (f) =>
            `  • [${f.check}] ${f.customer?.businessName ?? "Unnamed dealer"} — ${f.detail}`,
        )
        .join("\n") + (rows.length > 15 ? `\n  • …and ${rows.length - 15} more` : "");

    const lines: string[] = [
      `Billing ops digest — ${new Date().toISOString().slice(0, 10)}`,
      "",
      `Frozen dealers (blocked from deliveries): ${frozen.length}`,
      ...(frozen.length > 0 ? [nameList(frozen)] : []),
      "",
      `CRITICAL reconciliation findings: ${critical.length}`,
      ...(critical.length > 0 ? [findingList(critical)] : []),
      "",
      `WARNING reconciliation findings: ${warnings.length}`,
      ...(warnings.length > 0 ? [findingList(warnings)] : []),
      "",
      `Postpaid dealers with no card on file: ${noCardDealers.length}`,
      ...(noCardDealers.length > 0 ? [nameList(noCardDealers)] : []),
      "",
      "Next steps: Admin → Billing Health (repair buttons + dealer list);",
      "dealers fix a missing/broken card themselves by re-saving it in the app.",
      "Runbook: docs/billing-runbook.md.",
    ];

    try {
      await this.mailService?.sendMail({
        to: opsEmail,
        subject:
          `[101 Drivers billing] ` +
          (frozen.length > 0 || critical.length > 0 ? "ATTENTION — " : "") +
          `${frozen.length} frozen · ${critical.length} critical · ${warnings.length} warning`,
        text: lines.join("\n"),
      });
      this.logger.log(`Ops digest email sent to ${opsEmail}`);
      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Ops digest email failed: ${err?.message}`);
      return { sent: false, reason: "send failed" };
    }
  }
}
