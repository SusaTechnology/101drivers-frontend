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
import { PaymentController } from "../payment.controller";
import { PaymentService } from "../payment.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  amount: 42.42,
  authorizedAt: new Date(),
  capturedAt: new Date(),
  createdAt: new Date(),
  failedAt: new Date(),
  failureCode: "exampleFailureCode",
  failureMessage: "exampleFailureMessage",
  id: "exampleId",
  invoiceId: "exampleInvoiceId",
  paidAt: new Date(),
  providerChargeId: "exampleProviderChargeId",
  providerPaymentIntentId: "exampleProviderPaymentIntentId",
  refundedAt: new Date(),
  updatedAt: new Date(),
  voidedAt: new Date(),
};
const CREATE_RESULT = {
  amount: 42.42,
  authorizedAt: new Date(),
  capturedAt: new Date(),
  createdAt: new Date(),
  failedAt: new Date(),
  failureCode: "exampleFailureCode",
  failureMessage: "exampleFailureMessage",
  id: "exampleId",
  invoiceId: "exampleInvoiceId",
  paidAt: new Date(),
  providerChargeId: "exampleProviderChargeId",
  providerPaymentIntentId: "exampleProviderPaymentIntentId",
  refundedAt: new Date(),
  updatedAt: new Date(),
  voidedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    amount: 42.42,
    authorizedAt: new Date(),
    capturedAt: new Date(),
    createdAt: new Date(),
    failedAt: new Date(),
    failureCode: "exampleFailureCode",
    failureMessage: "exampleFailureMessage",
    id: "exampleId",
    invoiceId: "exampleInvoiceId",
    paidAt: new Date(),
    providerChargeId: "exampleProviderChargeId",
    providerPaymentIntentId: "exampleProviderPaymentIntentId",
    refundedAt: new Date(),
    updatedAt: new Date(),
    voidedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  amount: 42.42,
  authorizedAt: new Date(),
  capturedAt: new Date(),
  createdAt: new Date(),
  failedAt: new Date(),
  failureCode: "exampleFailureCode",
  failureMessage: "exampleFailureMessage",
  id: "exampleId",
  invoiceId: "exampleInvoiceId",
  paidAt: new Date(),
  providerChargeId: "exampleProviderChargeId",
  providerPaymentIntentId: "exampleProviderPaymentIntentId",
  refundedAt: new Date(),
  updatedAt: new Date(),
  voidedAt: new Date(),
};

const service = {
  createPayment() {
    return CREATE_RESULT;
  },
  payments: () => FIND_MANY_RESULT,
  payment: ({ where }: { where: { id: string } }) => {
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

describe("Payment", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: PaymentService,
          useValue: service,
        },
      ],
      controllers: [PaymentController],
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

  test("POST /payments", async () => {
    await request(app.getHttpServer())
      .post("/payments")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        authorizedAt: CREATE_RESULT.authorizedAt.toISOString(),
        capturedAt: CREATE_RESULT.capturedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        paidAt: CREATE_RESULT.paidAt.toISOString(),
        refundedAt: CREATE_RESULT.refundedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
        voidedAt: CREATE_RESULT.voidedAt.toISOString(),
      });
  });

  test("GET /payments", async () => {
    await request(app.getHttpServer())
      .get("/payments")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          authorizedAt: FIND_MANY_RESULT[0].authorizedAt.toISOString(),
          capturedAt: FIND_MANY_RESULT[0].capturedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          failedAt: FIND_MANY_RESULT[0].failedAt.toISOString(),
          paidAt: FIND_MANY_RESULT[0].paidAt.toISOString(),
          refundedAt: FIND_MANY_RESULT[0].refundedAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
          voidedAt: FIND_MANY_RESULT[0].voidedAt.toISOString(),
        },
      ]);
  });

  test("GET /payments/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/payments"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /payments/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/payments"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        authorizedAt: FIND_ONE_RESULT.authorizedAt.toISOString(),
        capturedAt: FIND_ONE_RESULT.capturedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        failedAt: FIND_ONE_RESULT.failedAt.toISOString(),
        paidAt: FIND_ONE_RESULT.paidAt.toISOString(),
        refundedAt: FIND_ONE_RESULT.refundedAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
        voidedAt: FIND_ONE_RESULT.voidedAt.toISOString(),
      });
  });

  test("POST /payments existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/payments")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        authorizedAt: CREATE_RESULT.authorizedAt.toISOString(),
        capturedAt: CREATE_RESULT.capturedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        paidAt: CREATE_RESULT.paidAt.toISOString(),
        refundedAt: CREATE_RESULT.refundedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
        voidedAt: CREATE_RESULT.voidedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/payments")
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
