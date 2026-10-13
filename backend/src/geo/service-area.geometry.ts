/**
 * Service-area geometry — PURE functions, zero dependencies.
 *
 * This module is the single source of truth for:
 *   - ZIP normalization (strip spaces, collapse ZIP+4 → first 5 digits)
 *   - ray-casting point-in-polygon test ([lat, lng] space)
 *   - polygon validation (self-intersection rejection for the ops editor)
 *   - the LA-metro seed polygon (Santa Barbara → Long Beach → San Diego,
 *     inland edge past Palm Springs and Joshua Tree)
 *
 * Kept dependency-free so it can be unit-tested directly (scripts/
 * test_service_area_polygon.mjs) and mirrored by the frontend preview
 * (src/lib/geo-utils.ts already ships the same ray-casting math).
 */

export type LatLng = [number, number]; // [lat, lng]

/** The seeded service area. Ops edit this IN THE DATABASE (ServiceAreaPolygon
 *  row) — this constant is only the day-one INSERT, never a runtime source. */
export const LA_METRO_SERVICE_AREA_NAME = "LA Metro";

export const LA_METRO_SERVICE_AREA_POLYGON: LatLng[] = [
  // ── Coast: Santa Barbara ↓ San Diego ──
  [34.55, -120.62], // Point Arguello (W of Santa Barbara, offshore buffer)
  [34.42, -120.15], // Santa Barbara
  [34.25, -119.55], // Ventura coast
  [34.05, -119.1], // Oxnard
  [33.9, -118.62], // Malibu
  [33.8, -118.35], // LA coast
  [33.73, -118.05], // Long Beach
  [33.42, -117.68], // Dana Point / south Orange County
  [33.05, -117.32], // Oceanside
  [32.68, -117.35], // San Diego offshore
  [32.53, -116.68], // Mexican border, east of San Diego
  // ── Inland edge: past Palm Springs and Joshua Tree ──
  [32.62, -115.95], // border, far southeast
  [33.2, -115.35], // east of the Salton Sea
  [33.95, -115.25], // east of Joshua Tree
  [34.35, -115.15], // northeast corner
  // ── North edge: back to the coast ──
  [34.75, -116.4], // north of Palm Springs
  [34.8, -117.55], // north of the High Desert
  [34.7, -118.9], // north of Lancaster/Palmdale
  [34.55, -119.8], // Santa Ynez Valley
];

/**
 * Normalize any user-supplied ZIP: strip surrounding spaces, inner spaces
 * and dashes, then keep the first five digits (ZIP+4 — both "91210-1234"
 * and "912101234" — collapses to "91210"). Returns null unless exactly 5
 * digits remain, so callers can treat null as "no usable zip".
 */
export function normalizeServiceAreaZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw)
    .trim()
    .replace(/[\s\-()]/g, "")
    .replace(/\D/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

/**
 * Standard ray-casting (even-odd) test. Point and ring are both [lat, lng].
 * The ring is treated as CLOSED (last vertex connects back to the first) —
 * callers must NOT repeat the first vertex at the end.
 */
export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  if (!ring || ring.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Orientation of the ordered triplet (a, b, c): >0 CCW, <0 CW, 0 collinear. */
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
  return (
    px >= Math.min(ax, bx) &&
    px <= Math.max(ax, bx) &&
    py >= Math.min(ay, by) &&
    py <= Math.max(ay, by)
  );
}

/** Proper segment intersection incl. collinear-overlap cases. */
export function segmentsIntersect(p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng): boolean {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;
  const d1 = cross(x3, y3, x4, y4, x1, y1);
  const d2 = cross(x3, y3, x4, y4, x2, y2);
  const d3 = cross(x1, y1, x2, y2, x3, y3);
  const d4 = cross(x1, y1, x2, y2, x4, y4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear touch/overlap cases — a vertex ON an edge is an invalid shape.
  if (d1 === 0 && onSegment(x3, y3, x4, y4, x1, y1)) return true;
  if (d2 === 0 && onSegment(x3, y3, x4, y4, x2, y2)) return true;
  if (d3 === 0 && onSegment(x1, y1, x2, y2, x3, y3)) return true;
  if (d4 === 0 && onSegment(x1, y1, x2, y2, x4, y4)) return true;
  return false;
}

/**
 * True when any two NON-adjacent edges of the closed ring cross or touch.
 * Adjacent edges share a vertex by definition and are skipped (that touch
 * is what makes it a polygon, not a defect).
 */
export function polygonSelfIntersects(ring: LatLng[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let k = i + 1; k < n; k++) {
      // skip adjacent edges (they legitimately share a vertex)
      if (k === i || (i === 0 && k === n - 1) || (k === (i + 1) % n)) continue;
      const b1 = ring[k];
      const b2 = ring[(k + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export interface PolygonValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Full validation for the ops editor's SAVE: enough vertices, numbers are
 * finite and in range, no repeated consecutive points, ring is not
 * self-intersecting. Rejects bowties, figure-eights and collapsed edges
 * before they can silently corrupt the service area.
 */
export function validatePolygon(ring: unknown): PolygonValidation {
  const errors: string[] = [];

  if (!Array.isArray(ring)) {
    return { valid: false, errors: ["Polygon must be an array of [lat, lng] pairs."] };
  }
  if (ring.length < 3) {
    errors.push("A polygon needs at least 3 vertices.");
    return { valid: false, errors };
  }
  if (ring.length > 500) {
    errors.push("A polygon can have at most 500 vertices.");
    return { valid: false, errors };
  }

  const clean: LatLng[] = [];
  for (let i = 0; i < ring.length; i++) {
    const v = ring[i] as unknown;
    if (
      !Array.isArray(v) ||
      v.length !== 2 ||
      typeof v[0] !== "number" ||
      typeof v[1] !== "number" ||
      !Number.isFinite(v[0]) ||
      !Number.isFinite(v[1])
    ) {
      errors.push(`Vertex ${i + 1} must be two finite numbers: [lat, lng].`);
      continue;
    }
    const [lat, lng] = v;
    if (lat < -90 || lat > 90) errors.push(`Vertex ${i + 1}: latitude ${lat} out of range.`);
    if (lng < -180 || lng > 180) errors.push(`Vertex ${i + 1}: longitude ${lng} out of range.`);
    const prev = clean[clean.length - 1];
    if (!prev || prev[0] !== lat || prev[1] !== lng) {
      clean.push([lat, lng]);
    }
  }
  if (clean.length > 1) {
    const [first] = clean;
    const last = clean[clean.length - 1];
    // A duplicated closing vertex is redundant, not fatal — drop it.
    if (first[0] === last[0] && first[1] === last[1]) clean.pop();
  }

  if (errors.length > 0) return { valid: false, errors };
  if (clean.length < 3) {
    errors.push("A polygon needs at least 3 distinct vertices.");
    return { valid: false, errors };
  }
  if (polygonSelfIntersects(clean)) {
    errors.push(
      "The polygon edges cross each other (self-intersection). Drag the vertices into a simple loop — no bowties.",
    );
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}
