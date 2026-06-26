/**
 * Pure-JS simulation of the scheduling slot logic.
 * No external deps — tests the isToday vs d===0 approaches.
 */

const TZ_OFFSET = -7; // PDT = UTC-7 (June)

function businessNow(y, mo, d, h, mi) {
  // Return a timestamp in ms for "now" in LA timezone
  return Date.UTC(y, mo - 1, d, h + 7, mi, 0); // +7 to convert LA to UTC
}

function toBusinessDay(ms) {
  const utc = new Date(ms);
  // Convert UTC to LA: subtract 7 hours
  const la = new Date(utc.getTime() - 7 * 3600_000);
  return `${la.getUTCFullYear()}-${String(la.getUTCMonth()+1).padStart(2,'0')}-${String(la.getUTCDate()).padStart(2,'0')}`;
}

function toBusinessHour(ms) {
  const utc = new Date(ms);
  const la = new Date(utc.getTime() - 7 * 3600_000);
  return la.getUTCHours();
}

function makeSlotOnDate(baseDateStr, hh, mm) {
  // baseDateStr = "2025-06-21", hh = 8, mm = 0
  // We need the UTC ms for this time in LA timezone
  const [y, m, d] = baseDateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, hh + 7, mm, 0); // LA time → UTC
}

const SLOT_TEMPLATES = [
  { label: "8:00-10:00 AM",  hh: 8,  mm: 0 },
  { label: "10:00AM-12:00PM", hh: 10, mm: 0 },
  { label: "1:00-3:00 PM",   hh: 13, mm: 0 },
  { label: "3:00-5:00 PM",   hh: 15, mm: 0 },
];

// Sunday=day7, closed. Mon-Sat=day1-6, open 08-17
function dayOfWeek(baseDateStr) {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const la = new Date(utc.getTime() - 7 * 3600_000);
  return la.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
}

function isOpen(baseDateStr) {
  const dow = dayOfWeek(baseDateStr);
  return dow >= 1 && dow <= 6; // Mon-Sat
}

function simulate(preferredDate, nowMs, maxDays) {
  const baseDateStr = preferredDate;
  const todayStr = toBusinessDay(nowMs);
  const results = [];

  for (let d = 0; d < maxDays; d++) {
    // Compute candidate date string (add d days to baseDate)
    const [y, m, dd] = baseDateStr.split('-').map(Number);
    const utcBase = new Date(Date.UTC(y, m - 1, dd, 7, 0, 0)); // midnight LA = 07:00 UTC
    const candidateMs = utcBase.getTime() + d * 24 * 3600_000;
    const candidateStr = toBusinessDay(candidateMs);

    if (!isOpen(candidateStr)) {
      results.push({ d, date: candidateStr, isToday: candidateStr === todayStr, dEq0: d === 0, slots: [], isTodayFiltered: [], dEq0Filtered: [] });
      continue;
    }

    const slots = SLOT_TEMPLATES.map(s => ({
      label: s.label,
      startMs: makeSlotOnDate(candidateStr, s.hh, s.mm),
    }));

    const isToday = candidateStr === todayStr;
    const isTodayFiltered = isToday ? slots.filter(s => s.startMs > nowMs) : slots;
    const dEq0Filtered = d === 0 ? slots.filter(s => s.startMs > nowMs) : slots;

    results.push({
      d, date: candidateStr, isToday, dEq0: d === 0,
      slots: slots.map(s => s.label),
      isTodayFiltered: isTodayFiltered.map(s => s.label),
      dEq0Filtered: dEq0Filtered.map(s => s.label),
    });
  }
  return results;
}

function runTest(name, preferredDate, nowMs, maxDays) {
  const todayStr = toBusinessDay(nowMs);
  const h = toBusinessHour(nowMs);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  const mi = new Date(nowMs).getUTCMinutes();

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`${name}`);
  console.log(`  Now: ${todayStr} ${dh}:${String(mi).padStart(2,'0')} ${ampm} (LA) | preferredDate: ${preferredDate || '(auto)'} | maxDays: ${maxDays}`);

  const results = simulate(preferredDate, nowMs, maxDays);
  let bugFound = false;

  for (const r of results) {
    const same = JSON.stringify(r.isTodayFiltered) === JSON.stringify(r.dEq0Filtered);
    const marker = same ? '' : '  *** BUG ***';
    if (!same) bugFound = true;

    console.log(`  d=${r.d}: ${r.date} (isToday=${r.isToday}, d===0=${r.dEq0})${marker}`);
    if (r.slots.length === 0) {
      console.log(`    (closed or no slots)`);
    }
    if (!same) {
      console.log(`    isToday → [${r.isTodayFiltered.join(', ')}]`);
      console.log(`    d===0  → [${r.dEq0Filtered.join(', ')}]`);
    } else {
      console.log(`    both   → [${r.isTodayFiltered.length} slot(s): ${r.isTodayFiltered.join(', ')}]`);
    }
  }

  // What gets RETURNED (first day with available)
  const isTodayReturn = results.find(r => r.isTodayFiltered.length > 0);
  const dEq0Return = results.find(r => r.dEq0Filtered.length > 0);
  if (isTodayReturn || dEq0Return) {
    const isTodayDay = isTodayReturn ? isTodayReturn.date : '(none)';
    const dEq0Day = dEq0Return ? dEq0Return.date : '(none)';
    const match = isTodayDay === dEq0Day && JSON.stringify(isTodayReturn?.isTodayFiltered) === JSON.stringify(dEq0Return?.dEq0Filtered);
    if (!match) bugFound = true;
    console.log(`  RETURN: isToday→${isTodayDay} | d===0→${dEq0Day} ${match ? '✓' : '✗ DIFFERENT!'}`);
  } else {
    console.log(`  RETURN: both→(no slots) ✓`);
  }

  return bugFound;
}

