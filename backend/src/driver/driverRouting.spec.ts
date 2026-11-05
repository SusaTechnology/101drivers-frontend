// Route-ordering regression spec for the driver self-service endpoints.
//
// DriverController redeclares the Amplication base catch-alls as its own
// methods (driver -> GET /:id, updateDriver -> PATCH /:id), which match any
// single-segment subpath. NestJS scans controller methods in DECLARATION
// order and Express matches in registration order, so the self-service
// onboarding routes MUST be declared before those catch-alls. When they
// lived in a second @Controller("drivers") class (and later, at the bottom
// of this class), GET/PATCH /api/drivers/onboarding-data resolved against
// the catch-alls and production answered
// 404 `No resource was found for {"id":"onboarding-data"}`.
//
// This spec boots the REAL DriverController (mirroring main.ts's "api"
// global prefix) and asserts the self-service routes reach THEIR handlers —
// not the catch-alls — while the ":id" behavior stays intact.

import { Test } from "@nestjs/testing";
import {
  INestApplication,
  HttpStatus,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import request from "supertest";
import { map } from "rxjs";
import { ACGuard } from "nest-access-control";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { ACLModule } from "../auth/acl.module";
import { MobileOnlySignupGuard } from "../auth/guards/mobile-only-signup.guard";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { DriverController } from "./driver.controller";
import { DriverService } from "./driver.service";
import { PrismaService } from "../prisma/prisma.service";

const DRIVER_PROFILE_ID = "driver-profile-1";
const DRIVER_USER_ID = "user-1";

const ONBOARDING_DATA_RESULT = {
  driverStatus: "PENDING_APPROVAL",
  onboardingCompleted: true,
  editable: true,
  licenseNumber: "D1234567",
  licenseState: "CA",
  licenseFrontUrl: "https://files.example/front.jpg",
  licenseBackUrl: "https://files.example/back.jpg",
};

const ONBOARDING_STATUS_ROW = {
  status: "PENDING_APPROVAL",
  onboardingCompletedAt: new Date("2026-11-05T10:00:00Z"),
};

const COMPLETE_RESULT = { onboardingCompleted: true, driverStatus: "PENDING_APPROVAL" };

const UPDATE_RESULT = {
  driverStatus: "PENDING_APPROVAL",
  onboardingCompleted: true,
  editable: false,
  licenseNumber: "D7654321",
  licenseState: "CA",
  licenseFrontUrl: "https://files.example/front-new.jpg",
  licenseBackUrl: "https://files.example/back-new.jpg",
};

const existingId = "existingId";
const FIND_ONE_RESULT = {
  approvedAt: null,
  createdAt: new Date(),
  id: existingId,
  phone: "examplePhone",
  profilePhotoUrl: "exampleProfilePhotoUrl",
  updatedAt: new Date(),
};

const service = {
  getOnboardingData: (profileId: string) => {
    expect(profileId).toBe(DRIVER_PROFILE_ID);
    return ONBOARDING_DATA_RESULT;
  },
  updateOnboardingData: (profileId: string) => {
    expect(profileId).toBe(DRIVER_PROFILE_ID);
    return UPDATE_RESULT;
  },
  completeOnboarding: (profileId: string) => {
    expect(profileId).toBe(DRIVER_PROFILE_ID);
    return COMPLETE_RESULT;
  },
  // Serves both the onboarding-status handler (id = profileId) and the base
  // :id findOne route; null makes the base throw its NotFound.
  driver: ({ where }: { where: { id: string } }) => {
    if (where.id === DRIVER_PROFILE_ID) {
      return ONBOARDING_STATUS_ROW;
    }
    if (where.id === existingId) {
      return FIND_ONE_RESULT;
    }
    return null;
  },
};

// Same guards/interceptors as driver.controller.base.spec.ts. The auth stub
// mirrors the REAL JwtStrategyBase.validate() output — { id, username,
// roles, isSuperAdmin }, NO profileId — and takes the user id from an
// x-test-user-id header so a test can act as a user with no driver row.
// The onboarding handlers resolve the driver row from user.id via
// PrismaService (Driver.userId is @unique); a stub that smuggled
// profileId onto request.user is exactly how the live
// 403 "Driver profile not found" slipped past the first routing spec.
const basicAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const argumentHost = context.switchToHttp();
    const request = argumentHost.getRequest();
    request.user = {
      username: "driver@test.example",
      roles: ["DRIVER"],
      id: (request.headers["x-test-user-id"] as string) || DRIVER_USER_ID,
      isSuperAdmin: false,
    };
    return true;
  },
};

