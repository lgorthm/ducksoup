import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { StoredMessage } from '@/features/chat/types/deepseek';
import { ChatMessage } from './chat-message';

vi.mock('@/shared/components/markdown-renderer', () => ({
  MarkdownRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-renderer">{children}</div>
  ),
}));

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    content: '测试内容',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('user 消息渲染纯文本内容', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-renderer')).not.toBeInTheDocument();
  });

  it('assistant 消息使用 MarkdownRenderer', async () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '# 标题',
    });
    render(<ChatMessage message={msg} />);
    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toBeInTheDocument();
    expect(screen.getByText('# 标题')).toBeInTheDocument();
  });

  it('无思考步骤时不显示思考区域', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} />);
    expect(screen.queryByText(/思考过程/)).not.toBeInTheDocument();
  });

  it('有推理内容时显示思考区域（折叠）', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '回复',
      reasoningContent: '首先理解问题\n然后寻找解决方案',
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/思考过程/)).toBeInTheDocument();
    // 折叠状态：不显示推理内容
    expect(screen.queryByText('首先理解问题')).not.toBeInTheDocument();
  });

  it('点击展开思考区域', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '回复',
      reasoningContent: '推理内容',
    });
    render(<ChatMessage message={msg} />);
    const toggleBtn = screen.getByText(/思考过程/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText('推理内容')).toBeInTheDocument();
  });

  it('流式且无内容时显示脉冲占位符', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
    });
    render(<ChatMessage message={msg} isStreaming />);
    // 应显示 animate-pulse 占位符
    const pulse = document.querySelector('.animate-pulse');
    expect(pulse).toBeInTheDocument();
  });

  it('流式且有推理内容时显示"思考中..."', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '思考',
    });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.getByText('思考中...')).toBeInTheDocument();
  });

  it('流式且有内容时使用 MarkdownRenderer', async () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '部分内容',
    });
    render(<ChatMessage message={msg} isStreaming />);
    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toBeInTheDocument();
  });
});

describe('ChatMessage 操作栏', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('完成的消息渲染操作栏与复制按钮', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-actions')).toBeInTheDocument();
    expect(screen.getByTestId('message-copy-button')).toBeInTheDocument();
  });

  it('assistant 完成消息同样渲染复制按钮', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-copy-button')).toBeInTheDocument();
  });

  it('流式消息不渲染操作栏', () => {
    const msg = makeMessage({ role: 'assistant', content: '部分内容' });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('点击复制按钮写入剪贴板并切换为已复制状态', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.useFakeTimers();
    try {
      const msg = makeMessage({ role: 'user', content: '待复制内容' });
      render(<ChatMessage message={msg} />);
      const btn = screen.getByTestId('message-copy-button');
      await act(async () => {
        fireEvent.click(btn);
      });
      expect(writeText).toHaveBeenCalledWith('待复制内容');
      expect(btn).toHaveAttribute('aria-label', '已复制');
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(btn).toHaveAttribute('aria-label', '复制');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ChatMessage 修改 / 重新生成 / 分支导航', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('user 消息渲染修改按钮', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-edit-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('message-regenerate-button'),
    ).not.toBeInTheDocument();
  });

  it('assistant 消息渲染重新生成按钮', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-regenerate-button')).toBeInTheDocument();
    expect(screen.queryByTestId('message-edit-button')).not.toBeInTheDocument();
  });

  it('isEditing 时渲染编辑框与取消/发送按钮，并预填内容', () => {
    const msg = makeMessage({ role: 'user', content: '原文' });
    render(<ChatMessage message={msg} isEditing />);
    const ta = screen.getByTestId(
      'message-edit-textarea',
    ) as HTMLTextAreaElement;
    expect(ta).toBeInTheDocument();
    expect(ta.value).toBe('原文');
    expect(screen.getByTestId('message-edit-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('message-edit-send')).toBeInTheDocument();
    // 编辑态不渲染操作栏
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('branchInfo.total>1 时渲染 <N/M> 导航', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(
      <ChatMessage
        message={msg}
        branchInfo={{
          current: 2,
          total: 3,
          prevSiblingId: 's1',
          nextSiblingId: 's3',
        }}
      />,
    );
    expect(screen.getByTestId('message-branch-nav')).toBeInTheDocument();
    expect(screen.getByTestId('message-branch-position').textContent).toBe(
      '2/3',
    );
    expect(screen.getByTestId('message-branch-prev')).not.toBeDisabled();
    expect(screen.getByTestId('message-branch-next')).not.toBeDisabled();
  });

  it('branchInfo.total===1 时不渲染导航', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(
      <ChatMessage
        message={msg}
        branchInfo={{
          current: 1,
          total: 1,
          prevSiblingId: null,
          nextSiblingId: null,
        }}
      />,
    );
    expect(screen.queryByTestId('message-branch-nav')).not.toBeInTheDocument();
  });

  it('分支边界按钮禁用', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(
      <ChatMessage
        message={msg}
        branchInfo={{
          current: 1,
          total: 2,
          prevSiblingId: null,
          nextSiblingId: 's2',
        }}
      />,
    );
    expect(screen.getByTestId('message-branch-prev')).toBeDisabled();
    expect(screen.getByTestId('message-branch-next')).not.toBeDisabled();
  });
});

