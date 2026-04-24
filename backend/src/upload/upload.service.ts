import { Injectable, BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class UploadService {
  /**
   * Saves uploaded files to the local filesystem and returns metadata.
   *
   * Storage layout:
   *   <UPLOAD_DIR>/delivery-evidence/<deliveryId>/<uuid>.<ext>
   *
   * Returns an array of { slotIndex, url } for the caller to store as evidence.
   */
  async saveDeliveryEvidenceFiles(
    files: Express.Multer.File[],
    deliveryId: string,
    photoType: string,
  ): Promise<{ slotIndex: number; url: string }[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }

    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const subDir = path.join(uploadDir, "delivery-evidence", deliveryId);

    // Ensure directory exists
    fs.mkdirSync(subDir, { recursive: true });

    const results: { slotIndex: number; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.originalname) || ".jpg";
      const filename = `${uuidv4()}${ext}`;
      const filepath = path.join(subDir, filename);

      // Write file to disk
      fs.writeFileSync(filepath, file.buffer);

      // Build the URL path that will be stored in the database
      // This is a relative path that the frontend can use to reference the image
      const url = `/uploads/delivery-evidence/${deliveryId}/${filename}`;

      // Slot index is 1-based and sequential for car-photos
      // For single-file uploads (odometer, vin), slotIndex is 1
      const slotIndex = photoType === "car-photos" ? i + 1 : 1;

      results.push({ slotIndex, url });
    }

    return results;
  }

  /**
   * Validates file type is an image and size is within limits.
   */
  validateImageFile(file: Express.Multer.File): void {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, HEIC are allowed.`,
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`,
      );
    }
  }
}
