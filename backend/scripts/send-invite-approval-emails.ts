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
 *     --dry-run                        list recipients + templates, send nothing
 *     --only=invited                   only the invited-driver email
 *     --only=approved                  only the approved (driver + dealer) emails
 *     --limit=N                        cap recipients (smoke test on the server first)
 *     --yes                            skip the interactive confirmation (live runs)
 *     --wait=180                       seconds for the FINAL settle pass (default 180)
 *     --retry-failed-from=<report>     RESUME: skip everyone marked SENT in that
 *                                      earlier report JSON (no duplicate emails)
 *     --stagger-ms=700                 delay between two sends (default 700)
 *     --pause-on-rate-limit-minutes=60 auto-pause when the SMTP host answers
 *                                      421 "Too many messages ... last hour"
 *                                      (default 60; 0 = disable, fail fast)
 *     --max-pauses=24                  max auto-pauses per run (default 24; 0 = disable)
 *     --ack-seconds=60                 per-recipient wait for SENT/FAILED before
 *                                      moving on (default 60)
 *
 * ── Rate limits (421 4.4.5 "Too many messages from this host last hour") ──
 *   Shared/cPanel-style SMTP hosts cap messages per rolling hour (often ~20).
 *   When the host answers 421, the run STOPS DEAD (it never hammers a
 *   throttled server), prints a countdown while it waits the window out
 *   (default 60 min), then retries and continues with the rest. A campaign
 *   larger than the hourly cap therefore takes several hours BY DESIGN —
 *   run it under nohup/screen/pm2. Ctrl+C is safe at any moment: nothing
 *   already SENT is ever re-sent; resume later with
 *     npx ts-node scripts/send-invite-approval-emails.ts --yes \
 *       --retry-failed-from=email-campaign-reports/<latest-report>.json
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
// rate-limit resilience — see the "Rate limits" note in the header
const RETRY_FROM = flag("retry-failed-from");
const STAGGER_MS = Math.max(0, Number(flag("stagger-ms") ?? 700) || 0);
const PAUSE_MINUTES = Math.max(0, Number(flag("pause-on-rate-limit-minutes") ?? 60) || 0);
const MAX_PAUSES = Math.max(0, Number(flag("max-pauses") ?? 24) || 0);
const ACK_SECONDS = Math.max(10, Number(flag("ack-seconds") ?? 60) || 60);

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
  attempts: number; // send attempts for this recipient (1 = no retry happened)
};

// The provider's refusal looks like:
//   "Failed to send email: Invalid greeting. response=421 4.4.5 Too many
//    messages from this host last hour"
function isRateLimitError(msg: string | null | undefined): boolean {
  if (!msg) return false;
  return (
    /\b421\b/.test(msg) ||
    /4\.4\.5/.test(msg) ||
    /too many messages/i.test(msg) ||
    /rate.?limit/i.test(msg)
  );
}

/** Countdown that keeps the terminal alive during long (hourly) pauses. */
async function sleepWithProgress(ms: number, label: string): Promise<void> {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  for (;;) {
    const remainMin = Math.ceil(Math.max(0, end - Date.now()) / 60000);
    process.stdout.write(`\r${label} — about ${remainMin} min left…   `);
    if (Date.now() >= end) break;
    await new Promise((res) => setTimeout(res, Math.min(30_000, end - Date.now())));
  }
  process.stdout.write("\r" + " ".repeat(110) + "\r");
}

/**
 * Resume support: read a previous campaign report and collect the emails it
 * recorded as SENT — those must never be emailed twice.
 */
