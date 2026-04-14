import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryToStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
  EnumQuoteServiceType,
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyServiceType,
  EnumUserRoles,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleMapsService } from "./google-maps.service";
import { PricingEngineService } from "./pricing-engine.service";
import { EmailVerificationService } from "../auth/email-verification/email-verification.service";
import { PasswordService } from "../auth/password.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";

export type CreateDeliveryDraftFromQuoteInput = {
  customerId: string;
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  createdByUserId?: string | null;
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
  licensePlate?: string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  isUrgent?: boolean;
  afterHours?: boolean;
};

export type CreateIndividualDeliveryDraftFromQuoteInput = {
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;

  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;

  savedVehicleId?: string | null;
  saveVehicleForFuture?: boolean;

  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;

  licensePlate?: string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode?: string | null;

  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;

  isUrgent?: boolean;
  afterHours?: boolean;
};

export type SchedulePreviewInput = {
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  customerId?: string | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
};

export type SchedulePreviewResult = {
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  dropoffWindowStart: Date | null;
  dropoffWindowEnd: Date | null;
  etaMinutes: number | null;
  bufferMinutes: number;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  feasible: boolean;
  message?: string | null;
};

export type CreateQuotePreviewInput = {
  pickupAddress: string;
  dropoffAddress: string;
  serviceType: EnumDeliveryRequestServiceType;
  customerId?: string | null;
};

export type CreateDeliveryFromQuoteInput = {
  customerId: string;
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  createdByUserId?: string | null;
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  dropoffWindowStart: Date;
  dropoffWindowEnd: Date;
  licensePlate: string;
  vehicleColor: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  isUrgent?: boolean;
  afterHours?: boolean;
};

export type CreateIndividualDeliveryFromQuoteInput = {
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  otp?: string | null;
  password?: string | null;

  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;

  savedVehicleId?: string | null;
  saveVehicleForFuture?: boolean;

  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;

  licensePlate: string;
  vehicleColor: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode: string;

  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;

  isUrgent?: boolean;
  afterHours?: boolean;
};

type IndividualCustomerShape = {
  id: string;
  userId: string | null;
  customerType: EnumCustomerCustomerType;
  user: {
    id: string;
    email: string | null;
    emailVerifiedAt: Date | null;
    fullName: string | null;
    phone: string | null;
  } | null;
};

type ResolvedIndividualCustomerResult =
  | {
      kind: "READY";
      customer: IndividualCustomerShape;
    }
  | {
      kind: "VERIFICATION_REQUIRED";
      email: string;
      message: string;
    }
  | {
      kind: "LOGIN_REQUIRED";
      email: string;
      message: string;
    };

export type CreateIndividualDeliveryFromQuoteResult =
  | {
      action: "VERIFICATION_REQUIRED";
      email: string;
      message: string;
    }
  | {
      action: "LOGIN_REQUIRED";
      email: string;
      message: string;
    }
  | {
      action: "CREATED";
      deliveryId: string;
      delivery: unknown;
    };

