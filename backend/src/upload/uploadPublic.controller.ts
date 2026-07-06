import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "fs";
import * as path from "path";
import { UploadService } from "./upload.service";

@swagger.ApiTags("uploads")
@Controller("public/uploads")
export class UploadPublicController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("driver-selfie")
  @swagger.ApiConsumes("multipart/form-data")
  @swagger.ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Selfie photo (jpeg, png, or webp, max 5MB)",
        },
      },
      required: ["file"],
    },
  })
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        url: { type: "string" },
        filename: { type: "string" },
        mimeType: { type: "string" },
        size: { type: "number" },
      },
    },
  })
  @swagger.ApiBadRequestResponse({ description: "Invalid file" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Use env var or default path
          const root =
            process.env.DRIVERS_MEDIA_ROOT ?? "/srv/cdn/101-drivers";
          const dir = path.join(root, "driver-selfie");
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
          const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
            ? ext
            : ".jpg";
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `selfie-${unique}${safeExt}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              "Only jpeg, png, and webp images are allowed"
            ),
            false
          );
        }
      },
    })
  )
  async uploadDriverSelfie(
    @UploadedFile() file: Express.Multer.File
  ): Promise<{
    ok: boolean;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const url = this.uploadService.buildDriverSelfiePublicUrl(file.filename);

    return {
      ok: true,
      url,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
