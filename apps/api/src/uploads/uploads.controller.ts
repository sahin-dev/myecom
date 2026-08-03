import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AdminGuard, JwtAuthGuard } from "../auth/auth.guards";
import { RequirePermission } from "../auth/permissions";

type UploadedMedia = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const proofExtensions: Record<string, string> = {
  ...imageExtensions,
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

@Controller()
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post("admin/uploads")
  @UseGuards(AdminGuard)
  @RequirePermission("uploads.write")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(
          imageExtensions[file.mimetype] ? null : new BadRequestException("Use JPG, PNG, or WebP."),
          Boolean(imageExtensions[file.mimetype])
        );
      }
    })
  )
  async upload(@UploadedFile() file?: UploadedMedia) {
    if (!file) throw new BadRequestException("Choose an image to upload.");

    return this.saveUpload(file, imageExtensions[file.mimetype]);
  }

  @Post("account/return-proofs")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(
          proofExtensions[file.mimetype] ? null : new BadRequestException("Use JPG, PNG, WebP, MP4, MOV, or WebM."),
          Boolean(proofExtensions[file.mimetype])
        );
      }
    })
  )
  async uploadReturnProof(@UploadedFile() file?: UploadedMedia) {
    if (!file) throw new BadRequestException("Choose a proof image or video to upload.");

    return this.saveUpload(file, proofExtensions[file.mimetype]);
  }

  @Delete("admin/uploads/:filename")
  @UseGuards(AdminGuard)
  @RequirePermission("uploads.write")
  async remove(@Param("filename") filename: string) {
    if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4|mov|webm)$/i.test(filename)) {
      throw new BadRequestException("Invalid upload filename.");
    }
    const uploadDir = resolve(
      process.cwd(),
      this.config.get<string>("UPLOAD_DIR") ?? "uploads"
    );
    await unlink(resolve(uploadDir, filename)).catch(() => undefined);
    return { deleted: true };
  }

  private async saveUpload(file: UploadedMedia, extension: string) {
    const filename = `${randomUUID()}.${extension}`;
    const uploadDir = resolve(
      process.cwd(),
      this.config.get<string>("UPLOAD_DIR") ?? "uploads"
    );
    await mkdir(uploadDir, { recursive: true });
    await writeFile(resolve(uploadDir, filename), file.buffer);

    const apiUrl = this.config.get<string>("API_PUBLIC_URL") ?? "http://localhost:4000";
    return {
      filename,
      url: `${apiUrl}/uploads/${filename}`
    };
  }
}
