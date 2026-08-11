import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from './chat-area';
import { useChatAreaState } from '@/stores/selectors';
import type { StoredMessage } from '@/features/chat/types/deepseek';

vi.mock('@/stores/selectors', () => ({
  useChatAreaState: vi.fn(),
}));

vi.mock('@/stores/actions', () => ({
  sendMessage: vi.fn(),
  cancelStream: vi.fn(),
  toggleDeepThink: vi.fn(),
}));

vi.mock('@/features/chat/components/chat-message-list', () => ({
  ChatMessageList: ({
    messages,
    children,
  }: {
    messages: StoredMessage[];
    children?: React.ReactNode;
  }) => (
    <div data-testid="message-list">
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      {children}
    </div>
  ),
}));

vi.mock('@/features/chat/components/chat-input', () => ({
  ChatInput: ({
    onSend,
  }: {
    onSend: (c: string, d: boolean) => void;
    deepThink: boolean;
    onToggleDeepThink: () => void;
  }) => <div data-testid="chat-input" onClick={() => onSend('test', false)} />,
}));

vi.mock('@/features/chat/components/chat-welcome', () => ({
  ChatWelcome: () => <div data-testid="chat-welcome" />,
}));

function makeMsg(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    content: '消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useChatAreaState).mockReturnValue({
    messages: [],
    streamingMessage: null,
    isLoading: false,
    error: null,
    deepThink: false,
  });
});

describe('ChatArea', () => {
  it('无消息时显示 ChatWelcome', () => {
    render(<ChatArea />);
    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('有消息时显示消息列表和输入框', () => {
    const msgs = [makeMsg({ id: 'm1', content: '你好' })];
    vi.mocked(useChatAreaState).mockReturnValue({
      messages: msgs,
      streamingMessage: null,
      isLoading: false,
      error: null,
      deepThink: false,
    });

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome')).not.toBeInTheDocument();
  });

  it('有流式消息时显示消息列表', () => {
    vi.mocked(useChatAreaState).mockReturnValue({
      messages: [],
      streamingMessage: {
        id: 's1',
        conversationId: 'c1',
        role: 'assistant' as const,
        content: '流式中',
        reasoningContent: '',
        createdAt: Date.now(),
      },
      isLoading: true,
      error: null,
      deepThink: false,
    });

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('loading 且无流式消息时显示思考中', () => {
    vi.mocked(useChatAreaState).mockReturnValue({
      messages: [makeMsg()],
      streamingMessage: null,
      isLoading: true,
      error: null,
      deepThink: false,
    });

    render(<ChatArea />);
    expect(screen.getByText('思考中...')).toBeInTheDocument();
  });

  it('有错误时显示错误信息', () => {
    vi.mocked(useChatAreaState).mockReturnValue({
      messages: [makeMsg()],
      streamingMessage: null,
      isLoading: false,
      error: 'API 调用失败',
      deepThink: false,
    });

    render(<ChatArea />);
    expect(screen.getByText('API 调用失败')).toBeInTheDocument();
  });

  it('显示免责声明', () => {
    const msgs = [makeMsg()];
    vi.mocked(useChatAreaState).mockReturnValue({
      messages: msgs,
      streamingMessage: null,
      isLoading: false,
      error: null,
      deepThink: false,
    });

    render(<ChatArea />);
    expect(screen.getByText('内容由AI生成，请仔细甄别')).toBeInTheDocument();
  });
});
