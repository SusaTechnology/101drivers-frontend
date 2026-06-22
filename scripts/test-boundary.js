/**
 * Verify: at exactly the slot boundary (10:00 AM), does start > now exclude it?
 * Answer: YES. This is by design — s.start > now means "slot must not have started yet".
 * At exactly 10:00:00, the slot IS starting, so the > operator excludes it.
 * This is a 1-second edge case and is the CORRECT safe behavior.
 */
const TZ_OFF = -7;
function mkNow(y,mo,d,h,mi) { return Date.UTC(y,mo-1,d,h-TZ_OFF,mi); }
function toH(ms) { const u=new Date(ms+TZ_OFF*3600_000); return `${u.getUTCHours()}:${String(u.getUTCMinutes()).padStart(2,'0')}`; }
function mkSlot(dayStr,hh) { const [y,m,d]=dayStr.split('-').map(Number); return Date.UTC(y,m-1,d,hh-TZ_OFF,0); }

// At 9:59:59 — 10:00 slot start > now?  10:00 > 9:59:59 = TRUE  → INCLUDED
const now1 = mkNow(2025,6,21,9,59);
const slot10 = mkSlot("2025-06-21", 10);
console.log(`9:59 AM: slot 10:00 > 9:59? ${slot10 > now1} → ${slot10 > now1 ? 'INCLUDED' : 'EXCLUDED'}`);

// At 10:00:00 — 10:00 slot start > now?  10:00 > 10:00 = FALSE → EXCLUDED
const now2 = mkNow(2025,6,21,10,0);
console.log(`10:00 AM: slot 10:00 > 10:00? ${slot10 > now2} → ${slot10 > now2 ? 'INCLUDED' : 'EXCLUDED'}`);

// At 10:00:01 — 10:00 slot start > now?  10:00 > 10:00:01 = FALSE → EXCLUDED
const now3 = mkNow(2025,6,21,10,0) + 1000;
console.log(`10:00:01 AM: slot 10:00 > 10:00:01? ${slot10 > now3} → ${slot10 > now3 ? 'INCLUDED' : 'EXCLUDED'}`);

console.log(`
CONCLUSION: At exactly 10:00:00 AM, the 10:00 AM slot is excluded.
This is the designed behavior (">" not ">="). The 1-second window at
the exact boundary is acceptable — no real user hits exactly 10:00:00.000.

This is NOT the customer's reported bug (they said 8:21 PM, not 10:00 AM).
`);