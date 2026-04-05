import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverPreferenceService } from "./driverPreference.service";
import { DriverPreferenceControllerBase } from "./base/driverPreference.controller.base";

@swagger.ApiTags("driverPreferences")
@common.Controller("driverPreferences")
export class DriverPreferenceController extends DriverPreferenceControllerBase {
  constructor(
    protected readonly service: DriverPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
