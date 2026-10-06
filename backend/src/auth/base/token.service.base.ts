import { JwtService } from "@nestjs/jwt";
import { ITokenPayload, ITokenService } from "../ITokenService";

export class TokenServiceBase implements ITokenService {
  constructor(protected readonly jwtService: JwtService) {}

  createToken({ id, username, roles }: ITokenPayload): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: id,
        username,
        roles: roles ?? [],
        type: "access",
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
      }
    );
  }

  createRefreshToken({ id, username, roles }: ITokenPayload): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: id,
        username,
        roles: roles ?? [],
        type: "refresh",
      },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
        // Sliding session: the client refreshes long before this expires, and
        // each refresh mints a fresh 30d token. Only a user who is completely
        // inactive for 30 days (or who logs out) loses their session.
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
      }
    );
  }

  verifyRefreshToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
    });
  }
}