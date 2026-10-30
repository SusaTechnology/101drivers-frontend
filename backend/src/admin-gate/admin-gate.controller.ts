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

    const options = getCookieOptionsFromRequest(req);
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

    return { ok: true };
  }

  /** Is the gate cookie present and valid? 200 = open, 401 = locked. */
  @Get("status")
  status(@Req() req: Request) {
    const cookies = (
      req as unknown as { cookies?: Record<string, string | undefined> }
    ).cookies;
    if (!this.adminGateService.isCookieValid(cookies?.[ADMIN_GATE_COOKIE])) {
      throw new UnauthorizedException("Admin gate is locked");
    }
    return { ok: true };
  }
}
