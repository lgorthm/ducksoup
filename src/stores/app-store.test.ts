import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Conversation, MessageNode } from '@/stores/models';
import {
  createInitialMessageState,
  initialConversationState,
  initialSettingsState,
} from '@/stores/models';
import { useStore } from '@/stores';
import {
  init,
  setApiKey,
  clearApiKey,
  toggleDeepThink,
  createConversation,
  startNewConversation,
  switchConversation,
  deleteConversation,
  sendMessage,
  cancelStream,
  clearMessages,
  editMessage,
  regenerateMessage,
  switchSibling,
  getBranchInfo,
  toggleActiveMessage,
} from '@/stores/actions';
import * as db from '@/features/chat/utils/db';
import { createChatStream } from '@/features/chat/utils/chat-stream';
import type {
  ChatStreamEvent,
  ChatStreamController,
} from '@/features/chat/utils/chat-stream';
import {
  appendChild,
  createRoot,
  pathNodes,
  rebuildActivePath,
} from '@/stores/utils/tree';

vi.mock('@/features/chat/utils/chat-stream', () => ({
  createChatStream: vi.fn(),
}));

vi.mock('@/features/chat/utils/files-api', () => ({
  uploadImageFile: vi.fn().mockResolvedValue('file-api-test'),
  deleteImageFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/chat/utils/resolve-attachments', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/chat/utils/resolve-attachments')
    >();
  return {
    ...actual,
    resolveAttachments: vi.fn(async (nodes: MessageNode[]) => {
      const resolved = new Map<string, { kind: 'file'; fileId: string }>();
      for (const node of nodes) {
        for (const a of node.attachments ?? []) {
          resolved.set(a.id, {
            kind: 'file',
            fileId: a.fileId ?? 'file-api-test',
          });
        }
      }
      return resolved;
    }),
  };
});

vi.mock('@/features/chat/utils/db', () => ({
  addConversation: vi.fn(),
  getAllConversations: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  addMessage: vi.fn(),
  getMessagesByConversation: vi.fn(),
  deleteMessage: vi.fn(),
  clearConversationMessages: vi.fn(),
  updateMessage: vi.fn(),
  putBlob: vi.fn(),
  getBlob: vi.fn(),
  deleteBlobs: vi.fn(),
  blobKeysOf: vi.fn(() => []),
  fileIdsOf: vi.fn(() => []),
  stripAllAttachmentFileIds: vi.fn(),
}));

let capturedOnEvent: (event: ChatStreamEvent) => void;
const mockAbort = vi.fn();
const mockController: ChatStreamController = {
  abort: mockAbort,
};

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  const id = overrides.id ?? `conv-${Math.random().toString(36).slice(2, 9)}`;
  return {
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
    ...overrides,
    id,
    rootId: overrides.rootId ?? `root-${id}`,
  };
}

function visible(state = useStore.getState()) {
  return pathNodes(state.messageNodes, state.activePath);
}

function seedEmptyConv(id = 'c1') {
  const root = createRoot(id, `root-${id}`);
  const conv = makeConversation({ id, rootId: root.id });
  useStore.setState({
    apiKey: 'test-key',
    hasApiKey: true,
    conversations: [conv],
    currentConversationId: id,
    messageNodes: new Map([[root.id, root]]),
    rootId: root.id,
    activeLeafId: null,
    activePath: [],
  });
  return { root, conv };
}

function seedQa(opts?: { userContent?: string; assistantContent?: string }) {
  const map = new Map<string, MessageNode>();
  const root = createRoot('c1', 'root');
  map.set(root.id, root);
  appendChild(map, 'root', {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
    content: opts?.userContent ?? '问题1',
    createdAt: 1,
  });
  appendChild(map, 'u1', {
    id: 'a1',
    conversationId: 'c1',
    role: 'assistant',
    content: opts?.assistantContent ?? '回答1',
    createdAt: 2,
  });
  const path = rebuildActivePath(map, 'root');
  useStore.setState({
    apiKey: 'test-key',
    hasApiKey: true,
    currentConversationId: 'c1',
    conversations: [
      makeConversation({ id: 'c1', rootId: 'root', activeLeafId: 'a1' }),
    ],
    messageNodes: map,
    rootId: 'root',
    activePath: path,
    activeLeafId: 'a1',
  });
  return map;
}

