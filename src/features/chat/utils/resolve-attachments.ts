import type { ImageAttachment, MessageNode } from '@/stores/models';
import {
  MAX_IMAGE_BYTES_INLINE,
  MAX_INLINE_IMAGES_TOTAL_BYTES,
  MAX_REQUEST_BODY_BYTES,
  blobToDataUrl,
  estimateDataUrlBytes,
} from '@/features/chat/utils/image-attachments';
import { uploadImageFile } from '@/features/chat/utils/files-api';
import type { ResolvedAttachment } from '@/stores/utils/api-messages';

export class VisionPrepareError extends Error {
  readonly code: 'too-large' | 'encode-failed';

  constructor(code: 'too-large' | 'encode-failed', message: string) {
    super(message);
    this.name = 'VisionPrepareError';
    this.code = code;
  }
}

export interface ResolveAttachmentsDeps {
  getBlob: (blobKey: string) => Promise<Blob | undefined>;
  onUploaded?: (
    messageId: string,
    attachment: ImageAttachment,
    fileId: string,
  ) => void | Promise<void>;
  upload?: typeof uploadImageFile;
}

/**
 * 对路径上尚无 fileId 的附件先尝试 Files API 上传并写回；
 * 失败或当轮体积超限则仅该轮降级为 data URL。
 */
export async function resolveAttachments(
  nodes: MessageNode[],
  apiKey: string,
  deps: ResolveAttachmentsDeps,
  signal?: AbortSignal,
): Promise<Map<string, ResolvedAttachment>> {
  const resolved = new Map<string, ResolvedAttachment>();
  let inlineBytes = 0;
  const upload = deps.upload ?? uploadImageFile;

  for (const node of nodes) {
    const attachments = node.attachments;
    if (!attachments?.length) continue;

    for (const attachment of attachments) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (attachment.fileId) {
        resolved.set(attachment.id, {
          kind: 'file',
          fileId: attachment.fileId,
        });
        continue;
      }

      const blob = await deps.getBlob(attachment.blobKey);
      if (!blob) {
        throw new VisionPrepareError('encode-failed', attachment.id);
      }

      try {
        const fileId = await upload(
          apiKey,
          blob,
          attachment.filename ?? 'image',
          signal,
        );
        await deps.onUploaded?.(node.id, attachment, fileId);
        resolved.set(attachment.id, { kind: 'file', fileId });
        continue;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }
      }

      if (attachment.byteLength > MAX_IMAGE_BYTES_INLINE) {
        throw new VisionPrepareError('too-large', attachment.id);
      }
      const dataUrlBytes = estimateDataUrlBytes(
        attachment.byteLength,
        attachment.mime,
      );
      if (
        inlineBytes + dataUrlBytes > MAX_INLINE_IMAGES_TOTAL_BYTES ||
        inlineBytes + dataUrlBytes > MAX_REQUEST_BODY_BYTES
      ) {
        throw new VisionPrepareError('too-large', attachment.id);
      }

      try {
        const dataUrl = await blobToDataUrl(blob, attachment.mime);
        inlineBytes += dataUrlBytes;
        resolved.set(attachment.id, { kind: 'inline', dataUrl });
      } catch {
        throw new VisionPrepareError('encode-failed', attachment.id);
      }
    }
  }

  return resolved;
}
