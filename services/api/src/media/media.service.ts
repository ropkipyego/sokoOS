import { Injectable, BadRequestException } from "@nestjs/common";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2_000_000;

@Injectable()
export class MediaService {
  readonly root = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), "uploads"));

  abs(relative: string) {
    return path.join(this.root, relative);
  }

  url(relative: string) {
    return `/v1/media/${relative.replaceAll("\\", "/")}`;
  }

  async saveProductImage(
    tenantId: string,
    productId: string,
    file: { mimetype: string; size: number; buffer: Buffer; originalname: string },
  ) {
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Image must be JPEG, PNG, or WebP",
      });
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Image must be 2MB or smaller",
      });
    }

    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const dir = path.join(tenantId, "products");
    await mkdir(this.abs(dir), { recursive: true });
    const stem = `${productId}-${randomUUID().slice(0, 8)}`;
    const filename = `${stem}.${ext}`;
    const thumbName = `${stem}.thumb.${ext}`;
    const relative = path.join(dir, filename);
    const thumbRelative = path.join(dir, thumbName);
    await writeFile(this.abs(relative), file.buffer);
    // Thumbnail = validated copy for now (same bytes). Real resize (sharp) can replace this without schema change.
    await writeFile(this.abs(thumbRelative), file.buffer);
    return {
      imageUrl: this.url(relative),
      thumbnailUrl: this.url(thumbRelative),
      relative,
    };
  }

  async removeFile(publicUrl?: string | null) {
    if (!publicUrl) return;
    const marker = "/v1/media/";
    const idx = publicUrl.indexOf(marker);
    if (idx < 0) return;
    const relative = publicUrl.slice(idx + marker.length);
    const full = this.abs(relative);
    if (existsSync(full) && full.startsWith(this.root)) {
      await unlink(full).catch(() => undefined);
    }
  }
}
