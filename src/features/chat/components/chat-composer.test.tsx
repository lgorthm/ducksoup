import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatComposer } from './chat-composer';
import { cancelStream, sendMessage, toggleDeepThink } from '@/stores/actions';
import { useStore } from '@/stores';

vi.mock('@/stores/actions', () => ({
  sendMessage: vi.fn(),
  cancelStream: vi.fn(),
  toggleDeepThink: vi.fn(),
}));

vi.mock('@/features/chat/components/chat-input', () => ({
  ChatInput: ({
    onSend,
    disabled,
    isStreaming,
    onCancel,
    deepThink,
    onToggleDeepThink,
  }: {
    onSend: (content: string, deepThink: boolean) => void;
    disabled?: boolean;
    isStreaming?: boolean;
    onCancel?: () => void;
    deepThink: boolean;
    onToggleDeepThink: () => void;
  }) => (
    <div
      data-testid="chat-input"
      data-disabled={String(disabled)}
      data-streaming={String(isStreaming)}
      data-deep-think={String(deepThink)}
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
      <button type="button" data-testid="cancel" onClick={onCancel}>
        cancel
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
  useStore.setState({
    isLoading: false,
    streamingMessageId: null,
    deepThink: false,
  });
});

describe('ChatComposer', () => {
  it('将 deepThink=true 转发给 sendMessage（回归测试）', () => {
    render(<ChatComposer />);
    screen.getByTestId('send-true').click();
    expect(sendMessage).toHaveBeenCalledWith('hello', true);
  });

  it('将 deepThink=false 转发给 sendMessage', () => {
    render(<ChatComposer />);
    screen.getByTestId('send-false').click();
    expect(sendMessage).toHaveBeenCalledWith('hello', false);
  });

  it('从 store 读取 deepThink 并传给 ChatInput', () => {
    useStore.setState({ deepThink: true });
    render(<ChatComposer />);
    expect(screen.getByTestId('chat-input')).toHaveAttribute(
      'data-deep-think',
      'true',
    );
  });

  it('点击深度思考按钮调用 store.toggleDeepThink', () => {
    render(<ChatComposer />);
    screen.getByTestId('toggle-deep-think').click();
    expect(toggleDeepThink).toHaveBeenCalledOnce();
  });

  it('isLoading 时禁用输入', () => {
    useStore.setState({ isLoading: true });
    render(<ChatComposer />);
    expect(screen.getByTestId('chat-input')).toHaveAttribute(
      'data-disabled',
      'true',
    );
  });

  it('流式时透传 isStreaming，取消按钮调用 cancelStream', () => {
    useStore.setState({
      isLoading: true,
      streamingMessageId: 's1',
    });
    render(<ChatComposer />);
    expect(screen.getByTestId('chat-input')).toHaveAttribute(
      'data-streaming',
      'true',
    );
    screen.getByTestId('cancel').click();
    expect(cancelStream).toHaveBeenCalledOnce();
  });
});
