/**
 * send-invite-approval-emails.ts — bulk re-send of the system's OWN
 * invitation / approval emails, with a per-recipient success/failure report.
 *
 * ── Who gets what (mirrors the live flows exactly) ────────────────────────
 *   1. INVITED drivers   (Driver.status = INVITED)
 *        → the exact "You're invited to complete your driver application"
 *          email from DriverApprovalEngine.inviteDriver
 *          (templateCode "driver-invited"), using each driver's EXISTING
 *          onboarding token so any link they already have keeps working.
 *          If a driver somehow has no token, one is generated + persisted
 *          (same 32-byte hex the engine uses) and flagged in the report.
 *   2. APPROVED drivers  (Driver.status = APPROVED)
 *        → the exact "Your driver application has been approved" email from
 *          DriverApprovalEngine.approve (templateCode "driver-approved").
 *   3. APPROVED dealers/customers (Customer.approvalStatus = APPROVED)
 *        → the exact approval email from CustomerApprovalEngine.approve
 *          (templateCode "dealer-approved"): BUSINESS copy carries the
 *          referral-code line + COO signature; PRIVATE copy is the generic
 *          one. Subject differs by customerType, exactly like the engine.
 *
 * ── Delivery pipeline ─────────────────────────────────────────────────────
 *   Emails go through the REAL NotificationEventEngine.queueAndSend → the
 *   same NotificationEvent ledger, the same MailService SMTP transport,
 *   SENT/FAILED stamped on every row (full audit trail, searchable by
 *   templateCode + campaignId in payload).
 *
 * ── Report ────────────────────────────────────────────────────────────────
 *   After queueing, the script polls each NotificationEvent until SENT or
 *   FAILED (errorMessage captured), then writes:
 *     - console table
 *     - download/email-campaign-report-<timestamp>.json
 *     - download/email-campaign-report-<timestamp>.md
 *   Exit code 0 = every queued email SENT; 1 = any FAILED/timeout/abort.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   npx ts-node scripts/send-invite-approval-emails.ts --dry-run
 *   npx ts-node scripts/send-invite-approval-emails.ts --yes            # live
 *   Flags:
 *     --dry-run          list recipients + templates, send nothing
 *     --only=invited     only the invited-driver email
 *     --only=approved    only the approved (driver + dealer) emails
 *     --limit=N          cap recipients (smoke test on the server first)
 *     --yes              skip the interactive confirmation (live runs)
 *     --wait=180         seconds to wait for SMTP results (default 180)
 *
 * Safety: if SMTP is not configured the script ABORTS BEFORE queueing
 * (nothing is written to the NotificationEvent ledger) and the report says
 * so — no guaranteed-failure rows, no misleading output.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import {
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  EnumNotificationEventStatus,
  Prisma,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { MailService } from "../src/common/mail/mail.service";
import { NotificationEventEngine } from "../src/domain/notificationEvent/notificationEvent.engine";

// ── env: shell first, then backend/.env, then repo root .env ──────────────
dotenv.config(); // process.cwd()/.env  (run from backend/)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

// ── CLI flags ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? "true" : hit.slice(eq + 1);
};
const DRY_RUN = flag("dry-run") === "true";
const ONLY = flag("only") as "invited" | "approved" | undefined;
const LIMIT = Number(flag("limit") ?? 0) || 0;
const ASSUME_YES = flag("yes") === "true";
const WAIT_SECONDS = Number(flag("wait") ?? 180) || 180;

const SEND_INVITED = ONLY !== "approved"; // default: both
const SEND_APPROVED = ONLY !== "invited";

// Reports land next to where you run the script (backend/email-campaign-reports/)
// unless CAMPAIGN_REPORT_DIR overrides it.
const REPORT_DIR =
  process.env.CAMPAIGN_REPORT_DIR ||
  path.join(process.cwd(), "email-campaign-reports");

type Category =
  | "INVITED_DRIVER"
  | "APPROVED_DRIVER"
  | "APPROVED_DEALER_BUSINESS"
  | "APPROVED_DEALER_PRIVATE";

type Recipient = {
  category: Category;
  refId: string; // driverId or customerId
  name: string;
  email: string | null;
  suspended: boolean;
  tokenRegenerated: boolean;
};

type ResultRow = Recipient & {
  status:
    | "SKIPPED_NO_EMAIL"
    | "SKIPPED_DUPLICATE"
    | "NOT_QUEUED_SMTP_UNCONFIGURED"
    | "QUEUED"
    | "SENT"
    | "FAILED"
    | "TIMEOUT_STILL_QUEUED";
  notificationEventId: string | null;
  errorMessage: string | null;
  crossRoleDuplicate: boolean;
};

// ── Templates: verbatim copies of the system's own emails ─────────────────
const appDomain = (process.env.APP_DOMAIN || "101drivers.techbee.et").replace(
  /^https?:\/\//,
  ""
);

/** DriverApprovalEngine.inviteDriver — templateCode "driver-invited" */
function buildInvitedDriverEmail(fullName: string, onboardingToken: string) {
  return {
    type: EnumNotificationEventType.DRIVER_APPROVED, // same type the engine uses for invites
    templateCode: "driver-invited",
    subject: "You\u2019re invited to complete your driver application \u2014 101 Drivers",
    body: [
      `Hi ${fullName},`,
      "",
      "Good news! You\u2019ve been selected to move forward with your driver application.",
      "Please complete your application by visiting the link below:",
      "",
      `https://${appDomain}/driver-onboarding-complete?token=${onboardingToken}`,
      "",
      "You will need to provide the following:",
      "",
      "\u2022  Driver\u2019s license (front and back photos)",
      "\u2022  Social Security Number",
      "\u2022  Current residential address",
      "\u2022  Selfie photo for identity verification",
      "",
      "Once we receive your complete application, we\u2019ll review it and get back to you.",
    ].join("\n"),
  };
}

