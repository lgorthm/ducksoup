import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';
import { useChatStore } from './chat-store';
import * as db from '@/features/chat/utils/db';
import { createChatStream } from '@/features/chat/utils/chat-stream';
import type {
  ChatStreamEvent,
  ChatStreamController,
} from '@/features/chat/utils/chat-stream';

// ========== Mock 模块 ==========

vi.mock('@/features/chat/utils/chat-stream', () => ({
  createChatStream: vi.fn(),
}));

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
}));

// ========== 辅助 ==========

let capturedOnEvent: (event: ChatStreamEvent) => void;
const mockAbort = vi.fn();
const mockController: ChatStreamController = {
  abort: mockAbort,
  connection: { close: vi.fn(), readyState: 'open' as const },
};

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: `conv-${Math.random().toString(36).slice(2, 9)}`,
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: 'c1',
    role: 'user',
    content: '测试',
    createdAt: Date.now(),
    ...overrides,
  };
}

const initialState = {
  apiKey: '',
  hasApiKey: false,
  selectedModel: 'deepseek-v4-flash' as const,
  deepThink: false,
  conversations: [] as Conversation[],
  currentConversationId: null as string | null,
  messages: [] as StoredMessage[],
  streamingMessage: null,
  allMessages: [] as StoredMessage[],
  editingMessageId: null,
  activeMessageId: null,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  useChatStore.setState(initialState);
  vi.clearAllMocks();

  vi.mocked(createChatStream).mockImplementation((options) => {
    capturedOnEvent = options.onEvent;
    return mockController;
  });
});

// ========== init ==========

describe('init', () => {
  it('有会话时选中最后一个作为当前会话', async () => {
    const conv1 = makeConversation({ id: 'c1', updatedAt: 100 });
    const conv2 = makeConversation({ id: 'c2', updatedAt: 200 });
    vi.mocked(db.getAllConversations).mockResolvedValue([conv1, conv2]);
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    localStorage.setItem('deepseek-api-key', 'test-key');
    await useChatStore.getState().init();

    const state = useChatStore.getState();
    expect(state.currentConversationId).toBe('c2');
    expect(state.conversations).toHaveLength(2);
    expect(state.apiKey).toBe('test-key');
    expect(state.hasApiKey).toBe(true);
  });

  it('无会话时不自动创建，保持 null + 空数组', async () => {
    vi.mocked(db.getAllConversations).mockResolvedValue([]);

    await useChatStore.getState().init();

    expect(db.addConversation).not.toHaveBeenCalled();
    const state = useChatStore.getState();
    expect(state.currentConversationId).toBeNull();
    expect(state.conversations).toEqual([]);
    expect(state.messages).toEqual([]);
  });

  it('DB 失败时仍设置 apiKey', async () => {
    vi.mocked(db.getAllConversations).mockRejectedValue(new Error('DB error'));
    localStorage.setItem('deepseek-api-key', 'fallback-key');

    await useChatStore.getState().init();

    const state = useChatStore.getState();
    expect(state.apiKey).toBe('fallback-key');
    expect(state.hasApiKey).toBe(true);
  });
});

// ========== API Key ==========

describe('setApiKey / clearApiKey', () => {
  it('setApiKey 持久化到 localStorage 并更新 state', () => {
    useChatStore.getState().setApiKey('my-key');
    expect(localStorage.getItem('deepseek-api-key')).toBe('my-key');
    expect(useChatStore.getState().apiKey).toBe('my-key');
    expect(useChatStore.getState().hasApiKey).toBe(true);
  });

  it('clearApiKey 移除 localStorage 并清空 state', () => {
    localStorage.setItem('deepseek-api-key', 'old-key');
    useChatStore.getState().setApiKey('temp');

    useChatStore.getState().clearApiKey();
    expect(localStorage.getItem('deepseek-api-key')).toBeNull();
    expect(useChatStore.getState().apiKey).toBe('');
    expect(useChatStore.getState().hasApiKey).toBe(false);
  });
});

// ========== setModel ==========

describe('setModel', () => {
  it('更新 selectedModel', () => {
    useChatStore.getState().setModel('deepseek-v4-pro');
    expect(useChatStore.getState().selectedModel).toBe('deepseek-v4-pro');
  });
});

// ========== toggleDeepThink ==========