// In-memory stand-in for the Prisma boundary: the controller looks the
// driver up by the AUTHENTICATED userId, so only user-1 has a profile.
const prisma = {
  driver: {
    findUnique: ({ where }: { where: { userId?: string; id?: string } }) => {
      if (where.userId !== undefined) {
        return where.userId === DRIVER_USER_ID
          ? { id: DRIVER_PROFILE_ID }
          : null;
      }
      return null;
    },
  },
};

const acGuard = {
  canActivate: () => {
    return true;
  },
};

const mobileOnlyGuard = {
  canActivate: () => {
    return true;
  },
};

const aclFilterResponseInterceptor = {
  intercept: (context: ExecutionContext, next: CallHandler) => {
    return next.handle().pipe(map((data) => data));
  },
};

const aclValidateRequestInterceptor = {
  intercept: (context: ExecutionContext, next: CallHandler) => {
    return next.handle();
  },
};

describe("Driver self-service routing", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DriverService,
          useValue: service,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
      controllers: [DriverController],
      imports: [ACLModule],
    })
      .overrideGuard(DefaultAuthGuard)
      .useValue(basicAuthGuard)
      .overrideGuard(ACGuard)
      .useValue(acGuard)
      .overrideGuard(MobileOnlySignupGuard)
      .useValue(mobileOnlyGuard)
      .overrideInterceptor(AclFilterResponseInterceptor)
      .useValue(aclFilterResponseInterceptor)
      .overrideInterceptor(AclValidateRequestInterceptor)
      .useValue(aclValidateRequestInterceptor)
      .compile();

    app = moduleRef.createNestApplication();
    // main.ts sets the same prefix in production.
    app.setGlobalPrefix("api");
    await app.init();
  });

  test("GET /api/drivers/onboarding-data reaches the onboarding handler, not :id", async () => {
    await request(app.getHttpServer())
      .get("/api/drivers/onboarding-data")
      .expect(HttpStatus.OK)
      .expect(ONBOARDING_DATA_RESULT);
  });

  test("PATCH /api/drivers/onboarding-data reaches the onboarding handler, not :id", async () => {
    await request(app.getHttpServer())
      .patch("/api/drivers/onboarding-data")
      .send({ licenseNumber: "D7654321", licenseState: "CA" })
      .expect(HttpStatus.OK)
      .expect(UPDATE_RESULT);
  });

  test("GET /api/drivers/onboarding-status reaches the onboarding handler, not :id", async () => {
    await request(app.getHttpServer())
      .get("/api/drivers/onboarding-status")
      .expect(HttpStatus.OK)
      .expect({
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-11-05T10:00:00.000Z",
        driverStatus: "PENDING_APPROVAL",
        dateOfBirth: null,
        residentialZip: null,
      });
  });

  test("POST /api/drivers/onboarding-complete reaches the onboarding handler", async () => {
    await request(app.getHttpServer())
      .post("/api/drivers/onboarding-complete")
      .send({ licenseNumber: "D1234567" })
      .expect(HttpStatus.CREATED)
      .expect(COMPLETE_RESULT);
  });

  test("GET /api/drivers/onboarding-data 403s when the user has no driver profile row", async () => {
    await request(app.getHttpServer())
      .get("/api/drivers/onboarding-data")
      .set("x-test-user-id", "user-without-profile")
      .expect(HttpStatus.FORBIDDEN)
      .expect({
        message: "Driver profile not found",
        error: "Forbidden",
        statusCode: HttpStatus.FORBIDDEN,
      });
  });

  test("GET /api/drivers/:id still serves the base route for real ids", async () => {
    await request(app.getHttpServer())
      .get(`/api/drivers/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /api/drivers/:id still answers the base 404 for unknown ids", async () => {
    await request(app.getHttpServer())
      .get("/api/drivers/does-not-exist")
      .expect(HttpStatus.NOT_FOUND);
  });

  afterAll(async () => {
    await app.close();
  });
});
