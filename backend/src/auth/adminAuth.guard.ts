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
 * This guard reads the real DB-backed user (populated by the JWT strategy)
 * and rejects anyone whose single role is not ADMIN.
 *
 * Use together with DefaultAuthGuard (which populates request.user).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || user.roles !== EnumUserRoles.ADMIN) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
