import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TipModuleBase } from "./base/tip.module.base";
import { TipService } from "./tip.service";
import { TipController } from "./tip.controller";
import { TipResolver } from "./tip.resolver";
import { TipDomain } from "src/domain/tip/tip.domain";
import { TipPolicyService } from "src/domain/tip/tipPolicy.service";

@Module({
  imports: [TipModuleBase, forwardRef(() => AuthModule)],
  controllers: [TipController],
  providers: [TipService, TipResolver, TipDomain, TipPolicyService],
  exports: [TipService],
})
export class TipModule {}