beforeEach(() => {
  useStore.setState({
    ...initialSettingsState,
    ...initialConversationState,
    ...createInitialMessageState(),
  });
  vi.clearAllMocks();

  vi.mocked(createChatStream).mockImplementation((options) => {
    capturedOnEvent = options.onEvent;
    return mockController;
  });
});

describe('init', () => {
  it('有会话时选中最后一个作为当前会话', async () => {
    const conv1 = makeConversation({ id: 'c1', updatedAt: 100 });
    const conv2 = makeConversation({ id: 'c2', updatedAt: 200 });
    vi.mocked(db.getAllConversations).mockResolvedValue([conv1, conv2]);
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    localStorage.setItem('deepseek-api-key', 'test-key');
    await init();

    const state = useStore.getState();
    expect(state.currentConversationId).toBe('c2');
    expect(state.conversations).toHaveLength(2);
    expect(state.initialized).toBe(true);
    expect(state.apiKey).toBe('test-key');
    expect(state.hasApiKey).toBe(true);
  });

  it('无会话时不自动创建，保持 null + 空树', async () => {
    vi.mocked(db.getAllConversations).mockResolvedValue([]);

    await init();

    expect(db.addConversation).not.toHaveBeenCalled();
    const state = useStore.getState();
    expect(state.currentConversationId).toBeNull();
    expect(state.conversations).toEqual([]);
    expect(state.activePath).toEqual([]);
  });

  it('DB 失败时仍设置 apiKey', async () => {
    vi.mocked(db.getAllConversations).mockRejectedValue(new Error('DB error'));
    localStorage.setItem('deepseek-api-key', 'fallback-key');

    await init();

    const state = useStore.getState();
    expect(state.apiKey).toBe('fallback-key');
    expect(state.hasApiKey).toBe(true);
    expect(state.initialized).toBe(true);
  });

  it('加载时将残留 pending 收口并写回 DB', async () => {
    const root = createRoot('c1', 'root-c1');
    root.activeChildId = 'u1';
    const u1: MessageNode = {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      parentId: 'root-c1',
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: 'a1',
      content: '问',
      status: 'done',
      createdAt: 1,
    };
    const a1: MessageNode = {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      parentId: 'u1',
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: null,
      content: '半句回复',
      status: 'pending',
      createdAt: 2,
    };
    vi.mocked(db.getAllConversations).mockResolvedValue([
      makeConversation({ id: 'c1', rootId: 'root-c1', activeLeafId: 'a1' }),
    ]);
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([root, u1, a1]);
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);

    await init();

    const loaded = useStore.getState().messageNodes.get('a1');
    expect(loaded?.status).not.toBe('pending');
    expect(['done', 'error']).toContain(loaded?.status);
    expect(useStore.getState().streamingMessageId).toBeNull();
    expect(db.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', status: loaded?.status }),
    );
  });
});

describe('setApiKey / clearApiKey', () => {
  it('setApiKey 持久化到 localStorage 并更新 state', () => {
    setApiKey('my-key');
    expect(localStorage.getItem('deepseek-api-key')).toBe('my-key');
    expect(useStore.getState().apiKey).toBe('my-key');
    expect(useStore.getState().hasApiKey).toBe(true);
  });

  it('clearApiKey 移除 localStorage 并清空 state', () => {
    localStorage.setItem('deepseek-api-key', 'old-key');
    setApiKey('temp');

    clearApiKey();
    expect(localStorage.getItem('deepseek-api-key')).toBeNull();
    expect(useStore.getState().apiKey).toBe('');
    expect(useStore.getState().hasApiKey).toBe(false);
  });
});

