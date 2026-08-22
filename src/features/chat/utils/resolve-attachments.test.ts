import { describe, expect, it, vi } from 'vitest';
import type { MessageNode } from '@/stores/models';
import { resolveAttachments } from './resolve-attachments';

function userWithAttachment(fileId?: string): MessageNode {
  return {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
    parentId: 'root',
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '看图',
    attachments: [
      {
        id: 'att1',
        mime: 'image/png',
        width: 1,
        height: 1,
        byteLength: 8,
        blobKey: 'blob1',
        fileId,
      },
    ],
    status: 'done',
    createdAt: 1,
  };
}

describe('resolveAttachments', () => {
  it('已有 fileId 时不再上传', async () => {
    const upload = vi.fn();
    const getBlob = vi.fn();
    const resolved = await resolveAttachments(
      [userWithAttachment('file-api-1')],
      'key',
      {
        getBlob,
        upload,
      },
    );
    expect(upload).not.toHaveBeenCalled();
    expect(getBlob).not.toHaveBeenCalled();
    expect(resolved.get('att1')).toEqual({
      kind: 'file',
      fileId: 'file-api-1',
    });
  });

  it('上传成功则写回 fileId', async () => {
    const node = userWithAttachment();
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const upload = vi.fn().mockResolvedValue('file-api-new');
    const onUploaded = vi.fn();
    const resolved = await resolveAttachments([node], 'key', {
      getBlob: async () => blob,
      upload,
      onUploaded,
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(onUploaded).toHaveBeenCalledWith(
      'u1',
      node.attachments![0],
      'file-api-new',
    );
    expect(resolved.get('att1')).toEqual({
      kind: 'file',
      fileId: 'file-api-new',
    });
  });

  it('上传失败则当轮降级 data URL 且不写 fileId', async () => {
    const node = userWithAttachment();
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    );
    const blob = new Blob([png], { type: 'image/png' });
    const upload = vi.fn().mockRejectedValue(new Error('network'));
    const resolved = await resolveAttachments([node], 'key', {
      getBlob: async () => blob,
      upload,
    });
    expect(node.attachments![0].fileId).toBeUndefined();
    const inline = resolved.get('att1');
    expect(inline?.kind).toBe('inline');
    if (inline?.kind === 'inline') {
      expect(inline.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    }
  });
});