function loadPreviouslySent(reportPath: string): Set<string> {
  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (e: any) {
    console.error(
      `\nABORT: cannot read --retry-failed-from report "${reportPath}": ${e?.message}`
    );
    process.exit(1);
  }
  const rows = Array.isArray(raw?.results) ? raw.results : [];
  const sent = new Set<string>();
  for (const row of rows) {
    if (row?.status === "SENT" && typeof row?.email === "string") {
      sent.add(row.email.trim().toLowerCase());
    }
  }
  if (sent.size === 0) {
    console.warn(
      `\nWARNING: "${path.basename(reportPath)}" contains no SENT rows — ` +
        "proceeding as a FULL send (everyone in scope gets an email)."
    );
  }
  return sent;
}

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

  // ── Resume mode: never re-email anyone the previous report marked SENT ──
  let previouslySentExcluded = 0;
  if (RETRY_FROM) {
    const sentEmails = loadPreviouslySent(RETRY_FROM);
    const before = scoped.length;
    scoped = scoped.filter((r) => !r.email || !sentEmails.has(r.email));
    previouslySentExcluded = before - scoped.length;
    console.log(
      `\nresume: loaded "${path.basename(RETRY_FROM)}" — ` +
        `${sentEmails.size} email(s) already SENT there, ` +
        `${previouslySentExcluded} recipient(s) excluded from this run.`
    );
  }

  if (LIMIT > 0) scoped = scoped.slice(0, LIMIT);

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

  // ── Queue emails (dedup per category; one attempt in flight at a time; ──
  //    stops dead on 421 rate-limit, waits the hourly window out, resumes) ─
  const results: ResultRow[] = [];
  const seen = new Map<string, Category>(); // email -> first category that claims it

  type QueueItem = {
    r: Recipient;
    crossRoleDuplicate: boolean;
    row: ResultRow; // ONE report row per recipient, mutated across retries
  };
  const queue: QueueItem[] = [];

  for (const r of scoped) {
    if (!r.email) {
      results.push({ ...r, status: "SKIPPED_NO_EMAIL", notificationEventId: null, errorMessage: null, crossRoleDuplicate: false, attempts: 0 });
      continue;
    }
    const firstClaim = seen.get(r.email);
    if (firstClaim === r.category) {
      results.push({ ...r, status: "SKIPPED_DUPLICATE", notificationEventId: null, errorMessage: `duplicate ${r.category} for ${r.email}`, crossRoleDuplicate: false, attempts: 0 });
      continue;
    }
    const crossRoleDuplicate = firstClaim !== undefined && firstClaim !== r.category;
    if (!crossRoleDuplicate) seen.set(r.email, r.category);
    const item: QueueItem = {
      r,
      crossRoleDuplicate,
      row: { ...r, status: "QUEUED", notificationEventId: null, errorMessage: null, crossRoleDuplicate, attempts: 0 },
    };
    queue.push(item);
    results.push(item.row);
  }

  const pauseMs = PAUSE_MINUTES * 60_000;
  let pausesUsed = 0;

  const logRateLimitPause = (remaining: number) => {
    console.log(
      `\n  [rate-limit] SMTP host refused the send: "421 4.4.5 Too many messages from this host last hour".`
    );
    console.log(
      `  [rate-limit] pausing ${PAUSE_MINUTES} min so the hourly window can clear, then resuming ` +
        `(${remaining} recipient(s) still to go) — pause ${pausesUsed}/${MAX_PAUSES}.`
    );
    console.log(
      `  [rate-limit] Ctrl+C is safe anytime; nothing already SENT is re-sent — resume with --retry-failed-from=<report>.`
    );
  };

  // main pipeline
  let idx = 0;
  while (idx < queue.length) {
    const item = queue[idx];
    item.row.attempts++;
    item.row.status = "QUEUED";
    item.row.errorMessage = null;
    item.row.notificationEventId = null;

    const q = await queueOne(item.r, engine);
    if (!q.ok) {
      item.row.status = "FAILED";
      item.row.errorMessage = q.error;
      if (!q.suppressed && isRateLimitError(q.error) && pauseMs > 0 && pausesUsed < MAX_PAUSES) {
        pausesUsed++;
        logRateLimitPause(queue.length - idx);
        await sleepWithProgress(pauseMs, "  waiting out the hourly window");
        continue; // retry the SAME recipient without advancing
      }
      console.log(`  FAILED [${item.r.category}] ${item.r.email} — ${item.row.errorMessage}`);
      await new Promise((res) => setTimeout(res, STAGGER_MS));
      idx++;
      continue;
    }
    item.row.notificationEventId = q.id;
    console.log(`  queued [${item.r.category}] ${item.r.email} → event ${q.id} (attempt ${item.row.attempts})`);

    const ackedStatus = await ackOne(item.row, prisma, ACK_SECONDS);

    if (
      ackedStatus === "FAILED" &&
      isRateLimitError(item.row.errorMessage) &&
      pauseMs > 0 &&
      pausesUsed < MAX_PAUSES
    ) {
      pausesUsed++;
      logRateLimitPause(queue.length - idx);
      await sleepWithProgress(pauseMs, "  waiting out the hourly window");
      continue; // retry the SAME recipient without advancing
    }
    await new Promise((res) => setTimeout(res, STAGGER_MS));
    idx++;
  }

  // ── Final courtesy pass: give slow events one last chance to settle ─────
  const stillQueued = () => results.filter((x) => x.status === "QUEUED");
  if (stillQueued().length > 0) {
    console.log(`\n  final wait: ${stillQueued().length} event(s) still unsettled (up to ${WAIT_SECONDS}s)…`);
    const deadline = Date.now() + WAIT_SECONDS * 1000;
    while (stillQueued().length > 0 && Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 2000));
      for (const row of stillQueued()) {
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
  }
  for (const row of stillQueued()) row.status = "TIMEOUT_STILL_QUEUED";

  // ── Report ──────────────────────────────────────────────────────────────
  const summary = {
    totalInScope: scoped.length,
    previouslySentExcluded,
    sent: results.filter((r) => r.status === "SENT").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    timedOut: results.filter((r) => r.status === "TIMEOUT_STILL_QUEUED").length,
    skippedNoEmail: results.filter((r) => r.status === "SKIPPED_NO_EMAIL").length,
    skippedDuplicate: results.filter((r) => r.status === "SKIPPED_DUPLICATE").length,
    rateLimitPauses: pausesUsed,
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

  const remainingRateLimited = results.filter(
    (r) => r.status === "FAILED" && isRateLimitError(r.errorMessage)
  ).length;

  const reportPath = writeReport(scoped, results, {
    smtpConfigured: mail.isConfigured,
    aborted: null,
    dryRun: false,
    summary,
    campaignId: CAMPAIGN_ID,
    resumedFrom: RETRY_FROM ?? null,
    pausesUsed,
  });

  await prisma.$disconnect();

  if (remainingRateLimited > 0 && reportPath) {
    console.log(
      `\n  RATE-LIMITED: ${remainingRateLimited} recipient(s) were refused by the SMTP host ` +
        `(pause budget of ${MAX_PAUSES} exhausted or pausing disabled).`
    );
    console.log(
      `  Resume later WITHOUT re-emailing anyone who already got their message:\n` +
        `    npx ts-node scripts/send-invite-approval-emails.ts --yes --retry-failed-from=${reportPath}\n`
    );
  }

  process.exit(summary.failed > 0 || summary.timedOut > 0 ? 1 : 0);
}

