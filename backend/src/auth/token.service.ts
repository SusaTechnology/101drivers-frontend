import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ITokenService } from "./ITokenService";
import { TokenServiceBase } from "./base/token.service.base";

@Injectable()
export class TokenService extends TokenServiceBase implements ITokenService {
  constructor(protected readonly jwtService: JwtService) {
    super(jwtService);
  }
}