describe('ChatMessage 操作栏可见性（isLast / 分支导航常显）', () => {
  // 承载 copy / edit / regenerate 的操作分组容器带 transition-opacity
  const hasClass = (el: Element | null, cls: string) =>
    !!el && el.className.split(/\s+/).includes(cls);
  const getActionsGroup = (container: HTMLElement) =>
    container.querySelector('[class*="transition-opacity"]');

  it('默认（非最后、无分支）：操作分组 hover 才显示', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    const { container } = render(<ChatMessage message={msg} />);
    const group = getActionsGroup(container);
    expect(group).not.toBeNull();
    expect(hasClass(group, 'opacity-0')).toBe(true);
    expect(hasClass(group, 'opacity-100')).toBe(false);
  });

  it('有分支但非最后一条：分支导航常显，复制/编辑分组仍 hover 才显示', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    const { container } = render(
      <ChatMessage
        message={msg}
        branchInfo={{
          current: 2,
          total: 3,
          prevSiblingId: 's1',
          nextSiblingId: 's3',
        }}
      />,
    );
    const branchNav = screen.getByTestId('message-branch-nav');
    // 分支导航不再被父级 opacity 遮蔽：父容器与导航均无 opacity-0
    const actions = screen.getByTestId('message-actions');
    expect(hasClass(actions, 'opacity-0')).toBe(false);
    expect(hasClass(branchNav, 'opacity-0')).toBe(false);
    expect(hasClass(branchNav, 'pointer-events-auto')).toBe(true);

    const group = getActionsGroup(container);
    expect(hasClass(group, 'opacity-0')).toBe(true);
    expect(hasClass(group, 'opacity-100')).toBe(false);
  });

  it('最后一条用户消息（isLast）：所有操作常显', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    const { container } = render(<ChatMessage message={msg} isLast />);
    const group = getActionsGroup(container);
    expect(hasClass(group, 'opacity-100')).toBe(true);
    expect(hasClass(group, 'opacity-0')).toBe(false);
    expect(screen.getByTestId('message-copy-button')).toBeInTheDocument();
    expect(screen.getByTestId('message-edit-button')).toBeInTheDocument();
  });

  it('最后一条 AI 回复（isLast）：所有操作常显', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    const { container } = render(<ChatMessage message={msg} isLast />);
    const group = getActionsGroup(container);
    expect(hasClass(group, 'opacity-100')).toBe(true);
    expect(hasClass(group, 'opacity-0')).toBe(false);
    expect(screen.getByTestId('message-regenerate-button')).toBeInTheDocument();
  });

  it('最后一条且有分支：分支导航与操作分组均常显', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    const { container } = render(
      <ChatMessage
        message={msg}
        isLast
        branchInfo={{
          current: 1,
          total: 2,
          prevSiblingId: null,
          nextSiblingId: 's2',
        }}
      />,
    );
    const branchNav = screen.getByTestId('message-branch-nav');
    expect(hasClass(branchNav, 'opacity-0')).toBe(false);
    const group = getActionsGroup(container);
    expect(hasClass(group, 'opacity-100')).toBe(true);
    expect(hasClass(group, 'opacity-0')).toBe(false);
  });
});

describe('ChatMessage 用户消息分支导航位置', () => {
  const hasClass = (el: Element | null, cls: string) =>
    !!el && el.className.split(/\s+/).includes(cls);
  const branchInfo2 = {
    current: 1,
    total: 2,
    prevSiblingId: null,
    nextSiblingId: 's2',
  };

  it('用户消息：<1/2> 排在最右（order-last），复制/修改在其左侧', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} branchInfo={branchInfo2} />);
    const branchNav = screen.getByTestId('message-branch-nav');
    expect(hasClass(branchNav, 'order-last')).toBe(true);
  });

  it('AI 回复：<1/2> 保持在最左（不添加 order-last）', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} branchInfo={branchInfo2} />);
    const branchNav = screen.getByTestId('message-branch-nav');
    expect(hasClass(branchNav, 'order-last')).toBe(false);
  });
});
