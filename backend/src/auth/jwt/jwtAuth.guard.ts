import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { firstValueFrom, isObservable } from "rxjs";
import { BetterAuthService } from "../../better-auth/better-auth.service";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Hybrid session guard (TRANSITION — see docs/auth/better-auth-plan.md §7).
 *
 * 1) Better Auth first: a valid session (HTTP-only cookie, or the bearer
 *    plugin's Authorization header for Safari/iOS-PWA) resolves the request
 *    user FRESH FROM THE DATABASE — id, username, roles, isSuperAdmin,
 *    isActive — exactly the shape the legacy JwtStrategy.validate returns.
 *    Roles are never taken from the session; a deactivated or deleted user
 *    is rejected even with a valid session (no stale-privilege window).
 * 2) Legacy fallback: no Better Auth session → the original passport JWT
 *    path runs unchanged, so every existing user keeps access through the
 *    cutover. Remove the Better Auth branch once all drivers have migrated
 *    (tracked in docs/auth/better-auth-drivers.md).
 *
 * Failure posture: any Better Auth internal error (e.g. migration not yet
 * applied) falls back to the legacy path — this guard can never take the
 * whole API down. A genuine Better Auth session pointing at a dead user is
 * the one case that hard-fails (no fallback to legacy tokens for that user).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") implements CanActivate {
  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      if (request?.headers) {
        const session = await this.betterAuthService.getSessionFromRequest(request);
        if (session?.user?.id) {
          const user = await this.prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
              id: true,
              username: true,
              roles: true,
              isSuperAdmin: true,
              isActive: true,
            },
          });
          if (!user || !user.isActive) {
            throw new UnauthorizedException();
          }
          request.user = {
            id: user.id,
            username: user.username,
            roles: [String(user.roles)],
            isSuperAdmin: user.isSuperAdmin === true,
          };
          return true;
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // Better Auth infrastructure failure → legacy JWT path continues.
    }

    const result = super.canActivate(context);
    return isObservable(result)
      ? await firstValueFrom(result as import("rxjs").Observable<boolean>)
      : await result;
  }
}
