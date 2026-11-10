// Boot-execution spec for the meeting-request RESEND flow.
//
// Boots the REAL chain — UserController → UserService → DriverService →
// DriverApprovalEngine (none of them mocked) — with only the two EXTERNAL
// boundaries replaced: PrismaService (in-memory rows) and MailService
// (records the send; a real SMTP account must never be exercised from a
// test). Asserts:
//   1. A MEETING_REQUESTED driver can receive the request AGAIN (the
//      resend path): the atomic updateMany accepts PENDING_APPROVAL and
//      MEETING_REQUESTED, the mail leaves with the picked Reply-To/BCC,
//      and the audit + notification provenance carry resend=true.
//   2. A PENDING_APPROVAL driver still works (first-request path) with
//      NO resend flag.
//   3. An APPROVED driver is rejected 400 BEFORE anything is written.
//   4. A failing SMTP send propagates as an error and no email leaves.

import { Test } from "@nestjs/testing";
import { INestApplication, ExecutionContext, CallHandler } from "@nestjs/common";
import request from "supertest";
import { map } from "rxjs";
import { ACGuard } from "nest-access-control";
import { AppModule } from "../../app.module";
import { DefaultAuthGuard } from "../../auth/defaultAuth.guard";
import { AclFilterResponseInterceptor } from "../../interceptors/aclFilterResponse.interceptor";
import { AclValidateRequestInterceptor } from "../../interceptors/aclValidateRequest.interceptor";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../../common/mail/mail.service";

process.env.JWT_ACCESS_SECRET ||= "meeting-resend-test-secret";
process.env.JWT_SECRET ||= "meeting-resend-test-secret";
// AuthModule's JwtModule factory reads these via SecretsManager/Config:
// secret key = JWT_SECRET_KEY, expiry = JWT_EXPIRATION.
process.env.JWT_SECRET_KEY ||= "meeting-resend-test-secret";
process.env.JWT_EXPIRATION ||= "3600";
// PasswordService throws at construction without a salt round count.
process.env.BCRYPT_SALT ||= "10";

const ADMIN_USER_ID = "admin-user-1";
const ADMIN_EMAIL = "admin@101drivers.com";
const DRIVER_ROW_ID = "driver-row-1";
const DRIVER_USER_ID = "driver-user-1";
const DRIVER_EMAIL = "driver@example.com";

// Mutable per-test rows. `linkedUser` serves BOTH findUniqueOrThrow call
// shapes: the service chain's { id, driver: { id } } probe and
// getAdminUserDetail's wide select after the send.
const rows = {
  driverStatus: "PENDING_APPROVAL" as string,
  updateCount: 1,
};
const linkedUser = {
  id: DRIVER_USER_ID,
  email: DRIVER_EMAIL,
  username: "driveruser",
  fullName: "Test Driver",
  roles: "DRIVER",
  isActive: true,
  driver: { id: DRIVER_ROW_ID },
};

const writes = {
  updateMany: [] as any[],
  audits: [] as any[],
  notifications: [] as any[],
  emails: [] as any[],
  failSend: false,
};

function resetWrites() {
  writes.updateMany = [];
  writes.audits = [];
  writes.notifications = [];
  writes.emails = [];
  writes.failSend = false;
}

// Generic fallback model: getAdminUserDetail runs a Promise.all of ~6
// findMany queries over audit/notification/delivery models after the send;
// every unspecified model.method resolves to a harmless default.
function modelProxy(specific: Record<string, unknown> = {}) {
  return new Proxy(specific, {
    get(target, method: string) {
      if (method in target) return (target as any)[method];
      if (method === "findMany") return async () => [];
      if (method === "findUnique" || method === "findFirst") return async () => null;
      if (method === "count") return async () => 0;
      if (method === "aggregate" || method === "groupBy") return async () => ({});
      return async () => ({});
    },
  });
}

const prismaMock = new Proxy(
  {
    driver: modelProxy({
      findUnique: async () => ({
        id: DRIVER_ROW_ID,
        status: rows.driverStatus,
        userId: DRIVER_USER_ID,
        user: { email: DRIVER_EMAIL, fullName: "Test Driver" },
      }),
    }),
    user: modelProxy({
      // Engine's actor lookup (select { email, fullName }).
      findUnique: async () => ({ email: ADMIN_EMAIL, fullName: "Test Admin" }),
      // Service chain probe + getAdminUserDetail after the send.
      findUniqueOrThrow: async () => linkedUser,
    }),
    $transaction: async (cb: (tx: any) => Promise<void>) =>
      cb(
        modelProxy({
          driver: {
            updateMany: async (args: any) => {
              writes.updateMany.push(args);
              return { count: rows.updateCount };
            },
          },
          adminAuditLog: {
            create: async (args: any) => {
              writes.audits.push(args);
              return {};
            },
          },
          notificationEvent: {
            create: async (args: any) => {
              writes.notifications.push(args);
              return {};
            },
          },
        })
      ),
  },
  {
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return modelProxy();
    },
  }
);

const mailMock = {
  isConfigured: true,
  // Mirrors MailService.platformFromAddress — the shared-record BCC target.
  platformFromAddress: "info@101drivers.com",
  sendMail: async (params: any) => {
    if (writes.failSend) {
      throw new Error("SMTP connection refused (test)");
    }
    writes.emails.push(params);
    return { messageId: "test-1" };
  },
};