@Injectable()
export class DeliveryRequestOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapsService: GoogleMapsService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordService: PasswordService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  async createDeliveryDraftFromQuote(input: CreateDeliveryDraftFromQuoteInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        userId: true,
        customerType: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        serviceType: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: input.customerId,
        quoteId: input.quoteId,
        createdByUserId: input.createdByUserId ?? customer.userId ?? null,
        createdByRole: input.createdByRole ?? null,
        customerChose: input.customerChose ?? null,

        pickupAddress: quote.pickupAddress,
        pickupLat: quote.pickupLat ?? null,
        pickupLng: quote.pickupLng ?? null,
        pickupPlaceId: quote.pickupPlaceId ?? null,
        pickupState: quote.pickupState ?? null,

        dropoffAddress: quote.dropoffAddress,
        dropoffLat: quote.dropoffLat ?? null,
        dropoffLng: quote.dropoffLng ?? null,
        dropoffPlaceId: quote.dropoffPlaceId ?? null,
        dropoffState: quote.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,

        etaMinutes: null,
        bufferMinutes: null,
        sameDayEligible: null,
        requiresOpsConfirmation: false,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.DRAFT,

        licensePlate: input.licensePlate?.trim() || null,
        vehicleColor: input.vehicleColor?.trim() || null,
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
        vinVerificationCode: input.vinVerificationCode?.trim() || null,

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: input.createdByUserId ?? customer.userId ?? null,
        actorRole: input.createdByRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.DRAFT,
        note: "Delivery draft created from quote",
      },
    });

    return { id: delivery.id };
  }

  async createIndividualDeliveryDraftFromQuote(
    input: CreateIndividualDeliveryDraftFromQuoteInput
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        serviceType: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    let resolvedCustomerId: string | null = input.customerId ?? null;
    let resolvedCustomerUserId: string | null = null;

    if (!resolvedCustomerId && input.customerEmail) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          customerType: EnumCustomerCustomerType.PRIVATE,
          user: {
            email: input.customerEmail.trim().toLowerCase(),
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id;
        resolvedCustomerUserId = existingCustomer.userId ?? null;
      }
    }

    let vehicle = {
      licensePlate: input.licensePlate?.trim() || null,
      vehicleColor: input.vehicleColor?.trim() || null,
      vehicleMake: input.vehicleMake?.trim() || null,
      vehicleModel: input.vehicleModel?.trim() || null,
    };

    if (resolvedCustomerId && input.savedVehicleId) {
      const savedVehicle = await this.prisma.savedVehicle.findFirst({
        where: {
          id: input.savedVehicleId,
          customerId: resolvedCustomerId,
        },
        select: {
          licensePlate: true,
          color: true,
          make: true,
          model: true,
        },
      });

      if (savedVehicle) {
        vehicle = {
          licensePlate: savedVehicle.licensePlate,
          vehicleColor: savedVehicle.color,
          vehicleMake: savedVehicle.make,
          vehicleModel: savedVehicle.model,
        };
      }
    }

    if (!resolvedCustomerId) {
      throw new BadRequestException(
        "customerId is required for individual draft creation"
      );
    }

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: resolvedCustomerId,
        quoteId: input.quoteId,
        createdByUserId: resolvedCustomerUserId,
        createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
        customerChose:
          input.pickupWindowStart && input.pickupWindowEnd
            ? EnumDeliveryRequestCustomerChose.PICKUP_WINDOW
            : input.dropoffWindowStart && input.dropoffWindowEnd
            ? EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW
            : null,

        pickupAddress: quote.pickupAddress,
        pickupLat: quote.pickupLat ?? null,
        pickupLng: quote.pickupLng ?? null,
        pickupPlaceId: quote.pickupPlaceId ?? null,
        pickupState: quote.pickupState ?? null,

        dropoffAddress: quote.dropoffAddress,
        dropoffLat: quote.dropoffLat ?? null,
        dropoffLng: quote.dropoffLng ?? null,
        dropoffPlaceId: quote.dropoffPlaceId ?? null,
        dropoffState: quote.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,

        etaMinutes: null,
        bufferMinutes: null,
        sameDayEligible: null,
        requiresOpsConfirmation: false,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.DRAFT,

        licensePlate: vehicle.licensePlate,
        vehicleColor: vehicle.vehicleColor,
        vehicleMake: vehicle.vehicleMake,
        vehicleModel: vehicle.vehicleModel,
        vinVerificationCode: input.vinVerificationCode?.trim() || null,

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: resolvedCustomerUserId,
        actorRole: EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.DRAFT,
        note: "Individual delivery draft created from quote",
      },
    });

    return { id: delivery.id };
  }

  async createQuotePreview(input: CreateQuotePreviewInput) {
    const pickupGeo = await this.mapsService.validateCaliforniaAddressOrThrow(
      input.pickupAddress
    );

    const dropoffGeo = await this.mapsService.validateCaliforniaAddressOrThrow(
      input.dropoffAddress
    );

    const route = await this.mapsService.computeRouteMetrics({
      originLat: pickupGeo.lat,
      originLng: pickupGeo.lng,
      destinationLat: dropoffGeo.lat,
      destinationLng: dropoffGeo.lng,
    });

    return this.pricingEngineService.createQuote({
      pickupAddress: pickupGeo.formattedAddress,
      pickupLat: pickupGeo.lat,
      pickupLng: pickupGeo.lng,
      pickupPlaceId: pickupGeo.placeId ?? null,
      pickupState: pickupGeo.stateCode ?? null,

      dropoffAddress: dropoffGeo.formattedAddress,
      dropoffLat: dropoffGeo.lat,
      dropoffLng: dropoffGeo.lng,
      dropoffPlaceId: dropoffGeo.placeId ?? null,
      dropoffState: dropoffGeo.stateCode ?? null,

      distanceMiles: route.distanceMiles,
      routePolyline: route.polyline ?? null,
      serviceType: this.mapDeliveryServiceTypeToQuoteServiceType(
        input.serviceType
      ),
      customerId: input.customerId ?? null,
    });
  }

  async createIndividualDeliveryFromAcceptedQuote(
    input: CreateIndividualDeliveryFromQuoteInput
  ): Promise<CreateIndividualDeliveryFromQuoteResult> {
    const customerResolution =
      await this.resolveIndividualCustomerForCreate(input);

    if (customerResolution.kind === "VERIFICATION_REQUIRED") {
      return {
        action: "VERIFICATION_REQUIRED",
        email: customerResolution.email,
        message: customerResolution.message,
      };
    }

    if (customerResolution.kind === "LOGIN_REQUIRED") {
      return {
        action: "LOGIN_REQUIRED",
        email: customerResolution.email,
        message: customerResolution.message,
      };
    }

    const delivery = await this.createIndividualDeliveryForResolvedCustomer(
      customerResolution.customer,
      input
    );

    return {
      action: "CREATED",
      deliveryId: (delivery as any).id,
      delivery,
    };
  }