describe('toggleDeepThink', () => {
  it('切换 deepThink 状态', () => {
    expect(useStore.getState().deepThink).toBe(false);
    toggleDeepThink();
    expect(useStore.getState().deepThink).toBe(true);
    toggleDeepThink();
    expect(useStore.getState().deepThink).toBe(false);
  });
});

describe('createConversation', () => {
  it('写入 DB 并设为当前会话', async () => {
    vi.mocked(db.addConversation).mockResolvedValue(undefined);
    vi.mocked(db.addMessage).mockResolvedValue(undefined);

    await createConversation();

    expect(db.addConversation).toHaveBeenCalledOnce();
    expect(db.addMessage).toHaveBeenCalledOnce();
    const state = useStore.getState();
    expect(state.currentConversationId).toBeTruthy();
    expect(state.conversations).toHaveLength(1);
    expect(state.rootId).toBeTruthy();
    expect(state.activePath).toEqual([]);
    expect(state.streamingMessageId).toBeNull();
  });
});

describe('startNewConversation', () => {
  it('设 currentConversationId 为 null 且不写 DB', () => {
    seedEmptyConv('c1');
    useStore.setState({
      activePath: ['u1'],
    });

    startNewConversation();

    const state = useStore.getState();
    expect(state.currentConversationId).toBeNull();
    expect(state.activePath).toEqual([]);
    expect(state.streamingMessageId).toBeNull();
    expect(state.error).toBeNull();
    expect(db.addConversation).not.toHaveBeenCalled();
  });
});

describe('switchConversation', () => {
  it('从 DB 加载消息并清空 streamingMessageId', async () => {
    const root = createRoot('c2', 'root-c2');
    root.activeChildId = 'm1';
    const m1: MessageNode = {
      id: 'm1',
      conversationId: 'c2',
      role: 'user',
      parentId: 'root-c2',
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: null,
      content: '历史消息',
      status: 'done',
      createdAt: 1,
    };
    useStore.setState({
      conversations: [makeConversation({ id: 'c2', rootId: 'root-c2' })],
    });
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([root, m1]);

    await switchConversation('c2');

    expect(db.getMessagesByConversation).toHaveBeenCalledWith('c2');
    const state = useStore.getState();
    expect(state.currentConversationId).toBe('c2');
    expect(state.activePath).toEqual(['m1']);
    expect(state.messageNodes.get('m1')?.content).toBe('历史消息');
    expect(state.streamingMessageId).toBeNull();
    expect(state.error).toBeNull();
  });

  it('切换会话时清空激活消息', async () => {
    useStore.setState({ activeMessageId: 'm1' });
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    await switchConversation('c2');

    expect(useStore.getState().activeMessageId).toBeNull();
  });
});

describe('toggleActiveMessage', () => {
  it('激活指定消息，再次调用取消激活', () => {
    toggleActiveMessage('m1');
    expect(useStore.getState().activeMessageId).toBe('m1');

    toggleActiveMessage('m1');
    expect(useStore.getState().activeMessageId).toBeNull();
  });

  it('激活新消息时替换上一条激活消息', () => {
    toggleActiveMessage('m1');
    toggleActiveMessage('m2');
    expect(useStore.getState().activeMessageId).toBe('m2');
  });
});

