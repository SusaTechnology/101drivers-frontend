import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryRatingService } from "./deliveryRating.service";
import { DeliveryRatingControllerBase } from "./base/deliveryRating.controller.base";

@swagger.ApiTags("deliveryRatings")
@common.Controller("deliveryRatings")
export class DeliveryRatingController extends DeliveryRatingControllerBase {
  constructor(
    protected readonly service: DeliveryRatingService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
