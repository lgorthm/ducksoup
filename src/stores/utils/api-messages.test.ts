import { describe, expect, it } from 'vitest';
import type { MessageNode } from '@/stores/models';
import { buildApiMessages } from './api-messages';
import { appendChild, createRoot, rebuildActivePath } from './tree';

function treeWithFailedAssistant(opts?: {
  assistantStatus?: MessageNode['status'];
  assistantContent?: string;
  followUpUser?: boolean;
}) {
  const map = new Map<string, MessageNode>();
  const root = createRoot('c1', 'root');
  map.set(root.id, root);
  appendChild(map, 'root', {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
    content: 'hello',
    createdAt: 1,
  });
  appendChild(map, 'u1', {
    id: 'a1',
    conversationId: 'c1',
    role: 'assistant',
    content: opts?.assistantContent ?? '',
    createdAt: 2,
    status: opts?.assistantStatus ?? 'error',
  });
  if (opts?.followUpUser) {
    appendChild(map, 'a1', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '再试一次',
      createdAt: 3,
    });
    appendChild(map, 'u2', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '',
      createdAt: 4,
      status: 'pending',
    });
  }
  return { map, path: rebuildActivePath(map, 'root') };
}

describe('buildApiMessages', () => {
  it('不含 system 根与 pending assistant', () => {
    const { map, path } = treeWithFailedAssistant({
      assistantStatus: 'done',
      assistantContent: '答',
      followUpUser: true,
    });

    const payload = buildApiMessages(map, path);

    expect(payload[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
    expect(
      payload.some((m) => m.role === 'assistant' && m.content === ''),
    ).toBe(false);
    expect(payload.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
  });

  it('路径上的空 error assistant 不发给模型', () => {
    const { map, path } = treeWithFailedAssistant({ followUpUser: true });

    const payload = buildApiMessages(map, path);

    expect(payload.some((m) => m.role === 'assistant')).toBe(false);
    expect(
      payload.filter((m) => m.role === 'user').map((m) => m.content),
    ).toEqual(['hello', '再试一次']);
  });

  it('有内容的 assistant 即使 status=error 仍保留', () => {
    const { map, path } = treeWithFailedAssistant({
      assistantStatus: 'error',
      assistantContent: '半句',
      followUpUser: true,
    });

    const payload = buildApiMessages(map, path);

    expect(payload).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '半句' },
      { role: 'user', content: '再试一次' },
    ]);
  });

  it('纯图 user 编成 input_image，优先 file_id', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '',
      createdAt: 1,
      attachments: [
        {
          id: 'att1',
          mime: 'image/png',
          width: 1,
          height: 1,
          byteLength: 10,
          blobKey: 'blob1',
        },
      ],
    });
    const path = rebuildActivePath(map, 'root');
    const payload = buildApiMessages(
      map,
      path,
      new Map([['att1', { kind: 'file', fileId: 'file-api-1' }]]),
    );
    expect(payload[1]).toEqual({
      role: 'user',
      content: [{ type: 'input_image', file_id: 'file-api-1' }],
    });
  });

  it('无 fileId 时用 data URL 内联', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '看图',
      createdAt: 1,
      attachments: [
        {
          id: 'att1',
          mime: 'image/png',
          width: 1,
          height: 1,
          byteLength: 10,
          blobKey: 'blob1',
        },
      ],
    });
    const path = rebuildActivePath(map, 'root');
    const payload = buildApiMessages(
      map,
      path,
      new Map([
        ['att1', { kind: 'inline', dataUrl: 'data:image/png;base64,xx' }],
      ]),
    );
    expect(payload[1]).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: '看图' },
        {
          type: 'input_image',
          image_url: 'data:image/png;base64,xx',
          detail: 'auto',
        },
      ],
    });
  });
});
