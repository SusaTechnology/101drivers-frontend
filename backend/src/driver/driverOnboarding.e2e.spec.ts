import "./onboarding-e2e.env";

// End-to-end check for the driver self-service onboarding routes, run over
// the REAL request pipeline: real DefaultAuthGuard + JwtStrategy (the user
// is rebuilt from the DB store on every request), real ACGuard + the real
// grants.json ACL, real MobileOnlySignupGuard device gate, real ACL request/
// response interceptors, real ValidationPipe and the real DriverService +
// DriverController logic. Only boundaries that would leave the process are
// faked: the PrismaService store (in-memory) and the unused domain deps of
// DriverService (policy / approval engine / service area — none of the
// exercised code paths call them).
//
// This is the layer the routing spec cannot see: it caught the live
// 403 {"message":"Driver profile not found"} that happened because the
// handlers read request.user.profileId — a field JwtStrategyBase.validate()
// never puts on request.user.
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ACGuard } from "nest-access-control";
import request from "supertest";
import { DriverController } from "./driver.controller";
import { DriverService } from "./driver.service";
import { DriverDomain } from "../domain/driver/driver.domain";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { JwtStrategy } from "../auth/jwt/jwt.strategy";
import { ACLModule } from "../auth/acl.module";
import { MobileOnlySignupGuard } from "../auth/guards/mobile-only-signup.guard";
import { AppEventsService } from "../common/appEvents/appEvents.service";
import { PrismaService } from "../prisma/prisma.service";

const DRIVER_PROFILE_ID = "e2e-driver-profile";

const USER_WITH_PROFILE = {
  id: "e2e-user-with-profile",
  username: "e2edriver",
  roles: ["DRIVER"],
  isActive: true,
  isSuperAdmin: false,
};

const USER_WITHOUT_PROFILE = {
  id: "e2e-user-no-profile",
  username: "e2enorow",
  roles: ["DRIVER"],
  isActive: true,
  isSuperAdmin: false,
};

const usersById = new Map<string, any>([
  [USER_WITH_PROFILE.id, USER_WITH_PROFILE],
  [USER_WITHOUT_PROFILE.id, USER_WITHOUT_PROFILE],
]);

const driverRows = new Map<string, any>();

function seedDriver() {
  driverRows.set(DRIVER_PROFILE_ID, {
    id: DRIVER_PROFILE_ID,
    userId: USER_WITH_PROFILE.id,
    status: "PENDING_APPROVAL",
    onboardingCompletedAt: new Date("2026-01-15T09:00:00Z"),
    licenseNumber: "D1234567",
    licenseState: "CA",
    licenseFrontUrl: "https://files.example/front.jpg",
    licenseBackUrl: "https://files.example/back.jpg",
    fullName: "E2E Driver",
  });
}

function fullDriverRow(id: string) {
  const row = driverRows.get(id);
  return row ? { ...row, user: { fullName: row.fullName } } : null;
}

const auditWrites: any[] = [];

// In-memory replacement for the Prisma boundary: user lookups feed the real
// JwtStrategy.validate(), driver lookups feed resolveDriverProfileId and the
// real DriverService methods. Models these routes never touch fall through
// to the Proxy's no-op handler so unrelated boot-time readers tolerate the
// fake (an empty settings row, an empty findMany, etc.).
const prismaHandlers: any = {
  $connect: async () => undefined,
  $disconnect: async () => undefined,
  $transaction: async (ops: any) => {
    if (Array.isArray(ops)) {
      for (const op of ops) await op;
      return;
    }
    if (typeof ops === "function") return ops(prismaHandlers);
    return undefined;
  },
  user: {
    findUnique: async ({ where }: any) => usersById.get(where.id) ?? null,
  },
  driver: {
    findUnique: async ({ where }: any) => {
      if (where && "userId" in where) {
        for (const row of driverRows.values()) {
          if (row.userId === where.userId) return fullDriverRow(row.id);
        }
        return null;
      }
      return where?.id ? fullDriverRow(where.id) : null;
    },
    findFirst: async () => null,
    findMany: async () => [],
    update: async ({ where, data }: any) => {
      const row = driverRows.get(where.id);
      if (!row) throw new Error("e2e fake: driver row missing");
      Object.assign(row, data);
      return fullDriverRow(row.id);
    },
  },
  adminAuditLog: {
    create: async ({ data }: any) => {
      auditWrites.push(data);
      return { id: "e2e-audit-1", ...data };
    },
  },
  blockedSignup: {
    create: async () => ({ id: "e2e-blocked-1" }),
  },
};

