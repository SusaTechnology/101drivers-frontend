import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { DriverService } from "./driver.service";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";
import { MobileOnlySignupGuard } from "../auth/guards/mobile-only-signup.guard";

@swagger.ApiTags("drivers")
@common.Controller("public/drivers")
export class DriverOnboardingPublicController {
  constructor(
    protected readonly service: DriverService
  ) {}

  @common.Get("onboarding-status")
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        onboardingCompleted: { type: "boolean" },
        driverStatus: { type: "string" },
        driverName: { type: "string", nullable: true },
        residentialZip: { type: "string", nullable: true },
      },
    },
  })
  @swagger.ApiNotFoundResponse({ description: "Invalid or expired token" })
  async getOnboardingStatusByToken(
    @common.Query("token") token: string,
  ): Promise<{
    valid: boolean;
    onboardingCompleted: boolean;
    driverStatus: string;
    driverName: string | null;
    dateOfBirth: string | null;
    residentialZip: string | null;
  }> {
    if (!token) {
      throw new common.NotFoundException("Token is required");
    }

    const driver = await this.service.findDriverByOnboardingToken(token);

    if (!driver) {
      throw new common.NotFoundException("Invalid or expired token");
    }

    return {
      valid: true,
      onboardingCompleted: !!driver.onboardingCompletedAt,
      driverStatus: driver.status,
      driverName: driver.user?.fullName ?? null,
      dateOfBirth: driver.dateOfBirth?.toISOString() ?? null,
      residentialZip: driver.residentialZip ?? null,
    };
  }

  @common.Post("onboarding-complete")
  // Driver onboarding is PHONE/TABLET ONLY — same desktop gate as driver
  // signup (the email-token link and the status-board button both land
  // here, so a desktop/laptop must be turned away server-side too).
  @common.UseGuards(MobileOnlySignupGuard)
  @swagger.ApiOkResponse({ description: "Onboarding completed successfully" })
  @swagger.ApiBadRequestResponse({ description: "Invalid input or driver not eligible" })
  @swagger.ApiNotFoundResponse({ description: "Invalid or expired token" })
  @swagger.ApiForbiddenResponse({ description: "Desktop/laptop browsers are not allowed" })
  async completeOnboardingByToken(
    @common.Body() body: CompleteDriverOnboardingDto & { token: string },
  ) {
    if (!body.token) {
      throw new common.NotFoundException("Token is required");
    }

    try {
      return await this.service.completeOnboardingByToken(body.token, body);
    } catch (error) {
      if (error instanceof common.BadRequestException) {
        throw error;
      }
      throw new common.NotFoundException(
        `Failed to complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
