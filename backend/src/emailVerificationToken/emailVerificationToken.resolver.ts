import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { EmailVerificationTokenResolverBase } from "./base/emailVerificationToken.resolver.base";
import { EmailVerificationToken } from "./base/EmailVerificationToken";
import { EmailVerificationTokenService } from "./emailVerificationToken.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => EmailVerificationToken)
export class EmailVerificationTokenResolver extends EmailVerificationTokenResolverBase {
  constructor(
    protected readonly service: EmailVerificationTokenService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