// NOTE: deliberately a plain object, NOT a Proxy — Nest reflects over
// provider values for lifecycle hooks and metadata, and a Proxy get-trap
// returning functions for every property stalls that scan.
const prismaFake = prismaHandlers;

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("Driver self-service onboarding — real pipeline", () => {
  let app: INestApplication;
  let driverToken: string;
  let noProfileToken: string;

  beforeAll(async () => {
    seedDriver();
    const moduleRef = await Test.createTestingModule({
      imports: [ACLModule, JwtModule.register({})],
      controllers: [DriverController],
      providers: [
        { provide: PrismaService, useValue: prismaFake },
        {
          // The real JwtStrategyBase.validate() logic, pointed at the
          // in-memory user store (JwtStrategy only ever calls
          // userService.user({ where: { id | username } })).
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy({
              user: async ({ where }: any) => usersById.get(where.id) ?? null,
            } as any),
        },
        DefaultAuthGuard,
        ACGuard,
        MobileOnlySignupGuard,
        { provide: AppEventsService, useValue: { emit: () => undefined } },
        {
          provide: DriverService,
          useFactory: (prisma: PrismaService) =>
            new DriverService(
              prisma,
              new DriverDomain(prisma),
              {} as any, // policy — not exercised by these routes
              {} as any, // approval engine — not exercised
              {} as any // service areas — not exercised
            ),
          inject: [PrismaService],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts's HTTP surface for these routes.
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, forbidUnknownValues: false })
    );
    await app.init();

    // Mint REAL access tokens with the same payload shape TokenServiceBase
    // produces: { sub, username, roles, type: "access" }.
    const jwtService = moduleRef.get(JwtService);
    const sign = (user: { id: string; username: string; roles: string[] }) =>
      jwtService.sign(
        { sub: user.id, username: user.username, roles: user.roles, type: "access" },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "15m" }
      );
    driverToken = sign(USER_WITH_PROFILE);
    noProfileToken = sign(USER_WITHOUT_PROFILE);
  }, 60_000);

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  test("401 without any token", async () => {
    await request(app.getHttpServer())
      .get("/api/drivers/onboarding-data")
      .expect(HttpStatus.UNAUTHORIZED);
  });

  test("GET /api/drivers/onboarding-data — real JwtStrategy + real service payload", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/drivers/onboarding-data")
      .set(bearer(driverToken))
      .expect(HttpStatus.OK);

    expect(res.body).toEqual({
      driverStatus: "PENDING_APPROVAL",
      onboardingCompleted: true,
      onboardingCompletedAt: "2026-01-15T09:00:00.000Z",
      editable: true,
      licenseNumber: "D1234567",
      licenseState: "CA",
      licenseFrontUrl: "https://files.example/front.jpg",
      licenseBackUrl: "https://files.example/back.jpg",
    });
  });

  test("GET /api/drivers/onboarding-data — 403 'Driver profile not found' for a DRIVER user with no driver row", async () => {
    // This is the exact payload reported from production against the
    // previous build, where the handler read request.user.profileId.
    const res = await request(app.getHttpServer())
      .get("/api/drivers/onboarding-data")
      .set(bearer(noProfileToken))
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body).toMatchObject({
      message: "Driver profile not found",
      error: "Forbidden",
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  test("PATCH /api/drivers/onboarding-data — real service update + audit trail (mobile device)", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/drivers/onboarding-data")
      .set(bearer(driverToken))
      .set("user-agent", MOBILE_UA)
      .send({
        licenseNumber: "D7654321",
        licenseState: "CA",
        licenseFrontUrl: "https://files.example/front-new.jpg",
        licenseBackUrl: "https://files.example/back-new.jpg",
      })
      .expect(HttpStatus.OK);

    expect(res.body).toEqual({
      driverStatus: "PENDING_APPROVAL",
      onboardingCompleted: true,
      onboardingCompletedAt: "2026-01-15T09:00:00.000Z",
      editable: true,
      licenseNumber: "D7654321",
      licenseState: "CA",
      licenseFrontUrl: "https://files.example/front-new.jpg",
      licenseBackUrl: "https://files.example/back-new.jpg",
    });

    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0].driverId).toBe(DRIVER_PROFILE_ID);
    expect(auditWrites[0].reason).toContain("PENDING_APPROVAL");
  });

  test("PATCH /api/drivers/onboarding-data — desktop browser stays blocked by the mobile-only gate", async () => {
    await request(app.getHttpServer())
      .patch("/api/drivers/onboarding-data")
      .set(bearer(driverToken))
      .set("user-agent", DESKTOP_UA)
      .send({
        licenseNumber: "D1111111",
        licenseState: "CA",
        licenseFrontUrl: "https://files.example/x.jpg",
        licenseBackUrl: "https://files.example/y.jpg",
      })
      .expect(HttpStatus.FORBIDDEN);
  });

  test("GET /api/drivers/onboarding-status — real status for the signed-in driver", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/drivers/onboarding-status")
      .set(bearer(driverToken))
      .expect(HttpStatus.OK);

    expect(res.body).toMatchObject({
      onboardingCompleted: true,
      driverStatus: "PENDING_APPROVAL",
    });
  });

  test("GET /api/drivers/:id catch-all still serves real ids after the fix", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/drivers/${DRIVER_PROFILE_ID}`)
      .set(bearer(driverToken))
      .expect(HttpStatus.OK);

    expect(res.body).toMatchObject({ id: DRIVER_PROFILE_ID });
  });

  afterAll(async () => {
    await app.close();
  });
});
