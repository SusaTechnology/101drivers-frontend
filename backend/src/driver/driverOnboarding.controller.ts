import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverService } from "./driver.service";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { Request } from "express";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";

@swagger.ApiTags("drivers")
@common.Controller("drivers")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DriverOnboardingController {
  constructor(
    protected readonly service: DriverService
  ) {}

  @common.Post("/onboarding-complete")
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
  }> {
    const profileId = (request as any).user?.profileId;
    if (!profileId) {
      return { onboardingCompleted: false, onboardingCompletedAt: null, driverStatus: "UNKNOWN", dateOfBirth: null };
    }

    const driver = await this.service.driver({
      where: { id: profileId },
      select: {
        status: true,
        onboardingCompletedAt: true,
        dateOfBirth: true,
      },
    });

    return {
      onboardingCompleted: !!driver?.onboardingCompletedAt,
      onboardingCompletedAt: driver?.onboardingCompletedAt?.toISOString() ?? null,
      driverStatus: driver?.status ?? "UNKNOWN",
      dateOfBirth: driver?.dateOfBirth?.toISOString() ?? null,
    };
  }
}
