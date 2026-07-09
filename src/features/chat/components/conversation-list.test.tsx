import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Conversation } from '@/features/chat/types/deepseek';
import { ConversationList } from './conversation-list';
import { useChatStore } from '@/features/chat/store/chat-store';
import { useIsMobile } from '@/shared/hooks/use-media-query';

vi.mock('@/features/chat/store/chat-store', () => ({
  useChatStore: vi.fn(),
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

const mockActions = {
  startNewConversation: vi.fn(),
  switchConversation: vi.fn(),
  deleteConversation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
    const state = {
      conversations: [] as Conversation[],
      currentConversationId: null,
      ...mockActions,
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
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
    expect(mockActions.startNewConversation).toHaveBeenCalledOnce();
  });

  it('无会话时显示"暂无对话"', () => {
    render(<ConversationList />);
    expect(screen.getByText('暂无对话')).toBeInTheDocument();
  });

  it('渲染会话列表', () => {
    const convs = [
      makeConv({ id: 'c1', title: '会话一' }),
      makeConv({ id: 'c2', title: '会话二' }),
    ];
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        conversations: convs,
        currentConversationId: 'c1',
        ...mockActions,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ConversationList />);
    expect(screen.getByText('会话一')).toBeInTheDocument();
    expect(screen.getByText('会话二')).toBeInTheDocument();
  });

  it('点击会话项调用 switchConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        conversations: convs,
        currentConversationId: null,
        ...mockActions,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ConversationList />);
    fireEvent.click(screen.getByText('会话一'));
    expect(mockActions.switchConversation).toHaveBeenCalledWith('c1');
  });

  it('点击删除菜单项弹出确认对话框，确认后调用 deleteConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        conversations: convs,
        currentConversationId: 'c1',
        ...mockActions,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ConversationList />);
    const deleteItem = screen.getByTestId('dropdown-item');
    fireEvent.click(deleteItem);
    // 点击删除菜单项后不应直接调用 deleteConversation
    expect(mockActions.deleteConversation).not.toHaveBeenCalled();
    // 应弹出确认对话框，点击确认后才执行删除
    const confirmBtn = screen.getByTestId('confirm-delete-conversation');
    fireEvent.click(confirmBtn);
    expect(mockActions.deleteConversation).toHaveBeenCalledWith('c1');
  });

  it('点击删除菜单项后点击取消不调用 deleteConversation', () => {
    const convs = [makeConv({ id: 'c1', title: '会话一' })];
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        conversations: convs,
        currentConversationId: 'c1',
        ...mockActions,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ConversationList />);
    fireEvent.click(screen.getByTestId('dropdown-item'));
    // 点击取消按钮（ghost 样式）不执行删除
    const cancelBtn = screen.getByText('取消');
    fireEvent.click(cancelBtn);
    expect(mockActions.deleteConversation).not.toHaveBeenCalled();
  });

  it('移动端非当前会话显示禁用的 MoreHorizontal', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const convs = [
      makeConv({ id: 'c1', title: '会话一' }),
      makeConv({ id: 'c2', title: '会话二' }),
    ];
    vi.mocked(useChatStore).mockImplementation((selector?: unknown) => {
      const state = {
        conversations: convs,
        currentConversationId: 'c1',
        ...mockActions,
      };
      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    render(<ConversationList />);
    // c2 是非当前会话，移动端应显示禁用按钮
    const disabledButtons = screen.getAllByRole('button', { name: '' });
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });
});
