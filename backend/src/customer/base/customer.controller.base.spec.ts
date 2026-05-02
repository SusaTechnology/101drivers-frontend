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
import { CustomerController } from "../customer.controller";
import { CustomerService } from "../customer.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  approvedAt: new Date(),
  businessAddress: "exampleBusinessAddress",
  businessName: "exampleBusinessName",
  businessPhone: "exampleBusinessPhone",
  businessPlaceId: "exampleBusinessPlaceId",
  businessWebsite: "exampleBusinessWebsite",
  contactEmail: "exampleContactEmail",
  contactName: "exampleContactName",
  contactPhone: "exampleContactPhone",
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  postpaidEnabled: "true",
  suspendedAt: new Date(),
  suspensionReason: "exampleSuspensionReason",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  approvedAt: new Date(),
  businessAddress: "exampleBusinessAddress",
  businessName: "exampleBusinessName",
  businessPhone: "exampleBusinessPhone",
  businessPlaceId: "exampleBusinessPlaceId",
  businessWebsite: "exampleBusinessWebsite",
  contactEmail: "exampleContactEmail",
  contactName: "exampleContactName",
  contactPhone: "exampleContactPhone",
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  postpaidEnabled: "true",
  suspendedAt: new Date(),
  suspensionReason: "exampleSuspensionReason",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    approvedAt: new Date(),
    businessAddress: "exampleBusinessAddress",
    businessName: "exampleBusinessName",
    businessPhone: "exampleBusinessPhone",
    businessPlaceId: "exampleBusinessPlaceId",
    businessWebsite: "exampleBusinessWebsite",
    contactEmail: "exampleContactEmail",
    contactName: "exampleContactName",
    contactPhone: "exampleContactPhone",
    createdAt: new Date(),
    id: "exampleId",
    phone: "examplePhone",
    postpaidEnabled: "true",
    suspendedAt: new Date(),
    suspensionReason: "exampleSuspensionReason",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  approvedAt: new Date(),
  businessAddress: "exampleBusinessAddress",
  businessName: "exampleBusinessName",
  businessPhone: "exampleBusinessPhone",
  businessPlaceId: "exampleBusinessPlaceId",
  businessWebsite: "exampleBusinessWebsite",
  contactEmail: "exampleContactEmail",
  contactName: "exampleContactName",
  contactPhone: "exampleContactPhone",
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  postpaidEnabled: "true",
  suspendedAt: new Date(),
  suspensionReason: "exampleSuspensionReason",
  updatedAt: new Date(),
};

const service = {
  createCustomer() {
    return CREATE_RESULT;
  },
  customers: () => FIND_MANY_RESULT,
  customer: ({ where }: { where: { id: string } }) => {
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

describe("Customer", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: CustomerService,
          useValue: service,
        },
      ],
      controllers: [CustomerController],
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

  test("POST /customers", async () => {
    await request(app.getHttpServer())
      .post("/customers")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        approvedAt: CREATE_RESULT.approvedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        suspendedAt: CREATE_RESULT.suspendedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /customers", async () => {
    await request(app.getHttpServer())
      .get("/customers")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          approvedAt: FIND_MANY_RESULT[0].approvedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          suspendedAt: FIND_MANY_RESULT[0].suspendedAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /customers/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/customers"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /customers/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/customers"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        approvedAt: FIND_ONE_RESULT.approvedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        suspendedAt: FIND_ONE_RESULT.suspendedAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /customers existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/customers")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        approvedAt: CREATE_RESULT.approvedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        suspendedAt: CREATE_RESULT.suspendedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/customers")
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
