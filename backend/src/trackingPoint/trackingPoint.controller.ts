import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { TrackingPointService } from "./trackingPoint.service";
import { TrackingPointControllerBase } from "./base/trackingPoint.controller.base";

@swagger.ApiTags("trackingPoints")
@common.Controller("trackingPoints")
export class TrackingPointController extends TrackingPointControllerBase {
  constructor(
    protected readonly service: TrackingPointService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
