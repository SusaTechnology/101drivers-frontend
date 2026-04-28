import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { SavedAddressResolverBase } from "./base/savedAddress.resolver.base";
import { SavedAddress } from "./base/SavedAddress";
import { SavedAddressService } from "./savedAddress.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => SavedAddress)
export class SavedAddressResolver extends SavedAddressResolverBase {
  constructor(
    protected readonly service: SavedAddressService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
