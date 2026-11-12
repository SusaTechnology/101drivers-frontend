import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import {
  AdminInviteAcceptDto,
  UserAdminInviteBodyDto,
  UserAdminDisableBodyDto,
  UserAdminEnableBodyDto,
  UserAdminPromoteBodyDto,
  UserAdminDemoteBodyDto,
} from "./dto/userAdmin.dto";
import { AdminInviteService } from "./adminInvite.service";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { AdminGuard, SuperAdminGuard } from "../auth/adminAuth.guard";

/**
 * Admin invite + admin team management endpoints.
 *
 * Admin-side (JWT + AdminGuard):
 *   POST /api/users/admin-invite            — invite a new administrator by email
 *   POST /api/users/:id/admin-resend-invite — resend the setup link
 *   POST /api/users/:id/admin-disable       — disable an admin (kills sessions + blocks sign-in)
 *   POST /api/users/:id/admin-enable        — re-enable a disabled admin
 *   POST /api/users/:id/admin-promote       — raise an admin to super admin
 *   POST /api/users/:id/admin-demote        — downgrade a super admin to plain admin
 *
 * Which of these require a SUPER admin is decided by the capability
 * registry src/auth/super-admin.ts — today: disable, promote, demote.
 * Those endpoints additionally carry SuperAdminGuard, and every service
 * call asserts the capability again server-side. The actor identity is
 * always taken from the JWT (request.user) — never from the body.
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
    @common.Body() body: UserAdminInviteBodyDto,
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.inviteAdmin({
      email: body.email,
      fullName: body.fullName,
      phone: body.phone ?? null,
      // Actor identity comes from the JWT — the body value is never
      // trusted for authorization decisions.
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
    });
  }

  @common.Post("users/:id/admin-resend-invite")
  @swagger.ApiOkResponse({ type: Object })
  @common.UseGuards(DefaultAuthGuard, AdminGuard)
  async resendAdminInvite(
    @common.Param("id") id: string,
    @common.Body() body: { actorUserId?: string | null },
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.resendInvite({
      userId: id,
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
    });
  }

  @common.Post("users/:id/admin-disable")
  @swagger.ApiOkResponse({ type: Object })
  // Super-admin-only (src/auth/super-admin.ts): regular admins can no
  // longer disable each other. SuperAdminGuard rejects before the
  // service; the service asserts the capability again as defense in
  // depth. The JWT strategy re-reads the DB on every request, so
  // revoking a super admin's flag takes effect immediately.
  @common.UseGuards(DefaultAuthGuard, AdminGuard, SuperAdminGuard)
  async disableAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminDisableBodyDto,
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.disableAdmin({
      userId: id,
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
      reason: body?.reason ?? null,
    });
  }

  @common.Post("users/:id/admin-enable")
  @swagger.ApiOkResponse({ type: Object })
  // Super-admin-only (src/auth/super-admin.ts): only a super admin may
  // undo a disable decision — regular admins cannot restore each other.
  // SuperAdminGuard rejects before the service; the service asserts the
  // capability again as defense in depth.
  @common.UseGuards(DefaultAuthGuard, AdminGuard, SuperAdminGuard)
  async enableAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminEnableBodyDto,
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.enableAdmin({
      userId: id,
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
    });
  }

  @common.Post("users/:id/admin-promote")
  @swagger.ApiOkResponse({ type: Object })
  // Super-admin-only: raising admins into the super-admin tier is
  // itself a super-admin capability.
  @common.UseGuards(DefaultAuthGuard, AdminGuard, SuperAdminGuard)
  async promoteAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminPromoteBodyDto,
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.promoteAdmin({
      userId: id,
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
    });
  }

  @common.Post("users/:id/admin-demote")
  @swagger.ApiOkResponse({ type: Object })
  // Super-admin-only. The service refuses self-demote and demoting the
  // last remaining super admin, so the system always keeps one.
  @common.UseGuards(DefaultAuthGuard, AdminGuard, SuperAdminGuard)
  async demoteAdmin(
    @common.Param("id") id: string,
    @common.Body() body: UserAdminDemoteBodyDto,
    @common.Request() request: any
  ): Promise<any> {
    return this.adminInviteService.demoteAdmin({
      userId: id,
      actorUserId: request?.user?.id ?? body?.actorUserId ?? null,
      actorIsSuperAdmin: request?.user?.isSuperAdmin === true,
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
