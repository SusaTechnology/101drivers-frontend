import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { EmailVerificationTokenService } from "./emailVerificationToken.service";
import { EmailVerificationTokenControllerBase } from "./base/emailVerificationToken.controller.base";

@swagger.ApiTags("emailVerificationTokens")
@common.Controller("emailVerificationTokens")
export class EmailVerificationTokenController extends EmailVerificationTokenControllerBase {
  constructor(
    protected readonly service: EmailVerificationTokenService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