describe('deleteConversation', () => {
  it('删除当前会话时调用 startNewConversation（即使还有其他会话）', async () => {
    const c1 = makeConversation({ id: 'c1', updatedAt: 100 });
    const c2 = makeConversation({ id: 'c2', updatedAt: 200 });
    useStore.setState({
      conversations: [c1, c2],
      currentConversationId: 'c2',
      activePath: ['m1'],
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    await deleteConversation('c2');

    const state = useStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.currentConversationId).toBeNull();
    expect(state.activePath).toEqual([]);
    expect(state.streamingMessageId).toBeNull();
    expect(db.getMessagesByConversation).toHaveBeenCalledWith('c2');
    expect(db.addConversation).not.toHaveBeenCalled();
  });

  it('删除唯一的当前会话时不自动创建新会话', async () => {
    const c1 = makeConversation({ id: 'c1' });
    useStore.setState({
      conversations: [c1],
      currentConversationId: 'c1',
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);

    await deleteConversation('c1');

    const state = useStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.currentConversationId).toBeNull();
    expect(state.activePath).toEqual([]);
    expect(db.addConversation).not.toHaveBeenCalled();
  });

  it('删除非当前会话时只更新列表', async () => {
    const c1 = makeConversation({ id: 'c1' });
    const c2 = makeConversation({ id: 'c2' });
    useStore.setState({
      conversations: [c1, c2],
      currentConversationId: 'c1',
      activePath: ['m1'],
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    await deleteConversation('c2');

    const state = useStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.currentConversationId).toBe('c1');
    expect(state.activePath).toHaveLength(1);
    expect(db.getMessagesByConversation).toHaveBeenCalledWith('c2');
  });
});

describe('sendMessage', () => {
  beforeEach(() => {
    seedEmptyConv('c1');
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
  });

  it('无 apiKey 时直接返回', async () => {
    useStore.setState({ apiKey: '', hasApiKey: false });
    await sendMessage('hello');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('无当前会话时惰性创建', async () => {
    useStore.setState({
      ...createInitialMessageState(),
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: null,
      conversations: [],
    });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    await sendMessage('第一条消息');

    expect(db.addConversation).toHaveBeenCalledOnce();
    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.title).toBe('第一条消息');
    expect(useStore.getState().currentConversationId).toBe(conv.id);
  });

  it('新会话持久化所选模型并传给流式请求', async () => {
    useStore.setState({
      ...createInitialMessageState(),
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: null,
      conversations: [],
    });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    await sendMessage('第一条消息', 'deepseek-v4-pro');

    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.model).toBe('deepseek-v4-pro');
    expect(createChatStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-v4-pro' }),
    );
  });

  it('未传模型时新会话使用默认模型', async () => {
    useStore.setState({
      ...createInitialMessageState(),
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: null,
      conversations: [],
    });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    await sendMessage('第一条消息');

    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.model).toBe('deepseek-v4-flash-vision-exp');
    expect(createChatStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-v4-flash-vision-exp' }),
    );
  });

  it('已有会话忽略传入模型，沿用会话自身的模型', async () => {
    const { root } = seedEmptyConv('c1');
    useStore.setState({
      conversations: [
        makeConversation({
          id: 'c1',
          rootId: root.id,
          model: 'deepseek-v4-pro',
        }),
      ],
    });

    await sendMessage('hello', 'deepseek-v4-flash-vision-exp');

    expect(createChatStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-v4-pro' }),
    );
  });

  it('长标题截断为 20 字符', async () => {
    useStore.setState({
      ...createInitialMessageState(),
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: null,
      conversations: [],
    });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    const longContent = '这是一段非常非常长的消息内容超过二十个字符';
    await sendMessage(longContent);

    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.title).toBe(`${longContent.slice(0, 20)}...`);
  });

  it('发送后设置 isLoading 和 pending assistant', async () => {
    await sendMessage('hello');

    const state = useStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.streamingMessageId).not.toBeNull();
    const msgs = visible(state);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].status).toBe('pending');
    expect(msgs[1].content).toBe('');
  });

  it('thinking 事件累积到 reasoningContent', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'thinking', text: '思考中' });

    const id = useStore.getState().streamingMessageId!;
    expect(useStore.getState().messageNodes.get(id)!.reasoningContent).toBe(
      '思考中',
    );
  });

  it('content 事件追加到 content', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'content', text: '你好' });
    capturedOnEvent({ type: 'content', text: '世界' });

    const id = useStore.getState().streamingMessageId!;
    expect(useStore.getState().messageNodes.get(id)!.content).toBe('你好世界');
  });

  it('done 事件持久化消息并更新会话', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'content', text: '回复内容' });
    capturedOnEvent({ type: 'done' });

    const state = useStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.isLoading).toBe(false);
    const msgs = visible(state);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('回复内容');
    expect(msgs[1].status).toBe('done');

    expect(db.addMessage).toHaveBeenCalled();
    expect(db.updateConversation).toHaveBeenCalledOnce();
    const updatedConv = vi.mocked(db.updateConversation).mock.calls[0][0];
    expect(updatedConv.messageCount).toBe(2);
  });

  it('done 事件拼接 reasoningContent', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'thinking', text: '第一步' });
    capturedOnEvent({ type: 'thinking', text: '第二步' });
    capturedOnEvent({ type: 'content', text: '结论' });
    capturedOnEvent({ type: 'done' });

    const assistantMsg = visible()[1];
    expect(assistantMsg.reasoningContent).toBe('第一步第二步');
  });

  it('error 事件设置 error 状态', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'error', error: new Error('API 错误') });

    const state = useStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.streamingMessageId).toBeNull();
    expect(state.error).toBe('API 错误');
  });

  it('失败后的下一条不把空 error assistant 发给模型', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'error', error: new Error('API 错误') });
    const failedId = useStore.getState().activeLeafId!;
    vi.mocked(createChatStream).mockClear();

    await sendMessage('再试一次');

    expect(useStore.getState().activePath).toContain(failedId);
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(
      payload.some((m) => m.role === 'assistant' && m.content === ''),
    ).toBe(false);
    expect(
      payload.filter((m) => m.role === 'user').map((m) => m.content),
    ).toEqual(['hello', '再试一次']);
  });

  it('纯图消息写入 attachments 并启动流', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    vi.mocked(db.putBlob).mockResolvedValue(undefined);
    vi.mocked(db.getBlob).mockResolvedValue(blob);

    await sendMessage('', undefined, [
      {
        id: 'p1',
        blob,
        mime: 'image/png',
        width: 1,
        height: 1,
        filename: 'a.png',
        previewUrl: 'blob:x',
      },
    ]);

    expect(db.putBlob).toHaveBeenCalled();
    const user = visible()[0];
    expect(user.role).toBe('user');
    expect(user.attachments).toHaveLength(1);
    expect(createChatStream).toHaveBeenCalledOnce();
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    const userMsg = payload.find((m) => m.role === 'user');
    expect(userMsg?.content).toEqual([
      { type: 'input_image', file_id: 'file-api-test' },
    ]);
  });

  it('Pro 会话拒绝带图发送', async () => {
    const { root } = seedEmptyConv('c1');
    useStore.setState({
      conversations: [
        makeConversation({
          id: 'c1',
          rootId: root.id,
          model: 'deepseek-v4-pro',
        }),
      ],
    });
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });

    await sendMessage('hello', undefined, [
      {
        id: 'p1',
        blob,
        mime: 'image/png',
        width: 1,
        height: 1,
        filename: 'a.png',
        previewUrl: 'blob:x',
      },
    ]);

    expect(createChatStream).not.toHaveBeenCalled();
    expect(visible()).toHaveLength(0);
  });
});

