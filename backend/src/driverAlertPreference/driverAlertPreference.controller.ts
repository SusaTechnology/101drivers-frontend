import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverAlertPreferenceService } from "./driverAlertPreference.service";
import { DriverAlertPreferenceControllerBase } from "./base/driverAlertPreference.controller.base";

@swagger.ApiTags("driverAlertPreferences")
@common.Controller("driverAlertPreferences")
export class DriverAlertPreferenceController extends DriverAlertPreferenceControllerBase {
  constructor(
    protected readonly service: DriverAlertPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