// ── Test cases ──
console.log('═'.repeat(70));
console.log('SLOT PAST-FILTERING VERIFICATION — isToday vs d===0');
console.log('═'.repeat(70));

let totalBugs = 0;

// Sat Jun 21, 2025
const sat = (h, m = 0) => businessNow(2025, 6, 21, h, m);
const fri = (h, m = 0) => businessNow(2025, 6, 20, h, m);

totalBugs += runTest("1. Sat 8:21PM, pick Sat (all past)", "2025-06-21", sat(20,21), 1) ? 1 : 0;
totalBugs += runTest("2. Sat 8:21PM, no preferredDate (auto)", "2025-06-22", sat(20,21), 7) ? 1 : 0;
totalBugs += runTest("3. Sat 10:00AM, pick Sat", "2025-06-21", sat(10,0), 1) ? 1 : 0;
totalBugs += runTest("4. Sat 7:59AM, pick Sat (before first slot)", "2025-06-21", sat(7,59), 1) ? 1 : 0;
totalBugs += runTest("5. Sat 8:21PM, pick Sun (tomorrow)", "2025-06-22", sat(20,21), 1) ? 1 : 0;
totalBugs += runTest("6. Sat 8:21PM, pick Mon (future)", "2025-06-23", sat(20,21), 1) ? 1 : 0;
totalBugs += runTest("7. Sat 9:30AM, pick Sat (1st slot in progress)", "2025-06-21", sat(9,30), 1) ? 1 : 0;
totalBugs += runTest("8. Sat 2:50PM, pick Sat (only 3-5 left)", "2025-06-21", sat(14,50), 1) ? 1 : 0;
totalBugs += runTest("9. Sat 4:01PM, pick Sat (all past)", "2025-06-21", sat(16,1), 1) ? 1 : 0;
totalBugs += runTest("10. Fri 8:21PM, pick Sat (tomorrow from Fri)", "2025-06-21", fri(20,21), 1) ? 1 : 0;
totalBugs += runTest("11. *** Sat 8:21PM, pick FRI (yesterday!) ***", "2025-06-20", sat(20,21), 1) ? 1 : 0;
totalBugs += runTest("12. Sat 8:21PM, pick Sun (closed)", "2025-06-22", sat(20,21), 1) ? 1 : 0;
totalBugs += runTest("13. Sun 10AM, no preferredDate (auto→Mon)", "2025-06-23", businessNow(2025,6,22,10,0), 7) ? 1 : 0;

console.log(`\n${'═'.repeat(70)}`);
console.log(`TOTAL BUGS FOUND: ${totalBugs}`);
console.log('═'.repeat(70));

console.log(`
EXPLANATION OF THE isToday BUG:
================================
"isToday" checks: is the candidate date == calendar today?
"d===0"  checks: is this the first candidate day?

These differ when:
  • User selects a PAST date (e.g., yesterday as preferredDate)
    → d=0 = yesterday, isToday=false → NO past filter → yesterday's
      slots shown as available! (BUG)
    → d=0 = yesterday, d===0=true → past filter applied → correctly removed

  • Auto mode with baseDate=tomorrow (no preferredDate)
    → d=0 = tomorrow, isToday=false → no filter (correct, all future)
    → d=0 = tomorrow, d===0=true → filter applied, but tomorrow's slots
      are all > now, so none removed (correct, same result)

The d===0 approach is STRICTLY SAFER — it handles the edge case of
a past preferredDate without affecting any normal scenario.

THE FIX: Change 'isToday' to 'd === 0' in both buildSuggestedSlotsMultiDay
and resolveSlotDate.
`);