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
import { DisputeCaseController } from "../disputeCase.controller";
import { DisputeCaseService } from "../disputeCase.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  closedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  legalHold: "true",
  openedAt: new Date(),
  reason: "exampleReason",
  resolvedAt: new Date(),
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  closedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  legalHold: "true",
  openedAt: new Date(),
  reason: "exampleReason",
  resolvedAt: new Date(),
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    closedAt: new Date(),
    createdAt: new Date(),
    id: "exampleId",
    legalHold: "true",
    openedAt: new Date(),
    reason: "exampleReason",
    resolvedAt: new Date(),
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  closedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  legalHold: "true",
  openedAt: new Date(),
  reason: "exampleReason",
  resolvedAt: new Date(),
  updatedAt: new Date(),
};

const service = {
  createDisputeCase() {
    return CREATE_RESULT;
  },
  disputeCases: () => FIND_MANY_RESULT,
  disputeCase: ({ where }: { where: { id: string } }) => {
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

describe("DisputeCase", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DisputeCaseService,
          useValue: service,
        },
      ],
      controllers: [DisputeCaseController],
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

  test("POST /disputeCases", async () => {
    await request(app.getHttpServer())
      .post("/disputeCases")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        closedAt: CREATE_RESULT.closedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        openedAt: CREATE_RESULT.openedAt.toISOString(),
        resolvedAt: CREATE_RESULT.resolvedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /disputeCases", async () => {
    await request(app.getHttpServer())
      .get("/disputeCases")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          closedAt: FIND_MANY_RESULT[0].closedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          openedAt: FIND_MANY_RESULT[0].openedAt.toISOString(),
          resolvedAt: FIND_MANY_RESULT[0].resolvedAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /disputeCases/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/disputeCases"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /disputeCases/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/disputeCases"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        closedAt: FIND_ONE_RESULT.closedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        openedAt: FIND_ONE_RESULT.openedAt.toISOString(),
        resolvedAt: FIND_ONE_RESULT.resolvedAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /disputeCases existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/disputeCases")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        closedAt: CREATE_RESULT.closedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        openedAt: CREATE_RESULT.openedAt.toISOString(),
        resolvedAt: CREATE_RESULT.resolvedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/disputeCases")
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
