/**
 * Client-Side Media Compressor.
 * Scales down large mobile camera photos (e.g. 5-15MB) into lightweight WebP/JPEG images (~150-300KB)
 * using HTML5 Canvas before uploading to the server.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  format?: "image/webp" | "image/jpeg";
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const { maxDimension = 1920, quality = 0.82, format = "image/webp" } = options;

  // Skip non-image files or already small images (< 150KB)
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 150 * 1024) {
    return file;
  }

  // Ensure window & HTMLCanvasElement exist
  if (typeof window === "undefined" || !window.createImageBitmap) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Calculate scaled dimensions while preserving aspect ratio
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: format === "image/webp" });

    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });

    if (!blob) {
      return file;
    }

    // Determine extension
    const ext = format === "image/webp" ? ".webp" : ".jpg";
    const cleanName = file.name.replace(/\.[^/.]+$/, "") + ext;

    return new File([blob], cleanName, {
      type: format,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("[MediaCompressor] Canvas compression failed, falling back to original file:", err);
    return file;
  }
}