describe('cancelStream', () => {
  beforeEach(() => {
    seedEmptyConv('c1');
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
  });

  it('调用 controller.abort()', async () => {
    await sendMessage('hello');
    mockAbort.mockClear();

    cancelStream();
    expect(mockAbort).toHaveBeenCalledOnce();
  });

  it('无活跃流时安全调用', () => {
    cancelStream();
    expect(mockAbort).not.toHaveBeenCalled();
  });

  it('中止后将 pending assistant 标为 done，清空流式标记并写回 DB', async () => {
    await sendMessage('hello');
    capturedOnEvent({ type: 'content', text: '半句' });
    const id = useStore.getState().streamingMessageId!;
    vi.mocked(db.updateMessage).mockClear();

    cancelStream();

    const state = useStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.messageNodes.get(id)?.status).toBe('done');
    expect(state.messageNodes.get(id)?.content).toBe('半句');
    expect(db.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id, status: 'done', content: '半句' }),
    );
  });

  it('中止空回复也将 pending 收口，不再保持流式', async () => {
    await sendMessage('hello');
    const id = useStore.getState().streamingMessageId!;

    cancelStream();

    const node = useStore.getState().messageNodes.get(id);
    expect(node?.status).not.toBe('pending');
    expect(['done', 'error']).toContain(node?.status);
    expect(useStore.getState().streamingMessageId).toBeNull();
    expect(useStore.getState().isLoading).toBe(false);
  });

  it('取消空生成后的下一条不把空 assistant 发给模型', async () => {
    await sendMessage('hello');
    const failedId = useStore.getState().streamingMessageId!;
    cancelStream();
    vi.mocked(createChatStream).mockClear();

    await sendMessage('再试一次');

    expect(useStore.getState().activePath).toContain(failedId);
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(
      payload.some((m) => m.role === 'assistant' && m.content === ''),
    ).toBe(false);
    expect(
      payload.filter((m) => m.role === 'user').map((m) => m.content),
    ).toEqual(['hello', '再试一次']);
  });
});

