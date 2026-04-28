import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { PaymentEventService } from "./paymentEvent.service";
import { PaymentEventControllerBase } from "./base/paymentEvent.controller.base";

@swagger.ApiTags("paymentEvents")
@common.Controller("paymentEvents")
export class PaymentEventController extends PaymentEventControllerBase {
  constructor(
    protected readonly service: PaymentEventService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
