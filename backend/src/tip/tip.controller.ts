import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { TipService } from "./tip.service";
import { TipControllerBase } from "./base/tip.controller.base";

@swagger.ApiTags("tips")
@common.Controller("tips")
export class TipController extends TipControllerBase {
  constructor(
    protected readonly service: TipService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
