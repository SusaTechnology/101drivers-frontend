import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { SavedAddressService } from "./savedAddress.service";
import { SavedAddressControllerBase } from "./base/savedAddress.controller.base";

@swagger.ApiTags("savedAddresses")
@common.Controller("savedAddresses")
export class SavedAddressController extends SavedAddressControllerBase {
  constructor(
    protected readonly service: SavedAddressService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
