import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_BYTES_FILES,
  MAX_IMAGE_BYTES_INLINE,
  MAX_IMAGE_SIDE_PX,
  blobToDataUrl,
  estimateDataUrlBytes,
  readImageMeta,
  sniffImageMime,
  validateImageFile,
  isVisionModel,
} from './image-attachments';

/** 1×1 PNG */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

/** 1×1 JPEG */
const JPEG_1X1 = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//Z',
  ),
  (c) => c.charCodeAt(0),
);

function blobFrom(bytes: Uint8Array, type = 'application/octet-stream') {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type });
}

describe('sniffImageMime', () => {
  it('识别 PNG / JPEG，忽略声明的 MIME', () => {
    expect(sniffImageMime(PNG_1X1)).toBe('image/png');
    expect(sniffImageMime(JPEG_1X1)).toBe('image/jpeg');
  });

  it('拒绝未知格式', () => {
    expect(sniffImageMime(new Uint8Array([0, 1, 2, 3, 4, 5]))).toBeNull();
  });
});

describe('readImageMeta', () => {
  it('读取 PNG 宽高', async () => {
    const meta = await readImageMeta(blobFrom(PNG_1X1, 'image/png'));
    expect(meta).toEqual({
      mime: 'image/png',
      width: 1,
      height: 1,
      byteLength: PNG_1X1.byteLength,
    });
  });
});

describe('validateImageFile', () => {
  it('接受合法小图', async () => {
    const result = await validateImageFile(blobFrom(PNG_1X1, 'image/gif'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meta.mime).toBe('image/png');
      expect(result.meta.width).toBe(1);
    }
  });

  it('拒绝非图片', async () => {
    const result = await validateImageFile(blobFrom(new Uint8Array([1, 2, 3])));
    expect(result).toEqual({ ok: false, code: 'format' });
  });

  it('拒绝超过 Files API 上限的体积', async () => {
    const huge = new Blob([PNG_1X1, new Uint8Array(MAX_IMAGE_BYTES_FILES)]);
    Object.defineProperty(huge, 'size', { value: MAX_IMAGE_BYTES_FILES + 1 });
    const result = await validateImageFile(huge);
    expect(result).toEqual({ ok: false, code: 'too-large' });
  });

  it('拒绝超长边', async () => {
    const result = await validateImageFile(blobFrom(PNG_1X1), {
      maxSide: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('too-big-dimension');
  });
});

describe('blobToDataUrl / estimateDataUrlBytes', () => {
  it('产出 data:image/png;base64 URL', async () => {
    const url = await blobToDataUrl(
      blobFrom(PNG_1X1, 'image/png'),
      'image/png',
    );
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(
      estimateDataUrlBytes(PNG_1X1.byteLength, 'image/png'),
    ).toBeGreaterThan(PNG_1X1.byteLength);
    expect(estimateDataUrlBytes(PNG_1X1.byteLength, 'image/png')).toBeLessThan(
      MAX_IMAGE_BYTES_INLINE,
    );
  });
});

describe('limits', () => {
  it('内联上限小于 Files 上限', () => {
    expect(MAX_IMAGE_BYTES_INLINE).toBe(32 * 1024 * 1024);
    expect(MAX_IMAGE_BYTES_FILES).toBe(64 * 1024 * 1024);
    expect(MAX_IMAGE_SIDE_PX).toBe(8192);
  });
});

describe('isVisionModel', () => {
  it('Flash vision 支持图像，Pro 不支持', () => {
    expect(isVisionModel('deepseek-v4-flash-vision-exp')).toBe(true);
    expect(isVisionModel('deepseek-v4-pro')).toBe(false);
  });
});
