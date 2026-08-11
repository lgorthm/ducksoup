import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatWelcome } from './chat-welcome';
import { setModel } from '@/stores/actions';
import { useStore } from '@/stores';

vi.mock('@/stores/actions', () => ({
  setModel: vi.fn(),
}));

vi.mock('@/shared/components/ui/radio-group-button', () => ({
  RadioGroupButton: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <button
      type="button"
      data-testid="radio-group-button"
      data-value={value}
      onClick={() => onValueChange('deepseek-v4-pro')}
    />
  ),
}));

vi.mock('@/features/chat/components/chat-composer', () => ({
  ChatComposer: () => <div data-testid="chat-composer" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({ selectedModel: 'deepseek-v4-flash' });
});

describe('ChatWelcome', () => {
  it('显示当前模型的欢迎语', () => {
    render(<ChatWelcome />);
    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(
      screen.getByText('使用 DeepSeek V4 Flash 开始对话'),
    ).toBeInTheDocument();
  });

  it('模型选择的值为 store 中的 selectedModel', () => {
    render(<ChatWelcome />);
    expect(screen.getByTestId('radio-group-button')).toHaveAttribute(
      'data-value',
      'deepseek-v4-flash',
    );
  });

  it('切换模型时调用 setModel', () => {
    render(<ChatWelcome />);
    screen.getByTestId('radio-group-button').click();
    expect(setModel).toHaveBeenCalledWith('deepseek-v4-pro');
  });

  it('渲染输入区（ChatComposer）', () => {
    render(<ChatWelcome />);
    expect(screen.getByTestId('chat-composer')).toBeInTheDocument();
  });
});
