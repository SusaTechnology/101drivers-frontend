import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverDistrictPreferenceService } from "./driverDistrictPreference.service";
import { DriverDistrictPreferenceControllerBase } from "./base/driverDistrictPreference.controller.base";

@swagger.ApiTags("driverDistrictPreferences")
@common.Controller("driverDistrictPreferences")
export class DriverDistrictPreferenceController extends DriverDistrictPreferenceControllerBase {
  constructor(
    protected readonly service: DriverDistrictPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
