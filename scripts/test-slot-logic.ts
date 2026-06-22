/**
 * Simulates the scheduling engine's slot generation logic
 * to verify past-slot filtering is correct in all cases.
 */
import { DateTime } from "luxon";

const BUSINESS_TZ = "America/Los_Angeles";

function businessNow() { return DateTime.now().setZone(BUSINESS_TZ); }
function toBusinessDT(value: Date | string) {
  if (value instanceof Date) return DateTime.fromJSDate(value).setZone(BUSINESS_TZ);
  return DateTime.fromISO(value, { zone: BUSINESS_TZ });
}
function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
function parseHHmm(value: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}
function applyTime(date: Date, hhmm: string): Date {
  const p = parseHHmm(hhmm)!;
  return toBusinessDT(date).set({ hour: p.hour, minute: p.minute, second: 0, millisecond: 0 }).toJSDate();
}
function toHHmm(date: Date) { return toBusinessDT(date).toFormat("HH:mm"); }

const slotTemplates = [
  { label: "8:00 - 10:00 AM",  startTime: "08:00", endTime: "10:00" },
  { label: "10:00 AM - 12:00 PM", startTime: "10:00", endTime: "12:00" },
  { label: "1:00 - 3:00 PM",    startTime: "13:00", endTime: "15:00" },
  { label: "3:00 - 5:00 PM",    startTime: "15:00", endTime: "17:00" },
];

