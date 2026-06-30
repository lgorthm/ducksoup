import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatWelcome } from './chat-welcome';
import { useChatStore } from '@/features/chat/store/chat-store';

vi.mock('@/features/chat/store/chat-store', () => ({
  useChatStore: vi.fn(),
  MODEL_LABELS: {
    'deepseek-v4-flash': 'DeepSeek V4 Flash',
    'deepseek-v4-pro': 'DeepSeek V4 Pro',
  },
}));

vi.mock('@/shared/components/ui/radio-group-button', () => ({
  RadioGroupButton: () => <div data-testid="radio-group-button" />,
}));

vi.mock('@/features/chat/components/chat-input', () => ({
  ChatInput: ({
    onSend,
    disabled,
    deepThink,
    onToggleDeepThink,
  }: {
    onSend: (content: string, deepThink: boolean) => void;
    disabled?: boolean;
    deepThink: boolean;
    onToggleDeepThink: () => void;
  }) => (
    <div
      data-testid="chat-input"
      data-disabled={disabled}
      data-deep-think={deepThink}
    >
      <button data-testid="send-false" onClick={() => onSend('hello', false)}>
        send-false
      </button>
      <button data-testid="send-true" onClick={() => onSend('hello', true)}>
        send-true
      </button>
      <button data-testid="toggle-deep-think" onClick={onToggleDeepThink}>
        toggle
      </button>
    </div>
  ),
}));

let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  sendMessage = vi.fn();
  vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
    const state = {
      selectedModel: 'deepseek-v4-flash' as const,
      setModel: vi.fn(),
      sendMessage,
      isLoading: false,
      deepThink: false,
      toggleDeepThink: vi.fn(),
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
});

describe('ChatWelcome', () => {
  it('将 deepThink=true 转发给 sendMessage（回归测试）', () => {
    render(<ChatWelcome />);
    screen.getByTestId('send-true').click();
    expect(sendMessage).toHaveBeenCalledWith('hello', true);
  });

  it('将 deepThink=false 转发给 sendMessage', () => {
    render(<ChatWelcome />);
    screen.getByTestId('send-false').click();
    expect(sendMessage).toHaveBeenCalledWith('hello', false);
  });

  it('从 store 读取 deepThink 并传给 ChatInput', () => {
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        selectedModel: 'deepseek-v4-flash' as const,
        setModel: vi.fn(),
        sendMessage,
        isLoading: false,
        deepThink: true,
        toggleDeepThink: vi.fn(),
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });
    render(<ChatWelcome />);
    expect(screen.getByTestId('chat-input')).toHaveAttribute(
      'data-deep-think',
      'true',
    );
  });

  it('点击深度思考按钮调用 store.toggleDeepThink', () => {
    const toggleDeepThink = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        selectedModel: 'deepseek-v4-flash' as const,
        setModel: vi.fn(),
        sendMessage,
        isLoading: false,
        deepThink: false,
        toggleDeepThink,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });
    render(<ChatWelcome />);
    screen.getByTestId('toggle-deep-think').click();
    expect(toggleDeepThink).toHaveBeenCalledOnce();
  });
});
