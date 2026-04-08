import { BadRequestException, Injectable } from "@nestjs/common";
import {
  EnumDeliveryEvidencePhase,
  EnumDeliveryEvidenceType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DeliveryEvidenceEngine {
  static readonly REQUIRED_PICKUP_PHOTO_COUNT = 6;
  static readonly REQUIRED_DROPOFF_PHOTO_COUNT = 6;

  constructor(private readonly prisma: PrismaService) {}

  async attachPickupPhoto(
    deliveryId: string,
    slotIndex: number,
    imageUrl: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryEvidenceEngine.REQUIRED_PICKUP_PHOTO_COUNT
    );
    const url = this.requireImageUrl(imageUrl);

    return this.upsertPhotoEvidence(
      {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.PICKUP,
        type: EnumDeliveryEvidenceType.PICKUP_PHOTO,
        slotIndex: slot,
        imageUrl: url,
      },
      db
    );
  }

  async removePickupPhoto(
    deliveryId: string,
    slotIndex: number,
    tx?: Tx
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryEvidenceEngine.REQUIRED_PICKUP_PHOTO_COUNT
    );

    await this.deletePhotoEvidenceIfExists(
      deliveryId,
      EnumDeliveryEvidencePhase.PICKUP,
      EnumDeliveryEvidenceType.PICKUP_PHOTO,
      slot,
      db
    );
  }

  async attachDropoffPhoto(
    deliveryId: string,
    slotIndex: number,
    imageUrl: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryEvidenceEngine.REQUIRED_DROPOFF_PHOTO_COUNT
    );
    const url = this.requireImageUrl(imageUrl);

    return this.upsertPhotoEvidence(
      {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.DROPOFF,
        type: EnumDeliveryEvidenceType.DROPOFF_PHOTO,
        slotIndex: slot,
        imageUrl: url,
      },
      db
    );
  }

  async removeDropoffPhoto(
    deliveryId: string,
    slotIndex: number,
    tx?: Tx
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const slot = this.parsePhotoSlot(
      slotIndex,
      DeliveryEvidenceEngine.REQUIRED_DROPOFF_PHOTO_COUNT
    );

    await this.deletePhotoEvidenceIfExists(
      deliveryId,
      EnumDeliveryEvidencePhase.DROPOFF,
      EnumDeliveryEvidenceType.DROPOFF_PHOTO,
      slot,
      db
    );
  }

  async upsertPickupVinEvidence(
    deliveryId: string,
    value: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    return this.upsertValueEvidence(
      {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.PICKUP,
        type: EnumDeliveryEvidenceType.VIN_CONFIRMATION,
        value: this.requireValue(value, "VIN evidence value"),
      },
      db
    );
  }

  async upsertPickupOdometerEvidence(
    deliveryId: string,
    value: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    return this.upsertValueEvidence(
      {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.PICKUP,
        type: EnumDeliveryEvidenceType.ODOMETER_START,
        value: this.requireValue(value, "Pickup odometer evidence value"),
      },
      db
    );
  }

  async upsertDropoffOdometerEvidence(
    deliveryId: string,
    value: string,
    tx?: Tx
  ) {
    const db = tx ?? this.prisma;
    return this.upsertValueEvidence(
      {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.DROPOFF,
        type: EnumDeliveryEvidenceType.ODOMETER_END,
        value: this.requireValue(value, "Drop-off odometer evidence value"),
      },
      db
    );
  }

  async countPickupPhotos(deliveryId: string, tx?: Tx): Promise<number> {
    const db = tx ?? this.prisma;
    return db.deliveryEvidence.count({
      where: {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.PICKUP,
        type: EnumDeliveryEvidenceType.PICKUP_PHOTO,
        imageUrl: { not: null },
      },
    });
  }

  async countDropoffPhotos(deliveryId: string, tx?: Tx): Promise<number> {
    const db = tx ?? this.prisma;
    return db.deliveryEvidence.count({
      where: {
        deliveryId,
        phase: EnumDeliveryEvidencePhase.DROPOFF,
        type: EnumDeliveryEvidenceType.DROPOFF_PHOTO,
        imageUrl: { not: null },
      },
    });
  }

  async listDeliveryEvidence(deliveryId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    return db.deliveryEvidence.findMany({
      where: { deliveryId },
      orderBy: [{ phase: "asc" }, { type: "asc" }, { slotIndex: "asc" }],
    });
  }

  private async upsertPhotoEvidence(
    input: {
      deliveryId: string;
      phase: EnumDeliveryEvidencePhase;
      type: EnumDeliveryEvidenceType;
      slotIndex: number;
      imageUrl: string;
    },
    db: Tx
  ) {
    const existing = await db.deliveryEvidence.findFirst({
      where: {
        deliveryId: input.deliveryId,
        phase: input.phase,
        type: input.type,
        slotIndex: input.slotIndex,
      },
    });

    if (existing) {
      return db.deliveryEvidence.update({
        where: { id: existing.id },
        data: {
          imageUrl: input.imageUrl,
          value: null,
        },
      });
    }

    return db.deliveryEvidence.create({
      data: {
        delivery: { connect: { id: input.deliveryId } },
        phase: input.phase,
        type: input.type,
        slotIndex: input.slotIndex,
        imageUrl: input.imageUrl,
      },
    });
  }

  private async upsertValueEvidence(
    input: {
      deliveryId: string;
      phase: EnumDeliveryEvidencePhase;
      type: EnumDeliveryEvidenceType;
      value: string;
    },
    db: Tx
  ) {
    const existing = await db.deliveryEvidence.findFirst({
      where: {
        deliveryId: input.deliveryId,
        phase: input.phase,
        type: input.type,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return db.deliveryEvidence.update({
        where: { id: existing.id },
        data: {
          value: input.value,
          imageUrl: null,
        },
      });
    }

    return db.deliveryEvidence.create({
      data: {
        delivery: { connect: { id: input.deliveryId } },
        phase: input.phase,
        type: input.type,
        value: input.value,
      },
    });
  }

  private async deletePhotoEvidenceIfExists(
    deliveryId: string,
    phase: EnumDeliveryEvidencePhase,
    type: EnumDeliveryEvidenceType,
    slotIndex: number,
    db: Tx
  ): Promise<void> {
    const existing = await db.deliveryEvidence.findFirst({
      where: {
        deliveryId,
        phase,
        type,
        slotIndex,
      },
      select: { id: true },
    });

    if (!existing) return;

    await db.deliveryEvidence.delete({
      where: { id: existing.id },
    });
  }

  private parsePhotoSlot(value: number, max: number): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      throw new BadRequestException(`slotIndex must be between 1 and ${max}`);
    }
    return n;
  }

  private requireImageUrl(value: string): string {
    const url = `${value ?? ""}`.trim();
    if (!url) {
      throw new BadRequestException("imageUrl is required");
    }
    return url;
  }

  private requireValue(value: string, label: string): string {
    const v = `${value ?? ""}`.trim();
    if (!v) {
      throw new BadRequestException(`${label} is required`);
    }
    return v;
  }
}