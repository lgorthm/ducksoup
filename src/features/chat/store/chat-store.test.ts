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
    expect(state.messages).toBe(msgs);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBeNull();
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

// ========== retryLastMessage ==========

describe('retryLastMessage', () => {
  it('截断到最后一条 user 消息并重发', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      hasApiKey: true,
      currentConversationId: 'c1',
      conversations: [makeConversation({ id: 'c1' })],
      messages: [
        makeMessage({ id: 'u1', role: 'user', content: '问题1' }),
        makeMessage({ id: 'a1', role: 'assistant', content: '回答1' }),
        makeMessage({ id: 'u2', role: 'user', content: '问题2' }),
        makeMessage({ id: 'a2', role: 'assistant', content: '回答2' }),
      ],
    });

    await useChatStore.getState().retryLastMessage();

    const state = useChatStore.getState();
    expect(state.messages[0].id).toBe('u1');
    expect(state.messages[1].id).toBe('a1');
    expect(state.messages).toHaveLength(3);
    expect(state.messages[2].role).toBe('user');
    expect(state.isLoading).toBe(true);
    expect(createChatStream).toHaveBeenCalledOnce();
  });

  it('无 user 消息时直接返回', async () => {
    useChatStore.setState({
      apiKey: 'test-key',
      messages: [
        makeMessage({ id: 'a1', role: 'assistant', content: '只有回答' }),
      ],
    });

    await useChatStore.getState().retryLastMessage();
    expect(createChatStream).not.toHaveBeenCalled();
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
