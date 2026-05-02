import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DisputeNoteService } from "./disputeNote.service";
import { DisputeNoteControllerBase } from "./base/disputeNote.controller.base";

@swagger.ApiTags("disputeNotes")
@common.Controller("disputeNotes")
export class DisputeNoteController extends DisputeNoteControllerBase {
  constructor(
    protected readonly service: DisputeNoteService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
