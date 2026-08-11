import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { Conversation } from '@/features/chat/types/deepseek';
import { ConversationList } from './conversation-list';
import {
  deleteConversation,
  startNewConversation,
  switchConversation,
} from '@/stores/actions';
import { useConversationListState } from '@/stores/selectors';
import { useIsMobile } from '@/shared/hooks/use-media-query';

vi.mock('@/stores/selectors', () => ({
  useConversationListState: vi.fn(),
}));

vi.mock('@/stores/actions', () => ({
  deleteConversation: vi.fn(),
  startNewConversation: vi.fn(),
  switchConversation: vi.fn(),
}));

vi.mock('@/shared/hooks/use-media-query', () => ({
  useIsMobile: vi.fn(),
}));

vi.mock('@/shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: `c-${Math.random().toString(36).slice(2, 7)}`,
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.mocked(useConversationListState).mockReturnValue({
    conversations: [],
    currentConversationId: null,
    initialized: true,
  });
});

describe('ConversationList', () => {
  it('渲染"开启新对话"按钮', () => {
    render(<ConversationList />);
    expect(screen.getByText('开启新对话')).toBeInTheDocument();
  });

  it('点击新对话按钮调用 startNewConversation', () => {
    render(<ConversationList />);
    fireEvent.click(screen.getByText('开启新对话'));
    expect(startNewConversation).toHaveBeenCalledOnce();
  });

  it('无会话时显示"暂无对话"', () => {
    render(<ConversationList />);
    expect(screen.getByText('暂无对话')).toBeInTheDocument();
  });

  it('未初始化时显示骨架屏而不是"暂无对话"', () => {
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: [],
      currentConversationId: null,
      initialized: false,
    });

    render(<ConversationList />);
    expect(screen.getByTestId('conversation-list-loading')).toBeInTheDocument();
    expect(screen.queryByText('暂无对话')).not.toBeInTheDocument();
  });

  it('加载很快时骨架屏也至少展示 200ms 再显示列表', () => {
    vi.useFakeTimers();
    let initialized = false;
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useConversationListState).mockImplementation(() => ({
      conversations: convs,
      currentConversationId: null,
      initialized,
    }));

    const { rerender } = render(<ConversationList />);
    // 30ms 后数据加载完成
    act(() => {
      vi.advanceTimersByTime(30);
    });
    initialized = true;
    rerender(<ConversationList />);
    // 不足最短展示时长，仍显示骨架屏
    expect(screen.getByTestId('conversation-list-loading')).toBeInTheDocument();
    expect(screen.queryByText('会话一')).not.toBeInTheDocument();
    // 到达最短展示时长后显示列表
    act(() => {
      vi.advanceTimersByTime(170);
    });
    expect(screen.getByText('会话一')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('渲染会话列表', () => {
    const convs = [
      makeConv({ id: 'c1', title: '会话一' }),
      makeConv({ id: 'c2', title: '会话二' }),
    ];
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: convs,
      currentConversationId: 'c1',
      initialized: true,
    });

    render(<ConversationList />);
    expect(screen.getByText('会话一')).toBeInTheDocument();
    expect(screen.getByText('会话二')).toBeInTheDocument();
  });

  it('点击会话项调用 switchConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: convs,
      currentConversationId: null,
      initialized: true,
    });

    render(<ConversationList />);
    fireEvent.click(screen.getByText('会话一'));
    expect(switchConversation).toHaveBeenCalledWith('c1');
  });

  it('点击删除菜单项弹出确认对话框，确认后调用 deleteConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: convs,
      currentConversationId: 'c1',
      initialized: true,
    });

    render(<ConversationList />);
    const deleteItem = screen.getByTestId('dropdown-item');
    fireEvent.click(deleteItem);
    // 点击删除菜单项后不应直接调用 deleteConversation
    expect(deleteConversation).not.toHaveBeenCalled();
    // 应弹出确认对话框，点击确认后才执行删除
    const confirmBtn = screen.getByTestId('confirm-delete-conversation');
    fireEvent.click(confirmBtn);
    expect(deleteConversation).toHaveBeenCalledWith('c1');
  });

  it('点击删除菜单项后点击取消不调用 deleteConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: convs,
      currentConversationId: 'c1',
      initialized: true,
    });

    render(<ConversationList />);
    fireEvent.click(screen.getByTestId('dropdown-item'));
    // 点击取消按钮（ghost 样式）不执行删除
    const cancelBtn = screen.getByText('取消');
    fireEvent.click(cancelBtn);
    expect(deleteConversation).not.toHaveBeenCalled();
  });

  it('移动端非当前会话显示禁用的 MoreHorizontal', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const convs = [
      makeConv({ id: 'c1', title: '会话一' }),
      makeConv({ id: 'c2', title: '会话二' }),
    ];
    vi.mocked(useConversationListState).mockReturnValue({
      conversations: convs,
      currentConversationId: 'c1',
      initialized: true,
    });

    render(<ConversationList />);
    // c2 是非当前会话，移动端应显示禁用按钮
    const disabledButtons = screen.getAllByRole('button', { name: '' });
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });
});
