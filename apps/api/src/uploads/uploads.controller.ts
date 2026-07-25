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
import { AdminGuard } from "../auth/auth.guards";
import { RequirePermission } from "../auth/permissions";

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

@Controller("admin/uploads")
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post()
  @RequirePermission("uploads.write")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(
          extensions[file.mimetype] ? null : new BadRequestException("Use JPG, PNG, or WebP."),
          Boolean(extensions[file.mimetype])
        );
      }
    })
  )
  async upload(@UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException("Choose an image to upload.");

    const extension = extensions[file.mimetype];
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

  @Delete(":filename")
  @RequirePermission("uploads.write")
  async remove(@Param("filename") filename: string) {
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
      throw new BadRequestException("Invalid upload filename.");
    }
    const uploadDir = resolve(
      process.cwd(),
      this.config.get<string>("UPLOAD_DIR") ?? "uploads"
    );
    await unlink(resolve(uploadDir, filename)).catch(() => undefined);
    return { deleted: true };
  }
}
