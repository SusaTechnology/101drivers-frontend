import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryStatusHistoryService } from "./deliveryStatusHistory.service";
import { DeliveryStatusHistoryControllerBase } from "./base/deliveryStatusHistory.controller.base";

@swagger.ApiTags("deliveryStatusHistories")
@common.Controller("deliveryStatusHistories")
export class DeliveryStatusHistoryController extends DeliveryStatusHistoryControllerBase {
  constructor(
    protected readonly service: DeliveryStatusHistoryService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
