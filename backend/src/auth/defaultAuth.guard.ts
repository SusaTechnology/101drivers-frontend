import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtAuthGuard } from "./jwt/jwtAuth.guard";
import { BetterAuthService } from "../better-auth/better-auth.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DefaultAuthGuard extends JwtAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    // Forwarded to the hybrid base guard (Better Auth session first, legacy
    // JWT fallback) — both are @Global providers, resolvable from anywhere.
    betterAuthService: BetterAuthService,
    prisma: PrismaService
  ) {
    super(betterAuthService, prisma);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler()
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
