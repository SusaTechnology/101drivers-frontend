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
import { ScheduleChangeRequestController } from "../scheduleChangeRequest.controller";
import { ScheduleChangeRequestService } from "../scheduleChangeRequest.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  createdAt: new Date(),
  decidedAt: new Date(),
  decisionNote: "exampleDecisionNote",
  id: "exampleId",
  proposedDropoffWindowEnd: new Date(),
  proposedDropoffWindowStart: new Date(),
  proposedPickupWindowEnd: new Date(),
  proposedPickupWindowStart: new Date(),
  reason: "exampleReason",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  createdAt: new Date(),
  decidedAt: new Date(),
  decisionNote: "exampleDecisionNote",
  id: "exampleId",
  proposedDropoffWindowEnd: new Date(),
  proposedDropoffWindowStart: new Date(),
  proposedPickupWindowEnd: new Date(),
  proposedPickupWindowStart: new Date(),
  reason: "exampleReason",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    createdAt: new Date(),
    decidedAt: new Date(),
    decisionNote: "exampleDecisionNote",
    id: "exampleId",
    proposedDropoffWindowEnd: new Date(),
    proposedDropoffWindowStart: new Date(),
    proposedPickupWindowEnd: new Date(),
    proposedPickupWindowStart: new Date(),
    reason: "exampleReason",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  createdAt: new Date(),
  decidedAt: new Date(),
  decisionNote: "exampleDecisionNote",
  id: "exampleId",
  proposedDropoffWindowEnd: new Date(),
  proposedDropoffWindowStart: new Date(),
  proposedPickupWindowEnd: new Date(),
  proposedPickupWindowStart: new Date(),
  reason: "exampleReason",
  updatedAt: new Date(),
};

const service = {
  createScheduleChangeRequest() {
    return CREATE_RESULT;
  },
  scheduleChangeRequests: () => FIND_MANY_RESULT,
  scheduleChangeRequest: ({ where }: { where: { id: string } }) => {
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

describe("ScheduleChangeRequest", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ScheduleChangeRequestService,
          useValue: service,
        },
      ],
      controllers: [ScheduleChangeRequestController],
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

  test("POST /scheduleChangeRequests", async () => {
    await request(app.getHttpServer())
      .post("/scheduleChangeRequests")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        decidedAt: CREATE_RESULT.decidedAt.toISOString(),
        proposedDropoffWindowEnd:
          CREATE_RESULT.proposedDropoffWindowEnd.toISOString(),
        proposedDropoffWindowStart:
          CREATE_RESULT.proposedDropoffWindowStart.toISOString(),
        proposedPickupWindowEnd:
          CREATE_RESULT.proposedPickupWindowEnd.toISOString(),
        proposedPickupWindowStart:
          CREATE_RESULT.proposedPickupWindowStart.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /scheduleChangeRequests", async () => {
    await request(app.getHttpServer())
      .get("/scheduleChangeRequests")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          decidedAt: FIND_MANY_RESULT[0].decidedAt.toISOString(),
          proposedDropoffWindowEnd:
            FIND_MANY_RESULT[0].proposedDropoffWindowEnd.toISOString(),
          proposedDropoffWindowStart:
            FIND_MANY_RESULT[0].proposedDropoffWindowStart.toISOString(),
          proposedPickupWindowEnd:
            FIND_MANY_RESULT[0].proposedPickupWindowEnd.toISOString(),
          proposedPickupWindowStart:
            FIND_MANY_RESULT[0].proposedPickupWindowStart.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /scheduleChangeRequests/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/scheduleChangeRequests"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /scheduleChangeRequests/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/scheduleChangeRequests"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        decidedAt: FIND_ONE_RESULT.decidedAt.toISOString(),
        proposedDropoffWindowEnd:
          FIND_ONE_RESULT.proposedDropoffWindowEnd.toISOString(),
        proposedDropoffWindowStart:
          FIND_ONE_RESULT.proposedDropoffWindowStart.toISOString(),
        proposedPickupWindowEnd:
          FIND_ONE_RESULT.proposedPickupWindowEnd.toISOString(),
        proposedPickupWindowStart:
          FIND_ONE_RESULT.proposedPickupWindowStart.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /scheduleChangeRequests existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/scheduleChangeRequests")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        decidedAt: CREATE_RESULT.decidedAt.toISOString(),
        proposedDropoffWindowEnd:
          CREATE_RESULT.proposedDropoffWindowEnd.toISOString(),
        proposedDropoffWindowStart:
          CREATE_RESULT.proposedDropoffWindowStart.toISOString(),
        proposedPickupWindowEnd:
          CREATE_RESULT.proposedPickupWindowEnd.toISOString(),
        proposedPickupWindowStart:
          CREATE_RESULT.proposedPickupWindowStart.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/scheduleChangeRequests")
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
