import { Module } from "@nestjs/common";

import { AdminGateController } from "./admin-gate.controller";
import { AdminGateService } from "./admin-gate.service";

/**
 * AdminGateModule — the shared-secret door in front of the admin UI.
 * Leaf module with no dependencies: unlock + status endpoints only.
 * See admin-gate.service.ts for the key/cookie design.
 */
@Module({
  controllers: [AdminGateController],
  providers: [AdminGateService],
  exports: [AdminGateService],
})
export class AdminGateModule {}
