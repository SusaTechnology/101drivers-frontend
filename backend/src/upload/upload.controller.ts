import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { Request } from "express";
import * as fs from "fs";
import * as path from "path";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { UploadService } from "./upload.service";
import {
  UploadDeliveryEvidenceBody,
  UploadDeliveryEvidenceResponseDto,
} from "./dto/uploadDeliveryEvidence.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  UploadDriverProfilePhotoBody,
  UploadDriverProfilePhotoResponseDto,
} from "./dto/uploadDriverProfilePhoto.dto";
import { UploadAppSettingFileBody, UploadAppSettingFileResponseDto } from "./dto/uploadAppSettingFile.dto";
@swagger.ApiTags("uploads")
@swagger.ApiBearerAuth()
@UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
@Controller("uploads")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @Post("driver-profile-photo")
  @swagger.ApiConsumes("multipart/form-data")
  @swagger.ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        driverId: {
          type: "string",
        },
      },
      required: ["file", "driverId"],
    },
  })
  @swagger.ApiOkResponse({
    type: UploadDriverProfilePhotoResponseDto,
  })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) => {
          try {
            const tmpDir = "/srv/cdn/101-drivers/tmp";
            fs.mkdirSync(tmpDir, { recursive: true });
            cb(null, tmpDir);
          } catch (error) {
            cb(error as Error, "");
          }
        },
        filename: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void
        ) => {
          try {
            const ext =
              path.extname(file.originalname || "").toLowerCase() || ".jpg";

            const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
              ? ext
              : ".jpg";

            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `tmp-profile-${unique}${safeExt}`);
          } catch (error) {
            cb(error as Error, "");
          }
        },
      }),
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void
      ) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              "Only jpeg, png, and webp images are allowed"
            ),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    })
  )
  async uploadDriverProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDriverProfilePhotoBody
  ): Promise<UploadDriverProfilePhotoResponseDto> {
    if (!file) {
      throw new BadRequestException("file is required");
    }

    const driverId = `${body.driverId ?? ""}`.trim();
    if (!driverId) {
      throw new BadRequestException("driverId is required");
    }

    this.uploadService.validateMimeType(file.mimetype);

    const finalDir = this.uploadService.getDriverProfilePhotoDiskRoot(driverId);
    this.uploadService.ensureDirectory(finalDir);

    const finalFilename = this.uploadService.buildDriverProfilePhotoFilename(
      file.originalname
    );

    const finalAbsolutePath = path.join(finalDir, finalFilename);

    fs.renameSync(file.path, finalAbsolutePath);

    const url = this.uploadService.buildDriverProfilePhotoPublicUrl({
      driverId,
      filename: finalFilename,
    });

    return {
      ok: true,
      url,
      filename: finalFilename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  @Post("delivery-evidence")
  @swagger.ApiConsumes("multipart/form-data")
  @swagger.ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
        },
        deliveryId: {
          type: "string",
        },
        phase: {
          type: "string",
          enum: ["PICKUP", "DROPOFF"],
          nullable: true,
        },
      },
      required: ["files", "deliveryId"],
    },
  })
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              slotIndex: { type: "number" },
              url: { type: "string" },
              filename: { type: "string" },
              mimeType: { type: "string" },
              size: { type: "number" },
            },
          },
        },
      },
    },
  })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @UseInterceptors(
    FilesInterceptor("files", 6, {
      storage: diskStorage({
        destination: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) => {
          try {
            const tmpDir = "/srv/cdn/101-drivers/tmp";
            fs.mkdirSync(tmpDir, { recursive: true });
            cb(null, tmpDir);
          } catch (error) {
            cb(error as Error, "");
          }
        },
        filename: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void
        ) => {
          try {
            const ext =
              path.extname(file.originalname || "").toLowerCase() || ".jpg";

            const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
              ? ext
              : ".jpg";

            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `tmp-${unique}${safeExt}`);
          } catch (error) {
            cb(error as Error, "");
          }
        },
      }),
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void
      ) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              "Only jpeg, png, and webp images are allowed"
            ),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    })
  )
  async uploadDeliveryEvidence(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadDeliveryEvidenceBody
  ): Promise<{
    ok: boolean;
    files: UploadDeliveryEvidenceResponseDto[];
  }> {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one file is required");
    }

    const deliveryId = this.uploadService.validateDeliveryId(body.deliveryId);
    const phase = this.uploadService.validatePhase(body.phase ?? null);

    const finalDir = this.uploadService.getDeliveryEvidenceDiskRoot(deliveryId);
    this.uploadService.ensureDirectory(finalDir);

    const uploaded = files.map((file, index) => {
      this.uploadService.validateMimeType(file.mimetype);

      const slotIndex = index + 1;

      const finalFilename = this.uploadService.buildDeliveryEvidenceFilename({
        phase,
        slotIndex,
        originalName: file.originalname,
      });

      const finalAbsolutePath = path.join(finalDir, finalFilename);

      fs.renameSync(file.path, finalAbsolutePath);

      const url = this.uploadService.buildDeliveryEvidencePublicUrl({
        deliveryId,
        filename: finalFilename,
      });

      return {
        ok: true,
        slotIndex,
        url,
        filename: finalFilename,
        mimeType: file.mimetype,
        size: file.size,
      };
    });

    return {
      ok: true,
      files: uploaded,
    };
  }

@Post("app-setting-file")
@swagger.ApiConsumes("multipart/form-data")
@swagger.ApiBody({
  schema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        format: "binary",
      },
      scope: {
        type: "string",
        enum: ["investor-deck", "landing-page"],
      },
      kind: {
        type: "string",
        enum: ["PDF", "IMAGE"],
      },
      filenameHint: {
        type: "string",
      },
    },
    required: ["file", "scope", "kind"],
  },
})
@swagger.ApiOkResponse({
  type: UploadAppSettingFileResponseDto,
})
@nestAccessControl.UseRoles({
  resource: "AppSetting",
  action: "update",
  possession: "any",
})
@UseInterceptors(
  FileInterceptor("file", {
    storage: diskStorage({
      destination: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void
      ) => {
        try {
          const tmpDir = "/srv/cdn/101-drivers/tmp";
          fs.mkdirSync(tmpDir, { recursive: true });
          cb(null, tmpDir);
        } catch (error) {
          cb(error as Error, "");
        }
      },
      filename: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void
      ) => {
        try {
          const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `tmp-app-setting-${unique}${ext}`);
        } catch (error) {
          cb(error as Error, "");
        }
      },
    }),
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
  })
)
async uploadAppSettingFile(
  @UploadedFile() file: Express.Multer.File,
  @Body() body: UploadAppSettingFileBody
): Promise<UploadAppSettingFileResponseDto> {
  if (!file) {
    throw new BadRequestException("file is required");
  }

  this.uploadService.validateAppSettingFileMimeType({
    mimeType: file.mimetype,
    kind: body.kind,
  });

  const finalDir = this.uploadService.getAppSettingDiskRoot(body.scope);
  this.uploadService.ensureDirectory(finalDir);

  const finalFilename = this.uploadService.buildAppSettingFilename({
    kind: body.kind,
    originalName: file.originalname,
    filenameHint: body.filenameHint,
  });

  const finalAbsolutePath = path.join(finalDir, finalFilename);
  fs.renameSync(file.path, finalAbsolutePath);

  const url = this.uploadService.buildAppSettingPublicUrl({
    scope: body.scope,
    filename: finalFilename,
  });

  return {
    ok: true,
    url,
    filename: finalFilename,
    mimeType: file.mimetype,
    size: file.size,
  };
}
}