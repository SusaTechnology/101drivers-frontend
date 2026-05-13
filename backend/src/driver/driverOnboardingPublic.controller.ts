import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { DriverService } from "./driver.service";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";

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
    };
  }

  @common.Post("onboarding-complete")
  @swagger.ApiOkResponse({ description: "Onboarding completed successfully" })
  @swagger.ApiBadRequestResponse({ description: "Invalid input or driver not eligible" })
  @swagger.ApiNotFoundResponse({ description: "Invalid or expired token" })
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
