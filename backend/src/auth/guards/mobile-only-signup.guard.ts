// src/auth/guards/mobile-only-signup.guard.ts
//
// Mobile-only gate for driver registration (POST /auth/signup/driver).
//
// The USER AGENT is the gate — never screen size, never touch detection.
// A desktop-pattern UA gets a 403 whose JSON body carries `message` and
// `storeUrl` (see user-agent.util.ts), and every rejection is written to
// the BlockedSignup table (timestamp, IP, user agent, attempted email)
// — the audit trail for this rule and the spam radar surfaced on the
// admin metrics page. iPad / Android tablets pass: the rule is
// OS-based (see classifySignupUserAgent), not screen-based.
//
// The BlockedSignup write is fire-and-forget: a ledger hiccup can never
// stop the 403 from going out, and the guard itself can never throw
// before the business flow when the UA is mobile.

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { Request } from "express";

import { PrismaService } from "../../prisma/prisma.service";
import { AppEventsService, APP_EVENT } from "../../common/appEvents/appEvents.service";
import { clientIpFromRequest } from "../../common/rate-limit/rate-limit.service";
import { classifySignupUserAgent, mobileOnlySignupPayload } from "../../common/user-agent.util";

@Injectable()
export class MobileOnlySignupGuard implements CanActivate {
  private readonly logger = new Logger(MobileOnlySignupGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appEvents: AppEventsService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const verdict = classifySignupUserAgent(request?.headers?.["user-agent"]);

    if (!verdict.blocked) {
      return true;
    }

    const userAgent = Array.isArray(request?.headers?.["user-agent"])
      ? request.headers["user-agent"].join(" ")
      : ((request?.headers?.["user-agent"] as string) ?? "").toString();

    // Attempted email — only when the posted body carried one. The guard
    // runs before DTO validation, so read defensively off the raw body.
    const rawEmail = (request?.body as any)?.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().slice(0, 255) || null : null;

    const ip = clientIpFromRequest(request);

    // Audit + spam-radar write — never awaited, never fatal.
    this.prisma.blockedSignup
      .create({
        data: {
          ip: ip.slice(0, 128),
          userAgent: userAgent.slice(0, 512),
          email,
          reason: verdict.reason,
        },
      })
      .then(() => {
        // Live ping for the admin metrics page (staff:ops room).
        this.appEvents?.emit(APP_EVENT.ANALYTICS_CHANGED);
      })
      .catch((err: any) => {
        this.logger.warn(
          `BlockedSignup audit write failed: ${err?.message ?? err}`
        );
      });

    this.logger.warn(
      `Blocked driver signup attempt from ${ip} (${verdict.reason})` +
        (email ? ` for ${email}` : "")
    );

    throw new ForbiddenException(mobileOnlySignupPayload());
  }
}
