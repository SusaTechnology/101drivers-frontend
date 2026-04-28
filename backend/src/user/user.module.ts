import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserModuleBase } from "./base/user.module.base";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { UserResolver } from "./user.resolver";
import { UserPolicyService } from "src/domain/user/userPolicy.service";
import { UserDomain } from "src/domain/user/user.domain";
import { CustomerModule } from "src/customer/customer.module";
import { DriverModule } from "src/driver/driver.module";

@Module({
  imports: [UserModuleBase, forwardRef(() => AuthModule), CustomerModule, DriverModule],
  controllers: [UserController],
providers: [
  UserService,
  UserPolicyService,
  UserDomain,
  UserResolver
] , 
exports: [UserService],
})
export class UserModule {}
