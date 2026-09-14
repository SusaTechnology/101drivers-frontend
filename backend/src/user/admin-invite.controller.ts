import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { AdminInviteAcceptDto, UserAdminInviteBodyDto } from "./dto/userAdmin.dto";
import { AdminInviteService } from "./adminInvite.service";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { AdminGuard } from "../auth/adminAuth.guard";

/**
 * Admin invite endpoints.
 *
 * Admin-side (JWT + AdminGuard):
 *   POST /api/users/admin-invite          — invite a new administrator by email
 *   POST /api/users/:id/admin-resend-invite — resend the setup link
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
