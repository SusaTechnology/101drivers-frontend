import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnumDeliveryEvidencePhase } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {}

  getDeliveryEvidenceDiskRoot(deliveryId: string): string {
    const root =
      this.configService.get<string>("DRIVERS_MEDIA_ROOT") ??
      "/srv/cdn/101-drivers";

    return path.join(root, "delivery-evidence", deliveryId);
  }

  getDeliveryEvidencePublicBaseUrl(): string {
    return (
      this.configService.get<string>("DRIVERS_MEDIA_BASE_URL") ??
      "https://cdn.techbee.et/101-drivers"
    );
  }

  ensureDirectory(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }

  validateDeliveryId(deliveryId: string): string {
    const value = `${deliveryId ?? ""}`.trim();
    if (!value) {
      throw new BadRequestException("deliveryId is required");
    }
    return value;
  }

  validateSlotIndex(slotIndex?: number | null): number | null {
    if (slotIndex === undefined || slotIndex === null) {
      return null;
    }

    const n = Number(slotIndex);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      throw new BadRequestException("slotIndex must be an integer between 1 and 6");
    }

    return n;
  }

  validatePhase(
    phase?: EnumDeliveryEvidencePhase | null
  ): EnumDeliveryEvidencePhase | null {
    if (phase == null) return null;

    if (
      phase !== EnumDeliveryEvidencePhase.PICKUP &&
      phase !== EnumDeliveryEvidencePhase.DROPOFF
    ) {
      throw new BadRequestException("phase must be PICKUP or DROPOFF");
    }

    return phase;
  }

  validateMimeType(mimeType: string): void {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(
        "Only jpeg, png, and webp images are allowed"
      );
    }
  }

  buildDeliveryEvidenceFilename(input: {
    phase?: EnumDeliveryEvidencePhase | null;
    slotIndex?: number | null;
    originalName: string;
  }): string {
    const ext = path.extname(input.originalName || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
      ? ext
      : ".jpg";

    const phasePart = input.phase ? input.phase.toLowerCase() : "evidence";
    const slotPart =
      input.slotIndex != null ? `slot-${input.slotIndex}` : "slot-x";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    return `${phasePart}-${slotPart}-${unique}${safeExt}`;
  }

  buildDeliveryEvidencePublicUrl(input: {
    deliveryId: string;
    filename: string;
  }): string {
    const base = this.getDeliveryEvidencePublicBaseUrl().replace(/\/+$/, "");
    return `${base}/delivery-evidence/${input.deliveryId}/${input.filename}`;
  }

  deleteFileByUrl(url: string): void {
    const base = this.getDeliveryEvidencePublicBaseUrl().replace(/\/+$/, "");
    if (!url.startsWith(base)) {
      return;
    }

    const relative = url.slice(base.length).replace(/^\/+/, "");
    const root =
      this.configService.get<string>("DRIVERS_MEDIA_ROOT") ??
      "/srv/cdn/101-drivers";
    const absolutePath = path.join(root, relative);

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      fs.unlinkSync(absolutePath);
    }
  }

  getDriverProfilePhotoDiskRoot(driverId: string): string {
    const root =
      this.configService.get<string>("DRIVERS_MEDIA_ROOT") ??
      "/srv/cdn/101-drivers";

    return path.join(root, "driver-profile", driverId);
  }

  buildDriverProfilePhotoFilename(originalName: string): string {
    const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
      ? ext
      : ".jpg";

    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `profile-${unique}${safeExt}`;
  }

  buildDriverProfilePhotoPublicUrl(input: {
    driverId: string;
    filename: string;
  }): string {
    const base = this.getDeliveryEvidencePublicBaseUrl().replace(/\/+$/, "");
    return `${base}/driver-profile/${input.driverId}/${input.filename}`;
  }
  


  validateAppSettingFileMimeType(input: {
  mimeType: string;
  kind: "PDF" | "IMAGE";
}): void {
  const pdfAllowed = ["application/pdf"];
  const imageAllowed = ["image/jpeg", "image/png", "image/webp"];

  if (input.kind === "PDF") {
    if (!pdfAllowed.includes(input.mimeType)) {
      throw new BadRequestException("Only PDF files are allowed for kind=PDF");
    }
    return;
  }

  if (!imageAllowed.includes(input.mimeType)) {
    throw new BadRequestException(
      "Only jpeg, png, and webp images are allowed for kind=IMAGE"
    );
  }
}

getAppSettingDiskRoot(scope: string): string {
  const root =
    this.configService.get<string>("DRIVERS_MEDIA_ROOT") ??
    "/srv/cdn/101-drivers";

  return path.join(root, "app-settings", scope);
}

buildAppSettingFilename(input: {
  kind: "PDF" | "IMAGE";
  originalName: string;
  filenameHint?: string;
}): string {
  const ext = path.extname(input.originalName || "").toLowerCase();
  const safePdfExt = ext === ".pdf" ? ".pdf" : ".pdf";
  const safeImageExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
    ? ext
    : ".jpg";

  const hint =
    (input.filenameHint ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";

  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  return `${hint}-${unique}${input.kind === "PDF" ? safePdfExt : safeImageExt}`;
}

buildAppSettingPublicUrl(input: {
  scope: string;
  filename: string;
}): string {
  const base =
    (
      this.configService.get<string>("DRIVERS_MEDIA_BASE_URL") ??
      "https://cdn.techbee.et/101-drivers"
    ).replace(/\/+$/, "");

  return `${base}/app-settings/${input.scope}/${input.filename}`;
}

}