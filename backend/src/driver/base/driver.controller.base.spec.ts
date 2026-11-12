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
import { DriverController } from "../driver.controller";
import { DriverService } from "../driver.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  approvedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  profilePhotoUrl: "exampleProfilePhotoUrl",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  approvedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  profilePhotoUrl: "exampleProfilePhotoUrl",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    approvedAt: new Date(),
    createdAt: new Date(),
    id: "exampleId",
    phone: "examplePhone",
    profilePhotoUrl: "exampleProfilePhotoUrl",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  approvedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  phone: "examplePhone",
  profilePhotoUrl: "exampleProfilePhotoUrl",
  updatedAt: new Date(),
};

const service = {
  createDriver() {
    return CREATE_RESULT;
  },
  drivers: () => FIND_MANY_RESULT,
  driver: ({ where }: { where: { id: string } }) => {
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

describe("Driver", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DriverService,
          useValue: service,
        },
      ],
      controllers: [DriverController],
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

  test("POST /drivers", async () => {
    await request(app.getHttpServer())
      .post("/drivers")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        approvedAt: CREATE_RESULT.approvedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /drivers", async () => {
    await request(app.getHttpServer())
      .get("/drivers")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          approvedAt: FIND_MANY_RESULT[0].approvedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /drivers/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/drivers"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /drivers/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/drivers"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        approvedAt: FIND_ONE_RESULT.approvedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /drivers existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/drivers")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        approvedAt: CREATE_RESULT.approvedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/drivers")
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
