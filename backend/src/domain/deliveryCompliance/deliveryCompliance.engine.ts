import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EnumDeliveryRequestStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryEvidenceEngine } from "../deliveryEvidence/deliveryEvidence.engine";

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DeliveryComplianceEngine {
  private static readonly REQUIRED_PICKUP_PHOTO_COUNT = 6;
  private static readonly REQUIRED_DROPOFF_PHOTO_COUNT = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryEvidenceEngine: DeliveryEvidenceEngine
  ) {}

  async ensureCompliance(deliveryId: string, tx?: Tx) {
    const db = tx ?? this.prisma;

    const delivery = await db.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true },
    });

    if (!delivery) {
      throw new NotFoundException(`DeliveryRequest ${deliveryId} not found`);
    }

    const existing = await db.deliveryCompliance.findUnique({
      where: { deliveryId },
    });

    if (existing) return existing;

    return db.deliveryCompliance.create({
      data: {
        delivery: { connect: { id: deliveryId } },
        vinConfirmed: false,
      },
    });
  }

async submitPickupCompliance(input: {
  deliveryId: string;
  driverId: string;
  vinVerificationCode: string;
  odometerStart: number;
  photos: Array<{
    slotIndex: number;
    imageUrl: string;
  }>;
}) {
  return this.prisma.$transaction(async (tx) => {
    const delivery = await this.getDeliveryForDriver(
      input.deliveryId,
      input.driverId,
      tx
    );

    if (delivery.status !== EnumDeliveryRequestStatus.BOOKED) {
      throw new BadRequestException(
        "Pickup compliance can only be submitted while delivery is BOOKED"
      );
    }

    await this.ensureCompliance(input.deliveryId, tx);

    await this.submitPickupVinTx(
      tx,
      input.deliveryId,
      input.driverId,
      input.vinVerificationCode
    );

    await this.submitPickupOdometerTx(
      tx,
      input.deliveryId,
      input.driverId,
      input.odometerStart
    );

    const photos = Array.isArray(input.photos) ? input.photos : [];
    this.validateDistinctPhotoSlots(
      photos,
      DeliveryComplianceEngine.REQUIRED_PICKUP_PHOTO_COUNT,
      "Pickup compliance"
    );

    for (const photo of photos) {
      await this.attachPickupPhotoTx(
        tx,
        input.deliveryId,
        input.driverId,
        photo.slotIndex,
        photo.imageUrl
      );
    }

    return this.getDriverWorkflowSummary(
      input.deliveryId,
      input.driverId,
      tx
    );
  });
}

