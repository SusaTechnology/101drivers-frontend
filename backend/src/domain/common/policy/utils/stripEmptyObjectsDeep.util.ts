// src/domain/common/policy/stripEmptyObjectsDeep.util.ts

/**
 * Removes:
 * - undefined keys
 * - empty plain objects {}
 * - empty relation shells like { connect: {} } or { connect: undefined }
 *
 * Preserves:
 * - Date
 * - arrays
 * - non-plain objects
 *
 * This is critical for Amplication-style updates where relation fields
 * are sometimes sent as empty objects in update payloads.
 */

function isPlainObject(value: any): value is Record<string, any> {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

export function stripEmptyObjectsDeep<T>(input: T): T {
  if (input == null) return input;

  // Preserve Date
  if (input instanceof Date) {
    return input;
  }

  // arrays
  if (Array.isArray(input)) {
    return input.map(stripEmptyObjectsDeep) as any;
  }

  // only recurse into plain objects
  if (isPlainObject(input)) {
    const out: any = {};

    for (const [k, v] of Object.entries(input as any)) {
      if (v === undefined) continue;

      const vv = stripEmptyObjectsDeep(v);

      if (vv === undefined) continue;

      // drop empty plain objects: {}
      if (isPlainObject(vv)) {
        const keys = Object.keys(vv);

        if (keys.length === 0) continue;

        // drop empty relation shells: { connect: {} } / { connect: undefined }
        if (keys.length === 1 && keys[0] === "connect") {
          const c = (vv as any).connect;
          if (
            c == null ||
            (isPlainObject(c) && Object.keys(c).length === 0)
          ) {
            continue;
          }
        }
      }

      out[k] = vv;
    }

    return out;
  }

  // primitives + non-plain objects
  return input;
}

/**
 * Mutates the original object in-place (useful inside policy methods
 * where you want to "clean" the same reference).
 */
export function sanitizeInPlace<T extends Record<string, any>>(target: T): T {
  const cleaned = stripEmptyObjectsDeep(target);
  for (const k of Object.keys(target)) delete (target as any)[k];
  Object.assign(target, cleaned);
  return target;
}