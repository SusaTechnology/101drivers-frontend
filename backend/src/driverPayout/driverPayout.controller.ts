import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutControllerBase } from "./base/driverPayout.controller.base";

@swagger.ApiTags("driverPayouts")
@common.Controller("driverPayouts")
export class DriverPayoutController extends DriverPayoutControllerBase {
  constructor(
    protected readonly service: DriverPayoutService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
