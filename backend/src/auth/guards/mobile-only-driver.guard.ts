// src/auth/guards/mobile-only-driver.guard.ts
//
// Desktop-blocking gate for the DRIVER SELF-SERVICE endpoints (the four
// /drivers/onboarding-* routes). Same phone/tablet-only rule as driver
// signup, but STRICTER, because the caller is a signed-in driver on a
// desktop browser who wants the phone-only flow on a big screen — most
// cheaply via DevTools' device toolbar or a UA-switcher extension:
//
//   • x-device-touch: 1 is REQUIRED (device.ts attaches it to every
//     driver-onboarding call) — a scripted replay with a borrowed iPhone
//     UA never sends it.
//   • Chrome's own client hints (sec-ch-ua-mobile / sec-ch-ua-platform)
//     must agree with the claimed device — a UA-switcher extension
//     rewrites the UA but not these. DevTools' device toolbar rewrites
//     UA AND hints coherently and still passes; that residual gap is
//     physical, and it is why every block is audited.
//
// Phones AND tablets are welcome; only desktops and laptops are turned
// away. A blocked attempt gets a 403 whose JSON body carries `message`
// and `storeUrl` (see user-agent.util.ts), and every rejection is written
// to the BlockedSignup table (timestamp, IP, user agent, reason) — the
// same audit trail / spam radar the signup gate feeds; NO_TOUCH_HINT and
// CLIENT_HINT_MISMATCH rows only ever originate here.
//
// The BlockedSignup write is fire-and-forget: a ledger hiccup can never
// stop the 403 from going out, and the guard itself can never throw
// before the business flow when the device is welcome.

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { Request } from "express";

import { PrismaService } from "../../prisma/prisma.service";
import { AppEventsService, APP_EVENT } from "../../common/appEvents/appEvents.service";
import { clientIpFromRequest } from "../../common/rate-limit/rate-limit.service";
import {
  classifyDriverDeviceRequest,
  mobileOnlyDriverPayload,
} from "../../common/user-agent.util";

@Injectable()
export class MobileOnlyDriverGuard implements CanActivate {
  private readonly logger = new Logger(MobileOnlyDriverGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appEvents: AppEventsService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headers = request?.headers ?? {};
    const verdict = classifyDriverDeviceRequest(
      headers["user-agent"],
      headers["x-device-touch"],
      headers["sec-ch-ua-mobile"],
      headers["sec-ch-ua-platform"]
    );

    if (!verdict.blocked) {
      return true;
    }

    const userAgent = Array.isArray(headers["user-agent"])
      ? headers["user-agent"].join(" ")
      : ((headers["user-agent"] as string) ?? "").toString();

    const ip = clientIpFromRequest(request);

    // Audit + spam-radar write — never awaited, never fatal.
    this.prisma.blockedSignup
      .create({
        data: {
          ip: ip.slice(0, 128),
          userAgent: userAgent.slice(0, 512),
          email: null,
          reason: `${verdict.reason} (driver portal)`,
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
      `Blocked driver-portal request from ${ip} (${verdict.reason})`
    );

    throw new ForbiddenException(mobileOnlyDriverPayload());
  }
}