const CAMPAIGN_ID = `campaign-${new Date().toISOString().replace(/[:.]/g, "-")}`;

/**
 * Queue ONE recipient through the real pipeline (NotificationEventEngine →
 * ledger row QUEUED → async SMTP deliver). Never throws — returns the ledger
 * id or an error string. The 421 refusal usually surfaces later, in ackOne,
 * via the ledger row's errorMessage.
 */
async function queueOne(
  r: Recipient,
  engine: NotificationEventEngine
): Promise<{ ok: true; id: string } | { ok: false; error: string; suppressed: boolean }> {
  try {
    let queued: { id: string } | null = null;
    if (r.category === "INVITED_DRIVER") {
      const tpl = buildInvitedDriverEmail(r.name, (r as any).onboardingToken ?? "");
      queued = await engine.queueAndSend({
        driverId: r.refId,
        channel: EnumNotificationEventChannel.EMAIL,
        toEmail: r.email!,
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
        toEmail: r.email!,
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
        toEmail: r.email!,
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
      return { ok: false, error: "suppressed by cross-role guard", suppressed: true };
    }
    return { ok: true, id: queued.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e), suppressed: false };
  }
}

/**
 * Wait for THIS recipient's ledger row to settle (SENT / FAILED), mutating
 * the report row in place. Returns the resulting status (also kept in
 * row.status). On ack timeout the row stays QUEUED — the final courtesy pass
 * re-checks it before the report is written.
 */
async function ackOne(
  row: ResultRow,
  prisma: PrismaService,
  ackSeconds: number
): Promise<ResultRow["status"]> {
  const deadline = Date.now() + ackSeconds * 1000;
  while (row.status === "QUEUED" && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 2000));
    const ev = await prisma.notificationEvent.findUnique({
      where: { id: row.notificationEventId! },
      select: { status: true, errorMessage: true },
    });
    if (!ev) continue;
    if (ev.status === EnumNotificationEventStatus.SENT) {
      row.status = "SENT";
    } else if (ev.status === EnumNotificationEventStatus.FAILED) {
      row.status = "FAILED";
      row.errorMessage = ev.errorMessage ?? "unknown SMTP error";
    }
  }
  return row.status;
}

function writeReport(
  scoped: Recipient[],
  results: ResultRow[],
  extra: Record<string, unknown>
): string | null {
  let jsonPath: string | null = null;
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    jsonPath = path.join(REPORT_DIR, `email-campaign-report-${stamp}.json`);
    const mdPath = path.join(REPORT_DIR, `email-campaign-report-${stamp}.md`);

    const payload = {
      generatedAt: new Date().toISOString(),
      campaignId: (extra.campaignId as string) ?? CAMPAIGN_ID,
      mode: extra.dryRun ? "DRY_RUN" : "LIVE",
      smtpConfigured: extra.smtpConfigured,
      aborted: extra.aborted,
      resumedFrom: (extra.resumedFrom as string | null) ?? null,
      pausesUsed: (extra.pausesUsed as number | undefined) ?? 0,
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
  return jsonPath;
}

main().catch(async (e) => {
  console.error("Campaign crashed:", e?.stack || e?.message || e);
  process.exit(1);
});