const operatingHours = [
  { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" },
  { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" },
  { dayOfWeek: 3, startTime: "08:00", endTime: "17:00" },
  { dayOfWeek: 4, startTime: "08:00", endTime: "17:00" },
  { dayOfWeek: 5, startTime: "08:00", endTime: "17:00" },
  { dayOfWeek: 6, startTime: "08:00", endTime: "17:00" },
];

function buildSuggestedSlots(baseDate: Date) {
  return slotTemplates.map(s => ({
    label: s.label,
    start: applyTime(baseDate, s.startTime),
    end: applyTime(baseDate, s.endTime),
  }));
}

// Simulate both approaches
function simulate(preferredDate: string | null, simNow: DateTime) {
  let baseDate: Date;
  if (preferredDate) {
    baseDate = DateTime.fromISO(preferredDate, { zone: BUSINESS_TZ }).startOf("day").toJSDate();
  } else {
    // Auto NEXT_DAY
    baseDate = simNow.plus({ days: 1 }).startOf("day").toJSDate();
  }
  const maxDays = preferredDate ? 1 : 7;
  const todayStr = simNow.toFormat('yyyy-MM-dd');
  const nowJS = simNow.toJSDate();

  const results: { approach: string; day: string; d: number; isToday: boolean; dEq0: boolean; slots: string[]; filtered: string[] }[] = [];

  for (let d = 0; d < maxDays; d++) {
    const candidateDate = addMinutes(baseDate, d * 24 * 60);
    const candidateDayStr = toBusinessDT(candidateDate).toFormat('yyyy-MM-dd');
    const isToday = candidateDayStr === todayStr;
    const dEq0 = d === 0;
    const slots = buildSuggestedSlots(candidateDate);

    const filtered_isToday = isToday ? slots.filter(s => s.start > nowJS) : slots;
    const filtered_dEq0 = dEq0 ? slots.filter(s => s.start > nowJS) : slots;

    results.push({
      approach: "isToday vs d===0",
      day: candidateDayStr,
      d,
      isToday,
      dEq0,
      slots: slots.map(s => s.label),
      filtered: filtered_isToday.map(s => s.label),
    });
  }

  return { baseDate: toBusinessDT(baseDate).toFormat('yyyy-MM-dd'), maxDays, todayStr, results };
}

// ── Test Cases ──
const tests = [
  { name: "1. Sat 8:21 PM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "2. Sat 8:21 PM, no preferredDate (auto NEXT_DAY)", preferred: null, now: DateTime.fromObject({ year:2025,month:6,day:21,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "3. Sat 10:00 AM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:10,minute:0 },{zone:BUSINESS_TZ}) },
  { name: "4. Sat 7:59 AM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:7,minute:59 },{zone:BUSINESS_TZ}) },
  { name: "5. Sat 8:21 PM, preferredDate=Sun", preferred: "2025-06-22", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "6. Sat 8:21 PM, preferredDate=Mon", preferred: "2025-06-23", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "7. Sat 9:30 AM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:9,minute:30 },{zone:BUSINESS_TZ}) },
  { name: "8. Sat 2:50 PM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:14,minute:50 },{zone:BUSINESS_TZ}) },
  { name: "9. Sat 4:01 PM, preferredDate=Sat", preferred: "2025-06-21", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:16,minute:1 },{zone:BUSINESS_TZ}) },
  { name: "10. Fri 8:21 PM, preferredDate=Sat (TOMORROW)", preferred: "2025-06-20", now: DateTime.fromObject({ year:2025,month:6,day:20,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "11. Sat 8:21 PM, preferredDate=FRI (YESTERDAY!)", preferred: "2025-06-20", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:20,minute:21 },{zone:BUSINESS_TZ}) },
  { name: "12. Sun 10 AM, preferredDate=Sun (no slots - closed)", preferred: "2025-06-22", now: DateTime.fromObject({ year:2025,month:6,day:22,hour:10,minute:0 },{zone:BUSINESS_TZ}) },
  { name: "13. Sat 11:59 PM, preferredDate=Sun", preferred: "2025-06-22", now: DateTime.fromObject({ year:2025,month:6,day:21,hour:23,minute:59 },{zone:BUSINESS_TZ}) },
];

console.log("=".repeat(80));
console.log("SLOT VALIDATION TEST — isToday approach vs d===0 approach");
console.log("=".repeat(80));

let bugs = 0;
for (const t of tests) {
  const r = simulate(t.preferred, t.now);
  console.log(`\n--- ${t.name} ---`);
  console.log(`  Now: ${t.now.toFormat('yyyy-MM-dd EEE HH:mm')} ${BUSINESS_TZ}`);
  console.log(`  Today: ${r.todayStr} | baseDate: ${r.baseDate} | maxDays: ${r.maxDays}`);

  for (const row of r.results) {
    // isToday filtering
    const isTodayFilter = row.isToday
      ? row.slots.filter((_, i) => {
          const s = buildSuggestedSlots(addMinutes(new Date(r.baseDate + "T00:00:00"), row.d * 24 * 60));
          return s[i].start > t.now.toJSDate();
        })
      : row.slots;
    // d===0 filtering
    const dEq0Filter = row.dEq0
      ? row.slots.filter((_, i) => {
          const s = buildSuggestedSlots(addMinutes(new Date(r.baseDate + "T00:00:00"), row.d * 24 * 60));
          return s[i].start > t.now.toJSDate();
        })
      : row.slots;

    const same = JSON.stringify(isTodayFilter) === JSON.stringify(dEq0Filter);
    const marker = same ? "  " : "  *** DIFFER ***";
    if (!same) bugs++;

    console.log(`  d=${row.d}: ${row.day} | isToday=${row.isToday} d===0=${row.dEq0}${marker}`);
    console.log(`    isToday filter → ${isTodayFilter.length} slots: [${isTodayFilter.join(', ')}]`);
    console.log(`    d===0  filter → ${dEq0Filter.length} slots: [${dEq0Filter.join(', ')}]`);
  }
}

console.log(`\n${"=".repeat(80)}`);
console.log(`RESULT: ${bugs === 0 ? "ALL CASES MATCH - no difference between isToday and d===0" : `${bugs} CASE(S) DIFFER - isToday has bugs!`}`);
console.log("=".repeat(80));

// Now explain the key finding
console.log(`
KEY FINDING:
============
The isToday approach checks if the CANDIDATE DATE is TODAY.
The d===0 approach checks if this is the FIRST candidate day.

These differ ONLY when:
  - d===0 but isToday=false  → d===0 filters, isToday does NOT
  - d===0 but isToday=true   → both filter (same behavior)
  - d>0 but isToday=true     → isToday filters, d===0 does NOT

Scenario "d===0 but isToday=false":
  This happens when the user selects a PAST date (e.g., yesterday).
  With isToday: no filter → past date's slots shown as available! BUG!
  With d===0: past filter applied → slots correctly removed.

Scenario "d>0 but isToday=true":
  This CANNOT happen with maxDays=1 (preferredDate mode).
  With maxDays=7 (auto mode), d>0 is always a future day, so
  isToday would only be true if baseDate < today. But baseDate is
  always today or later, so d>0 is always > today → isToday=false.
  This scenario is impossible.

CONCLUSION: d===0 is strictly safer. isToday has a bug when a
past date is selected as preferredDate. The fix is to change
isToday to (d === 0).
`);