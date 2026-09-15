import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import {
  AdminInviteAcceptDto,
  UserAdminInviteBodyDto,
  UserAdminDisableBodyDto,
  UserAdminEnableBodyDto,
} from "./dto/userAdmin.dto";
import { AdminInviteService } from "./adminInvite.service";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { AdminGuard } from "../auth/adminAuth.guard";

/**
 * Admin invite + admin team management endpoints.
 *
 * Admin-side (JWT + AdminGuard):
 *   POST /api/users/admin-invite            — invite a new administrator by email
 *   POST /api/users/:id/admin-resend-invite — resend the setup link
 *   POST /api/users/:id/admin-disable       — disable an admin (kills sessions + blocks sign-in)
 *   POST /api/users/:id/admin-enable        — re-enable a disabled admin
 *
 * Public (no auth — the invitee has no usable account yet):
 *   GET  /api/auth/accept-invite?token=   — validate a setup link (page load)
 *   POST /api/auth/accept-invite          — set password and activate the account
 */
@swagger.ApiTags("users")
@common.Controller()
export class AdminInviteController {
  constructor(private readonly adminInviteService: AdminInviteService) {}

  // ==================== ADMIN-SIDE ====================

  @common.Post("users/admin-invite")
  @swagger.ApiOkResponse({ type: Object })
  @common.UseGuards(DefaultAuthGuard, AdminGuard)
  async inviteAdmin(
    @common.Body() body: UserAdminInviteBodyDto
  ): Promise<any> {
    return this.adminInviteService.inviteAdmin({
      email: body.email,
      fullName: body.fullName,
      phone: body.phone ?? null,
      actorUserId: body.actorUserId ?? null,
    });
  }

  @common.Post("users/:id/admin-resend-invite")
  @swagger.ApiOkResponse({ type: Object })
  @common.UseGuards(DefaultAuthGuard, AdminGuard)
  async resendAdminInvite(
    @common.Param("id") id: string,
    @common.Body() body: { actorUserId?: string | null }
  ): Promise<any> {
    return this.adminInviteService.resendInvite({
      userId: id,
      actorUserId: body?.actorUserId ?? null,
    });
  }

  @common.Post("users/:id/admin-disable")
  @swagger.ApiOkResponse({ type: Object })
  @common.UseGuards(DefaultAuthGuard, AdminGuard)
  async disableAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminDisableBodyDto
  ): Promise<any> {
    return this.adminInviteService.disableAdmin({
      userId: id,
      actorUserId: body?.actorUserId ?? null,
      reason: body?.reason ?? null,
    });
  }

  @common.Post("users/:id/admin-enable")
  @swagger.ApiOkResponse({ type: Object })
  @common.UseGuards(DefaultAuthGuard, AdminGuard)
  async enableAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminEnableBodyDto
  ): Promise<any> {
    return this.adminInviteService.enableAdmin({
      userId: id,
      actorUserId: body?.actorUserId ?? null,
    });
  }

  // ==================== PUBLIC (invitee) ====================

  @common.Get("auth/accept-invite")
  @swagger.ApiOkResponse({ type: Object })
  async validateInvite(
    @common.Query("token") token?: string
  ): Promise<{ email: string; fullName: string | null }> {
    return this.adminInviteService.validateInviteToken(token ?? "");
  }

  @common.Post("auth/accept-invite")
  @common.HttpCode(common.HttpStatus.OK)
  @swagger.ApiOkResponse({ type: Object })
  async acceptInvite(
    @common.Body() body: AdminInviteAcceptDto
  ): Promise<{ success: true; email: string }> {
    const result = await this.adminInviteService.acceptInvite({
      token: body?.token ?? "",
      password: body?.password ?? "",
    });

    return { success: true, email: result.email };
  }
}
