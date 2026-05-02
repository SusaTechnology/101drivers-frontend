import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { SupportRequestNoteResolverBase } from "./base/supportRequestNote.resolver.base";
import { SupportRequestNote } from "./base/SupportRequestNote";
import { SupportRequestNoteService } from "./supportRequestNote.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => SupportRequestNote)
export class SupportRequestNoteResolver extends SupportRequestNoteResolverBase {
  constructor(
    protected readonly service: SupportRequestNoteService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
