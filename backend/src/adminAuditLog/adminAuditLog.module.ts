import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminAuditLogModuleBase } from "./base/adminAuditLog.module.base";
import { AdminAuditLogService } from "./adminAuditLog.service";
import { AdminAuditLogController } from "./adminAuditLog.controller";
import { AdminAuditLogResolver } from "./adminAuditLog.resolver";
import { AdminAuditLogDomain } from "src/domain/adminAuditLog/adminAuditLog.domain";
import { AdminAuditLogPolicyService } from "src/domain/adminAuditLog/adminAuditLogPolicy.service";


@Module({
  imports: [AdminAuditLogModuleBase, forwardRef(() => AuthModule)],
  controllers: [AdminAuditLogController],
  providers: [AdminAuditLogService, AdminAuditLogResolver, AdminAuditLogDomain, AdminAuditLogPolicyService],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
