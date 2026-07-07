import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { SettingsDialog } from './settings-dialog';
import { useTheme } from '@/shared/providers/theme-provider';
import { useChatStore } from '@/features/chat/store/chat-store';
import { server } from '@/mocks/server';
import {
  mockBalanceError,
  mockBalanceNetworkError,
} from '@/mocks/handlers/deepseek';

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

  // ========== 余额查询测试 ==========

  it('显示余额查询标签', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('余额查询')).toBeInTheDocument();
  });

  it('切换到余额查询标签显示查询界面', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));
    expect(screen.getByText('查询余额')).toBeInTheDocument();
  });

  it('未配置 API Key 时显示提示', () => {
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { apiKey: '', setApiKey: vi.fn() };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));
    expect(
      screen.getByText('请先在 API KEY 设置中配置您的 DeepSeek API Key。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('查询余额')).not.toBeInTheDocument();
  });

  it('查询余额成功显示余额信息', async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));
    fireEvent.click(screen.getByTestId('balance-query-btn'));

    // 等待加载完成，显示余额数据
    await waitFor(() => {
      expect(screen.getByText('¥110.00')).toBeInTheDocument();
    });
    expect(screen.getByText('可用')).toBeInTheDocument();
    expect(screen.getByText('¥10.00')).toBeInTheDocument();
    expect(screen.getByText('¥100.00')).toBeInTheDocument();
    // 查询成功后按钮变为「重新查询」
    expect(screen.getByText('重新查询')).toBeInTheDocument();
  });

  it('查询余额失败显示错误信息', async () => {
    server.use(mockBalanceError(401, 'Invalid API key'));

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));
    fireEvent.click(screen.getByTestId('balance-query-btn'));

    await waitFor(() => {
      expect(screen.getByText('查询失败')).toBeInTheDocument();
    });
    expect(screen.getByText('Invalid API key')).toBeInTheDocument();
  });

  it('网络错误时显示错误信息', async () => {
    server.use(mockBalanceNetworkError());

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));
    fireEvent.click(screen.getByTestId('balance-query-btn'));

    await waitFor(() => {
      expect(screen.getByText('查询失败')).toBeInTheDocument();
    });
  });

  it('查询成功后切换标签再切回，余额数据从缓存恢复', async () => {
    const { unmount } = render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('余额查询'));
    fireEvent.click(screen.getByTestId('balance-query-btn'));

    // 等待查询完成
    await waitFor(() => {
      expect(screen.getByText('¥110.00')).toBeInTheDocument();
    });

    // 卸载组件（模拟切换到其他标签）
    unmount();

    // 重新挂载（模拟切回余额标签）
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));

    // 缓存数据应该直接显示，无需点击查询
    expect(screen.getByText('¥110.00')).toBeInTheDocument();
    expect(screen.getByText('重新查询')).toBeInTheDocument();
  });

  it('apiKey 变更后缓存不恢复', async () => {
    // 先用 key-A 查询并缓存
    const { unmount } = render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('余额查询'));
    fireEvent.click(screen.getByTestId('balance-query-btn'));
    await waitFor(() => {
      expect(screen.getByText('¥110.00')).toBeInTheDocument();
    });

    // 卸载并切换到不同的 apiKey
    unmount();
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = { apiKey: 'different-key-9999', setApiKey: vi.fn() };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    // 重新挂载（模拟换 key 后重新打开）
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('余额查询'));

    // 缓存不应恢复，应该显示初始状态（查询按钮，无余额数据）
    expect(screen.getByText('查询余额')).toBeInTheDocument();
    expect(screen.queryByText('¥110.00')).not.toBeInTheDocument();
  });
});