describe('toggleDeepThink', () => {
  it('切换 deepThink 状态', () => {
    expect(useChatStore.getState().deepThink).toBe(false);
    useChatStore.getState().toggleDeepThink();
    expect(useChatStore.getState().deepThink).toBe(true);
    useChatStore.getState().toggleDeepThink();
    expect(useChatStore.getState().deepThink).toBe(false);
  });
});

// ========== createConversation ==========

describe('createConversation', () => {
  it('写入 DB 并设为当前会话', async () => {
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    await useChatStore.getState().createConversation();

    expect(db.addConversation).toHaveBeenCalledOnce();
    const state = useChatStore.getState();
    expect(state.currentConversationId).toBeTruthy();
    expect(state.conversations).toHaveLength(1);
    expect(state.messages).toEqual([]);
    expect(state.streamingMessage).toBeNull();
  });
});

// ========== startNewConversation ==========

describe('startNewConversation', () => {
  it('设 currentConversationId 为 null 且不写 DB', () => {
    useChatStore.setState({
      conversations: [makeConversation({ id: 'c1' })],
      currentConversationId: 'c1',
      messages: [makeMessage()],
    });

    useChatStore.getState().startNewConversation();

    const state = useChatStore.getState();
    expect(state.currentConversationId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBeNull();
    expect(db.addConversation).not.toHaveBeenCalled();
  });
});

// ========== switchConversation ==========

describe('switchConversation', () => {
  it('从 DB 加载消息并清空 streamingMessage', async () => {
    const msgs = [makeMessage({ id: 'm1', content: '历史消息' })];
    vi.mocked(db.getMessagesByConversation).mockResolvedValue(msgs);

    await useChatStore.getState().switchConversation('c2');

    expect(db.getMessagesByConversation).toHaveBeenCalledWith('c2');
    const state = useChatStore.getState();
    expect(state.currentConversationId).toBe('c2');
    expect(state.allMessages).toBe(msgs);
    expect(state.messages).toEqual(msgs);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBeNull();
  });

  it('切换会话时清空激活消息', async () => {
    useChatStore.setState({ activeMessageId: 'm1' });
    vi.mocked(db.getMessagesByConversation).mockResolvedValue([]);

    await useChatStore.getState().switchConversation('c2');

    expect(useChatStore.getState().activeMessageId).toBeNull();
  });
});

// ========== toggleActiveMessage ==========

describe('toggleActiveMessage', () => {
  it('激活指定消息，再次调用取消激活', () => {
    useChatStore.getState().toggleActiveMessage('m1');
    expect(useChatStore.getState().activeMessageId).toBe('m1');

    useChatStore.getState().toggleActiveMessage('m1');
    expect(useChatStore.getState().activeMessageId).toBeNull();
  });

  it('激活新消息时替换上一条激活消息', () => {
    useChatStore.getState().toggleActiveMessage('m1');
    useChatStore.getState().toggleActiveMessage('m2');
    expect(useChatStore.getState().activeMessageId).toBe('m2');
  });
});

// ========== deleteConversation ==========

describe('deleteConversation', () => {
  it('删除当前会话时调用 startNewConversation（即使还有其他会话）', async () => {
    const c1 = makeConversation({ id: 'c1', updatedAt: 100 });
    const c2 = makeConversation({ id: 'c2', updatedAt: 200 });
    useChatStore.setState({
      conversations: [c1, c2],
      currentConversationId: 'c2',
      messages: [makeMessage({ id: 'm1' })],
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);

    await useChatStore.getState().deleteConversation('c2');

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.currentConversationId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.streamingMessage).toBeNull();
    expect(db.getMessagesByConversation).not.toHaveBeenCalled();
    expect(db.addConversation).not.toHaveBeenCalled();
  });

  it('删除唯一的当前会话时不自动创建新会话', async () => {
    const c1 = makeConversation({ id: 'c1' });
    useChatStore.setState({
      conversations: [c1],
      currentConversationId: 'c1',
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);

    await useChatStore.getState().deleteConversation('c1');

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.currentConversationId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(db.addConversation).not.toHaveBeenCalled();
  });

  it('删除非当前会话时只更新列表', async () => {
    const c1 = makeConversation({ id: 'c1' });
    const c2 = makeConversation({ id: 'c2' });
    useChatStore.setState({
      conversations: [c1, c2],
      currentConversationId: 'c1',
      messages: [makeMessage({ id: 'm1' })],
    });
    vi.mocked(db.deleteConversation).mockResolvedValue(undefined);

    await useChatStore.getState().deleteConversation('c2');

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.currentConversationId).toBe('c1');
    expect(state.messages).toHaveLength(1);
    expect(db.getMessagesByConversation).not.toHaveBeenCalled();
  });
});

// ========== sendMessage ==========

describe('sendMessage', () => {
  beforeEach(() => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      conversations: [makeConversation({ id: 'c1' })],
      currentConversationId: 'c1',
    });
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
  });

  it('无 apiKey 时直接返回', async () => {
    useChatStore.setState({ apiKey: '', hasApiKey: false });
    await useChatStore.getState().sendMessage('hello');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('无当前会话时惰性创建', async () => {
    useChatStore.setState({ currentConversationId: null });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    await useChatStore.getState().sendMessage('第一条消息');

    expect(db.addConversation).toHaveBeenCalledOnce();
    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.title).toBe('第一条消息');
    expect(useChatStore.getState().currentConversationId).toBe(conv.id);
  });

  it('长标题截断为 20 字符', async () => {
    useChatStore.setState({ currentConversationId: null });
    vi.mocked(db.addConversation).mockResolvedValue(undefined);

    const longContent = '这是一段非常非常长的消息内容超过二十个字符';
    await useChatStore.getState().sendMessage(longContent);

    const conv = vi.mocked(db.addConversation).mock.calls[0][0];
    expect(conv.title).toBe(longContent.slice(0, 20) + '...');
  });

  it('发送后设置 isLoading 和 streamingMessage', async () => {
    await useChatStore.getState().sendMessage('hello');

    const state = useChatStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.streamingMessage).not.toBeNull();
    expect(state.streamingMessage!.content).toBe('');
    expect(state.streamingMessage!.reasoningContent).toBe('');
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('hello');
  });

  it('thinking 事件累积到 reasoningContent', async () => {
    await useChatStore.getState().sendMessage('hello');

    capturedOnEvent({
      type: 'thinking',
      text: '思考中',
    });

    expect(useChatStore.getState().streamingMessage!.reasoningContent).toBe(
      '思考中',
    );
  });

  it('content 事件追加到 content', async () => {
    await useChatStore.getState().sendMessage('hello');

    capturedOnEvent({ type: 'content', text: '你好' });
    capturedOnEvent({ type: 'content', text: '世界' });

    expect(useChatStore.getState().streamingMessage!.content).toBe('你好世界');
  });

  it('done 事件持久化消息并更新会话', async () => {
    await useChatStore.getState().sendMessage('hello');

    capturedOnEvent({ type: 'content', text: '回复内容' });
    capturedOnEvent({ type: 'done' });

    const state = useChatStore.getState();
    expect(state.streamingMessage).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].content).toBe('回复内容');

    expect(db.addMessage).toHaveBeenCalledTimes(2);
    expect(db.updateConversation).toHaveBeenCalledOnce();
    const updatedConv = vi.mocked(db.updateConversation).mock.calls[0][0];
    expect(updatedConv.messageCount).toBe(2);
  });

  it('done 事件拼接 reasoningContent', async () => {
    await useChatStore.getState().sendMessage('hello', true);

    capturedOnEvent({
      type: 'thinking',
      text: '第一步',
    });
    capturedOnEvent({
      type: 'thinking',
      text: '第二步',
    });
    capturedOnEvent({ type: 'content', text: '结论' });
    capturedOnEvent({ type: 'done' });

    const assistantMsg = useChatStore.getState().messages[1];
    expect(assistantMsg.reasoningContent).toBe('第一步第二步');
  });

  it('error 事件设置 error 状态', async () => {
    await useChatStore.getState().sendMessage('hello');

    capturedOnEvent({ type: 'error', error: new Error('API 错误') });

    const state = useChatStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBe('API 错误');
  });
});

