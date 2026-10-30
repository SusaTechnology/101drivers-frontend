import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { IsString } from "class-validator";
import type { Request, Response } from "express";

import { getCookieOptionsFromRequest } from "../common/cors-cookie.util";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_MIRROR_COOKIE,
  AdminGateService,
} from "./admin-gate.service";

export class UnlockGateDto {
  // DTO properties are populated by ValidationPipe — definite assignment.
  @IsString()
  key!: string;
}

/**
 * AdminGateController — the two PUBLIC endpoints of the admin door.
 *
 * They are intentionally reachable without authentication: the gate has
 * to work BEFORE anyone has logged in. Neither endpoint ever returns
 * admin data — "unlock" only flips the cookie, "status" only answers
 * ok/unauthorized, so neither leaks anything about the admin area.
 */
@Controller("admin-gate")
export class AdminGateController {
  constructor(private readonly adminGateService: AdminGateService) {}

  /** Validate a ?key= access key and set the 30-day gate cookie. */
  @Post("unlock")
  unlock(
    @Body() dto: UnlockGateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!this.adminGateService.isValidAccessKey(dto?.key)) {
      throw new UnauthorizedException("Invalid access key");
    }

    // HOST-ONLY gate cookies — deliberately NOT the shared auth options'
    // Domain=.techbee.et. A Set-Cookie whose Domain doesn't match the
    // responding host (e.g. an /api proxy on 101drivers.com) is SILENTLY
    // DROPPED by the browser, so the door would relock on every reload.
    // The gate cookie only ever needs to travel back to the API host that
    // set it — a host-only cookie does exactly that, on every shape of
    // deployment. Policy is otherwise the shared one (httpOnly/secure/
    // sameSite/maxAge).
    const { domain: _gateCookieDomain, ...options } =
      getCookieOptionsFromRequest(req);
    const { name, value, maxAgeMs } = this.adminGateService.issueCookie();

    // The real gate — httpOnly, JavaScript never sees it.
    res.cookie(name, value, { ...options, maxAge: maxAgeMs });
    // Same-origin UX mirror — lets a same-origin SPA answer "is the door
    // open?" without a network probe. Cross-origin deployments (API on a
    // different host) simply never read this cookie and use /status.
    res.cookie(ADMIN_GATE_MIRROR_COOKIE, "1", {
      ...options,
      httpOnly: false,
      maxAge: maxAgeMs,
    });

    // Token fallback for browsers that refuse even a correct cross-site
    // cookie (iOS PWA standalone, Safari ITP, third-party cookies off —
    // the same limitation that already forced the x-refresh-token header):
    // the SPA keeps this signed value in localStorage and presents it as
    // an x-admin-gate-token header on GET /status. It is the SAME signed
    // "<expiry>.<hmac>" value the cookie carries — nothing new to verify.
    return { ok: true, gateToken: value };
  }

  /**
   * Is the gate credential present and valid? 200 = open, 401 = locked.
   * Two accepted credentials, whichever the browser managed to keep:
   *   1. the httpOnly admin_gate cookie (primary), or
   *   2. the x-admin-gate-token header carrying the signed value the SPA
   *      stored at unlock time (fallback for cookie-blocked browsers).
   */
  @Get("status")
  status(@Req() req: Request) {
    const cookies = (
      req as unknown as { cookies?: Record<string, string | undefined> }
    ).cookies;
    const headers = (
      req as unknown as { headers?: Record<string, unknown> }
    ).headers;
    const headerToken = headers?.["x-admin-gate-token"];

    const valid =
      this.adminGateService.isCookieValid(cookies?.[ADMIN_GATE_COOKIE]) ||
      (typeof headerToken === "string" &&
        this.adminGateService.isCookieValid(headerToken));

    if (!valid) {
      throw new UnauthorizedException("Admin gate is locked");
    }
    return { ok: true };
  }
}
