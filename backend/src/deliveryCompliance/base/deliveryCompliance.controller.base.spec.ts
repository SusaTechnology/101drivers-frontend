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
import { DeliveryComplianceController } from "../deliveryCompliance.controller";
import { DeliveryComplianceService } from "../deliveryCompliance.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  createdAt: new Date(),
  dropoffCompletedAt: new Date(),
  id: "exampleId",
  odometerEnd: 42,
  odometerStart: 42,
  pickupCompletedAt: new Date(),
  updatedAt: new Date(),
  verifiedByAdminAt: new Date(),
  vinConfirmed: "true",
  vinVerificationCode: "exampleVinVerificationCode",
};
const CREATE_RESULT = {
  createdAt: new Date(),
  dropoffCompletedAt: new Date(),
  id: "exampleId",
  odometerEnd: 42,
  odometerStart: 42,
  pickupCompletedAt: new Date(),
  updatedAt: new Date(),
  verifiedByAdminAt: new Date(),
  vinConfirmed: "true",
  vinVerificationCode: "exampleVinVerificationCode",
};
const FIND_MANY_RESULT = [
  {
    createdAt: new Date(),
    dropoffCompletedAt: new Date(),
    id: "exampleId",
    odometerEnd: 42,
    odometerStart: 42,
    pickupCompletedAt: new Date(),
    updatedAt: new Date(),
    verifiedByAdminAt: new Date(),
    vinConfirmed: "true",
    vinVerificationCode: "exampleVinVerificationCode",
  },
];
const FIND_ONE_RESULT = {
  createdAt: new Date(),
  dropoffCompletedAt: new Date(),
  id: "exampleId",
  odometerEnd: 42,
  odometerStart: 42,
  pickupCompletedAt: new Date(),
  updatedAt: new Date(),
  verifiedByAdminAt: new Date(),
  vinConfirmed: "true",
  vinVerificationCode: "exampleVinVerificationCode",
};

const service = {
  createDeliveryCompliance() {
    return CREATE_RESULT;
  },
  deliveryCompliances: () => FIND_MANY_RESULT,
  deliveryCompliance: ({ where }: { where: { id: string } }) => {
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

describe("DeliveryCompliance", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DeliveryComplianceService,
          useValue: service,
        },
      ],
      controllers: [DeliveryComplianceController],
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

  test("POST /deliveryCompliances", async () => {
    await request(app.getHttpServer())
      .post("/deliveryCompliances")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dropoffCompletedAt: CREATE_RESULT.dropoffCompletedAt.toISOString(),
        pickupCompletedAt: CREATE_RESULT.pickupCompletedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
        verifiedByAdminAt: CREATE_RESULT.verifiedByAdminAt.toISOString(),
      });
  });

  test("GET /deliveryCompliances", async () => {
    await request(app.getHttpServer())
      .get("/deliveryCompliances")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          dropoffCompletedAt:
            FIND_MANY_RESULT[0].dropoffCompletedAt.toISOString(),
          pickupCompletedAt:
            FIND_MANY_RESULT[0].pickupCompletedAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
          verifiedByAdminAt:
            FIND_MANY_RESULT[0].verifiedByAdminAt.toISOString(),
        },
      ]);
  });

  test("GET /deliveryCompliances/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryCompliances"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /deliveryCompliances/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryCompliances"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        dropoffCompletedAt: FIND_ONE_RESULT.dropoffCompletedAt.toISOString(),
        pickupCompletedAt: FIND_ONE_RESULT.pickupCompletedAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
        verifiedByAdminAt: FIND_ONE_RESULT.verifiedByAdminAt.toISOString(),
      });
  });

  test("POST /deliveryCompliances existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/deliveryCompliances")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dropoffCompletedAt: CREATE_RESULT.dropoffCompletedAt.toISOString(),
        pickupCompletedAt: CREATE_RESULT.pickupCompletedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
        verifiedByAdminAt: CREATE_RESULT.verifiedByAdminAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/deliveryCompliances")
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