describe('regenerateMessage', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
    seedQa();
  });

  it('为 assistant 创建同父兄弟分支并切到新分支', async () => {
    await regenerateMessage('a1');

    const state = useStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.streamingMessageId).not.toBeNull();
    const pending = state.messageNodes.get(state.streamingMessageId!);
    expect(pending?.role).toBe('assistant');
    expect(pending?.parentId).toBe('u1');
    expect(visible(state).map((m) => m.id)).toEqual(['u1', pending!.id]);
    expect(createChatStream).toHaveBeenCalledOnce();
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(payload).toHaveLength(2);
    expect(payload[1]).toMatchObject({ role: 'user', content: '问题1' });
  });

  it('流式 done 后持久化新 assistant 并更新父指针/会话', async () => {
    await regenerateMessage('a1');
    capturedOnEvent({ type: 'content', text: '新回答' });
    capturedOnEvent({ type: 'done' });

    const state = useStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(visible(state)).toHaveLength(2);
    expect(visible(state)[1].content).toBe('新回答');
    expect(db.updateMessage).toHaveBeenCalled();
    expect(db.updateConversation).toHaveBeenCalled();
    expect(state.conversations[0].activeLeafId).toBe(visible(state)[1].id);
    expect(state.messageNodes.get('u1')!.activeChildId).toBe(
      visible(state)[1].id,
    );
  });

  it('非 assistant 消息直接返回', async () => {
    await regenerateMessage('u1');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('流式中禁止重新生成', async () => {
    useStore.setState({ isLoading: true });
    await regenerateMessage('a1');
    expect(createChatStream).not.toHaveBeenCalled();
  });
});

describe('editMessage', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
    seedQa({ userContent: '原始问题', assistantContent: '回答' });
  });

  it('为 user 创建同父兄弟分支 + assistant 子节点', async () => {
    await editMessage('u1', '修改后的问题');

    const state = useStore.getState();
    expect(state.editingMessageId).toBeNull();
    expect(state.isLoading).toBe(true);
    const users = [...state.messageNodes.values()].filter(
      (n) => n.role === 'user',
    );
    expect(users).toHaveLength(2);
    const newUser = users.find((u) => u.content === '修改后的问题')!;
    expect(newUser.parentId).toBe('root');
    const newAssistant = state.messageNodes.get(newUser.activeChildId!);
    expect(newAssistant?.parentId).toBe(newUser.id);
    expect(visible(state).map((m) => m.id)).toEqual([
      newUser.id,
      newAssistant!.id,
    ]);
    expect(db.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: '修改后的问题' }),
    );
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(payload).toHaveLength(2);
    expect(payload[1]).toMatchObject({
      role: 'user',
      content: '修改后的问题',
    });
  });

  it('编辑第一条用户消息会更新 root.activeChildId', async () => {
    await editMessage('u1', '改问');
    const root = useStore.getState().messageNodes.get('root')!;
    const newUser = [...useStore.getState().messageNodes.values()].find(
      (n) => n.content === '改问',
    );
    expect(root.activeChildId).toBe(newUser!.id);
  });

  it('非 user 消息直接返回', async () => {
    await editMessage('a1', 'x');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('流式中禁止编辑', async () => {
    useStore.setState({ isLoading: true });
    await editMessage('u1', 'x');
    expect(createChatStream).not.toHaveBeenCalled();
  });
});

