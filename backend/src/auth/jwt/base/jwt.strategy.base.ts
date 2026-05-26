import { Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { IAuthStrategy } from "../../IAuthStrategy";
import { UserInfo } from "../../UserInfo";
import { UserService } from "../../../user/user.service";
const jwtDebug = new Logger("JwtStrategy");

function extractJwtFromCookieOrHeader(req: Request): string | null {
  if (!req) {
    jwtDebug.warn("No request object in extractor");
    return null;
  }

  const cookieToken = req.cookies?.accessToken;
  const authHeader = req.headers?.authorization;

  jwtDebug.log(
    `Extractor: cookie=${cookieToken ? "yes" : "no"}, bearer=${authHeader?.startsWith("Bearer ") ? "yes" : "no"}`
  );

  if (cookieToken) {
    jwtDebug.log(`Extractor: using cookie token, first20=${cookieToken.slice(0, 20)}...`);
    return cookieToken;
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    jwtDebug.log(`Extractor: using bearer token, first20=${token.slice(0, 20)}...`);
    return token;
  }

  jwtDebug.warn("Extractor: no token found");
  return null;
}

export class JwtStrategyBase
  extends PassportStrategy(Strategy)
  implements IAuthStrategy
{
  constructor(
    protected readonly secretOrKey: string,
    protected readonly userService: UserService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookieOrHeader,
      ]),
      ignoreExpiration: false,
      secretOrKey,
    });
    jwtDebug.log(
  `Strategy init: secret provided=${secretOrKey ? "yes" : "no"}, length=${secretOrKey?.length ?? 0}`
);
  }

 async validate(payload: any): Promise<UserInfo> {
  jwtDebug.log(`Validate: payload=${JSON.stringify(payload)}`);

  const userId = payload?.sub ?? payload?.id;
  const username = payload?.username;

  jwtDebug.log(`Validate: sub=${userId}, username=${username}`);

  let user = null;

  if (userId) {
    user = await this.userService.user({
      where: { id: userId },
    });
    jwtDebug.log(`Validate: user by id ${userId} => ${user ? "found" : "not found"}`);
  }

  if (!user && username) {
    user = await this.userService.user({
      where: { username },
    });
    jwtDebug.log(`Validate: user by username ${username} => ${user ? "found" : "not found"}`);
  }

  if (!user) {
    jwtDebug.error("Validate: user not found, throwing Unauthorized");
    throw new UnauthorizedException();
  }

  if (!user.isActive) {
    jwtDebug.error(`Validate: user ${user.id} inactive`);
    throw new UnauthorizedException();
  }

  const rawRoles: any = (user as any).roles;
  const roles =
    Array.isArray(rawRoles)
      ? rawRoles.map(String)
      : rawRoles
      ? [String(rawRoles)]
      : [];

  jwtDebug.log(`Validate: resolved roles=${JSON.stringify(roles)}`);

  return {
    id: user.id,
    username: user.username,
    roles,
  };
}
}