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
  }: {
    onSend: (content: string, deepThink: boolean) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="chat-input" data-disabled={disabled}>
      <button data-testid="send-false" onClick={() => onSend('hello', false)}>
        send-false
      </button>
      <button data-testid="send-true" onClick={() => onSend('hello', true)}>
        send-true
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
});
