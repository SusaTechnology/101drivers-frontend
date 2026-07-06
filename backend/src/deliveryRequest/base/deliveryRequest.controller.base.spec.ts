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
import { DeliveryRequestController } from "../deliveryRequest.controller";
import { DeliveryRequestService } from "../deliveryRequest.service";

const nonExistingId = "nonExistingId";
const existingId = "existingId";
const CREATE_INPUT = {
  afterHours: "true",
  bufferMinutes: 42,
  createdAt: new Date(),
  dropoffAddress: "exampleDropoffAddress",
  dropoffLat: 42.42,
  dropoffLng: 42.42,
  dropoffPlaceId: "exampleDropoffPlaceId",
  dropoffState: "exampleDropoffState",
  dropoffWindowEnd: new Date(),
  dropoffWindowStart: new Date(),
  etaMinutes: 42,
  id: "exampleId",
  isUrgent: "true",
  licensePlate: "exampleLicensePlate",
  pickupAddress: "examplePickupAddress",
  pickupLat: 42.42,
  pickupLng: 42.42,
  pickupPlaceId: "examplePickupPlaceId",
  pickupState: "examplePickupState",
  pickupWindowEnd: new Date(),
  pickupWindowStart: new Date(),
  recipientEmail: "exampleRecipientEmail",
  recipientName: "exampleRecipientName",
  recipientPhone: "exampleRecipientPhone",
  requiresOpsConfirmation: "true",
  sameDayEligible: "true",
  trackingShareExpiresAt: new Date(),
  trackingShareToken: "exampleTrackingShareToken",
  updatedAt: new Date(),
  urgentBonusAmount: 42.42,
  vehicleColor: "exampleVehicleColor",
  vehicleMake: "exampleVehicleMake",
  vehicleModel: "exampleVehicleModel",
  vinVerificationCode: "exampleVinVerificationCode",
};
const CREATE_RESULT = {
  afterHours: "true",
  bufferMinutes: 42,
  createdAt: new Date(),
  dropoffAddress: "exampleDropoffAddress",
  dropoffLat: 42.42,
  dropoffLng: 42.42,
  dropoffPlaceId: "exampleDropoffPlaceId",
  dropoffState: "exampleDropoffState",
  dropoffWindowEnd: new Date(),
  dropoffWindowStart: new Date(),
  etaMinutes: 42,
  id: "exampleId",
  isUrgent: "true",
  licensePlate: "exampleLicensePlate",
  pickupAddress: "examplePickupAddress",
  pickupLat: 42.42,
  pickupLng: 42.42,
  pickupPlaceId: "examplePickupPlaceId",
  pickupState: "examplePickupState",
  pickupWindowEnd: new Date(),
  pickupWindowStart: new Date(),
  recipientEmail: "exampleRecipientEmail",
  recipientName: "exampleRecipientName",
  recipientPhone: "exampleRecipientPhone",
  requiresOpsConfirmation: "true",
  sameDayEligible: "true",
  trackingShareExpiresAt: new Date(),
  trackingShareToken: "exampleTrackingShareToken",
  updatedAt: new Date(),
  urgentBonusAmount: 42.42,
  vehicleColor: "exampleVehicleColor",
  vehicleMake: "exampleVehicleMake",
  vehicleModel: "exampleVehicleModel",
  vinVerificationCode: "exampleVinVerificationCode",
};
const FIND_MANY_RESULT = [
  {
    afterHours: "true",
    bufferMinutes: 42,
    createdAt: new Date(),
    dropoffAddress: "exampleDropoffAddress",
    dropoffLat: 42.42,
    dropoffLng: 42.42,
    dropoffPlaceId: "exampleDropoffPlaceId",
    dropoffState: "exampleDropoffState",
    dropoffWindowEnd: new Date(),
    dropoffWindowStart: new Date(),
    etaMinutes: 42,
    id: "exampleId",
    isUrgent: "true",
    licensePlate: "exampleLicensePlate",
    pickupAddress: "examplePickupAddress",
    pickupLat: 42.42,
    pickupLng: 42.42,
    pickupPlaceId: "examplePickupPlaceId",
    pickupState: "examplePickupState",
    pickupWindowEnd: new Date(),
    pickupWindowStart: new Date(),
    recipientEmail: "exampleRecipientEmail",
    recipientName: "exampleRecipientName",
    recipientPhone: "exampleRecipientPhone",
    requiresOpsConfirmation: "true",
    sameDayEligible: "true",
    trackingShareExpiresAt: new Date(),
    trackingShareToken: "exampleTrackingShareToken",
    updatedAt: new Date(),
    urgentBonusAmount: 42.42,
    vehicleColor: "exampleVehicleColor",
    vehicleMake: "exampleVehicleMake",
    vehicleModel: "exampleVehicleModel",
    vinVerificationCode: "exampleVinVerificationCode",
  },
];
const FIND_ONE_RESULT = {
  afterHours: "true",
  bufferMinutes: 42,
  createdAt: new Date(),
  dropoffAddress: "exampleDropoffAddress",
  dropoffLat: 42.42,
  dropoffLng: 42.42,
  dropoffPlaceId: "exampleDropoffPlaceId",
  dropoffState: "exampleDropoffState",
  dropoffWindowEnd: new Date(),
  dropoffWindowStart: new Date(),
  etaMinutes: 42,
  id: "exampleId",
  isUrgent: "true",
  licensePlate: "exampleLicensePlate",
  pickupAddress: "examplePickupAddress",
  pickupLat: 42.42,
  pickupLng: 42.42,
  pickupPlaceId: "examplePickupPlaceId",
  pickupState: "examplePickupState",
  pickupWindowEnd: new Date(),
  pickupWindowStart: new Date(),
  recipientEmail: "exampleRecipientEmail",
  recipientName: "exampleRecipientName",
  recipientPhone: "exampleRecipientPhone",
  requiresOpsConfirmation: "true",
  sameDayEligible: "true",
  trackingShareExpiresAt: new Date(),
  trackingShareToken: "exampleTrackingShareToken",
  updatedAt: new Date(),
  urgentBonusAmount: 42.42,
  vehicleColor: "exampleVehicleColor",
  vehicleMake: "exampleVehicleMake",
  vehicleModel: "exampleVehicleModel",
  vinVerificationCode: "exampleVinVerificationCode",
};

