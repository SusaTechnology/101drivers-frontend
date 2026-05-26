import { Test } from "@nestjs/testing";
import {
  INestApplication,
  HttpStatus,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import request from "supertest";
import { ACGuard } from "nest-access-control";
import { DefaultAuthGuard } from "../../auth/defaultAuth.guard";
import { ACLModule } from "../../auth/acl.module";
import { AclFilterResponseInterceptor } from "../../interceptors/aclFilterResponse.interceptor";
import { AclValidateRequestInterceptor } from "../../interceptors/aclValidateRequest.interceptor";
import { map } from "rxjs";
import { DriverPayoutController } from "../driverPayout.controller";
import { DriverPayoutService } from "../driverPayout.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  createdAt: new Date(),
  driverSharePct: 42.42,
  failedAt: new Date(),
  failureMessage: "exampleFailureMessage",
  grossAmount: 42.42,
  id: "exampleId",
  insuranceFee: 42.42,
  netAmount: 42.42,
  paidAt: new Date(),
  platformFee: 42.42,
  providerTransferId: "exampleProviderTransferId",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  createdAt: new Date(),
  driverSharePct: 42.42,
  failedAt: new Date(),
  failureMessage: "exampleFailureMessage",
  grossAmount: 42.42,
  id: "exampleId",
  insuranceFee: 42.42,
  netAmount: 42.42,
  paidAt: new Date(),
  platformFee: 42.42,
  providerTransferId: "exampleProviderTransferId",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    createdAt: new Date(),
    driverSharePct: 42.42,
    failedAt: new Date(),
    failureMessage: "exampleFailureMessage",
    grossAmount: 42.42,
    id: "exampleId",
    insuranceFee: 42.42,
    netAmount: 42.42,
    paidAt: new Date(),
    platformFee: 42.42,
    providerTransferId: "exampleProviderTransferId",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  createdAt: new Date(),
  driverSharePct: 42.42,
  failedAt: new Date(),
  failureMessage: "exampleFailureMessage",
  grossAmount: 42.42,
  id: "exampleId",
  insuranceFee: 42.42,
  netAmount: 42.42,
  paidAt: new Date(),
  platformFee: 42.42,
  providerTransferId: "exampleProviderTransferId",
  updatedAt: new Date(),
};

const service = {
  createDriverPayout() {
    return CREATE_RESULT;
  },
  driverPayouts: () => FIND_MANY_RESULT,
  driverPayout: ({ where }: { where: { id: string } }) => {
    switch (where.id) {
      case existingId:
        return FIND_ONE_RESULT;
      case nonExistingId:
        return null;
    }
  },
};

const basicAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const argumentHost = context.switchToHttp();
    const request = argumentHost.getRequest();
    request.user = {
      roles: ["user"],
    };
    return true;
  },
};

const acGuard = {
  canActivate: () => {
    return true;
  },
};

const aclFilterResponseInterceptor = {
  intercept: (context: ExecutionContext, next: CallHandler) => {
    return next.handle().pipe(
      map((data) => {
        return data;
      })
    );
  },
};
const aclValidateRequestInterceptor = {
  intercept: (context: ExecutionContext, next: CallHandler) => {
    return next.handle();
  },
};

describe("DriverPayout", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DriverPayoutService,
          useValue: service,
        },
      ],
      controllers: [DriverPayoutController],
      imports: [ACLModule],
    })
      .overrideGuard(DefaultAuthGuard)
      .useValue(basicAuthGuard)
      .overrideGuard(ACGuard)
      .useValue(acGuard)
      .overrideInterceptor(AclFilterResponseInterceptor)
      .useValue(aclFilterResponseInterceptor)
      .overrideInterceptor(AclValidateRequestInterceptor)
      .useValue(aclValidateRequestInterceptor)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  test("POST /driverPayouts", async () => {
    await request(app.getHttpServer())
      .post("/driverPayouts")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        paidAt: CREATE_RESULT.paidAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /driverPayouts", async () => {
    await request(app.getHttpServer())
      .get("/driverPayouts")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          failedAt: FIND_MANY_RESULT[0].failedAt.toISOString(),
          paidAt: FIND_MANY_RESULT[0].paidAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /driverPayouts/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/driverPayouts"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /driverPayouts/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/driverPayouts"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        failedAt: FIND_ONE_RESULT.failedAt.toISOString(),
        paidAt: FIND_ONE_RESULT.paidAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /driverPayouts existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/driverPayouts")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        paidAt: CREATE_RESULT.paidAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/driverPayouts")
          .send(CREATE_INPUT)
          .expect(HttpStatus.CONFLICT)
          .expect({
            statusCode: HttpStatus.CONFLICT,
          });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
