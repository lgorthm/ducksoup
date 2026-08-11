import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPage } from './chat-page';
import { init } from '@/stores/actions';
import { useStore } from '@/stores';
import {
  useChatAreaState,
  useChatWelcomeState,
  useHasContent,
  useInitialized,
} from '@/stores/selectors';
import type { StoredMessage } from '@/features/chat/types/deepseek';

vi.mock('@/stores', () => ({
  useStore: vi.fn(),
}));

vi.mock('@/stores/selectors', () => ({
  useInitialized: vi.fn(),
  useHasContent: vi.fn(),
  useChatAreaState: vi.fn(),
  useChatWelcomeState: vi.fn(),
}));

vi.mock('@/stores/actions', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn(),
  cancelStream: vi.fn(),
  toggleDeepThink: vi.fn(),
  setModel: vi.fn(),
}));

vi.mock('@/features/chat/components/api-key-dialog', () => ({
  ApiKeyDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="api-key-dialog" /> : null,
}));

vi.mock('@/features/chat/components/chat-input', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock('@/features/chat/components/chat-message-list', () => ({
  ChatMessageList: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="message-list">{children}</div>
  ),
}));

vi.mock('@/shared/components/ui/radio-group-button', () => ({
  RadioGroupButton: () => <div data-testid="radio-group-button" />,
}));

interface MockChatState {
  initialized: boolean;
  hasApiKey: boolean;
  messages: StoredMessage[];
  streamingMessage: null;
  isLoading: boolean;
  error: string | null;
  deepThink: boolean;
  selectedModel: 'deepseek-v4-flash';
}

let state: MockChatState;

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'user',
    content: '历史消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

function setMockState(overrides: Partial<MockChatState> = {}) {
  state = {
    initialized: false,
    hasApiKey: true,
    messages: [],
    streamingMessage: null,
    isLoading: false,
    error: null,
    deepThink: false,
    selectedModel: 'deepseek-v4-flash',
    ...overrides,
  };
  applyMocks();
}

function updateMockState(overrides: Partial<MockChatState>) {
  state = { ...state, ...overrides };
  applyMocks();
}

function applyMocks() {
  vi.mocked(useInitialized).mockReturnValue(state.initialized);
  vi.mocked(useHasContent).mockReturnValue(
    state.messages.length > 0 || state.streamingMessage !== null,
  );
  vi.mocked(useChatAreaState).mockReturnValue({
    messages: state.messages,
    streamingMessage: state.streamingMessage,
    isLoading: state.isLoading,
    error: state.error,
    deepThink: state.deepThink,
  });
  vi.mocked(useChatWelcomeState).mockReturnValue({
    selectedModel: state.selectedModel,
    isLoading: state.isLoading,
    deepThink: state.deepThink,
  });
  vi.mocked(useStore).mockImplementation((selector?: unknown) => {
    const storeState = { hasApiKey: state.hasApiKey };
    return typeof selector === 'function'
      ? (selector as (s: typeof storeState) => unknown)(storeState)
      : storeState;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setMockState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatPage', () => {
  it('初始化完成前显示空白 pending 容器，不显示骨架屏或欢迎页', () => {
    render(<ChatPage />);

    expect(screen.getByTestId('chat-page-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome')).not.toBeInTheDocument();
    expect(init).toHaveBeenCalledOnce();
  });

  it('初始化后无消息时直接进入 ChatWelcome，且不显示骨架屏', () => {
    const { rerender } = render(<ChatPage />);

    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();

    updateMockState({ initialized: true });
    rerender(<ChatPage />);

    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-page-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();
  });

  it('初始化后有消息时先显示一次骨架屏，再显示历史聊天内容', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ChatPage />);

    updateMockState({ initialized: true, messages: [makeMessage()] });
    rerender(<ChatPage />);

    expect(screen.getByTestId('chat-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(screen.getByTestId('chat-page-skeleton')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome')).not.toBeInTheDocument();
  });

  it('历史内容 reveal 后切换到空会话，直接显示欢迎页且不再显示骨架屏', () => {
    vi.useFakeTimers();
    setMockState({ initialized: true, messages: [makeMessage()] });
    const { rerender } = render(<ChatPage />);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('message-list')).toBeInTheDocument();

    updateMockState({ messages: [] });
    rerender(<ChatPage />);

    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();
  });

  it('欢迎页 reveal 后没有 API Key 时打开 ApiKeyDialog', () => {
    setMockState({ initialized: true, hasApiKey: false });
    render(<ChatPage />);

    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.getByTestId('api-key-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-page-skeleton')).not.toBeInTheDocument();
  });
});
