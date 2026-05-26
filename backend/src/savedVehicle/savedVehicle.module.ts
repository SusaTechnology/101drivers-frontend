import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SavedVehicleModuleBase } from "./base/savedVehicle.module.base";
import { SavedVehicleService } from "./savedVehicle.service";
import { SavedVehicleController } from "./savedVehicle.controller";
import { SavedVehicleResolver } from "./savedVehicle.resolver";
import { SavedVehiclePolicyService } from "src/domain/savedVehicle/savedVehiclePolicy.service";
import { SavedVehicleDomain } from "src/domain/savedVehicle/savedVehicle.domain";

@Module({
  imports: [SavedVehicleModuleBase, forwardRef(() => AuthModule)],
  controllers: [SavedVehicleController],
  providers: [SavedVehicleService, SavedVehicleResolver, SavedVehicleDomain, SavedVehiclePolicyService],
  exports: [SavedVehicleService],
})
export class SavedVehicleModule {}
