import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SavedAddressModuleBase } from "./base/savedAddress.module.base";
import { SavedAddressService } from "./savedAddress.service";
import { SavedAddressController } from "./savedAddress.controller";
import { SavedAddressResolver } from "./savedAddress.resolver";
import { SavedAddressDomain } from "src/domain/savedAddress/savedAddress.domain";
import { SavedAddressPolicyService } from "src/domain/savedAddress/savedAddressPolicy.service";

@Module({
  imports: [SavedAddressModuleBase, forwardRef(() => AuthModule)],
  controllers: [SavedAddressController],
  providers: [SavedAddressService, SavedAddressResolver, SavedAddressDomain, SavedAddressPolicyService],
  exports: [SavedAddressService],
})
export class SavedAddressModule {}
