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
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
      }
    );
  }

  verifyRefreshToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
    });
  }
}