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
import { DriverLocationController } from "../driverLocation.controller";
import { DriverLocationService } from "../driverLocation.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  createdAt: new Date(),
  currentAt: new Date(),
  currentLat: 42.42,
  currentLng: 42.42,
  homeBaseCity: "exampleHomeBaseCity",
  homeBaseLat: 42.42,
  homeBaseLng: 42.42,
  homeBaseState: "exampleHomeBaseState",
  id: "exampleId",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  createdAt: new Date(),
  currentAt: new Date(),
  currentLat: 42.42,
  currentLng: 42.42,
  homeBaseCity: "exampleHomeBaseCity",
  homeBaseLat: 42.42,
  homeBaseLng: 42.42,
  homeBaseState: "exampleHomeBaseState",
  id: "exampleId",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    createdAt: new Date(),
    currentAt: new Date(),
    currentLat: 42.42,
    currentLng: 42.42,
    homeBaseCity: "exampleHomeBaseCity",
    homeBaseLat: 42.42,
    homeBaseLng: 42.42,
    homeBaseState: "exampleHomeBaseState",
    id: "exampleId",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  createdAt: new Date(),
  currentAt: new Date(),
  currentLat: 42.42,
  currentLng: 42.42,
  homeBaseCity: "exampleHomeBaseCity",
  homeBaseLat: 42.42,
  homeBaseLng: 42.42,
  homeBaseState: "exampleHomeBaseState",
  id: "exampleId",
  updatedAt: new Date(),
};

const service = {
  createDriverLocation() {
    return CREATE_RESULT;
  },
  driverLocations: () => FIND_MANY_RESULT,
  driverLocation: ({ where }: { where: { id: string } }) => {
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

describe("DriverLocation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DriverLocationService,
          useValue: service,
        },
      ],
      controllers: [DriverLocationController],
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

  test("POST /driverLocations", async () => {
    await request(app.getHttpServer())
      .post("/driverLocations")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        currentAt: CREATE_RESULT.currentAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /driverLocations", async () => {
    await request(app.getHttpServer())
      .get("/driverLocations")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          currentAt: FIND_MANY_RESULT[0].currentAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /driverLocations/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/driverLocations"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /driverLocations/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/driverLocations"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        currentAt: FIND_ONE_RESULT.currentAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /driverLocations existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/driverLocations")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        currentAt: CREATE_RESULT.currentAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/driverLocations")
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
