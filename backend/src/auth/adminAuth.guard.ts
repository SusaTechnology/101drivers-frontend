import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { EnumUserRoles } from "@prisma/client";

/**
 * Hard role gate for admin-only endpoints.
 *
 * nest-access-control's ACGuard only checks grants.json — and the
 * Amplication-generated grants historically granted User create/update to
 * EVERY role, which let any authenticated user reach admin endpoints.
 * This guard reads the DB-backed user (loaded by the JWT strategy on every
 * request, attached to request.user with roles as a string array) and
 * rejects anyone whose roles do not include ADMIN.
 *
 * Use together with DefaultAuthGuard (which populates request.user).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // The JWT strategy attaches roles as a string array (e.g. ["ADMIN"]).
    // Accept both shapes so a strategy change can never silently re-open
    // this gate — but an empty/missing roles list always rejects.
    const rawRoles: unknown = user?.roles;
    const roles: string[] = Array.isArray(rawRoles)
      ? rawRoles.map((role) => String(role))
      : rawRoles
        ? [String(rawRoles)]
        : [];

    if (!user || !roles.includes(EnumUserRoles.ADMIN)) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}

/**
 * Elevated gate for super-admin-only endpoints (disable / promote /
 * demote admins today — see src/auth/super-admin.ts for the registry).
 *
 * Must run AFTER DefaultAuthGuard (which populates request.user) and is
 * used alongside AdminGuard: super admins are admins first. The JWT
 * strategy re-reads the user from the DB on EVERY request and includes
 * isSuperAdmin, so granting or revoking the flag takes effect on the
 * actor's very next request — no token invalidation needed.
 *
 * The service layer additionally calls assertSuperAdminCapability(),
 * so flipping an entry in SUPER_ADMIN_ONLY restricts the action even
 * without touching guards.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || user.isSuperAdmin !== true) {
      throw new ForbiddenException("Super admin access required");
    }

    return true;
  }
}
