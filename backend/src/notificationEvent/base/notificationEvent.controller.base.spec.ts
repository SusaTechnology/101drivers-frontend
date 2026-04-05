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
import { NotificationEventController } from "../notificationEvent.controller";
import { NotificationEventService } from "../notificationEvent.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  archivedAt: new Date(),
  body: "exampleBody",
  clickedAt: new Date(),
  createdAt: new Date(),
  dismissedAt: new Date(),
  errorMessage: "exampleErrorMessage",
  expiresAt: new Date(),
  failedAt: new Date(),
  id: "exampleId",
  isRead: "true",
  openedAt: new Date(),
  readAt: new Date(),
  seenInListAt: new Date(),
  sentAt: new Date(),
  subject: "exampleSubject",
  templateCode: "exampleTemplateCode",
  toEmail: "exampleToEmail",
  toPhone: "exampleToPhone",
  updatedAt: new Date(),
};
const CREATE_RESULT = {
  archivedAt: new Date(),
  body: "exampleBody",
  clickedAt: new Date(),
  createdAt: new Date(),
  dismissedAt: new Date(),
  errorMessage: "exampleErrorMessage",
  expiresAt: new Date(),
  failedAt: new Date(),
  id: "exampleId",
  isRead: "true",
  openedAt: new Date(),
  readAt: new Date(),
  seenInListAt: new Date(),
  sentAt: new Date(),
  subject: "exampleSubject",
  templateCode: "exampleTemplateCode",
  toEmail: "exampleToEmail",
  toPhone: "exampleToPhone",
  updatedAt: new Date(),
};
const FIND_MANY_RESULT = [
  {
    archivedAt: new Date(),
    body: "exampleBody",
    clickedAt: new Date(),
    createdAt: new Date(),
    dismissedAt: new Date(),
    errorMessage: "exampleErrorMessage",
    expiresAt: new Date(),
    failedAt: new Date(),
    id: "exampleId",
    isRead: "true",
    openedAt: new Date(),
    readAt: new Date(),
    seenInListAt: new Date(),
    sentAt: new Date(),
    subject: "exampleSubject",
    templateCode: "exampleTemplateCode",
    toEmail: "exampleToEmail",
    toPhone: "exampleToPhone",
    updatedAt: new Date(),
  },
];
const FIND_ONE_RESULT = {
  archivedAt: new Date(),
  body: "exampleBody",
  clickedAt: new Date(),
  createdAt: new Date(),
  dismissedAt: new Date(),
  errorMessage: "exampleErrorMessage",
  expiresAt: new Date(),
  failedAt: new Date(),
  id: "exampleId",
  isRead: "true",
  openedAt: new Date(),
  readAt: new Date(),
  seenInListAt: new Date(),
  sentAt: new Date(),
  subject: "exampleSubject",
  templateCode: "exampleTemplateCode",
  toEmail: "exampleToEmail",
  toPhone: "exampleToPhone",
  updatedAt: new Date(),
};

const service = {
  createNotificationEvent() {
    return CREATE_RESULT;
  },
  notificationEvents: () => FIND_MANY_RESULT,
  notificationEvent: ({ where }: { where: { id: string } }) => {
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

describe("NotificationEvent", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: NotificationEventService,
          useValue: service,
        },
      ],
      controllers: [NotificationEventController],
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

  test("POST /notificationEvents", async () => {
    await request(app.getHttpServer())
      .post("/notificationEvents")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        archivedAt: CREATE_RESULT.archivedAt.toISOString(),
        clickedAt: CREATE_RESULT.clickedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dismissedAt: CREATE_RESULT.dismissedAt.toISOString(),
        expiresAt: CREATE_RESULT.expiresAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        openedAt: CREATE_RESULT.openedAt.toISOString(),
        readAt: CREATE_RESULT.readAt.toISOString(),
        seenInListAt: CREATE_RESULT.seenInListAt.toISOString(),
        sentAt: CREATE_RESULT.sentAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /notificationEvents", async () => {
    await request(app.getHttpServer())
      .get("/notificationEvents")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          archivedAt: FIND_MANY_RESULT[0].archivedAt.toISOString(),
          clickedAt: FIND_MANY_RESULT[0].clickedAt.toISOString(),
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          dismissedAt: FIND_MANY_RESULT[0].dismissedAt.toISOString(),
          expiresAt: FIND_MANY_RESULT[0].expiresAt.toISOString(),
          failedAt: FIND_MANY_RESULT[0].failedAt.toISOString(),
          openedAt: FIND_MANY_RESULT[0].openedAt.toISOString(),
          readAt: FIND_MANY_RESULT[0].readAt.toISOString(),
          seenInListAt: FIND_MANY_RESULT[0].seenInListAt.toISOString(),
          sentAt: FIND_MANY_RESULT[0].sentAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /notificationEvents/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/notificationEvents"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /notificationEvents/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/notificationEvents"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        archivedAt: FIND_ONE_RESULT.archivedAt.toISOString(),
        clickedAt: FIND_ONE_RESULT.clickedAt.toISOString(),
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        dismissedAt: FIND_ONE_RESULT.dismissedAt.toISOString(),
        expiresAt: FIND_ONE_RESULT.expiresAt.toISOString(),
        failedAt: FIND_ONE_RESULT.failedAt.toISOString(),
        openedAt: FIND_ONE_RESULT.openedAt.toISOString(),
        readAt: FIND_ONE_RESULT.readAt.toISOString(),
        seenInListAt: FIND_ONE_RESULT.seenInListAt.toISOString(),
        sentAt: FIND_ONE_RESULT.sentAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /notificationEvents existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/notificationEvents")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        archivedAt: CREATE_RESULT.archivedAt.toISOString(),
        clickedAt: CREATE_RESULT.clickedAt.toISOString(),
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dismissedAt: CREATE_RESULT.dismissedAt.toISOString(),
        expiresAt: CREATE_RESULT.expiresAt.toISOString(),
        failedAt: CREATE_RESULT.failedAt.toISOString(),
        openedAt: CREATE_RESULT.openedAt.toISOString(),
        readAt: CREATE_RESULT.readAt.toISOString(),
        seenInListAt: CREATE_RESULT.seenInListAt.toISOString(),
        sentAt: CREATE_RESULT.sentAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/notificationEvents")
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
