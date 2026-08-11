import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatWelcome } from './chat-welcome';
import { sendMessage, toggleDeepThink } from '@/stores/actions';
import { useChatWelcomeState } from '@/stores/selectors';

vi.mock('@/stores/selectors', () => ({
  useChatWelcomeState: vi.fn(),
}));

vi.mock('@/stores/actions', () => ({
  setModel: vi.fn(),
  sendMessage: vi.fn(),
  toggleDeepThink: vi.fn(),
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
      <button
        type="button"
        data-testid="send-false"
        onClick={() => onSend('hello', false)}
      >
        send-false
      </button>
      <button
        type="button"
        data-testid="send-true"
        onClick={() => onSend('hello', true)}
      >
        send-true
      </button>
      <button
        type="button"
        data-testid="toggle-deep-think"
        onClick={onToggleDeepThink}
      >
        toggle
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useChatWelcomeState).mockReturnValue({
    selectedModel: 'deepseek-v4-flash',
    isLoading: false,
    deepThink: false,
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
    vi.mocked(useChatWelcomeState).mockReturnValue({
      selectedModel: 'deepseek-v4-flash',
      isLoading: false,
      deepThink: true,
    });
    render(<ChatWelcome />);
    expect(screen.getByTestId('chat-input')).toHaveAttribute(
      'data-deep-think',
      'true',
    );
  });

  it('点击深度思考按钮调用 store.toggleDeepThink', () => {
    render(<ChatWelcome />);
    screen.getByTestId('toggle-deep-think').click();
    expect(toggleDeepThink).toHaveBeenCalledOnce();
  });
});