const service = {
  createDeliveryRequest() {
    return CREATE_RESULT;
  },
  deliveryRequests: () => FIND_MANY_RESULT,
  deliveryRequest: ({ where }: { where: { id: string } }) => {
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

describe("DeliveryRequest", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DeliveryRequestService,
          useValue: service,
        },
      ],
      controllers: [DeliveryRequestController],
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

  test("POST /deliveryRequests", async () => {
    await request(app.getHttpServer())
      .post("/deliveryRequests")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dropoffWindowEnd: CREATE_RESULT.dropoffWindowEnd.toISOString(),
        dropoffWindowStart: CREATE_RESULT.dropoffWindowStart.toISOString(),
        pickupWindowEnd: CREATE_RESULT.pickupWindowEnd.toISOString(),
        pickupWindowStart: CREATE_RESULT.pickupWindowStart.toISOString(),
        trackingShareExpiresAt:
          CREATE_RESULT.trackingShareExpiresAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      });
  });

  test("GET /deliveryRequests", async () => {
    await request(app.getHttpServer())
      .get("/deliveryRequests")
      .expect(HttpStatus.OK)
      .expect([
        {
          ...FIND_MANY_RESULT[0],
          createdAt: FIND_MANY_RESULT[0].createdAt.toISOString(),
          dropoffWindowEnd: FIND_MANY_RESULT[0].dropoffWindowEnd.toISOString(),
          dropoffWindowStart:
            FIND_MANY_RESULT[0].dropoffWindowStart.toISOString(),
          pickupWindowEnd: FIND_MANY_RESULT[0].pickupWindowEnd.toISOString(),
          pickupWindowStart:
            FIND_MANY_RESULT[0].pickupWindowStart.toISOString(),
          trackingShareExpiresAt:
            FIND_MANY_RESULT[0].trackingShareExpiresAt.toISOString(),
          updatedAt: FIND_MANY_RESULT[0].updatedAt.toISOString(),
        },
      ]);
  });

  test("GET /deliveryRequests/:id non existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryRequests"}/${nonExistingId}`)
      .expect(HttpStatus.NOT_FOUND)
      .expect({
        statusCode: HttpStatus.NOT_FOUND,
        message: `No resource was found for {"${"id"}":"${nonExistingId}"}`,
        error: "Not Found",
      });
  });

  test("GET /deliveryRequests/:id existing", async () => {
    await request(app.getHttpServer())
      .get(`${"/deliveryRequests"}/${existingId}`)
      .expect(HttpStatus.OK)
      .expect({
        ...FIND_ONE_RESULT,
        createdAt: FIND_ONE_RESULT.createdAt.toISOString(),
        dropoffWindowEnd: FIND_ONE_RESULT.dropoffWindowEnd.toISOString(),
        dropoffWindowStart: FIND_ONE_RESULT.dropoffWindowStart.toISOString(),
        pickupWindowEnd: FIND_ONE_RESULT.pickupWindowEnd.toISOString(),
        pickupWindowStart: FIND_ONE_RESULT.pickupWindowStart.toISOString(),
        trackingShareExpiresAt:
          FIND_ONE_RESULT.trackingShareExpiresAt.toISOString(),
        updatedAt: FIND_ONE_RESULT.updatedAt.toISOString(),
      });
  });

  test("POST /deliveryRequests existing resource", async () => {
    const agent = request(app.getHttpServer());
    await agent
      .post("/deliveryRequests")
      .send(CREATE_INPUT)
      .expect(HttpStatus.CREATED)
      .expect({
        ...CREATE_RESULT,
        createdAt: CREATE_RESULT.createdAt.toISOString(),
        dropoffWindowEnd: CREATE_RESULT.dropoffWindowEnd.toISOString(),
        dropoffWindowStart: CREATE_RESULT.dropoffWindowStart.toISOString(),
        pickupWindowEnd: CREATE_RESULT.pickupWindowEnd.toISOString(),
        pickupWindowStart: CREATE_RESULT.pickupWindowStart.toISOString(),
        trackingShareExpiresAt:
          CREATE_RESULT.trackingShareExpiresAt.toISOString(),
        updatedAt: CREATE_RESULT.updatedAt.toISOString(),
      })
      .then(function () {
        agent
          .post("/deliveryRequests")
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
