// BetterAuthService — owns the Better Auth instance inside the Nest app.
//
// The instance is built in onModuleInit (Better Auth's config callbacks are
// async — Apple's ES256 client secret, etc.), then main.ts mounts the raw
// handler on the Express instance at BA_MOUNT_PATH (BEFORE app.listen, the
// same early-registration pattern as the Stripe raw-body mount — this must
// run ahead of Nest's JSON body parser, because Better Auth reads the raw
// stream itself).
//
// getSessionFromRequest is deliberately swallow-safe: Better Auth failures
// (e.g. the Session table not migrated yet) must never break the legacy JWT
// path, which is what keeps every existing user signed in during rollout.

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Request } from "express";
import type * as BetterAuthNode from "better-auth/node";
import { MailService } from "../common/mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { BetterAuthInstance } from "./create-better-auth";
import { BA_MOUNT_PATH, readBetterAuthEnv, type BaProviderId } from "./ba-env";

export interface BaSessionShape {
  user: {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: boolean;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
}

@Injectable()
export class BetterAuthService implements OnModuleInit {
  private readonly logger = new Logger(BetterAuthService.name);
  private auth: BetterAuthInstance | null = null;
  /** Express middleware — mounted by main.ts (see BA_MOUNT_PATH). */
  handler: ReturnType<typeof BetterAuthNode.toNodeHandler> | null = null;
  enabledProviderIds: BaProviderId[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const env = await readBetterAuthEnv();
      this.enabledProviderIds = env.enabledProviderIds;
      // better-auth ships ESM-only, while this backend compiles to CJS. A
      // STATIC import would crash the WHOLE backend at boot on Node runtimes
      // without require(ESM) support (pre-22.12 — e.g. the old node:18 image
      // in the Dockerfile). Dynamic imports keep any load failure scoped to
      // THIS feature: Better Auth simply stays disabled and the legacy JWT
      // path — which every existing user depends on — keeps working.
      const [{ createBetterAuth }, { toNodeHandler }] = await Promise.all([
        import("./create-better-auth"),
        import("better-auth/node"),
      ]);
      this.auth = createBetterAuth({ prisma: this.prisma, mail: this.mail, env });
      this.handler = toNodeHandler(this.auth);
      this.logger.log(
        `Better Auth ready — mount ${BA_MOUNT_PATH}, providers: ${
          env.enabledProviderIds.join(", ") || "none (env vars not set)"
        }`
      );
    } catch (error) {
      this.auth = null;
      this.handler = null;
      this.enabledProviderIds = [];
      this.logger.error(
        `Better Auth DISABLED — failed to initialize: ${
          error instanceof Error ? error.message : String(error)
        }. Legacy JWT auth is unaffected; social sign-in is simply unavailable.`
      );
    }
  }

  get mountPath(): string {
    return BA_MOUNT_PATH;
  }

  /** Live enabled-provider map for the frontend (no secrets). */
  getEnabledProviders(): Record<string, boolean> {
    return {
      google: this.enabledProviderIds.includes("google"),
      microsoft: this.enabledProviderIds.includes("microsoft"),
      apple: this.enabledProviderIds.includes("apple"),
      yahoo: this.enabledProviderIds.includes("yahoo"),
    };
  }

  /**
   * Resolve a Better Auth session from cookies or the bearer plugin's
   * Authorization header. Returns null for anonymous or on ANY internal
   * failure (never throws — callers fall back to the legacy JWT path).
   */
  async getSessionFromRequest(req: Request | undefined): Promise<BaSessionShape | null> {
    if (!this.auth || !req) return null;
    try {
      const result = (await this.auth.api.getSession({ headers: req.headers })) as
        | BaSessionShape
        | null;
      return result ?? null;
    } catch (err: unknown) {
      this.logger.warn(
        `Better Auth session lookup failed (falling back to legacy JWT): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null;
    }
  }
}