async submitDropoffCompliance(input: {
  deliveryId: string;
  driverId: string;
  odometerEnd: number;
  photos: Array<{
    slotIndex: number;
    imageUrl: string;
  }>;
}) {
  return this.prisma.$transaction(async (tx) => {
    const delivery = await this.getDeliveryForDriver(
      input.deliveryId,
      input.driverId,
      tx
    );

    if (delivery.status !== EnumDeliveryRequestStatus.ACTIVE) {
      throw new BadRequestException(
        "Drop-off compliance can only be submitted while delivery is ACTIVE"
      );
    }

    await this.ensureCompliance(input.deliveryId, tx);

    await this.submitDropoffOdometerTx(
      tx,
      input.deliveryId,
      input.driverId,
      input.odometerEnd
    );

    const photos = Array.isArray(input.photos) ? input.photos : [];
    this.validateDistinctPhotoSlots(
      photos,
      DeliveryComplianceEngine.REQUIRED_DROPOFF_PHOTO_COUNT,
      "Drop-off compliance"
    );

    for (const photo of photos) {
      await this.attachDropoffPhotoTx(
        tx,
        input.deliveryId,
        input.driverId,
        photo.slotIndex,
        photo.imageUrl
      );
    }

    return this.getDriverWorkflowSummary(
      input.deliveryId,
      input.driverId,
      tx
    );
  });
}

  async getDriverWorkflowSummary(
    deliveryId: string,
    driverId: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, db);
    const compliance = await this.ensureCompliance(deliveryId, db);

    const pickupPhotoCount =
      await this.deliveryEvidenceEngine.countPickupPhotos(deliveryId, db);

    const dropoffPhotoCount =
      await this.deliveryEvidenceEngine.countDropoffPhotos(deliveryId, db);

    const pickupMissing: string[] = [];
    if (!compliance.vinConfirmed) pickupMissing.push("vinVerification");
    if (compliance.odometerStart == null) pickupMissing.push("odometerStart");
    if (
      pickupPhotoCount <
      DeliveryComplianceEngine.REQUIRED_PICKUP_PHOTO_COUNT
    ) {
      pickupMissing.push("pickupPhotos");
    }

    const dropoffMissing: string[] = [];
    if (compliance.odometerEnd == null) dropoffMissing.push("odometerEnd");
    if (
      compliance.odometerStart != null &&
      compliance.odometerEnd != null &&
      compliance.odometerEnd <= compliance.odometerStart
    ) {
      dropoffMissing.push("odometerEndMustExceedStart");
    }
    if (
      dropoffPhotoCount <
      DeliveryComplianceEngine.REQUIRED_DROPOFF_PHOTO_COUNT
    ) {
      dropoffMissing.push("dropoffPhotos");
    }

    return {
      deliveryId,
      status: delivery.status,
      pickup: {
        vinConfirmed: compliance.vinConfirmed,
        vinVerificationCode: compliance.vinVerificationCode,
        odometerStart: compliance.odometerStart,
        photoCount: pickupPhotoCount,
        requiredPhotoCount:
          DeliveryComplianceEngine.REQUIRED_PICKUP_PHOTO_COUNT,
        completedAt: compliance.pickupCompletedAt,
        ready: pickupMissing.length === 0,
        missing: pickupMissing,
      },
      dropoff: {
        odometerEnd: compliance.odometerEnd,
        photoCount: dropoffPhotoCount,
        requiredPhotoCount:
          DeliveryComplianceEngine.REQUIRED_DROPOFF_PHOTO_COUNT,
        completedAt: compliance.dropoffCompletedAt,
        ready: dropoffMissing.length === 0,
        missing: dropoffMissing,
      },
      canStartTrip:
        delivery.status === EnumDeliveryRequestStatus.BOOKED &&
        pickupMissing.length === 0,
      canCompleteTrip:
        delivery.status === EnumDeliveryRequestStatus.ACTIVE &&
        dropoffMissing.length === 0,
    };
  }

  async assertReadyForTripStart(
    deliveryId: string,
    driverId: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    const summary = await this.getDriverWorkflowSummary(
      deliveryId,
      driverId,
      db
    );

    if (!summary.canStartTrip) {
      throw new BadRequestException(
        `Pickup compliance incomplete: ${summary.pickup.missing.join(", ")}`
      );
    }

    await db.deliveryCompliance.update({
      where: { deliveryId },
      data: {
        pickupCompletedAt: new Date(),
      },
    });
  }

  async assertReadyForTripCompletion(
    deliveryId: string,
    driverId: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    const summary = await this.getDriverWorkflowSummary(
      deliveryId,
      driverId,
      db
    );

    if (!summary.canCompleteTrip) {
      throw new BadRequestException(
        `Drop-off compliance incomplete: ${summary.dropoff.missing.join(", ")}`
      );
    }

    await db.deliveryCompliance.update({
      where: { deliveryId },
      data: {
        dropoffCompletedAt: new Date(),
      },
    });
  }

  private async submitPickupVinTx(
    tx: Tx,
    deliveryId: string,
    driverId: string,
    enteredCode: string
  ) {
    const code = `${enteredCode ?? ""}`.trim();

    if (!/^\d{4}$/.test(code)) {
      throw new BadRequestException(
        "VIN verification code must be exactly 4 digits"
      );
    }

    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, tx);

    if (delivery.status !== EnumDeliveryRequestStatus.BOOKED) {
      throw new BadRequestException(
        "Pickup VIN can only be submitted while delivery is BOOKED"
      );
    }

    if (delivery.vinVerificationCode !== code) {
      throw new BadRequestException("VIN verification code does not match");
    }

    await tx.deliveryCompliance.update({
      where: { deliveryId },
      data: {
        vinConfirmed: true,
        vinVerificationCode: code,
      },
    });

    await this.deliveryEvidenceEngine.upsertPickupVinEvidence(
      deliveryId,
      code,
      tx
    );
  }

  private async submitPickupOdometerTx(
    tx: Tx,
    deliveryId: string,
    driverId: string,
    odometerStart: number
  ) {
    const value = this.parseNonNegativeInt(
      odometerStart,
      "Starting odometer"
    );

    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, tx);

    if (delivery.status !== EnumDeliveryRequestStatus.BOOKED) {
      throw new BadRequestException(
        "Pickup odometer can only be submitted while delivery is BOOKED"
      );
    }

    await tx.deliveryCompliance.update({
      where: { deliveryId },
      data: {
        odometerStart: value,
      },
    });

    await this.deliveryEvidenceEngine.upsertPickupOdometerEvidence(
      deliveryId,
      String(value),
      tx
    );
  }

  private async attachPickupPhotoTx(
    tx: Tx,
    deliveryId: string,
    driverId: string,
    slotIndex: number,
    imageUrl: string
  ) {
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryComplianceEngine.REQUIRED_PICKUP_PHOTO_COUNT
    );
    const url = this.requireImageUrl(imageUrl);

    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, tx);

    if (delivery.status !== EnumDeliveryRequestStatus.BOOKED) {
      throw new BadRequestException(
        "Pickup photos can only be uploaded while delivery is BOOKED"
      );
    }

    await this.deliveryEvidenceEngine.attachPickupPhoto(
      deliveryId,
      slot,
      url,
      tx
    );
  }

  private async submitDropoffOdometerTx(
    tx: Tx,
    deliveryId: string,
    driverId: string,
    odometerEnd: number
  ) {
    const value = this.parseNonNegativeInt(odometerEnd, "Ending odometer");

    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, tx);

    if (delivery.status !== EnumDeliveryRequestStatus.ACTIVE) {
      throw new BadRequestException(
        "Drop-off odometer can only be submitted while delivery is ACTIVE"
      );
    }

    const compliance = await this.ensureCompliance(deliveryId, tx);

    if (compliance.odometerStart == null) {
      throw new BadRequestException(
        "Starting odometer must exist before ending odometer"
      );
    }

    if (value <= compliance.odometerStart) {
      throw new BadRequestException(
        "Ending odometer must be greater than starting odometer"
      );
    }

    await tx.deliveryCompliance.update({
      where: { deliveryId },
      data: {
        odometerEnd: value,
      },
    });

    await this.deliveryEvidenceEngine.upsertDropoffOdometerEvidence(
      deliveryId,
      String(value),
      tx
    );
  }

  private async attachDropoffPhotoTx(
    tx: Tx,
    deliveryId: string,
    driverId: string,
    slotIndex: number,
    imageUrl: string
  ) {
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryComplianceEngine.REQUIRED_DROPOFF_PHOTO_COUNT
    );
    const url = this.requireImageUrl(imageUrl);

    const delivery = await this.getDeliveryForDriver(deliveryId, driverId, tx);

    if (delivery.status !== EnumDeliveryRequestStatus.ACTIVE) {
      throw new BadRequestException(
        "Drop-off photos can only be uploaded while delivery is ACTIVE"
      );
    }

    await this.deliveryEvidenceEngine.attachDropoffPhoto(
      deliveryId,
      slot,
      url,
      tx
    );
  }

  private async getDeliveryForDriver(
    deliveryId: string,
    driverId: string,
    db: Tx
  ) {
    const delivery = await db.deliveryRequest.findUnique({
      where: { id: deliveryId },
      include: {
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`DeliveryRequest ${deliveryId} not found`);
    }

    const activeAssignment = delivery.assignments?.[0];
    if (!activeAssignment || activeAssignment.driverId !== driverId) {
      throw new BadRequestException("Delivery is not assigned to this driver");
    }

    return delivery;
  }

  private parseNonNegativeInt(value: number, label: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException(
        `${label} must be a non-negative integer`
      );
    }
    return n;
  }

  private parsePhotoSlot(value: number, max: number) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      throw new BadRequestException(`slotIndex must be between 1 and ${max}`);
    }
    return n;
  }

  private requireImageUrl(value: string) {
    const url = `${value ?? ""}`.trim();
    if (!url) {
      throw new BadRequestException("imageUrl is required");
    }
    return url;
  }

private validateDistinctPhotoSlots(
  photos: Array<{ slotIndex: number; imageUrl: string }>,
  requiredCount: number,
  label: string
) {
  if (!Array.isArray(photos) || photos.length < requiredCount) {
    throw new BadRequestException(
      `${label} requires ${requiredCount} photos`
    );
  }

  if (photos.length > requiredCount) {
    throw new BadRequestException(
      `${label} cannot contain more than ${requiredCount} photos`
    );
  }

  const slots = photos.map((p) =>
    this.parsePhotoSlot(p.slotIndex, requiredCount)
  );
  const uniqueSlots = new Set(slots);

  if (uniqueSlots.size !== photos.length) {
    throw new BadRequestException(
      `${label} contains duplicate slotIndex values`
    );
  }

  for (let i = 1; i <= requiredCount; i++) {
    if (!uniqueSlots.has(i)) {
      throw new BadRequestException(
        `${label} must include slotIndex values 1 through ${requiredCount}`
      );
    }
  }
}
}