// src/auth/guards/driver-approved.guard.ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { EnumDriverStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * OPERATIONAL DRIVER GATE — the backend twin of the frontend route guard.
 *
 * The frontend's DriverRouteGuard is UX routing only; this guard is the
 * enforcement point. Every operational driver endpoint it decorates
 * independently re-reads the driver's CURRENT status from the database on
 * each request, so:
 *   - a suspended / rejected / on-hold / pending driver cannot operate,
 *     no matter how fresh their access token is (status was deliberately
 *     kept OUT of the JWT for exactly this reason — claims would go stale
 *     for up to the token lifetime),
 *   - a stale localStorage snapshot can never grant operational access,
 *   - a mid-session suspension takes effect on the driver's very next
 *     operational request, without waiting for re-login.
 *
 * Identity comes from the verified JWT (request.user.id, re-resolved by
 * the strategy) — never from client-supplied driver IDs.
 *
 * ADMIN bypass: operational endpoints are driver-facing; the bypass exists
 * so ops tooling can act on behalf of a driver without holding a driver
 * session. Admin authority itself is enforced by the ACL/roles upstream.
 *
 * The loaded driver row is stashed on `request.driver` (id + status) so
 * downstream handlers can reuse it instead of re-querying.
 */
@Injectable()
export class DriverApprovedGuard {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: {
    switchToHttp: () => { getRequest: () => any };
  }): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user as
      | { id?: string; roles?: string[] }
      | undefined;

    if (!user?.id) {
      throw new UnauthorizedException("Not authenticated");
    }

    if (Array.isArray(user.roles) && user.roles.includes("ADMIN")) {
      return true;
    }

    const driver = await this.prisma.driver.findFirst({
      where: { userId: user.id },
      select: { id: true, status: true },
    });

    if (!driver) {
      throw new ForbiddenException("Driver profile not found");
    }

    if (driver.status !== EnumDriverStatus.APPROVED) {
      // Structured, credential-free: ids and status only — enough to
      // diagnose an authorization rejection, never enough to leak secrets.
      request["driverRejection"] = {
        driverId: driver.id,
        status: driver.status,
      };
      throw new ForbiddenException(
        `Driver account is not approved (current status: ${driver.status})`
      );
    }

    request.driver = driver;
    return true;
  }
}
