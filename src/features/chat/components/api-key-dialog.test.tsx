import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiKeyDialog } from './api-key-dialog';
import { useChatStore } from '@/features/chat/store/chat-store';

vi.mock('@/features/chat/store/chat-store', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
    const state = {
      setApiKey: vi.fn(),
      hasApiKey: false,
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
});

describe('ApiKeyDialog', () => {
  it('渲染对话框标题', () => {
    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('设置 API Key')).toBeInTheDocument();
  });

  it('渲染密码输入框', () => {
    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('空输入时保存按钮禁用', () => {
    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('保存')).toBeDisabled();
  });

  it('输入后保存按钮启用', () => {
    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-test-key' } });
    expect(screen.getByText('保存')).toBeEnabled();
  });

  it('点击保存调用 setApiKey 并关闭对话框', () => {
    const onOpenChange = vi.fn();
    const mockSetApiKey = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { setApiKey: mockSetApiKey, hasApiKey: false };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ApiKeyDialog open={true} onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-my-key' } });
    fireEvent.click(screen.getByText('保存'));

    expect(mockSetApiKey).toHaveBeenCalledWith('sk-my-key');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('保存时去除首尾空格', () => {
    const mockSetApiKey = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { setApiKey: mockSetApiKey, hasApiKey: false };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: '  sk-key  ' } });
    fireEvent.click(screen.getByText('保存'));

    expect(mockSetApiKey).toHaveBeenCalledWith('sk-key');
  });

  it('Enter 键保存', () => {
    const mockSetApiKey = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { setApiKey: mockSetApiKey, hasApiKey: false };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ApiKeyDialog open={true} onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-key' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSetApiKey).toHaveBeenCalledWith('sk-key');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('已有 API Key 时显示取消按钮', () => {
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { setApiKey: vi.fn(), hasApiKey: true };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('无 API Key 时不显示取消按钮', () => {
    render(<ApiKeyDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('取消')).not.toBeInTheDocument();
  });

  it('点击取消按钮关闭对话框', () => {
    const onOpenChange = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { setApiKey: vi.fn(), hasApiKey: true };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ApiKeyDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('open=false 时不渲染内容', () => {
    render(<ApiKeyDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('设置 API Key')).not.toBeInTheDocument();
  });
});