// ========== cancelStream ==========

describe('cancelStream', () => {
  it('调用 controller.abort()', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: 'c1',
    });
    await useChatStore.getState().sendMessage('hello');
    mockAbort.mockClear();

    useChatStore.getState().cancelStream();
    expect(mockAbort).toHaveBeenCalledOnce();
  });

  it('无活跃流时安全调用', () => {
    useChatStore.getState().cancelStream();
    expect(mockAbort).not.toHaveBeenCalled();
  });
});

// ========== regenerateMessage ==========

describe('regenerateMessage', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
  });

  it('为 assistant 创建同父兄弟分支并切到新分支', async () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '问题1',
      parentId: null,
      selectedChildId: 'a1',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '回答1',
      parentId: 'u1',
      createdAt: 100,
    });
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a1' })],
      allMessages: [u1, a1],
      messages: [u1, a1],
    });

    await useChatStore.getState().regenerateMessage('a1');

    const state = useChatStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.streamingMessage).not.toBeNull();
    // 全树新增一条 assistant 占位
    expect(state.allMessages).toHaveLength(3);
    const newAssistant = state.allMessages[2];
    expect(newAssistant.role).toBe('assistant');
    expect(newAssistant.parentId).toBe('u1');
    // 流式期间 messages 截止到父 user（不含新 assistant）
    expect(state.messages.map((m) => m.id)).toEqual(['u1']);
    expect(createChatStream).toHaveBeenCalledOnce();
    // API payload = system + 父 user
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(payload).toHaveLength(2);
    expect(payload[1]).toMatchObject({ role: 'user', content: '问题1' });
  });

  it('流式 done 后持久化新 assistant 并更新父指针/会话', async () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '问题1',
      parentId: null,
      selectedChildId: 'a1',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '回答1',
      parentId: 'u1',
      createdAt: 100,
    });
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a1' })],
      allMessages: [u1, a1],
      messages: [u1, a1],
    });

    await useChatStore.getState().regenerateMessage('a1');
    capturedOnEvent({ type: 'content', text: '新回答' });
    capturedOnEvent({ type: 'done' });

    const state = useChatStore.getState();
    expect(state.streamingMessage).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).toBe('新回答');
    // 新 assistant 持久化
    expect(db.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', content: '新回答' }),
    );
    // 父 user 的 selectedChildId 切到新 assistant
    expect(db.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
    );
    // 会话 activeLeafId 更新
    expect(db.updateConversation).toHaveBeenCalled();
    expect(state.conversations[0].activeLeafId).toBe(state.messages[1].id);
  });

  it('非 assistant 消息直接返回', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      allMessages: [makeMessage({ id: 'u1', role: 'user' })],
    });
    await useChatStore.getState().regenerateMessage('u1');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('流式中禁止重新生成', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      isLoading: true,
      allMessages: [makeMessage({ id: 'a1', role: 'assistant' })],
    });
    await useChatStore.getState().regenerateMessage('a1');
    expect(createChatStream).not.toHaveBeenCalled();
  });
});

