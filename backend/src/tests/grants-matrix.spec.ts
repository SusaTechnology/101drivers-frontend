import * as fs from "fs";
import * as path from "path";

/**
 * GRANTS MATRIX GUARD-RAIL (P1)
 *
 * The October-2026 authorization audit found that the generated-CRUD
 * scaffold shipped with grants.json giving EVERY role (including the
 * fallback "user") create/update/delete/read:any on every resource —
 * money, bookings, tracking, payouts. The fix rewrote the matrix; these
 * tests pin the corrected matrix in place so a future regeneration or
 * hand-edit can never silently reopen the holes.
 *
 * Grant shape in this repo: a single combined `action` string
 * "<verb>:<possession>" (e.g. "create:any", "read:own") plus attributes.
 *
 * Two contract halves:
 *   1. LOCKED  — no non-ADMIN role gets a ":any"-possession or
 *                create/delete grant on money/booking resources
 *                (DriverPayout's read:own/update:own for drivers is the
 *                deliberate exception — visibility without minting).
 *   2. INTACT  — the customer-facing grants the frontend relies on
 *                (dealers/customers create and manage DeliveryRequests,
 *                customers tip their drivers) still exist, so hardening
 *                never downgraded the customer experience.
 */

interface GrantEntry {
  role: string;
  resource: string;
  action: string; // "<verb>:<possession>"
  attributes: string;
}

const grantsPath = path.resolve(__dirname, "..", "grants.json");
const grants: GrantEntry[] = JSON.parse(fs.readFileSync(grantsPath, "utf-8"));

const ADMIN_ONLY = "ADMIN";
const NON_ADMIN_ROLES = ["BUSINESS_CUSTOMER", "PRIVATE_CUSTOMER", "DRIVER", "user"];

/** Resources where money/booking integrity lives — ADMIN by default. */
const PROTECTED_RESOURCES = [
  "Quote",
  "Payment",
  "PaymentEvent",
  "DriverPayout",
  "TrackingSession",
  "TrackingPoint",
  "DeliveryAssignment",
];

function actionsFor(resource: string, role: string): string[] {
  return grants
    .filter((g) => g.resource === resource && g.role === role)
    .map((g) => g.action);
}

describe("grants.json — authorization matrix contract", () => {
  it("parses and contains the five expected roles", () => {
    expect(Array.isArray(grants)).toBe(true);
    const roles = new Set(grants.map((g) => g.role));
    for (const role of [...NON_ADMIN_ROLES, ADMIN_ONLY]) {
      expect(roles.has(role)).toBe(true);
    }
  });

  it("every entry is well-formed (role/resource/action/attributes)", () => {
    for (const g of grants) {
      expect(g.role).toBeTruthy();
      expect(g.resource).toBeTruthy();
      expect(g.action).toMatch(/^[a-z]+:(any|own)$/);
      expect(g.attributes).toBeTruthy();
    }
  });

  describe("LOCKED — money/booking resources are ADMIN-only", () => {
    for (const resource of PROTECTED_RESOURCES) {
      it(`${resource}: no non-admin role holds an ":any" grant`, () => {
        const offending = NON_ADMIN_ROLES.flatMap((role) =>
          actionsFor(resource, role)
            .filter((a) => a.endsWith(":any"))
            .map((a) => `${role} ${a}`)
        );
        expect(offending).toEqual([]);
      });

      it(`${resource}: non-admin grants (if any) are read:own/update:own only`, () => {
        const offending = NON_ADMIN_ROLES.flatMap((role) =>
          actionsFor(resource, role)
            .filter((a) => !["read:own", "update:own"].includes(a))
            .map((a) => `${role} ${a}`)
        );
        expect(offending).toEqual([]);
      });
    }

    it("DriverPayout for DRIVER is read:own + update:own only (visibility, never minting)", () => {
      expect(actionsFor("DriverPayout", "DRIVER").sort()).toEqual([
        "read:own",
        "update:own",
      ]);
    });

    it("fallback 'user' role holds NO grant on any protected resource", () => {
      const offending = PROTECTED_RESOURCES.filter(
        (r) => actionsFor(r, "user").length > 0
      );
      expect(offending).toEqual([]);
    });
  });

  describe("INTACT — customer-facing grants the FE depends on", () => {
    it("customers (private + business) keep create/update/read on DeliveryRequests", () => {
      for (const role of ["PRIVATE_CUSTOMER", "BUSINESS_CUSTOMER"]) {
        const actions = actionsFor("DeliveryRequest", role);
        expect(actions).toContain("create:any");
        expect(actions).toContain("update:any");
        expect(actions).toContain("read:own");
      }
    });

    it("DRIVER keeps read access to DeliveryRequests (job feed / gig details)", () => {
      const actions = actionsFor("DeliveryRequest", "DRIVER");
      expect(actions).toContain("read:own");
    });

    it("customers keep tip read/update grants (Tip row-scoped in the controller)", () => {
      // Tips are CREATED server-side (Stripe tip-intent → webhook), so
      // customers correctly hold read + update only — update drives the
      // CAPTURED status flip from the payment dialog.
      for (const role of ["PRIVATE_CUSTOMER", "BUSINESS_CUSTOMER"]) {
        const actions = actionsFor("Tip", role);
        expect(actions).toContain("update:any");
        expect(actions).toContain("read:any");
        expect(actions).not.toContain("create:any");
        expect(actions).not.toContain("delete:any");
      }
    });
  });
});
