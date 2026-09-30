/**
 * Universal Storage Service for Samparka.
 * Supports Supabase Storage with graceful fallback to local public uploads.
 * Replaces high-overhead Base64 database strings with fast CDN/public media URLs.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/wav",
  "application/octet-stream", // For client-encrypted E2EE media blobs
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "application/octet-stream": "bin",
};

/**
 * Uploads a file buffer to storage.
 * Automatically tries Supabase Storage bucket 'samparka-media' if configured,
 * or writes to public/uploads/ for zero-dependency local/standalone operation.
 */
export async function uploadFileToStorage(
  buffer: Buffer,
  contentType: string,
  category: "avatars" | "feed" | "chats" | "groups" = "feed",
  originalFilename?: string
): Promise<UploadResult> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum allowed size of 10MB (size: ${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  }

  const normalizedContentType = contentType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.has(normalizedContentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  // Derive file extension
  let ext = MIME_TO_EXTENSION[normalizedContentType] || "bin";
  if (originalFilename) {
    const origExt = path.extname(originalFilename).replace(".", "").toLowerCase();
    if (origExt && origExt.length <= 5) ext = origExt;
  }

  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const randomId = crypto.randomBytes(16).toString("hex");
  const key = `${category}/${year}/${month}/${randomId}.${ext}`;

  // Try Supabase Storage if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucketName = "samparka-media";

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(key, buffer, {
          contentType: normalizedContentType,
          upsert: true,
          cacheControl: "31536000",
        });

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);

        if (publicUrlData?.publicUrl) {
          return {
            url: publicUrlData.publicUrl,
            key: data.path,
            size: buffer.length,
            contentType: normalizedContentType,
          };
        }
      }
    } catch (err) {
      console.warn("[Storage] Supabase upload failed, falling back to local filesystem:", err);
    }
  }

  // Local filesystem fallback (stored in public/uploads/)
  const uploadDir = path.join(process.cwd(), "public", "uploads", category, String(year), month);
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, `${randomId}.${ext}`);
  await fs.writeFile(filePath, buffer);

  const publicUrl = `/uploads/${category}/${year}/${month}/${randomId}.${ext}`;

  return {
    url: publicUrl,
    key,
    size: buffer.length,
    contentType: normalizedContentType,
  };
}