// ========== editMessage ==========

describe('editMessage', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
    vi.mocked(db.addMessage).mockResolvedValue(undefined);
  });

  it('为 user 创建同父兄弟分支 + assistant 子节点', async () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '原始问题',
      parentId: null,
      selectedChildId: 'a1',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '回答',
      parentId: 'u1',
      createdAt: 100,
    });
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a1' })],
      allMessages: [u1, a1],
      messages: [u1, a1],
      editingMessageId: 'u1',
    });

    await useChatStore.getState().editMessage('u1', '修改后的问题');

    const state = useChatStore.getState();
    expect(state.editingMessageId).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.allMessages).toHaveLength(4);
    const newUser = state.allMessages[2];
    const newAssistant = state.allMessages[3];
    expect(newUser.role).toBe('user');
    expect(newUser.content).toBe('修改后的问题');
    expect(newUser.parentId).toBeNull(); // 同父（root）
    expect(newAssistant.parentId).toBe(newUser.id);
    // 流式期间 messages = [新 user]
    expect(state.messages.map((m) => m.id)).toEqual([newUser.id]);
    // 新 user 立即持久化
    expect(db.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: '修改后的问题' }),
    );
    // API payload = system + 新 user
    const payload = vi.mocked(createChatStream).mock.calls[0][0].messages;
    expect(payload).toHaveLength(2);
    expect(payload[1]).toMatchObject({
      role: 'user',
      content: '修改后的问题',
    });
  });

  it('非 user 消息直接返回', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      allMessages: [makeMessage({ id: 'a1', role: 'assistant' })],
    });
    await useChatStore.getState().editMessage('a1', 'x');
    expect(createChatStream).not.toHaveBeenCalled();
  });

  it('流式中禁止编辑', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      isLoading: true,
      allMessages: [makeMessage({ id: 'u1', role: 'user' })],
    });
    await useChatStore.getState().editMessage('u1', 'x');
    expect(createChatStream).not.toHaveBeenCalled();
  });
});

// ========== switchSibling ==========

