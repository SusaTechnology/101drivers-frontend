import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DisputeNoteResolverBase } from "./base/disputeNote.resolver.base";
import { DisputeNote } from "./base/DisputeNote";
import { DisputeNoteService } from "./disputeNote.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DisputeNote)
export class DisputeNoteResolver extends DisputeNoteResolverBase {
  constructor(
    protected readonly service: DisputeNoteService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
