import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UploadController } from "./upload.controller";
import { UploadPublicController } from "./uploadPublic.controller";
import { UploadService } from "./upload.service";

@Module({
  imports: [ConfigModule],
  controllers: [UploadController, UploadPublicController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
