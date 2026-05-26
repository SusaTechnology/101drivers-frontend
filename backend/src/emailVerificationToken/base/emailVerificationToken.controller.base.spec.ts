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
import { EmailVerificationTokenController } from "../emailVerificationToken.controller";
import { EmailVerificationTokenService } from "../emailVerificationToken.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  createdAt: new Date(),
  email: "exampleEmail",
  expiresAt: new Date(),
  id: "exampleId",
  tokenHash: "exampleTokenHash",
  verifiedAt: new Date(),
};
const CREATE_RESULT = {
  createdAt: new Date(),
  email: "exampleEmail",
  expiresAt: new Date(),
  id: "exampleId",
  tokenHash: "exampleTokenHash",
  verifiedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    createdAt: new Date(),
    email: "exampleEmail",
    expiresAt: new Date(),
    id: "exampleId",
    tokenHash: "exampleTokenHash",
    verifiedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  createdAt: new Date(),
  email: "exampleEmail",
  expiresAt: new Date(),
  id: "exampleId",
  tokenHash: "exampleTokenHash",
  verifiedAt: new Date(),
};

const service = {
  createEmailVerificationToken() {
    return CREATE_RESULT;
  },
  emailVerificationTokens: () => FIND_MANY_RESULT,
  emailVerificationToken: ({ where }: { where: { id: string } }) => {
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

describe("EmailVerificationToken", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: EmailVerificationTokenService,
          useValue: service,
        },
      ],
      controllers: [EmailVerificationTokenController],
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

  test("POST /emailVerificationTokens", async () => {
    await request(app.getHttpServer())
      .post("/emailVerificationTokens")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        expiresAt: CREATE_RESULT.expiresAt.toISOString(),
        verifiedAt: CREATE_RESULT.verifiedAt.toISOString(),
      });
  });

  test("GET /emailVerificationTokens", async () => {
    await request(app.getHttpServer())
      .get("/emailVerificationTokens")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          expiresAt: FIND_MANY_RESULT[0].expiresAt.toISOString(),
          verifiedAt: FIND_MANY_RESULT[0].verifiedAt.toISOString(),
        },
      ]);
  });

  test("GET /emailVerificationTokens/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/emailVerificationTokens"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /emailVerificationTokens/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/emailVerificationTokens"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        expiresAt: FIND_ONE_RESULT.expiresAt.toISOString(),
        verifiedAt: FIND_ONE_RESULT.verifiedAt.toISOString(),
      });
  });

  test("POST /emailVerificationTokens existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/emailVerificationTokens")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        expiresAt: CREATE_RESULT.expiresAt.toISOString(),
        verifiedAt: CREATE_RESULT.verifiedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/emailVerificationTokens")
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
