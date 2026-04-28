import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryAssignmentService } from "./deliveryAssignment.service";
import { DeliveryAssignmentControllerBase } from "./base/deliveryAssignment.controller.base";

@swagger.ApiTags("deliveryAssignments")
@common.Controller("deliveryAssignments")
export class DeliveryAssignmentController extends DeliveryAssignmentControllerBase {
  constructor(
    protected readonly service: DeliveryAssignmentService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
