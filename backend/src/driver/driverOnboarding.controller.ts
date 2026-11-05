import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverService } from "./driver.service";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { Request } from "express";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";
import { UpdateDriverOnboardingDto } from "./dto/driverOnboardingUpdate.dto";
import { MobileOnlySignupGuard } from "../auth/guards/mobile-only-signup.guard";

@swagger.ApiTags("drivers")
@common.Controller("drivers")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DriverOnboardingController {
  constructor(
    protected readonly service: DriverService
  ) {}

  @common.Post("/onboarding-complete")
  // Driver onboarding is PHONE/TABLET ONLY — same desktop gate as driver
  // signup (runs after DefaultAuthGuard, so the identity is already
  // resolved; it then classifies the device like the public route).
  @common.UseGuards(MobileOnlySignupGuard)
  @swagger.ApiOkResponse({ description: "Onboarding completed successfully" })
  @swagger.ApiBadRequestResponse({ description: "Invalid input or driver not eligible" })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "own",
  })
  async completeOnboarding(
    @common.Req() request: Request,
    @common.Body() body: CompleteDriverOnboardingDto
  ) {
    const profileId = (request as any).user?.profileId;
    if (!profileId) {
      throw new common.ForbiddenException("Driver profile not found");
    }

    try {
      return await this.service.completeOnboarding(profileId, body);
    } catch (error) {
      if (error instanceof common.BadRequestException) {
        throw error;
      }
      throw new common.NotFoundException(
        `Failed to complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  @common.Get("/onboarding-status")
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        onboardingCompleted: { type: "boolean" },
        onboardingCompletedAt: { type: "string", nullable: true },
        driverStatus: { type: "string" },
        residentialZip: { type: "string", nullable: true },
      },
    },
  })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "own",
  })
  async getOnboardingStatus(
    @common.Req() request: Request
  ): Promise<{
    onboardingCompleted: boolean;
    onboardingCompletedAt: string | null;
    driverStatus: string;
    dateOfBirth: string | null;
    residentialZip: string | null;
  }> {
    const profileId = (request as any).user?.profileId;
    if (!profileId) {
      return { onboardingCompleted: false, onboardingCompletedAt: null, driverStatus: "UNKNOWN", dateOfBirth: null, residentialZip: null };
    }

    const driver = await this.service.driver({
      where: { id: profileId },
      select: {
        status: true,
        onboardingCompletedAt: true,
        dateOfBirth: true,
        // Signup already collects (and stores) a 5-digit home ZIP; exposing
        // it here lets the onboarding form reuse it instead of asking again.
        residentialZip: true,
      },
    });

    return {
      onboardingCompleted: !!driver?.onboardingCompletedAt,
      onboardingCompletedAt: driver?.onboardingCompletedAt?.toISOString() ?? null,
      driverStatus: driver?.status ?? "UNKNOWN",
      dateOfBirth: driver?.dateOfBirth?.toISOString() ?? null,
      residentialZip: driver?.residentialZip ?? null,
    };
  }

  // ── Onboarding-data edit (self-service) ────────────────────────────────
  // Prefill + update for the driver's Application Status board "Edit
  // Application Info" page. GET returns everything the form prefills with
  // (including the stored photo URLs and DOB; SSN only as last four) plus
  // an `editable` flag so the page can render an honest not-available card.
  // PATCH re-validates with the same rules the completion form enforces
  // (identity uniqueness, 25+ DOB, California ZIP) and never touches the
  // driver's status or onboardingCompletedAt. The PATCH keeps the same
  // PHONE/TABLET-ONLY gate as onboarding-complete — re-capturing license
  // and selfie photos requires the live camera, and desktops are refused
  // on both layers by design.

  @common.Get("/onboarding-data")
  @swagger.ApiOkResponse({
    description: "The driver's submitted onboarding data for prefill",
    schema: {
      type: "object",
      properties: {
        driverStatus: { type: "string" },
        onboardingCompleted: { type: "boolean" },
        editable: { type: "boolean" },
        dateOfBirth: { type: "string", nullable: true },
        licenseNumber: { type: "string", nullable: true },
        licenseState: { type: "string", nullable: true },
        licenseFrontUrl: { type: "string", nullable: true },
        licenseBackUrl: { type: "string", nullable: true },
        selfiePhotoUrl: { type: "string", nullable: true },
        residentialAddressLine1: { type: "string", nullable: true },
        residentialAddressLine2: { type: "string", nullable: true },
        residentialCity: { type: "string", nullable: true },
        residentialState: { type: "string", nullable: true },
        residentialZip: { type: "string", nullable: true },
        ssnLastFour: { type: "string", nullable: true },
        agreementAcceptedAt: { type: "string", nullable: true },
      },
    },
  })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "own",
  })
  async getOnboardingData(@common.Req() request: Request) {
    const profileId = (request as any).user?.profileId;
    if (!profileId) {
      throw new common.ForbiddenException("Driver profile not found");
    }
    return this.service.getOnboardingData(profileId);
  }

  @common.Patch("/onboarding-data")
  @common.UseGuards(MobileOnlySignupGuard)
  @swagger.ApiOkResponse({ description: "Onboarding data updated" })
  @swagger.ApiBadRequestResponse({
    description: "Invalid input or the data is not editable for this status",
  })
  @swagger.ApiConflictResponse({
    description: "SSN or license already registered on another account",
  })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "own",
  })
  async updateOnboardingData(
    @common.Req() request: Request,
    @common.Body() body: UpdateDriverOnboardingDto
  ) {
    const profileId = (request as any).user?.profileId;
    if (!profileId) {
      throw new common.ForbiddenException("Driver profile not found");
    }

    try {
      return await this.service.updateOnboardingData(profileId, body);
    } catch (error) {
      if (
        error instanceof common.BadRequestException ||
        error instanceof common.ConflictException
      ) {
        throw error;
      }
      throw new common.NotFoundException(
        `Failed to update onboarding data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
