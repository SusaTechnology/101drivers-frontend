import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { SavedVehicleService } from "./savedVehicle.service";
import { SavedVehicleControllerBase } from "./base/savedVehicle.controller.base";

@swagger.ApiTags("savedVehicles")
@common.Controller("savedVehicles")
export class SavedVehicleController extends SavedVehicleControllerBase {
  constructor(
    protected readonly service: SavedVehicleService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
