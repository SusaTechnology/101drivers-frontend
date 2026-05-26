import { Injectable } from "@nestjs/common";
import { JwtStrategyBase } from "./base/jwt.strategy.base";
import { UserService } from "../../user/user.service";

@Injectable()
export class JwtStrategy extends JwtStrategyBase {
  constructor(protected readonly userService: UserService) {
    super(process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "", userService);
  }
}