private async createIndividualDeliveryForResolvedCustomer(
  customer: IndividualCustomerShape,
  input: CreateIndividualDeliveryFromQuoteInput
) {
  const quote = await this.prisma.quote.findUnique({
    where: { id: input.quoteId },
    select: {
      id: true,
      estimatedPrice: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      pickupPlaceId: true,
      pickupState: true,
      dropoffAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffPlaceId: true,
      dropoffState: true,
      serviceType: true,
      pricingSnapshot: true,
      feesBreakdown: true,
    },
  });

  if (!quote) {
    throw new NotFoundException("Quote not found");
  }

  if (customer.customerType !== EnumCustomerCustomerType.PRIVATE) {
    throw new BadRequestException(
      "This endpoint is only for individual/private customers"
    );
  }

  if (!customer.user?.emailVerifiedAt) {
    throw new BadRequestException(
      "Email must be verified before creating a delivery request"
    );
  }

  if (!/^\d{4}$/.test(input.vinVerificationCode)) {
    throw new BadRequestException(
      "VIN verification code must be exactly 4 numeric digits"
    );
  }

  const resolvedVehicle = await this.resolveIndividualVehicleInput(
    customer.id,
    input
  );

  const routeMetrics =
    quote.pickupLat != null &&
    quote.pickupLng != null &&
    quote.dropoffLat != null &&
    quote.dropoffLng != null
      ? await this.mapsService.computeRouteMetrics({
          originLat: quote.pickupLat,
          originLng: quote.pickupLng,
          destinationLat: quote.dropoffLat,
          destinationLng: quote.dropoffLng,
        })
      : null;

  const policy =
    (await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
        serviceType: this.mapDeliveryServiceTypeToSchedulingServiceType(
          input.serviceType
        ),
      },
      orderBy: { createdAt: "desc" },
    })) ??
    (await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
        serviceType: null,
      },
      orderBy: { createdAt: "desc" },
    }));

  const bufferMinutes = policy?.bufferMinutes ?? 30;
  const etaMinutes = routeMetrics?.durationMinutes ?? 0;

  const schedule = this.resolveIndividualSchedule({
    pickupWindowStart: input.pickupWindowStart ?? null,
    pickupWindowEnd: input.pickupWindowEnd ?? null,
    dropoffWindowStart: input.dropoffWindowStart ?? null,
    dropoffWindowEnd: input.dropoffWindowEnd ?? null,
    etaMinutes,
    bufferMinutes,
  });

  const sameDayEligible = this.isSameDayEligible(
    schedule.pickupWindowStart,
    schedule.dropoffWindowEnd,
    etaMinutes,
    bufferMinutes,
    policy?.maxSameDayMiles ?? null,
    routeMetrics?.distanceMiles ?? null
  );

  const requiresOpsConfirmation =
    policy?.requiresOpsConfirmation === true ||
    (input.afterHours === true && policy?.afterHoursEnabled !== true) ||
    (sameDayEligible === false &&
      this.isSameCalendarDay(
        schedule.pickupWindowStart,
        schedule.dropoffWindowEnd
      ));


  const delivery = await this.prisma.deliveryRequest.create({
    data: {
      customerId: customer.id,
      quoteId: input.quoteId,
      createdByUserId: customer.userId,
      createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
      customerChose:
        input.pickupWindowStart && input.pickupWindowEnd
          ? EnumDeliveryRequestCustomerChose.PICKUP_WINDOW
          : EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW,

      pickupAddress: quote.pickupAddress,
      pickupLat: quote.pickupLat ?? null,
      pickupLng: quote.pickupLng ?? null,
      pickupPlaceId: quote.pickupPlaceId ?? null,
      pickupState: quote.pickupState ?? null,

      dropoffAddress: quote.dropoffAddress,
      dropoffLat: quote.dropoffLat ?? null,
      dropoffLng: quote.dropoffLng ?? null,
      dropoffPlaceId: quote.dropoffPlaceId ?? null,
      dropoffState: quote.dropoffState ?? null,

      pickupWindowStart: schedule.pickupWindowStart,
      pickupWindowEnd: schedule.pickupWindowEnd,
      dropoffWindowStart: schedule.dropoffWindowStart,
      dropoffWindowEnd: schedule.dropoffWindowEnd,

      etaMinutes: routeMetrics?.durationMinutes ?? null,
      bufferMinutes,
      sameDayEligible,
      requiresOpsConfirmation,
      afterHours: input.afterHours === true,

      serviceType: input.serviceType,
      status: EnumDeliveryRequestStatus.QUOTED,

      licensePlate: resolvedVehicle.licensePlate,
      vehicleColor: resolvedVehicle.vehicleColor,
      vehicleMake: resolvedVehicle.vehicleMake,
      vehicleModel: resolvedVehicle.vehicleModel,
      vinVerificationCode: input.vinVerificationCode.trim(),

      recipientName: input.recipientName?.trim() || null,
      recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
      recipientPhone: input.recipientPhone?.trim() || null,

      isUrgent: input.isUrgent === true,
      trackingShareToken: null,
      trackingShareExpiresAt: null,
    },
    select: {
      id: true,
    },
  });

  await this.prisma.deliveryStatusHistory.create({
    data: {
      deliveryId: delivery.id,
      actorUserId: customer.userId,
      actorType: EnumDeliveryStatusHistoryActorType.USER,
      fromStatus: null,
      toStatus: EnumDeliveryStatusHistoryToStatus.QUOTED,
      note: "Individual delivery created from accepted quote",
    },
  });

  await this.prisma.deliveryCompliance.create({
    data: {
      deliveryId: delivery.id,
      vinVerificationCode: input.vinVerificationCode.trim(),
    },
  });

  await this.prisma.trackingSession.create({
    data: {
      deliveryId: delivery.id,
    },
  });

  const payment = await this.prisma.payment.create({
    data: {
      deliveryId: delivery.id,
      amount: quote.estimatedPrice,
      paymentType: EnumPaymentPaymentType.PREPAID,
      provider: EnumPaymentProvider.MANUAL,
      status: EnumPaymentStatus.AUTHORIZED,
      authorizedAt: new Date(),
    },
  });

  await this.prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      type: EnumPaymentEventType.AUTHORIZE,
      status: EnumPaymentEventStatus.AUTHORIZED,
      amount: quote.estimatedPrice,
      message: "Prepaid payment authorized at individual request creation",
      raw: {
        source: "individual-create-from-quote",
        deliveryId: delivery.id,
      },
    },
  });

  await this.notificationEventEngine.notifyDeliveryCreated({
    deliveryId: delivery.id,
    actorUserId: customer.userId ?? null,
  });

  // Do NOT send tracking link at creation time.
  // Only notify recipient that tracking will be shared after booking.
  if (input.recipientEmail || input.recipientPhone) {
    await this.notificationEventEngine.queueAndSend({
      actorUserId: customer.userId ?? null,
      customerId: customer.id,
      deliveryId: delivery.id,
      channel: input.recipientEmail
        ? EnumNotificationEventChannel.EMAIL
        : EnumNotificationEventChannel.SMS,
      type: EnumNotificationEventType.REMINDER,
      templateCode: "tracking-will-be-sent",
      subject: "Vehicle delivery scheduled",
      body: [
        `Hi ${input.recipientName ?? "Recipient"},`,
        "",
        "A vehicle delivery has been scheduled for you.",
        "Tracking will be shared once a driver is assigned.",
        "",
        "You will receive a tracking link when the trip begins.",
      ].join("\n"),
      toEmail: input.recipientEmail?.trim().toLowerCase() || null,
      toPhone: input.recipientPhone?.trim() || null,
      payload: {
        deliveryId: delivery.id,
      },
    });
  }

  if (input.saveVehicleForFuture === true) {
    await this.upsertSavedVehicleForCustomer(customer.id, {
      licensePlate: resolvedVehicle.licensePlate,
      make: resolvedVehicle.vehicleMake,
      model: resolvedVehicle.vehicleModel,
      color: resolvedVehicle.vehicleColor,
    });
  }

  return this.prisma.deliveryRequest.findUniqueOrThrow({
    where: { id: delivery.id },
  });
}