/** DriverApprovalEngine.approve — templateCode "driver-approved" */
function buildApprovedDriverEmail(fullName: string, approvedAt: Date | null) {
  return {
    type: EnumNotificationEventType.DRIVER_APPROVED,
    templateCode: "driver-approved",
    subject: "Your driver application has been approved \u2014 101 Drivers",
    body: [
      `Hi ${fullName},`,
      "",
      "Great news! Your driver application has been approved.",
      "You now have access to the 101 Drivers platform.",
      "Log in to your account to start viewing available deliveries:",
      "",
      `https://${appDomain}/driver-signin`,
      "",
      approvedAt ? `Approved at: ${approvedAt.toISOString()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** CustomerApprovalEngine.approve — templateCode "dealer-approved" */
function buildApprovedDealerEmail(customer: {
  customerType: string | null;
  businessName: string | null;
  contactName: string | null;
  userFullName: string | null;
  postpaidEnabled: boolean;
}) {
  const isBusiness = customer.customerType === "BUSINESS";
  const displayName =
    customer.businessName || customer.contactName || customer.userFullName || "Customer";
  const subject = isBusiness
    ? "Your business account has been approved"
    : "Your customer account has been approved";
  const approvalLine = isBusiness
    ? "Your business account has been approved."
    : "Your customer account has been approved.";
  const loginLine = isBusiness
    ? "You can now log in and start creating delivery requests."
    : "You can now log in and continue using your account.";
  const postpaidLine = customer.postpaidEnabled
    ? "Postpaid billing has been enabled for your account."
    : "";

  const body = isBusiness
    ? [
        `Hi ${displayName},`,
        "",
        approvalLine,
        "",
        `${loginLine} ${
          customer.postpaidEnabled
            ? "Postpaid billing has been enabled for your account."
            : "All deliveries are prepaid. If you\u2019d like to negotiate a postpaid plan, just contact us."
        }`,
        "",
        "You also have your own referral code, which you can customize.",
        "",
        "Welcome aboard.",
        "",
        "Best, Maz Siam",
        "COO, 101 Drivers Inc.",
        "Cell 3107293250",
        "Whatsup 4243132168",
        "maz@101drivers.com",
      ].join("\n")
    : [
        `Hi ${displayName},`,
        "",
        approvalLine,
        postpaidLine,
        loginLine,
      ]
        .filter(Boolean)
        .join("\n");

  return { type: EnumNotificationEventType.DEALER_APPROVED, templateCode: "dealer-approved", subject, body };
}

async function main() {
  console.log("=== 101 Drivers — invite / approval email campaign ===");
  console.log(`mode: ${DRY_RUN ? "DRY-RUN (no emails sent)" : "LIVE"}`);

  // ── SMTP pre-check: abort before touching the ledger if mail can't go ──
  const mail = new MailService(new ConfigService());
  if (!mail.isConfigured && !DRY_RUN) {
    console.error(
      "\nABORT: SMTP is not configured in this environment " +
        "(SMTP_HOST / SMTP_USER / SMTP_PASS missing).\n" +
        "Nothing was queued. Run this script on the server where SMTP is set " +
        "(or export the SMTP_* vars first)."
    );
    writeReport([], [], {
      smtpConfigured: false,
      aborted: "SMTP_NOT_CONFIGURED",
      dryRun: false,
    });
    process.exit(1);
  }

  const prisma = new PrismaService();
  const engine = new NotificationEventEngine(prisma, mail);

  // ── Collect recipients ──────────────────────────────────────────────────
  const recipients: Recipient[] = [];

  if (SEND_INVITED) {
    const invited = await prisma.driver.findMany({
      where: { status: "INVITED" },
      select: {
        id: true,
        onboardingToken: true,
        user: { select: { email: true, fullName: true } },
      },
    });
    for (const d of invited) {
      let tokenRegenerated = false;
      if (!DRY_RUN && !d.onboardingToken && d.user?.email) {
        // INVITED drivers always get a token at invite time; regenerate only if missing.
        const token = randomBytes(32).toString("hex");
        await prisma.driver.update({
          where: { id: d.id },
          data: { onboardingToken: token },
        });
        (d as any).onboardingToken = token;
        tokenRegenerated = true;
      }
      recipients.push({
        category: "INVITED_DRIVER",
        refId: d.id,
        name: d.user?.fullName || "Driver",
        email: d.user?.email?.trim().toLowerCase() || null,
        suspended: false,
        tokenRegenerated,
      });
      (recipients[recipients.length - 1] as any).onboardingToken = d.onboardingToken;
    }
  }

  if (SEND_APPROVED) {
    const approvedDrivers = await prisma.driver.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        approvedAt: true,
        user: { select: { email: true, fullName: true } },
      },
    });
    for (const d of approvedDrivers) {
      recipients.push({
        category: "APPROVED_DRIVER",
        refId: d.id,
        name: d.user?.fullName || "Driver",
        email: d.user?.email?.trim().toLowerCase() || null,
        suspended: false,
        tokenRegenerated: false,
      });
      (recipients[recipients.length - 1] as any).approvedAt = d.approvedAt;
    }

    const approvedDealers = await prisma.customer.findMany({
      where: { approvalStatus: "APPROVED" },
      select: {
        id: true,
        customerType: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        postpaidEnabled: true,
        suspendedAt: true,
        user: { select: { email: true, fullName: true } },
      },
    });
    for (const c of approvedDealers) {
      recipients.push({
        category:
          c.customerType === "BUSINESS"
            ? "APPROVED_DEALER_BUSINESS"
            : "APPROVED_DEALER_PRIVATE",
        refId: c.id,
        name: c.businessName || c.contactName || c.user?.fullName || "Customer",
        email:
          c.contactEmail?.trim().toLowerCase() ||
          c.user?.email?.trim().toLowerCase() ||
          null,
        suspended: c.suspendedAt != null,
        tokenRegenerated: false,
      });
      const r = recipients[recipients.length - 1] as any;
      r.customerType = c.customerType;
      r.postpaidEnabled = c.postpaidEnabled;
      r.businessName = c.businessName;
      r.contactName = c.contactName;
      r.userFullName = c.user?.fullName ?? null;
    }
  }

  let scoped = recipients;
  if (LIMIT > 0) scoped = recipients.slice(0, LIMIT);

  // ── Scope summary ───────────────────────────────────────────────────────
  const countBy = (fn: (r: Recipient) => boolean) => scoped.filter(fn).length;
  console.log("\n── recipients in scope ──");
  console.log(`  invited drivers            : ${countBy((r) => r.category === "INVITED_DRIVER")}`);
  console.log(`  approved drivers           : ${countBy((r) => r.category === "APPROVED_DRIVER")}`);
  console.log(`  approved dealers (BUSINESS): ${countBy((r) => r.category === "APPROVED_DEALER_BUSINESS")}`);
  console.log(`  approved dealers (PRIVATE) : ${countBy((r) => r.category === "APPROVED_DEALER_PRIVATE")}`);
  console.log(`  (suspended-but-approved    : ${countBy((r) => r.suspended)} — still included, flagged)`);
  console.log(`  total                      : ${scoped.length}\n`);

  if (DRY_RUN) {
    for (const r of scoped) {
      console.log(
        `  [${r.category}] ${r.name} <${r.email ?? "NO EMAIL"}>` +
          (r.suspended ? "  (suspended)" : "") +
          (r.tokenRegenerated ? "  (token regenerated)" : "")
      );
    }
    writeReport(scoped, [], { smtpConfigured: mail.isConfigured, aborted: null, dryRun: true });
    await prisma.$disconnect();
    return;
  }

  // ── Live confirmation ───────────────────────────────────────────────────
  if (!ASSUME_YES && process.stdin.isTTY) {
    const ok = await new Promise<boolean>((resolve) => {
      process.stdout.write(`Type SEND to email ${scoped.length} recipients: `);
      process.stdin.once("data", (d) => resolve(String(d).trim() === "SEND"));
    });
    if (!ok) {
      console.log("Aborted by operator. Nothing sent.");
      await prisma.$disconnect();
      process.exit(1);
    }
  } else if (!ASSUME_YES) {
    console.error("Refusing a live run without --yes (or interactive confirmation).");
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Queue emails (dedup per category; stagger to be gentle on SMTP) ─────
  const results: ResultRow[] = [];
  const seen = new Map<string, Category>(); // email -> first category that claims it
  const queuedIds: string[] = [];

  for (const r of scoped) {
    if (!r.email) {
      results.push({ ...r, status: "SKIPPED_NO_EMAIL", notificationEventId: null, errorMessage: null, crossRoleDuplicate: false });
      continue;
    }
    const firstClaim = seen.get(r.email);
    if (firstClaim === r.category) {
      results.push({ ...r, status: "SKIPPED_DUPLICATE", notificationEventId: null, errorMessage: `duplicate ${r.category} for ${r.email}`, crossRoleDuplicate: false });
      continue;
    }
    const crossRoleDuplicate = firstClaim !== undefined && firstClaim !== r.category;
    if (!crossRoleDuplicate) seen.set(r.email, r.category);

    try {
      let queued: { id: string } | null = null;
      if (r.category === "INVITED_DRIVER") {
        const tpl = buildInvitedDriverEmail(r.name, (r as any).onboardingToken ?? "");
        queued = await engine.queueAndSend({
          driverId: r.refId,
          channel: EnumNotificationEventChannel.EMAIL,
          toEmail: r.email,
          ...tpl,
          payload: {
            campaignId: CAMPAIGN_ID,
            driverId: r.refId,
            note: "Bulk invite re-send (campaign script)",
          } as Prisma.InputJsonValue,
        });
      } else if (r.category === "APPROVED_DRIVER") {
        const tpl = buildApprovedDriverEmail(r.name, (r as any).approvedAt ?? null);
        queued = await engine.queueAndSend({
          driverId: r.refId,
          channel: EnumNotificationEventChannel.EMAIL,
          toEmail: r.email,
          ...tpl,
          payload: {
            campaignId: CAMPAIGN_ID,
            driverId: r.refId,
            note: "Bulk approval re-send (campaign script)",
          } as Prisma.InputJsonValue,
        });
      } else {
        const tpl = buildApprovedDealerEmail({
          customerType: (r as any).customerType ?? null,
          businessName: (r as any).businessName ?? null,
          contactName: (r as any).contactName ?? null,
          userFullName: (r as any).userFullName ?? null,
          postpaidEnabled: (r as any).postpaidEnabled ?? false,
        });
        queued = await engine.queueAndSend({
          customerId: r.refId,
          channel: EnumNotificationEventChannel.EMAIL,
          toEmail: r.email,
          ...tpl,
          payload: {
            campaignId: CAMPAIGN_ID,
            customerId: r.refId,
            note: "Bulk approval re-send (campaign script)",
          } as Prisma.InputJsonValue,
        });
      }

      if (!queued) {
        // queueAndSend returns null only when cross-role suppression fired (not expected here)
        results.push({ ...r, status: "FAILED", notificationEventId: null, errorMessage: "suppressed by cross-role guard", crossRoleDuplicate });
        continue;
      }
      queuedIds.push(queued.id);
      results.push({ ...r, status: "QUEUED", notificationEventId: queued.id, errorMessage: null, crossRoleDuplicate });
      console.log(`  queued [${r.category}] ${r.email} → event ${queued.id}`);
    } catch (e: any) {
      results.push({ ...r, status: "FAILED", notificationEventId: null, errorMessage: e?.message ?? String(e), crossRoleDuplicate });
    }
    await new Promise((res) => setTimeout(res, 700)); // stagger SMTP load
  }

  // ── Poll until every queued event settles (SENT / FAILED) ───────────────
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  const pending = () => results.filter((x) => x.status === "QUEUED");
  while (pending().length > 0 && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 2000));
    for (const row of pending()) {
      const ev = await prisma.notificationEvent.findUnique({
        where: { id: row.notificationEventId! },
        select: { status: true, errorMessage: true },
      });
      if (!ev) continue;
      if (ev.status === EnumNotificationEventStatus.SENT) row.status = "SENT";
      if (ev.status === EnumNotificationEventStatus.FAILED) {
        row.status = "FAILED";
        row.errorMessage = ev.errorMessage ?? "unknown SMTP error";
      }
    }
  }
  for (const row of pending()) row.status = "TIMEOUT_STILL_QUEUED";

  // ── Report ──────────────────────────────────────────────────────────────
  const summary = {
    totalInScope: scoped.length,
    sent: results.filter((r) => r.status === "SENT").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    timedOut: results.filter((r) => r.status === "TIMEOUT_STILL_QUEUED").length,
    skippedNoEmail: results.filter((r) => r.status === "SKIPPED_NO_EMAIL").length,
    skippedDuplicate: results.filter((r) => r.status === "SKIPPED_DUPLICATE").length,
  };
  console.log("\n── campaign result ──");
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(18)}: ${v}`);
  console.log("\n  per-recipient:");
  for (const r of results) {
    console.log(
      `  [${r.status.padEnd(20)}] ${r.category.padEnd(26)} ${r.email ?? "NO EMAIL"}` +
        (r.errorMessage ? `  — ${r.errorMessage}` : "")
    );
  }

  writeReport(scoped, results, {
    smtpConfigured: mail.isConfigured,
    aborted: null,
    dryRun: false,
    summary,
    campaignId: CAMPAIGN_ID,
  });

  await prisma.$disconnect();
  process.exit(summary.failed > 0 || summary.timedOut > 0 ? 1 : 0);
}

const CAMPAIGN_ID = `campaign-${new Date().toISOString().replace(/[:.]/g, "-")}`;

function writeReport(
  scoped: Recipient[],
  results: ResultRow[],
  extra: Record<string, unknown>
) {
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(REPORT_DIR, `email-campaign-report-${stamp}.json`);
    const mdPath = path.join(REPORT_DIR, `email-campaign-report-${stamp}.md`);

    const payload = {
      generatedAt: new Date().toISOString(),
      campaignId: (extra.campaignId as string) ?? CAMPAIGN_ID,
      mode: extra.dryRun ? "DRY_RUN" : "LIVE",
      smtpConfigured: extra.smtpConfigured,
      aborted: extra.aborted,
      summary: extra.summary ?? { totalInScope: scoped.length },
      results,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

    const lines: string[] = [
      `# Email campaign report — ${payload.generatedAt}`,
      "",
      `- Mode: **${payload.mode}**  ·  SMTP configured: **${payload.smtpConfigured}**`,
      extra.aborted ? `- **ABORTED: ${extra.aborted}** — nothing was queued.` : "",
      "",
      `| Status | Category | Recipient | Detail |`,
      `|---|---|---|---|`,
      ...(results.length
        ? results.map(
            (r) =>
              `| ${r.status} | ${r.category} | ${r.email ?? "NO EMAIL"} | ${
                r.errorMessage ?? r.notificationEventId ?? ""
              } |`
          )
        : scoped.map(
            (r) =>
              `| IN_SCOPE | ${r.category} | ${r.email ?? "NO EMAIL"} | ${
                r.suspended ? "suspended" : r.tokenRegenerated ? "token regenerated" : ""
              } |`
          )),
      "",
    ];
    fs.writeFileSync(mdPath, lines.filter((l) => l !== "").join("\n") + "\n");
    console.log(`\nreport saved:\n  ${jsonPath}\n  ${mdPath}`);
  } catch (e: any) {
    console.warn(`(report file write failed: ${e?.message})`);
  }
}

main().catch(async (e) => {
  console.error("Campaign crashed:", e?.stack || e?.message || e);
  process.exit(1);
});