describe("Meeting request resend (real service chain)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Auth stub mirrors the REAL JwtStrategyBase.validate() output and
    // acts as the admin who clicked the button (the meeting-request route
    // takes actorUserId from the body, exactly like the admin UI sends it).
    const adminAuthGuard = {
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        request.user = {
          id: ADMIN_USER_ID,
          username: "admin",
          email: ADMIN_EMAIL,
          roles: ["ADMIN"],
          isSuperAdmin: false,
        };
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(MailService)
      .useValue(mailMock)
      .overrideGuard(DefaultAuthGuard)
      .useValue(adminAuthGuard)
      .overrideGuard(ACGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(AclFilterResponseInterceptor)
      .useValue({
        intercept: (_context: ExecutionContext, next: CallHandler) =>
          next.handle().pipe(map((data) => data)),
      })
      .overrideInterceptor(AclValidateRequestInterceptor)
      .useValue({
        intercept: (_context: ExecutionContext, next: CallHandler) =>
          next.handle(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api"); // mirror main.ts / production paths
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    resetWrites();
  });

  const postMeetingRequest = (driverUserId: string, body?: object) =>
    request(app.getHttpServer())
      .post(`/api/users/${driverUserId}/request-meeting-driver`)
      .send({
        message: "Can we meet Thursday at 10am?",
        fromMode: "mine",
        fromEmail: ADMIN_EMAIL,
        actorUserId: ADMIN_USER_ID,
        ...body,
      });

  it("RESEND: a MEETING_REQUESTED driver gets the email again with resend provenance", async () => {
    rows.driverStatus = "MEETING_REQUESTED";
    rows.updateCount = 1;

    const res = await postMeetingRequest(DRIVER_USER_ID);
    expect([200, 201]).toContain(res.status);

    // The atomic guard accepts BOTH resumable statuses.
    expect(writes.updateMany).toHaveLength(1);
    expect(writes.updateMany[0].where.status).toEqual({
      in: ["PENDING_APPROVAL", "MEETING_REQUESTED"],
    });
    expect(writes.updateMany[0].data).toEqual({
      status: "MEETING_REQUESTED",
    });

    // Exactly ONE email left, to the driver, Reply-To = the admin, BCC =
    // the admin's tracking copy + the shared platform record address.
    expect(writes.emails).toHaveLength(1);
    expect(writes.emails[0].to).toBe(DRIVER_EMAIL);
    expect(writes.emails[0].replyTo).toBe(ADMIN_EMAIL);
    expect(writes.emails[0].bcc).toEqual([
      ADMIN_EMAIL,
      "info@101drivers.com",
    ]);

    // Provenance: this send is marked as a resend in BOTH records.
    expect(writes.notifications).toHaveLength(1);
    expect(writes.notifications[0].data.payload.resend).toBe(true);
    expect(writes.notifications[0].data.templateCode).toBe(
      "driver-meeting-request"
    );
    expect(writes.audits).toHaveLength(1);
    expect(writes.audits[0].data.beforeJson.status).toBe("MEETING_REQUESTED");
    expect(writes.audits[0].data.afterJson.email.resend).toBe(true);
    expect(writes.audits[0].data.afterJson.email.triggeredBy).toBe(ADMIN_EMAIL);
  });

  it("FIRST REQUEST: a PENDING_APPROVAL driver still works with no resend flag", async () => {
    rows.driverStatus = "PENDING_APPROVAL";
    rows.updateCount = 1;

    const res = await postMeetingRequest(DRIVER_USER_ID);
    expect([200, 201]).toContain(res.status);
    expect(writes.emails).toHaveLength(1);
    expect(writes.updateMany[0].where.status).toEqual({
      in: ["PENDING_APPROVAL", "MEETING_REQUESTED"],
    });
    expect(writes.notifications[0].data.payload.resend).toBeUndefined();
    expect(writes.audits[0].data.beforeJson.status).toBe("PENDING_APPROVAL");
    expect(writes.audits[0].data.afterJson.status).toBe("MEETING_REQUESTED");
  });

  it("GUARD: an APPROVED driver is rejected 400 before anything is written", async () => {
    rows.driverStatus = "APPROVED";

    const res = await postMeetingRequest(DRIVER_USER_ID);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(
      /pending approval or an outstanding meeting request/
    );
    expect(writes.updateMany).toHaveLength(0);
    expect(writes.audits).toHaveLength(0);
    expect(writes.notifications).toHaveLength(0);
    expect(writes.emails).toHaveLength(0);
  });

  it("ROLLBACK PATH: an SMTP failure surfaces as an error and no email leaves", async () => {
    rows.driverStatus = "MEETING_REQUESTED";
    writes.failSend = true;

    const res = await postMeetingRequest(DRIVER_USER_ID);
    expect(res.status).toBe(500);
    expect(writes.emails).toHaveLength(0);
  });

  it("PLATFORM MODE: fromEmail is ignored; BCC goes to the admin's account + the shared record", async () => {
    rows.driverStatus = "MEETING_REQUESTED";

    const res = await postMeetingRequest(DRIVER_USER_ID, {
      fromMode: "platform",
      fromEmail: "not-used@example.com",
    });
    expect([200, 201]).toContain(res.status);
    expect(writes.emails).toHaveLength(1);
    expect(writes.emails[0].replyTo).toBeNull();
    expect(writes.emails[0].bcc).toEqual([
      ADMIN_EMAIL,
      "info@101drivers.com",
    ]);
    expect(writes.notifications[0].data.payload.resend).toBe(true);
  });
});
