/**
 * 本地图片校验与编码。格式按文件魔数判断，不信任文件名或声明 MIME。
 * 限制对齐 DeepSeek Vision / Files API。
 */

import type { ImageMime } from '@/stores/models';

export const MAX_IMAGE_BYTES_INLINE = 32 * 1024 * 1024;
export const MAX_IMAGE_BYTES_FILES = 64 * 1024 * 1024;
export const MAX_REQUEST_BODY_BYTES = 48 * 1024 * 1024;
export const MAX_INLINE_IMAGES_TOTAL_BYTES = 64 * 1024 * 1024;
export const MAX_IMAGE_SIDE_PX = 8192;
export const MAX_IMAGE_SIDE_PX_MANY = 4096;
export const MANY_IMAGES_THRESHOLD = 15;
export const MAX_IMAGES_PER_MESSAGE = 16;
export const MAX_IMAGES_PER_REQUEST = 600;

export type ImageValidationCode =
  | 'format'
  | 'too-large'
  | 'too-big-dimension'
  | 'too-many';

export interface ImageMeta {
  mime: ImageMime;
  width: number;
  height: number;
  byteLength: number;
}

export type ImageValidationResult =
  | { ok: true; meta: ImageMeta }
  | { ok: false; code: ImageValidationCode };

export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

function gifSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  return { width: readU16LE(bytes, 6), height: readU16LE(bytes, 8) };
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk === 'VP8X') {
    return {
      width: readU24LE(bytes, 24) + 1,
      height: readU24LE(bytes, 27) + 1,
    };
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    return {
      width: bytes[26] | (bytes[27] << 8),
      height: bytes[28] | (bytes[29] << 8),
    };
  }
  return null;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (i + 8 >= bytes.length) return null;
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

export async function readImageMeta(blob: Blob): Promise<ImageMeta | null> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const mime = sniffImageMime(bytes);
  if (!mime) return null;
  let size: { width: number; height: number } | null = null;
  if (mime === 'image/png') size = pngSize(bytes);
  else if (mime === 'image/gif') size = gifSize(bytes);
  else if (mime === 'image/webp') size = webpSize(bytes);
  else size = jpegSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return null;
  return {
    mime,
    width: size.width,
    height: size.height,
    byteLength: blob.size,
  };
}

export async function validateImageFile(
  blob: Blob,
  opts?: { maxSide?: number; maxBytes?: number },
): Promise<ImageValidationResult> {
  const maxBytes = opts?.maxBytes ?? MAX_IMAGE_BYTES_FILES;
  if (blob.size > maxBytes) {
    return { ok: false, code: 'too-large' };
  }
  const meta = await readImageMeta(blob);
  if (!meta) return { ok: false, code: 'format' };
  const maxSide = opts?.maxSide ?? MAX_IMAGE_SIDE_PX;
  if (meta.width > maxSide || meta.height > maxSide) {
    return { ok: false, code: 'too-big-dimension' };
  }
  return { ok: true, meta };
}

export function estimateDataUrlBytes(
  byteLength: number,
  mime: ImageMime,
): number {
  const prefix = `data:${mime};base64,`.length;
  return prefix + Math.ceil((byteLength * 4) / 3);
}

export function blobToDataUrl(blob: Blob, mime: ImageMime): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode image'));
        return;
      }
      const comma = result.indexOf(',');
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve(`data:${mime};base64,${data}`);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to encode image'));
    reader.readAsDataURL(blob);
  });
}

export interface PendingImage {
  id: string;
  blob: Blob;
  mime: ImageMime;
  width: number;
  height: number;
  filename: string;
  previewUrl: string;
}

export function isVisionModel(model: string): boolean {
  return model !== 'deepseek-v4-pro';
}
