/**
 * email-proof-report.ts — the "we sent the correct email to every driver"
 * evidence pack, in one command.
 *
 * Cross-checks two sources:
 *   1. The Driver table  — everyone who SHOULD have received an invite email
 *      (default scope: drivers with status INVITED, APPROVED or REJECTED —
 *      every status that passes through the invite flow).
 *   2. The NotificationEvent ledger — the exact emails the system sent
 *      (templateCodes "driver-invited" and "driver-approved"), including the
 *      full body text, so the URLs that actually went out are audited
 *      against the 101drivers.com allow-list (same list as email:audit).
 *
 * A driver with NO invite email row, a FAILED/QUEUED send, or any
 * non-101drivers.com URL is listed as a problem with a verdict, so the
 * report doubles as the re-send worklist. Drivers with none are the proof.
 *
 * ── Usage (from backend/) ────────────────────────────────────────────────
 *   npm run email:proof
 *   npm run email:proof -- --statuses INVITED,APPROVED
 *   npm run email:proof -- --campaign <campaignId>     # ledger rows from one bulk campaign
 *   npm run email:proof -- --since 2026-11-03          # only post-fix sends count as proof
 *
 * ── Output ────────────────────────────────────────────────────────────────
 *   Console: per-verdict counts + the problem list.
 *   CSV: email-campaign-reports/email-proof-<timestamp>.csv — one row per
 *   driver (status of each email, sent timestamps, URL hosts, verdict).
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

dotenv.config(); // process.cwd()/.env  (run from backend/)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

const ALLOWED_HOSTS = new Set(["101drivers.com", "www.101drivers.com"]);
const TEMPLATES = ["driver-invited", "driver-approved"] as const;
const DEFAULT_STATUSES = ["INVITED", "APPROVED", "REJECTED"];

// ── Args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const statusesArg = argValue("--statuses");
const statuses = statusesArg
  ? statusesArg.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  : DEFAULT_STATUSES;
const campaignId = argValue("--campaign");
const sinceArg = argValue("--since");
const since = sinceArg ? new Date(`${sinceArg}T00:00:00Z`) : null;

type EmailRow = {
  id: string;
  driverId: string | null;
  templateCode: string | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  body: string | null;
  payload: unknown;
};

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  return matches.map((u) => u.replace(/[.,;:]+$/, ""));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function rowCampaignId(row: EmailRow): string | null {
  const p = row.payload as { campaignId?: string } | null;
  return typeof p?.campaignId === "string" ? p.campaignId : null;
}

function rowHosts(row: EmailRow): string[] {
  return Array.from(
    new Set(extractUrls(row.body ?? "").map((u) => hostOf(u)).filter((h): h is string => !!h))
  );
}

type PerTemplate = {
  sendStatus: "SENT" | "FAILED" | "QUEUED" | "MISSING";
  sentAt: Date | null;
  hosts: string[];
  campaignIds: string[];
  urlOk: boolean;
};

function verdictOf(invite: PerTemplate): string {
  if (invite.sendStatus === "MISSING") return "NO_EMAIL";
  if (invite.sendStatus === "FAILED") return "SEND_FAILED";
  if (invite.sendStatus === "QUEUED") return "PENDING";
  return invite.urlOk ? "OK" : "URL_BAD";
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // 1. Drivers in scope
  const drivers = await prisma.driver.findMany({
    where: { status: { in: statuses as never[] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      user: { select: { email: true, fullName: true } },
    },
  });

  console.log(`\n=== Email proof report ===`);
  console.log(`Driver scope   : statuses ${statuses.join(", ")} → ${drivers.length} driver(s)`);
  console.log(`Templates      : ${TEMPLATES.join(", ")}`);
  if (campaignId) console.log(`Campaign filter: ${campaignId}`);
  if (since) console.log(`Since          : ${since.toISOString()}`);

  // 2. Their email rows from the ledger
  const rows: EmailRow[] = drivers.length
    ? (await prisma.notificationEvent.findMany({
        where: {
          channel: "EMAIL",
          driverId: { in: drivers.map((d) => d.id) },
          templateCode: { in: TEMPLATES as unknown as string[] },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          driverId: true,
          templateCode: true,
          status: true,
          sentAt: true,
          createdAt: true,
          body: true,
          payload: true,
        },
      })) as EmailRow[]
    : [];

  const byDriver = new Map<string, EmailRow[]>();
  for (const row of rows) {
    if (campaignId && rowCampaignId(row) !== campaignId) continue;
    const list = byDriver.get(row.driverId!) ?? [];
    list.push(row);
    byDriver.set(row.driverId!, list);
  }

  // 3. Per-driver verdicts
  const summarize = (driverRows: EmailRow[] | undefined): PerTemplate => {
    const relevant = driverRows ?? [];
    const latest = relevant[0]; // rows are newest-first
    if (!latest) {
      return {
        sendStatus: "MISSING",
        sentAt: null,
        hosts: [],
        campaignIds: [],
        urlOk: true,
      };
    }
    const hosts = rowHosts(latest);
    const campaignIds = Array.from(
      new Set(relevant.map((r) => rowCampaignId(r)).filter((c): c is string => !!c))
    );
    const sentRows = relevant.filter((r) => r.status === "SENT");
    const sendStatus = sentRows.length
      ? "SENT"
      : (relevant.some((r) => r.status === "FAILED") ? "FAILED" : "QUEUED");
    const sentRow = sentRows[0] ?? latest;
    return {
      sendStatus,
      sentAt: sentRow.sentAt,
      hosts,
      campaignIds,
      urlOk: hosts.every((h) => ALLOWED_HOSTS.has(h)),
    };
  };

  const results = drivers.map((d) => {
    const driverRows = byDriver.get(d.id) ?? [];
    const inviteRows = driverRows.filter((r) => r.templateCode === "driver-invited");
    const approveRows = driverRows.filter((r) => r.templateCode === "driver-approved");
    const invite = summarize(inviteRows);
    const approve = summarize(approveRows);
    return { driver: d, invite, approve, verdict: verdictOf(invite) };
  });

  // 4. Console summary
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
  console.log(`\nVerdicts:`);
  for (const [v, n] of [...counts].sort()) {
    const mark = v === "OK" ? "✓" : "⚠";
    console.log(`  ${mark} ${v.padEnd(12)} ×${n}`);
  }
  const urlBad = results.filter((r) => r.verdict === "URL_BAD");
  const badApprove = results.filter(
    (r) => r.verdict === "OK" && r.approve.sendStatus === "SENT" && !r.approve.urlOk
  );
  const problems = results.filter((r) => r.verdict !== "OK");
  if (problems.length === 0) {
    console.log(
      `\n✓ PROOF: every driver in scope has a SENT invite email and every URL in those emails points at 101drivers.com.`
    );
  } else {
    console.log(`\n⚠ ${problems.length} driver(s) need attention (these are your re-send list):`);
    for (const r of problems) {
      console.log(
        `  [${r.verdict}] ${r.driver.user?.email ?? "(no email)"} · ${r.driver.status} · invite: ${r.invite.sendStatus}`
      );
    }
  }
  if (badApprove.length > 0) {
    console.log(
      `\n⚠ ${badApprove.length} approval email(s) contain a non-101drivers.com URL (invite was fine):`
    );
    for (const r of badApprove) {
      console.log(`  ${r.driver.user?.email ?? "?"} → ${r.approve.hosts.filter((h) => !ALLOWED_HOSTS.has(h)).join(", ")}`);
    }
  }

  // 5. CSV — one row per driver
  const dir = path.join(process.cwd(), "email-campaign-reports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const csvPath = path.join(dir, `email-proof-${stamp}.csv`);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header =
    "driverId,driverName,email,driverStatus,driverCreatedAt,inviteSendStatus,inviteSentAt,inviteUrlHosts,approveSendStatus,approveSentAt,approveUrlHosts,campaignIds,verdict";
  const lines = results.map((r) =>
    [
      r.driver.id,
      r.driver.user?.fullName ?? "",
      r.driver.user?.email ?? "",
      r.driver.status,
      r.driver.createdAt.toISOString(),
      r.invite.sendStatus,
      r.invite.sentAt?.toISOString() ?? "",
      r.invite.hosts.join(" ; "),
      r.approve.sendStatus,
      r.approve.sentAt?.toISOString() ?? "",
      r.approve.hosts.join(" ; "),
      [...r.invite.campaignIds, ...r.approve.campaignIds].join(" ; "),
      r.verdict,
    ]
      .map(esc)
      .join(",")
  );
  fs.writeFileSync(csvPath, [header, ...lines].join("\n") + "\n");
  console.log(`\nCSV written: ${csvPath}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Proof report failed:", e);
  process.exitCode = 1;
});
