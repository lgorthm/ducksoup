import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatWelcome } from './chat-welcome';
import { useStore } from '@/stores';

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
  ChatComposer: ({
    draftModel,
    onPendingImagesChange,
  }: {
    draftModel?: string;
    onPendingImagesChange?: (count: number) => void;
  }) => (
    <div data-testid="chat-composer" data-draft-model={draftModel}>
      <button
        type="button"
        data-testid="fake-add-image"
        onClick={() => onPendingImagesChange?.(1)}
      />
      <button
        type="button"
        data-testid="fake-clear-image"
        onClick={() => onPendingImagesChange?.(0)}
      />
    </div>
  ),
}));

describe('ChatWelcome', () => {
  it('默认选择 flash 并传给输入组件作为草稿模型', () => {
    render(<ChatWelcome />);

    expect(
      screen.getByText('使用 DeepSeek V4 Flash 开始对话'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('radio-group-button')).toHaveAttribute(
      'data-value',
      'deepseek-v4-flash-vision-exp',
    );
    expect(screen.getByTestId('chat-composer')).toHaveAttribute(
      'data-draft-model',
      'deepseek-v4-flash-vision-exp',
    );
  });

  it('切换模型只更新本地草稿，store 中不存在 selectedModel', () => {
    render(<ChatWelcome />);

    fireEvent.click(screen.getByTestId('radio-group-button'));

    expect(
      screen.getByText('使用 DeepSeek V4 Pro 开始对话'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('radio-group-button')).toHaveAttribute(
      'data-value',
      'deepseek-v4-pro',
    );
    expect(screen.getByTestId('chat-composer')).toHaveAttribute(
      'data-draft-model',
      'deepseek-v4-pro',
    );
    expect('selectedModel' in useStore.getState()).toBe(false);
  });

  it('渲染输入区（ChatComposer）', () => {
    render(<ChatWelcome />);
    expect(screen.getByTestId('chat-composer')).toBeInTheDocument();
  });

  it('有待发图时隐藏模型选择，清空后恢复', () => {
    render(<ChatWelcome />);
    expect(screen.getByTestId('radio-group-button')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fake-add-image'));
    expect(screen.queryByTestId('radio-group-button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fake-clear-image'));
    expect(screen.getByTestId('radio-group-button')).toBeInTheDocument();
  });
});
