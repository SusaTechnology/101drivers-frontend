import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import * as multer from "multer";
import { UploadService } from "./upload.service";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";

// Memory storage — files are buffered in memory, then saved by the service
const memoryStorage = multer.memoryStorage();

@Controller("uploads")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/uploads/delivery-evidence
   *
   * Accepts multipart form data with:
   *   - files: one or more image files (field name "files")
   *   - deliveryId: the delivery ID (string)
   *   - photoType: "car-photos" | "odometer" | "vin"
   *
   * Returns:
   *   { ok: true, files: [{ slotIndex: number, url: string }] }
   */
  @Post("delivery-evidence")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: "files", maxCount: 10 }], {
      storage: memoryStorage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 10, // max 10 files per request
      },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only images are allowed.`,
            ) as any,
            false,
          );
        }
      },
    }),
  )
  async uploadDeliveryEvidence(
    @UploadedFiles() files: { files?: Express.Multer.File[] },
    @Req() req: Request,
  ) {
    const uploadedFiles = files?.files;
    const deliveryId = (req.body as any).deliveryId;
    const photoType = (req.body as any).photoType;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      throw new BadRequestException("No files uploaded");
    }

    if (!deliveryId) {
      throw new BadRequestException("deliveryId is required");
    }

    const validPhotoTypes = ["car-photos", "odometer", "vin"];
    if (!photoType || !validPhotoTypes.includes(photoType)) {
      throw new BadRequestException(
        `photoType must be one of: ${validPhotoTypes.join(", ")}`,
      );
    }

    if (photoType === "car-photos" && uploadedFiles.length !== 6) {
      throw new BadRequestException(
        "car-photos requires exactly 6 files (one per walk-around position)",
      );
    }

    // Validate each file
    for (const file of uploadedFiles) {
      this.uploadService.validateImageFile(file);
    }

    // Save files and get URLs
    const savedFiles = await this.uploadService.saveDeliveryEvidenceFiles(
      uploadedFiles,
      deliveryId,
      photoType,
    );

    return {
      ok: true,
      files: savedFiles,
    };
  }
}