describe('switchSibling', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
  });

  it('切到上一版本：更新父 activeChildId 与 activeLeafId', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '答1',
      createdAt: 2,
    });
    appendChild(map, 'u1', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '答2',
      createdAt: 3,
    });
    useStore.setState({
      currentConversationId: 'c1',
      conversations: [
        makeConversation({ id: 'c1', rootId: 'root', activeLeafId: 'a2' }),
      ],
      messageNodes: map,
      rootId: 'root',
      activePath: rebuildActivePath(map, 'root'),
      activeLeafId: 'a2',
    });

    switchSibling('a2', -1);

    const state = useStore.getState();
    expect(visible(state).map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(state.conversations[0].activeLeafId).toBe('a1');
    expect(db.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', activeChildId: 'a1' }),
    );
    expect(db.updateConversation).toHaveBeenCalled();
  });

  it('切到下一版本', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '答1',
      createdAt: 2,
    });
    appendChild(map, 'u1', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '答2',
      createdAt: 3,
    });
    switchActiveOnA1(map);
    useStore.setState({
      currentConversationId: 'c1',
      conversations: [
        makeConversation({ id: 'c1', rootId: 'root', activeLeafId: 'a1' }),
      ],
      messageNodes: map,
      rootId: 'root',
      activePath: rebuildActivePath(map, 'root'),
      activeLeafId: 'a1',
    });

    switchSibling('a1', 1);

    const state = useStore.getState();
    expect(visible(state).map((m) => m.id)).toEqual(['u1', 'a2']);
    expect(state.conversations[0].activeLeafId).toBe('a2');
  });

  it('到达边界时为 no-op', () => {
    seedQa();
    switchSibling('a1', -1);
    expect(db.updateMessage).not.toHaveBeenCalled();
    expect(visible().map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('流式中禁止切换', () => {
    seedQa();
    useStore.setState({ isLoading: true });
    switchSibling('a1', -1);
    expect(db.updateMessage).not.toHaveBeenCalled();
  });
});

function switchActiveOnA1(map: Map<string, MessageNode>) {
  const u1 = map.get('u1');
  if (u1) u1.activeChildId = 'a1';
}

describe('getBranchInfo', () => {
  it('返回当前版本序号与总数', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '1',
      createdAt: 2,
    });
    appendChild(map, 'u1', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '2',
      createdAt: 3,
    });
    useStore.setState({
      messageNodes: map,
      rootId: 'root',
      conversations: [makeConversation({ id: 'c1', rootId: 'root' })],
    });

    const info = getBranchInfo('a2');
    expect(info.total).toBe(2);
    expect(info.current).toBe(2);
    expect(info.prevSiblingId).toBe('a1');
    expect(info.nextSiblingId).toBeNull();
  });

  it('无兄弟时返回 1/1', () => {
    seedQa();
    const info = getBranchInfo('u1');
    expect(info.total).toBe(1);
    expect(info.current).toBe(1);
  });
});

describe('clearMessages', () => {
  it('清空 DB 和内存消息，保留虚拟根', async () => {
    seedQa();
    useStore.setState({ streamingMessageId: 'a1' });
    vi.mocked(db.clearConversationMessages).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);

    await clearMessages();

    expect(db.clearConversationMessages).toHaveBeenCalledWith('c1');
    const state = useStore.getState();
    expect(state.activePath).toEqual([]);
    expect(state.streamingMessageId).toBeNull();
    expect(state.messageNodes.get('root')).toBeTruthy();
    expect(state.messageNodes.size).toBe(1);
  });

  it('无当前会话时不操作', async () => {
    useStore.setState({ currentConversationId: null });
    await clearMessages();
    expect(db.clearConversationMessages).not.toHaveBeenCalled();
  });
});
