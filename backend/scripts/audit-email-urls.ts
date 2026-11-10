/**
 * audit-email-urls.ts — read-only audit of the emails the system actually
 * sent, answering: "which URLs went out, and are they 101drivers.com?"
 *
 * Emails sent through NotificationEventEngine.queueAndSend land in the
 * NotificationEvent ledger with the full email text in `body` — so this
 * script reads that ledger (no SMTP access needed) and extracts every URL
 * from the bodies, grouped by host, flagging anything that is not
 * 101drivers.com (e.g. the legacy 101drivers.techbee.et links).
 *
 * ── Scope ─────────────────────────────────────────────────────────────────
 *   Default: EMAIL events tied to a driver (driverId set), created in the
 *   last 7 days (createdAt — always present; sentAt is reported per row).
 *   QUEUED/FAILED rows are included and labelled so stuck sends are visible.
 *
 * ── Usage (from backend/) ────────────────────────────────────────────────
 *   npm run email:audit                      # driver emails, last 7 days
 *   npm run email:audit -- --days 30         # wider window
 *   npm run email:audit -- --since 2026-11-03
 *   npm run email:audit -- --all-recipients  # drop the driver-only filter
 *
 * ── Output ────────────────────────────────────────────────────────────────
 *   Console: window, counts by status/templateCode, a domain histogram and
 *   every flagged row. CSV: email-url-audit-<timestamp>.csv in backend/
 *   (one row per event, URLs joined by " ; ") for spreadsheets.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

dotenv.config(); // process.cwd()/.env  (run from backend/)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

const ALLOWED_HOSTS = new Set(["101drivers.com", "www.101drivers.com"]);

// ── Args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argValue(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const hasFlag = (name: string) => argv.includes(name);

let since: Date;
const sinceArg = argValue("--since");
const daysArg = argValue("--days");
if (sinceArg) {
  since = new Date(`${sinceArg}T00:00:00Z`);
  if (isNaN(since.getTime())) {
    console.error(`--since must be YYYY-MM-DD, got: ${sinceArg}`);
    process.exit(1);
  }
} else {
  const days = daysArg ? parseInt(daysArg, 10) : 7;
  since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
const driverOnly = !hasFlag("--all-recipients");

// ── Query ─────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

type Row = {
  id: string;
  createdAt: Date;
  sentAt: Date | null;
  status: string;
  templateCode: string | null;
  subject: string | null;
  toEmail: string | null;
  driverId: string | null;
  body: string | null;
  payload: unknown;
};

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  // trim trailing punctuation the regex happily swallowed
  return matches.map((u) => u.replace(/[.,;:]+$/, ""));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const rows = (await prisma.notificationEvent.findMany({
    where: {
      channel: "EMAIL",
      createdAt: { gte: since },
      ...(driverOnly ? { driverId: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      sentAt: true,
      status: true,
      templateCode: true,
      subject: true,
      toEmail: true,
      driverId: true,
      body: true,
      payload: true,
    },
  })) as Row[];

  console.log(`\n=== Email URL audit ===`);
  console.log(`Window   : created since ${since.toISOString()}`);
  console.log(`Scope    : ${driverOnly ? "driver emails (driverId set)" : "ALL recipients"}`);
  console.log(`Rows     : ${rows.length}\n`);

  if (rows.length === 0) {
    console.log("Nothing sent in this window — nothing to audit.");
    return;
  }

  // counts
  const byStatus = new Map<string, number>();
  const byTemplate = new Map<string, number>();
  const byHost = new Map<string, number>();
  const flagged: { row: Row; urls: string[]; badHosts: string[] }[] = [];

  for (const row of rows) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    const tpl = row.templateCode ?? "(none)";
    byTemplate.set(tpl, (byTemplate.get(tpl) ?? 0) + 1);

    const texts = [row.body ?? "", JSON.stringify(row.payload ?? "")];
    const urls = Array.from(
      new Set(texts.flatMap((t) => extractUrls(t)))
    );
    const badHosts = new Set<string>();
    for (const url of urls) {
      const host = hostOf(url);
      if (!host) continue;
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
      if (!ALLOWED_HOSTS.has(host)) badHosts.add(host);
    }
    if (badHosts.size > 0) flagged.push({ row, urls, badHosts: [...badHosts] });
  }

  console.log(`By status     : ${[...byStatus].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(
    `By template   : ${[...byTemplate]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}\n`
  );

  console.log(`URL hosts seen (allow-list: ${[...ALLOWED_HOSTS].join(", ")}):`);
  for (const [host, count] of [...byHost].sort((a, b) => b[1] - a[1])) {
    const ok = ALLOWED_HOSTS.has(host) ? "OK " : "⚠ NON-COMPLIANT";
    console.log(`  ${ok}  ${host}  ×${count}`);
  }

  if (flagged.length > 0) {
    console.log(
      `\n⚠ ${flagged.length} email(s) contain a non-101drivers.com URL — these are the ones to re-send:`
    );
    for (const { row, badHosts } of flagged) {
      console.log(
        `  [${row.status}] ${row.templateCode ?? "(none)"} → ${row.toEmail ?? "?"} | sent ${row.sentAt?.toISOString() ?? "never"} | bad hosts: ${badHosts.join(", ")}`
      );
    }
  } else {
    console.log(`\n✓ Every URL in this window points at 101drivers.com.`);
  }

  // CSV (one row per event)
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const csvPath = path.resolve(process.cwd(), `email-url-audit-${stamp}.csv`);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header =
    "createdAt,sentAt,status,templateCode,toEmail,driverId,subject,hosts,urls";
  const lines = rows.map((row) => {
    const urls = Array.from(
      new Set([row.body ?? "", JSON.stringify(row.payload ?? "")].flatMap((t) => extractUrls(t)))
    );
    const hosts = [...new Set(urls.map((u) => hostOf(u)).filter(Boolean))];
    return [
      row.createdAt.toISOString(),
      row.sentAt?.toISOString() ?? "",
      row.status,
      row.templateCode ?? "",
      row.toEmail ?? "",
      row.driverId ?? "",
      row.subject ?? "",
      hosts.join(" ; "),
      urls.join(" ; "),
    ]
      .map(esc)
      .join(",");
  });
  fs.writeFileSync(csvPath, [header, ...lines].join("\n") + "\n");
  console.log(`\nCSV written: ${csvPath}`);
}

main()
  .catch((e) => {
    console.error("Audit failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