private async resolveIndividualCustomerForCreate(
  input: CreateIndividualDeliveryFromQuoteInput
): Promise<ResolvedIndividualCustomerResult> {
  if (input.customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (!customer.user?.emailVerifiedAt) {
      if (customer.user?.email) {
        await this.emailVerificationService.requestVerification(
          customer.user.email,
          customer.user.fullName ?? null,
          "PRIVATE_CUSTOMER"
        );

        return {
          kind: "VERIFICATION_REQUIRED",
          email: customer.user.email,
          message: "Please verify your email before creating a delivery request.",
        };
      }

      throw new BadRequestException(
        "Customer email is missing and cannot be verified"
      );
    }

    if (
      customer.customerType === EnumCustomerCustomerType.PRIVATE &&
      customer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
    ) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          approvalStatus: EnumCustomerApprovalStatus.APPROVED,
          approvedAt: customer.approvedAt ?? new Date(),
          approvedByUserId: null,
        },
      });
    }

    const normalizedCustomer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return {
      kind: "READY",
      customer: normalizedCustomer,
    };
  }

  const customerEmail = input.customerEmail?.trim().toLowerCase() ?? null;
  const customerName = input.customerName?.trim() ?? null;
  const customerPhone = input.customerPhone?.trim() ?? null;
  const otp = input.otp?.trim() ?? null;
  const password = input.password ?? null;

  if (!customerEmail) {
    throw new BadRequestException("customerEmail is required");
  }

  const existingUser = await this.prisma.user.findUnique({
    where: { email: customerEmail },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      fullName: true,
      phone: true,
    },
  });

  if (existingUser) {
    if (existingUser.emailVerifiedAt) {
      return {
        kind: "LOGIN_REQUIRED",
        email: customerEmail,
        message:
          "An account already exists for this email. Please log in to continue.",
      };
    }

    if (!otp) {
      await this.emailVerificationService.requestVerification(
        customerEmail,
        customerName ?? existingUser.fullName ?? null,
        "PRIVATE_CUSTOMER"
      );

      return {
        kind: "VERIFICATION_REQUIRED",
        email: customerEmail,
        message:
          "Your email is not verified yet. We sent a verification code.",
      };
    }

    if (!password) {
      throw new BadRequestException(
        "password is required when completing email verification"
      );
    }

    await this.emailVerificationService.consumeTokenForEmail(
      customerEmail,
      otp
    );

    const hashedPassword = await this.passwordService.hash(password);

    const verifiedUser = await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerifiedAt: new Date(),
        password: hashedPassword,
        fullName: customerName ?? existingUser.fullName ?? undefined,
        phone: customerPhone ?? existingUser.phone ?? undefined,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        fullName: true,
        phone: true,
      },
    });

    const existingCustomer = await this.prisma.customer.findUnique({
      where: { userId: verifiedUser.id },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (existingCustomer) {
      if (
        existingCustomer.customerType === EnumCustomerCustomerType.PRIVATE &&
        existingCustomer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
      ) {
        await this.prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            approvalStatus: EnumCustomerApprovalStatus.APPROVED,
            approvedAt: existingCustomer.approvedAt ?? new Date(),
            approvedByUserId: null,
          },
        });
      }

      const normalizedExistingCustomer =
        await this.prisma.customer.findUniqueOrThrow({
          where: { id: existingCustomer.id },
          select: {
            id: true,
            userId: true,
            customerType: true,
            approvalStatus: true,
            approvedAt: true,
            approvedByUserId: true,
            user: {
              select: {
                id: true,
                email: true,
                emailVerifiedAt: true,
                fullName: true,
                phone: true,
              },
            },
          },
        });

      return {
        kind: "READY",
        customer: normalizedExistingCustomer,
      };
    }

    const createdCustomer = await this.prisma.customer.create({
      data: {
        userId: verifiedUser.id,
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: null,
        contactName: customerName ?? verifiedUser.fullName ?? "",
        contactEmail: customerEmail,
        contactPhone: customerPhone ?? verifiedUser.phone ?? "",
        phone: customerPhone ?? verifiedUser.phone ?? "",
      },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return {
      kind: "READY",
      customer: createdCustomer,
    };
  }

  if (!customerName) {
    throw new BadRequestException(
      "customerName is required for new individual customers"
    );
  }

  if (!otp) {
    await this.emailVerificationService.requestVerification(
      customerEmail,
      customerName,
      "PRIVATE_CUSTOMER"
    );

    return {
      kind: "VERIFICATION_REQUIRED",
      email: customerEmail,
      message: "Please verify your email before creating a delivery request.",
    };
  }

  if (!password) {
    throw new BadRequestException(
      "password is required when completing email verification"
    );
  }

  await this.emailVerificationService.consumeTokenForEmail(
    customerEmail,
    otp
  );

  const hashedPassword = await this.passwordService.hash(password);

  const user = await this.prisma.user.create({
    data: {
      email: customerEmail,
      username: this.generateUsernameFromEmail(customerEmail),
      password: hashedPassword,
      roles: EnumUserRoles.PRIVATE_CUSTOMER,
      fullName: customerName,
      phone: customerPhone ?? null,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      fullName: true,
      phone: true,
    },
  });

  const customer = await this.prisma.customer.create({
    data: {
      userId: user.id,
      customerType: EnumCustomerCustomerType.PRIVATE,
      approvalStatus: EnumCustomerApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: null,
      contactName: customerName,
      contactEmail: customerEmail,
      contactPhone: customerPhone ?? "",
      phone: customerPhone ?? "",
    },
    select: {
      id: true,
      userId: true,
      customerType: true,
      approvalStatus: true,
      approvedAt: true,
      approvedByUserId: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          fullName: true,
          phone: true,
        },
      },
    },
  });

  return {
    kind: "READY",
    customer,
  };
}

  private generateUsernameFromEmail(email: string): string {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
    return `${base}_${Date.now()}`;
  }

  private async resolveIndividualVehicleInput(
    customerId: string,
    input: CreateIndividualDeliveryFromQuoteInput
  ) {
    if (!input.savedVehicleId) {
      return {
        licensePlate: input.licensePlate.trim(),
        vehicleColor: input.vehicleColor.trim(),
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
      };
    }

    const savedVehicle = await this.prisma.savedVehicle.findFirst({
      where: {
        id: input.savedVehicleId,
        customerId,
      },
      select: {
        id: true,
        make: true,
        model: true,
        color: true,
        licensePlate: true,
      },
    });

    if (!savedVehicle) {
      throw new NotFoundException("Saved vehicle not found");
    }

    return {
      licensePlate: savedVehicle.licensePlate,
      vehicleColor: savedVehicle.color,
      vehicleMake: savedVehicle.make,
      vehicleModel: savedVehicle.model,
    };
  }

  async createDeliveryFromAcceptedQuote(input: CreateDeliveryFromQuoteInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        postpaidEnabled: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        estimatedPrice: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        serviceType: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (!/^\d{4}$/.test(input.vinVerificationCode)) {
      throw new BadRequestException(
        "VIN verification code must be exactly 4 numeric digits"
      );
    }

    this.assertScheduleWindows(input);

    const policyCustomerType =
      customer.customerType === EnumCustomerCustomerType.BUSINESS
        ? EnumSchedulingPolicyCustomerType.BUSINESS
        : EnumSchedulingPolicyCustomerType.PRIVATE;

    const policyServiceType =
      this.mapDeliveryServiceTypeToSchedulingServiceType(input.serviceType);

    const policy =
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: policyServiceType,
        },
        orderBy: { createdAt: "desc" },
      })) ??
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: null,
        },
        orderBy: { createdAt: "desc" },
      }));

    const routeMetrics =
      quote.pickupLat != null &&
      quote.pickupLng != null &&
      quote.dropoffLat != null &&
      quote.dropoffLng != null
        ? await this.mapsService.computeRouteMetrics({
            originLat: quote.pickupLat,
            originLng: quote.pickupLng,
            destinationLat: quote.dropoffLat,
            destinationLng: quote.dropoffLng,
          })
        : null;

    const bufferMinutes = policy?.bufferMinutes ?? 30;

    const sameDayEligible = this.isSameDayEligible(
      input.pickupWindowStart,
      input.dropoffWindowEnd,
      routeMetrics?.durationMinutes ?? 0,
      bufferMinutes,
      policy?.maxSameDayMiles ?? null,
      routeMetrics?.distanceMiles ?? null
    );

    const requiresOpsConfirmation =
      policy?.requiresOpsConfirmation === true ||
      (input.afterHours === true && policy?.afterHoursEnabled !== true) ||
      (sameDayEligible === false &&
        this.isSameCalendarDay(
          input.pickupWindowStart,
          input.dropoffWindowEnd
        ));

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: input.customerId,
        quoteId: input.quoteId,
        createdByUserId: input.createdByUserId ?? null,
        createdByRole: input.createdByRole ?? null,
        customerChose: input.customerChose ?? null,

        pickupAddress: quote.pickupAddress,
        pickupLat: quote.pickupLat ?? null,
        pickupLng: quote.pickupLng ?? null,
        pickupPlaceId: quote.pickupPlaceId ?? null,
        pickupState: quote.pickupState ?? null,

        dropoffAddress: quote.dropoffAddress,
        dropoffLat: quote.dropoffLat ?? null,
        dropoffLng: quote.dropoffLng ?? null,
        dropoffPlaceId: quote.dropoffPlaceId ?? null,
        dropoffState: quote.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        dropoffWindowStart: input.dropoffWindowStart,
        dropoffWindowEnd: input.dropoffWindowEnd,

        etaMinutes: routeMetrics?.durationMinutes ?? null,
        bufferMinutes,
        sameDayEligible,
        requiresOpsConfirmation,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.QUOTED,

        licensePlate: input.licensePlate.trim(),
        vehicleColor: input.vehicleColor.trim(),
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
        vinVerificationCode: input.vinVerificationCode.trim(),

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
      },
      select: {
        id: true,
        status: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        etaMinutes: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: input.createdByUserId ?? null,
        actorRole: input.createdByRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.QUOTED,
        note: "Delivery created from accepted quote",
      },
    });

    await this.prisma.deliveryCompliance.create({
      data: {
        deliveryId: delivery.id,
        vinVerificationCode: input.vinVerificationCode.trim(),
      },
    });

    await this.prisma.trackingSession.create({
      data: {
        deliveryId: delivery.id,
      },
    });

    const paymentType =
      customer.customerType === EnumCustomerCustomerType.BUSINESS &&
      customer.postpaidEnabled === true
        ? EnumPaymentPaymentType.POSTPAID
        : EnumPaymentPaymentType.PREPAID;

    const payment = await this.prisma.payment.create({
      data: {
        deliveryId: delivery.id,
        amount: quote.estimatedPrice,
        paymentType,
        provider: EnumPaymentProvider.MANUAL,
        status: EnumPaymentStatus.AUTHORIZED,
        authorizedAt: new Date(),
      },
    });

    if (paymentType === EnumPaymentPaymentType.PREPAID) {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: EnumPaymentEventType.AUTHORIZE,
          status: EnumPaymentEventStatus.AUTHORIZED,
          amount: quote.estimatedPrice,
          message: "Manual prepaid payment authorized at delivery creation",
          raw: {
            source: "business-create-from-quote",
            deliveryId: delivery.id,
            customerId: customer.id,
            paymentType,
          },
        },
      });
    }

    await this.notificationEventEngine.notifyDeliveryCreated({
      deliveryId: delivery.id,
      actorUserId: input.createdByUserId ?? null,
    });

    return delivery;
  }

  private assertScheduleWindows(input: CreateDeliveryFromQuoteInput) {
    if (input.pickupWindowStart >= input.pickupWindowEnd) {
      throw new BadRequestException("Pickup window start must be before end");
    }

    if (input.dropoffWindowStart >= input.dropoffWindowEnd) {
      throw new BadRequestException("Drop-off window start must be before end");
    }

    if (input.dropoffWindowEnd < input.pickupWindowStart) {
      throw new BadRequestException(
        "Drop-off window cannot end before pickup starts"
      );
    }
  }

  private isSameDayEligible(
    pickupStart: Date,
    dropoffEnd: Date,
    etaMinutes: number,
    bufferMinutes: number,
    maxSameDayMiles: number | null,
    miles: number | null
  ): boolean {
    if (!this.isSameCalendarDay(pickupStart, dropoffEnd)) {
      return false;
    }

    if (maxSameDayMiles != null && miles != null && miles > maxSameDayMiles) {
      return false;
    }

    const availableMinutes = Math.floor(
      (dropoffEnd.getTime() - pickupStart.getTime()) / (1000 * 60)
    );

    return availableMinutes >= etaMinutes + bufferMinutes;
  }

  private isSameCalendarDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private mapDeliveryServiceTypeToQuoteServiceType(
    value: EnumDeliveryRequestServiceType
  ): EnumQuoteServiceType {
    if (value === EnumDeliveryRequestServiceType.HOME_DELIVERY) {
      return EnumQuoteServiceType.HOME_DELIVERY;
    }

    if (value === EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS) {
      return EnumQuoteServiceType.BETWEEN_LOCATIONS;
    }

    return EnumQuoteServiceType.SERVICE_PICKUP_RETURN;
  }

  private mapDeliveryServiceTypeToSchedulingServiceType(
    value: EnumDeliveryRequestServiceType
  ): EnumSchedulingPolicyServiceType {
    if (value === EnumDeliveryRequestServiceType.HOME_DELIVERY) {
      return EnumSchedulingPolicyServiceType.HOME_DELIVERY;
    }

    if (value === EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS) {
      return EnumSchedulingPolicyServiceType.BETWEEN_LOCATIONS;
    }

    return EnumSchedulingPolicyServiceType.SERVICE_PICKUP_RETURN;
  }

  private resolveIndividualSchedule(input: {
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
    etaMinutes: number;
    bufferMinutes: number;
  }) {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (hasPickup && hasDropoff) {
      return {
        pickupWindowStart: input.pickupWindowStart!,
        pickupWindowEnd: input.pickupWindowEnd!,
        dropoffWindowStart: input.dropoffWindowStart!,
        dropoffWindowEnd: input.dropoffWindowEnd!,
      };
    }

    if (!hasPickup && !hasDropoff) {
      throw new BadRequestException(
        "Provide either pickup window or dropoff window"
      );
    }

    const travelWithBufferMinutes = input.etaMinutes + input.bufferMinutes;

    if (hasPickup) {
      const pickupStart = input.pickupWindowStart!;
      const pickupEnd = input.pickupWindowEnd!;

      return {
        pickupWindowStart: pickupStart,
        pickupWindowEnd: pickupEnd,
        dropoffWindowStart: new Date(
          pickupStart.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowEnd: new Date(
          pickupEnd.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
      };
    }

    const dropoffStart = input.dropoffWindowStart!;
    const dropoffEnd = input.dropoffWindowEnd!;

    return {
      pickupWindowStart: new Date(
        dropoffStart.getTime() - travelWithBufferMinutes * 60 * 1000
      ),
      pickupWindowEnd: new Date(
        dropoffEnd.getTime() - travelWithBufferMinutes * 60 * 1000
      ),
      dropoffWindowStart: dropoffStart,
      dropoffWindowEnd: dropoffEnd,
    };
  }

  private async upsertSavedVehicleForCustomer(
    customerId: string,
    input: {
      licensePlate: string;
      make: string | null;
      model: string | null;
      color: string;
    }
  ) {
    const existing = await this.prisma.savedVehicle.findFirst({
      where: {
        customerId,
        licensePlate: input.licensePlate,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.savedVehicle.update({
        where: { id: existing.id },
        data: {
          make: input.make,
          model: input.model,
          color: input.color,
        },
      });
    }

    return this.prisma.savedVehicle.create({
      data: {
        customerId,
        licensePlate: input.licensePlate,
        make: input.make,
        model: input.model,
        color: input.color,
      },
    });
  }

  async schedulePreview(
    input: SchedulePreviewInput
  ): Promise<SchedulePreviewResult> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        serviceType: true,
      },
    });
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    const expectedQuoteServiceType =
      this.mapDeliveryServiceTypeToQuoteServiceType(input.serviceType);

    if (quote.serviceType !== expectedQuoteServiceType) {
      throw new BadRequestException(
        "Selected service type does not match the quote"
      );
    }

    this.validatePreviewWindowPair(
      input.pickupWindowStart ?? null,
      input.pickupWindowEnd ?? null,
      "pickup window"
    );
    this.validatePreviewWindowPair(
      input.dropoffWindowStart ?? null,
      input.dropoffWindowEnd ?? null,
      "dropoff window"
    );

    let policyCustomerType: EnumSchedulingPolicyCustomerType =
      EnumSchedulingPolicyCustomerType.BUSINESS;

    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: {
          id: true,
          customerType: true,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      policyCustomerType =
        customer.customerType === EnumCustomerCustomerType.BUSINESS
          ? EnumSchedulingPolicyCustomerType.BUSINESS
          : EnumSchedulingPolicyCustomerType.PRIVATE;
    }

    const routeMetrics =
      quote.pickupLat != null &&
      quote.pickupLng != null &&
      quote.dropoffLat != null &&
      quote.dropoffLng != null
        ? await this.mapsService.computeRouteMetrics({
            originLat: quote.pickupLat,
            originLng: quote.pickupLng,
            destinationLat: quote.dropoffLat,
            destinationLng: quote.dropoffLng,
          })
        : null;

    const policy =
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: this.mapDeliveryServiceTypeToSchedulingServiceType(
            input.serviceType
          ),
        },
        orderBy: { createdAt: "desc" },
      })) ??
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: null,
        },
        orderBy: { createdAt: "desc" },
      }));

    const policyAny = policy as any;

    const bufferMinutes = policy?.bufferMinutes ?? 30;
    const etaMinutes = routeMetrics?.durationMinutes ?? null;
    const distanceMiles = routeMetrics?.distanceMiles ?? null;

    const resolvedCustomerChose = this.resolvePreviewCustomerChose({
      customerChose: input.customerChose ?? null,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
    });

    const schedule = this.resolveSchedulePreview({
      customerChose: resolvedCustomerChose,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
      etaMinutes: etaMinutes ?? 0,
      bufferMinutes,
    });

    const sameDayRequested = this.isSameCalendarDay(
      schedule.pickupWindowStart,
      schedule.dropoffWindowEnd
    );

    const sameDayEligible = this.isSameDayEligible(
      schedule.pickupWindowStart,
      schedule.dropoffWindowEnd,
      etaMinutes ?? 0,
      bufferMinutes,
      policy?.maxSameDayMiles ?? null,
      distanceMiles
    );

    const afterHours = this.isScheduleAfterHours(
      {
        pickupWindowStart: schedule.pickupWindowStart,
        pickupWindowEnd: schedule.pickupWindowEnd,
        dropoffWindowStart: schedule.dropoffWindowStart,
        dropoffWindowEnd: schedule.dropoffWindowEnd,
      },
      policyAny
    );

    let feasible = true;
    let requiresOpsConfirmation = false;
    let message: string | null = null;

    const availableMinutes = Math.floor(
      (schedule.dropoffWindowEnd.getTime() -
        schedule.pickupWindowStart.getTime()) /
        (1000 * 60)
    );
    const requiredMinutes = (etaMinutes ?? 0) + bufferMinutes;

    if (schedule.pickupWindowStart >= schedule.pickupWindowEnd) {
      feasible = false;
      message = "Pickup window start must be before pickup window end.";
    } else if (schedule.dropoffWindowStart >= schedule.dropoffWindowEnd) {
      feasible = false;
      message = "Drop-off window start must be before drop-off window end.";
    } else if (schedule.dropoffWindowEnd <= schedule.pickupWindowStart) {
      feasible = false;
      message = "Drop-off window must occur after pickup window.";
    } else if (availableMinutes < requiredMinutes) {
      feasible = false;
      message =
        "Selected schedule does not allow enough time for route ETA plus buffer.";
    } else if (sameDayRequested && !sameDayEligible) {
      const shouldRouteToOps =
        policy?.requiresOpsConfirmation === true ||
        policyAny?.manualConfirmationForSameDayFailure === true;

      if (shouldRouteToOps) {
        feasible = true;
        requiresOpsConfirmation = true;
        message =
          "Same-day scheduling is outside current policy and requires Operations confirmation.";
      } else {
        feasible = false;
        message =
          "Same-day scheduling is not eligible for this route or time window. Please choose the nearest feasible next option.";
      }
    }

    if (afterHours) {
      if (policy?.afterHoursEnabled === true) {
        message =
          message ??
          "Schedule is outside normal operating hours but after-hours delivery is enabled.";
      } else {
        requiresOpsConfirmation = true;
        message =
          message ??
          "This schedule is outside normal operating hours and requires Operations confirmation.";
      }
    }

    const dealerSameDayCutoffHour = this.resolveNumericPolicyValue(
      policyAny?.sameDayCutoffHour,
      15
    );
    const latestWindowEndHour = this.resolveNumericPolicyValue(
      policyAny?.latestDeliveryWindowEndHour,
      19
    );
    const earliestWindowStartHour = this.resolveNumericPolicyValue(
      policyAny?.earliestPickupWindowStartHour,
      7
    );

    if (sameDayRequested) {
      const now = new Date();
      if (this.isSameCalendarDay(now, schedule.pickupWindowStart)) {
        const cutoff = new Date(schedule.pickupWindowStart);
        cutoff.setHours(dealerSameDayCutoffHour, 0, 0, 0);

        if (now > cutoff) {
          if (policy?.requiresOpsConfirmation === true) {
            requiresOpsConfirmation = true;
            message =
              message ??
              "Same-day cutoff has passed and this request requires Operations confirmation.";
          } else {
            feasible = false;
            message =
              message ??
              "Same-day cutoff has passed for dealer scheduling. Please choose the next feasible slot.";
          }
        }
      }
    }

    if (
      this.hourOf(schedule.pickupWindowStart) < earliestWindowStartHour ||
      this.hourOf(schedule.dropoffWindowEnd) > latestWindowEndHour
    ) {
      if (policy?.afterHoursEnabled === true) {
        message =
          message ??
          "Selected schedule falls outside default MVP time windows but remains allowed by policy.";
      } else {
        requiresOpsConfirmation = true;
        message =
          message ??
          "Selected schedule falls outside default MVP time windows and requires Operations confirmation.";
      }
    }

    return {
      pickupWindowStart: schedule.pickupWindowStart,
      pickupWindowEnd: schedule.pickupWindowEnd,
      dropoffWindowStart: schedule.dropoffWindowStart,
      dropoffWindowEnd: schedule.dropoffWindowEnd,
      etaMinutes,
      bufferMinutes,
      sameDayEligible,
      requiresOpsConfirmation,
      afterHours,
      feasible,
      message,
    };
  }

  private resolvePreviewCustomerChose(input: {
    customerChose: EnumDeliveryRequestCustomerChose | null;
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
  }): EnumDeliveryRequestCustomerChose | null {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (input.customerChose) {
      if (
        input.customerChose === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW &&
        !hasPickup
      ) {
        throw new BadRequestException(
          "customerChose is PICKUP_WINDOW but pickup window is missing"
        );
      }

      if (
        input.customerChose === EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW &&
        !hasDropoff
      ) {
        throw new BadRequestException(
          "customerChose is DROPOFF_WINDOW but dropoff window is missing"
        );
      }

      return input.customerChose;
    }

    if (hasPickup && !hasDropoff) {
      return EnumDeliveryRequestCustomerChose.PICKUP_WINDOW;
    }

    if (!hasPickup && hasDropoff) {
      return EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW;
    }

    if (hasPickup && hasDropoff) {
      return null;
    }

    throw new BadRequestException(
      "Provide either pickup window or dropoff window for schedule preview"
    );
  }

  private resolveSchedulePreview(input: {
    customerChose: EnumDeliveryRequestCustomerChose | null;
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
    etaMinutes: number;
    bufferMinutes: number;
  }) {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (hasPickup && hasDropoff && !input.customerChose) {
      return {
        pickupWindowStart: input.pickupWindowStart!,
        pickupWindowEnd: input.pickupWindowEnd!,
        dropoffWindowStart: input.dropoffWindowStart!,
        dropoffWindowEnd: input.dropoffWindowEnd!,
      };
    }

    const travelWithBufferMinutes = input.etaMinutes + input.bufferMinutes;

    if (
      input.customerChose === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW ||
      (hasPickup && !hasDropoff)
    ) {
      const pickupStart = input.pickupWindowStart!;
      const pickupEnd = input.pickupWindowEnd!;

      return {
        pickupWindowStart: pickupStart,
        pickupWindowEnd: pickupEnd,
        dropoffWindowStart: new Date(
          pickupStart.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowEnd: new Date(
          pickupEnd.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
      };
    }

    if (
      input.customerChose === EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW ||
      (!hasPickup && hasDropoff)
    ) {
      const dropoffStart = input.dropoffWindowStart!;
      const dropoffEnd = input.dropoffWindowEnd!;

      return {
        pickupWindowStart: new Date(
          dropoffStart.getTime() - travelWithBufferMinutes * 60 * 1000
        ),
        pickupWindowEnd: new Date(
          dropoffEnd.getTime() - travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowStart: dropoffStart,
        dropoffWindowEnd: dropoffEnd,
      };
    }

    throw new BadRequestException("Unable to resolve schedule preview");
  }

  private validatePreviewWindowPair(
    start: Date | null,
    end: Date | null,
    label: string
  ): void {
    if ((start && !end) || (!start && end)) {
      throw new BadRequestException(
        `${label} start and end must both be provided together`
      );
    }

    if (!start && !end) {
      return;
    }

    const startDate = new Date(start as Date);
    const endDate = new Date(end as Date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(`${label} is invalid`);
    }

    if (endDate <= startDate) {
      throw new BadRequestException(`${label} end must be after start`);
    }
  }

  private isScheduleAfterHours(
    input: {
      pickupWindowStart: Date;
      pickupWindowEnd: Date;
      dropoffWindowStart: Date;
      dropoffWindowEnd: Date;
    },
    policy: any
  ): boolean {
    const earliestHour = this.resolveNumericPolicyValue(
      policy?.earliestPickupWindowStartHour,
      7
    );
    const latestHour = this.resolveNumericPolicyValue(
      policy?.latestDeliveryWindowEndHour,
      19
    );

    const values = [
      input.pickupWindowStart,
      input.pickupWindowEnd,
      input.dropoffWindowStart,
      input.dropoffWindowEnd,
    ];

    return values.some((value) => {
      const hour = this.hourOf(value);
      return hour < earliestHour || hour >= latestHour;
    });
  }

  private hourOf(value: Date): number {
    return new Date(value).getHours();
  }

  private resolveNumericPolicyValue(
    value: unknown,
    fallback: number
  ): number {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number(value)
        : NaN;

    return Number.isFinite(parsed) ? parsed : fallback;
  }
}