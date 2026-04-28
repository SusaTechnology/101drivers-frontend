import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ServiceDistrictModuleBase } from "./base/serviceDistrict.module.base";
import { ServiceDistrictService } from "./serviceDistrict.service";
import { ServiceDistrictController } from "./serviceDistrict.controller";
import { ServiceDistrictResolver } from "./serviceDistrict.resolver";
import { ServiceDistrictDomain } from "src/domain/serviceDistrict/serviceDistrict.domain";
import { ServiceDistrictPolicyService } from "src/domain/serviceDistrict/serviceDistrictPolicy.service";
import { ServiceDistrictPublicController } from "./serviceDistrict.public.controller";

@Module({
  imports: [ServiceDistrictModuleBase, forwardRef(() => AuthModule)],
  controllers: [ServiceDistrictController, ServiceDistrictPublicController],
  providers: [ServiceDistrictService, ServiceDistrictResolver, ServiceDistrictDomain, ServiceDistrictPolicyService],
  exports: [ServiceDistrictService],
})
export class ServiceDistrictModule {}
