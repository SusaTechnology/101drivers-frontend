import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { TrackingSessionService } from "./trackingSession.service";
import { TrackingSessionControllerBase } from "./base/trackingSession.controller.base";

@swagger.ApiTags("trackingSessions")
@common.Controller("trackingSessions")
export class TrackingSessionController extends TrackingSessionControllerBase {
  constructor(
    protected readonly service: TrackingSessionService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