describe('switchSibling', () => {
  beforeEach(() => {
    vi.mocked(db.updateMessage).mockResolvedValue(undefined);
    vi.mocked(db.updateConversation).mockResolvedValue(undefined);
  });

  it('切到上一版本：更新父 selectedChildId 与 activeLeafId', () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '问',
      parentId: null,
      selectedChildId: 'a2',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '答1',
      parentId: 'u1',
      createdAt: 100,
    });
    const a2 = makeMessage({
      id: 'a2',
      role: 'assistant',
      content: '答2',
      parentId: 'u1',
      createdAt: 200,
    });
    useChatStore.setState({
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a2' })],
      allMessages: [u1, a1, a2],
      messages: [u1, a2],
    });

    useChatStore.getState().switchSibling('a2', -1);

    const state = useChatStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(state.conversations[0].activeLeafId).toBe('a1');
    expect(db.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', selectedChildId: 'a1' }),
    );
    expect(db.updateConversation).toHaveBeenCalled();
  });

  it('切到下一版本', () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '问',
      parentId: null,
      selectedChildId: 'a1',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '答1',
      parentId: 'u1',
      createdAt: 100,
    });
    const a2 = makeMessage({
      id: 'a2',
      role: 'assistant',
      content: '答2',
      parentId: 'u1',
      createdAt: 200,
    });
    useChatStore.setState({
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a1' })],
      allMessages: [u1, a1, a2],
      messages: [u1, a1],
    });

    useChatStore.getState().switchSibling('a1', 1);

    const state = useChatStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(['u1', 'a2']);
    expect(state.conversations[0].activeLeafId).toBe('a2');
  });

  it('到达边界时为 no-op', () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      content: '问',
      parentId: null,
      selectedChildId: 'a1',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      content: '答1',
      parentId: 'u1',
    });
    useChatStore.setState({
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1', activeLeafId: 'a1' })],
      allMessages: [u1, a1],
      messages: [u1, a1],
    });

    useChatStore.getState().switchSibling('a1', -1);

    const state = useChatStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(db.updateMessage).not.toHaveBeenCalled();
  });

  it('流式中禁止切换', () => {
    useChatStore.setState({
      isLoading: true,
      allMessages: [makeMessage({ id: 'u1' }), makeMessage({ id: 'a1' })],
    });
    useChatStore.getState().switchSibling('a1', -1);
    expect(db.updateMessage).not.toHaveBeenCalled();
  });
});

// ========== getBranchInfo ==========

describe('getBranchInfo', () => {
  it('返回当前版本序号与总数', () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      parentId: null,
      selectedChildId: 'a2',
    });
    const a1 = makeMessage({
      id: 'a1',
      role: 'assistant',
      parentId: 'u1',
      createdAt: 100,
    });
    const a2 = makeMessage({
      id: 'a2',
      role: 'assistant',
      parentId: 'u1',
      createdAt: 200,
    });
    useChatStore.setState({
      allMessages: [u1, a1, a2],
      conversations: [makeConversation({ id: 'c1' })],
    });

    const info = useChatStore.getState().getBranchInfo('a2');
    expect(info.total).toBe(2);
    expect(info.current).toBe(2);
    expect(info.prevSiblingId).toBe('a1');
    expect(info.nextSiblingId).toBeNull();
  });

  it('无兄弟时返回 1/1', () => {
    const u1 = makeMessage({
      id: 'u1',
      role: 'user',
      parentId: null,
    });
    useChatStore.setState({
      allMessages: [u1],
      conversations: [makeConversation({ id: 'c1' })],
    });

    const info = useChatStore.getState().getBranchInfo('u1');
    expect(info.total).toBe(1);
    expect(info.current).toBe(1);
  });
});

// ========== clearMessages ==========

describe('clearMessages', () => {
  it('清空 DB 和内存消息', async () => {
    useChatStore.setState({
      currentConversationId: 'c1',
      messages: [makeMessage()],
      streamingMessage: {
        id: 's1',
        conversationId: 'c1',
        role: 'assistant',
        content: '流式中',
        reasoningContent: '',
        createdAt: Date.now(),
      },
    });
    vi.mocked(db.clearConversationMessages).mockResolvedValue(undefined);

    await useChatStore.getState().clearMessages();

    expect(db.clearConversationMessages).toHaveBeenCalledWith('c1');
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.streamingMessage).toBeNull();
  });

  it('无当前会话时不操作', async () => {
    useChatStore.setState({ currentConversationId: null });
    await useChatStore.getState().clearMessages();
    expect(db.clearConversationMessages).not.toHaveBeenCalled();
  });
});
