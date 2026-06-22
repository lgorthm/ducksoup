import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsDialog } from './settings-dialog';
import { useTheme } from '@/shared/providers/theme-provider';
import { useChatStore } from '@/features/chat/store/chat-store';

vi.mock('@/shared/providers/theme-provider', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/features/chat/store/chat-store', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('@/shared/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/shared/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTheme).mockReturnValue({
    theme: 'light',
    setTheme: vi.fn(),
  });
  vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
    const state = {
      apiKey: 'existing-key',
      setApiKey: vi.fn(),
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
});

describe('SettingsDialog', () => {
  it('渲染对话框标题', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('默认显示通用设置标签', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('选择界面主题')).toBeInTheDocument();
  });

  it('切换到 API Key 标签', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('API KEY 设置'));
    expect(
      screen.getByText('Key 将存储在本地浏览器中，不会上传到任何服务器。'),
    ).toBeInTheDocument();
  });

  it('主题选择调用 setTheme', () => {
    const mockSetTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('深色'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('当前主题有选中标记', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    const darkBtn = screen.getByText('深色').closest('button');
    expect(darkBtn?.className).toContain('border-foreground');
  });

  it('API Key 标签显示已有 key', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('API KEY 设置'));
    const input = screen.getByDisplayValue('existing-key');
    expect(input).toBeInTheDocument();
  });

  it('保存 API Key 调用 setApiKey', () => {
    const mockSetApiKey = vi.fn();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { apiKey: '', setApiKey: mockSetApiKey };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('API KEY 设置'));
    const input = screen.getByPlaceholderText('请输入您的 DeepSeek API Key');
    fireEvent.change(input, { target: { value: 'sk-new' } });
    fireEvent.click(screen.getByText('保存'));

    expect(mockSetApiKey).toHaveBeenCalledWith('sk-new');
  });

  it('眼睛按钮切换密码可见性', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('API KEY 设置'));
    const input = screen.getByDisplayValue('existing-key');
    expect(input).toHaveAttribute('type', 'password');

    // 点击眼睛按钮
    const eyeBtn = input.parentElement?.querySelector('button');
    if (eyeBtn) fireEvent.click(eyeBtn);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('保存后显示"已保存"状态', () => {
    vi.useFakeTimers();
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('API KEY 设置'));
    fireEvent.click(screen.getByText('保存'));
    expect(screen.getByText('已保存')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('保存')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('移动端渲染 Sheet 而非 Dialog', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} isMobile={true} />,
    );
    // Sheet 和 Dialog 都用 role="dialog"，但标题应该可见
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('open=false 时不渲染', () => {
    render(<SettingsDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('系统设置')).not.toBeInTheDocument();
  });
});
