/**
 * Super-admin capability registry — the single place that decides which
 * admin capabilities require a super admin.
 *
 * A super admin is a User with roles=ADMIN AND isSuperAdmin=true. The
 * boolean is additive (super admins are admins first), so every existing
 * ADMIN check — AdminGuard, login routing, adminStatus — keeps working
 * unchanged.
 *
 * HOW TO RESTRICT OR OPEN A CAPABILITY LATER (no schema change needed):
 *   1. Flip the entry below (true = super admins only, false = any admin).
 *   2. That's it for services — every admin action calls
 *      assertSuperAdminCapability() with its capability key, which throws
 *      ForbiddenException when the actor lacks the flag.
 *   3. Optionally also attach SuperAdminGuard to the endpoint(s) so the
 *      request is rejected before it reaches the service.
 * To add a NEW capability, add a key here and gate the endpoint the same
 * way. (Per-super-admin granular permissions, e.g. "this super admin can
 * invite but that one can't", would need per-user storage — not built;
 * today the flag is all-or-nothing by design.)
 */
export const SUPER_ADMIN_ONLY = {
  /** Disable an administrator (kills sessions + blocks sign-in). */
  "admins.disable": true,
  /** Re-enable a disabled administrator (super admins only — regular
   *  admins must not restore each other after a super-admin decision). */
  "admins.enable": true,
  /** Invite a new administrator by email. */
  "admins.invite": false,
  /** Resend an admin's setup link. */
  "admins.resendInvite": false,
  /** Raise an admin to super admin. */
  "admins.promote": true,
  /** Downgrade a super admin to a plain admin. */
  "admins.demote": true,
} as const;

export type SuperAdminCapability = keyof typeof SUPER_ADMIN_ONLY;

export function requiresSuperAdmin(capability: SuperAdminCapability): boolean {
  return SUPER_ADMIN_ONLY[capability];
}
