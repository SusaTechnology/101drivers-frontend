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
import { DeliveryAssignmentController } from "../deliveryAssignment.controller";
import { DeliveryAssignmentService } from "../deliveryAssignment.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  assignedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  reason: "exampleReason",
  unassignedAt: new Date(),
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  assignedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  reason: "exampleReason",
  unassignedAt: new Date(),
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    assignedAt: new Date(),
    createdAt: new Date(),
    id: "exampleId",
    reason: "exampleReason",
    unassignedAt: new Date(),
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  assignedAt: new Date(),
  createdAt: new Date(),
  id: "exampleId",
  reason: "exampleReason",
  unassignedAt: new Date(),
  updatedAt: new Date(),
};

const service = {
  createDeliveryAssignment() {
    return CREATE_RESULT;
  },
  deliveryAssignments: () => FIND_MANY_RESULT,
  deliveryAssignment: ({ where }: { where: { id: string } }) => {
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

describe("DeliveryAssignment", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DeliveryAssignmentService,
          useValue: service,
        },
      ],
      controllers: [DeliveryAssignmentController],
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

  test("POST /deliveryAssignments", async () => {
    await request(app.getHttpServer())
      .post("/deliveryAssignments")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        assignedAt: CREATE_RESULT.assignedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        unassignedAt: CREATE_RESULT.unassignedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /deliveryAssignments", async () => {
    await request(app.getHttpServer())
      .get("/deliveryAssignments")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          assignedAt: FIND_MANY_RESULT[0].assignedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          unassignedAt: FIND_MANY_RESULT[0].unassignedAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /deliveryAssignments/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryAssignments"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /deliveryAssignments/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryAssignments"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        assignedAt: FIND_ONE_RESULT.assignedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        unassignedAt: FIND_ONE_RESULT.unassignedAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /deliveryAssignments existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/deliveryAssignments")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        assignedAt: CREATE_RESULT.assignedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        unassignedAt: CREATE_RESULT.unassignedAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/deliveryAssignments")
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
