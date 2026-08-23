import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { MessageNode } from '@/stores/models';
import { useStore } from '@/stores';
import { ChatMessage } from './chat-message';

const markdownRender = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="markdown-renderer">{children}</div>
));

vi.mock('@/shared/components/markdown-renderer', () => ({
  MarkdownRenderer: (props: { children: React.ReactNode }) =>
    markdownRender(props),
}));

function makeMessage(overrides: Partial<MessageNode> = {}): MessageNode {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '测试内容',
    status: 'done',
    createdAt: Date.now(),
    ...overrides,
  };
}

const hasClass = (el: Element | null, cls: string) =>
  !!el && el.className.split(/\s+/).includes(cls);
// 承载 copy / edit / regenerate 的操作分组容器带 transition-opacity
const getActionsGroup = (container: HTMLElement) =>
  container.querySelector('[class*="transition-opacity"]');

describe('ChatMessage', () => {
  it('user 消息渲染纯文本内容', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-renderer')).not.toBeInTheDocument();
  });

  it('附件渲染在用户气泡上方而非气泡内', () => {
    const msg = makeMessage({
      role: 'user',
      content: '看图',
      attachments: [
        {
          id: 'a1',
          mime: 'image/png',
          width: 10,
          height: 10,
          byteLength: 8,
          blobKey: 'b1',
          filename: 'a.png',
        },
      ],
    });
    render(<ChatMessage message={msg} />);
    const images = screen.getByTestId('message-images');
    const text = screen.getByText('看图');
    expect(
      images.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    const bubble = text.closest('[class*="bg-primary"]');
    expect(bubble?.contains(images)).toBe(false);
  });

  it('纯图消息不渲染文字气泡', () => {
    const msg = makeMessage({
      role: 'user',
      content: '',
      attachments: [
        {
          id: 'a1',
          mime: 'image/png',
          width: 10,
          height: 10,
          byteLength: 8,
          blobKey: 'b1',
          filename: 'a.png',
        },
      ],
    });
    const { container } = render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-images')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-primary"]')).toBeNull();
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

  it('branchInfo 仅引用变化时不重渲染 Markdown', async () => {
    markdownRender.mockClear();
    const msg = makeMessage({
      role: 'assistant',
      content: '# 标题',
    });
    const { rerender } = render(
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
    await screen.findByTestId('markdown-renderer');
    const afterFirst = markdownRender.mock.calls.length;

    rerender(
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
    expect(markdownRender.mock.calls.length).toBe(afterFirst);
  });

  it('branchInfo 数值变化时重新渲染 Markdown', async () => {
    markdownRender.mockClear();
    const msg = makeMessage({
      role: 'assistant',
      content: '# 标题',
    });
    const { rerender } = render(
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
    await screen.findByTestId('markdown-renderer');
    const afterFirst = markdownRender.mock.calls.length;

    rerender(
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
    expect(markdownRender.mock.calls.length).toBeGreaterThan(afterFirst);
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

  it('流式且有推理内容时展开思考过程，不显示回复占位符', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '思考',
    });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.getByText('思考中...')).toBeInTheDocument();
    expect(screen.getByText('思考')).toBeInTheDocument();
    const replyCursor = [...document.querySelectorAll('.animate-pulse')].find(
      (el) => el.textContent === '▊' && !el.className.includes('text-xs'),
    );
    expect(replyCursor).toBeUndefined();
  });

  it('思考中点击可折叠思考过程', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '推理内容',
    });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.getByText('推理内容')).toBeInTheDocument();
    fireEvent.click(screen.getByText('思考中...'));
    expect(screen.queryByText('推理内容')).not.toBeInTheDocument();
  });

  it('思考阶段被中止时标题为已停止并默认展开', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '半截思路',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('已停止');
    expect(screen.getByText('半截思路')).toBeInTheDocument();
    const thinkingCursor = [
      ...document.querySelectorAll('.animate-pulse'),
    ].find((el) => el.textContent === '▊');
    expect(thinkingCursor).toBeUndefined();
  });

  it('回复阶段被中止时思考标题仍为思考过程', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '半句',
      reasoningContent: '完整思路',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('思考过程');
  });

  it('流式推理结束后思考过程自动折叠并显示正文', async () => {
    const thinkingMsg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '推理内容',
    });
    const { rerender } = render(
      <ChatMessage message={thinkingMsg} isStreaming />,
    );
    expect(screen.getByText('推理内容')).toBeInTheDocument();

    const replyMsg = { ...thinkingMsg, content: '最终答案' };
    rerender(<ChatMessage message={replyMsg} isStreaming />);
    expect(screen.getByText('思考过程')).toBeInTheDocument();
    expect(screen.queryByText('推理内容')).not.toBeInTheDocument();
    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toBeInTheDocument();
    expect(screen.getByText('最终答案')).toBeInTheDocument();
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

describe('ChatMessage 操作栏可见性（isLast / 分支常显）', () => {
  it('默认（非最后、无分支）：操作分组 hover 才显示', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    const { container } = render(<ChatMessage message={msg} />);
    const group = getActionsGroup(container);
    expect(group).not.toBeNull();
    expect(hasClass(group, 'opacity-0')).toBe(true);
    expect(hasClass(group, 'opacity-100')).toBe(false);
  });

  it('有分支但非最后一条：分支导航与操作分组均常显', () => {
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
    expect(hasClass(group, 'opacity-100')).toBe(true);
    expect(hasClass(group, 'opacity-0')).toBe(false);
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

  it('中止的最后一条 assistant 在重新生成右侧显示继续生成', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '半句',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} isLast />);
    const continueBtn = screen.getByTestId('message-continue-button');
    const regen = screen.getByTestId('message-regenerate-button');
    expect(
      regen.compareDocumentPosition(continueBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('完成的 assistant 不显示继续生成', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '回复',
      status: 'done',
    });
    render(<ChatMessage message={msg} isLast />);
    expect(
      screen.queryByTestId('message-continue-button'),
    ).not.toBeInTheDocument();
  });

  it('非最后一条的中止消息不显示继续生成', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '半句',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} />);
    expect(
      screen.queryByTestId('message-continue-button'),
    ).not.toBeInTheDocument();
  });

  it('user 消息不显示继续生成', () => {
    const msg = makeMessage({
      role: 'user',
      content: '你好',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} isLast />);
    expect(
      screen.queryByTestId('message-continue-button'),
    ).not.toBeInTheDocument();
  });

  it('流式中不显示继续生成', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '半句',
      status: 'aborted',
    });
    render(<ChatMessage message={msg} isStreaming isLast />);
    expect(
      screen.queryByTestId('message-continue-button'),
    ).not.toBeInTheDocument();
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

describe('ChatMessage 移动端点击激活操作栏', () => {
  // 全局 matchMedia mock 对所有 query 返回 matches:false，
  // 即默认模拟不可 hover 的移动端环境。
  beforeEach(() => {
    useStore.setState({ activeMessageId: null });
  });

  it('点击气泡激活操作栏，再次点击取消激活', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    const { container } = render(<ChatMessage message={msg} />);
    const group = getActionsGroup(container);
    expect(hasClass(group, 'opacity-0')).toBe(true);

    fireEvent.click(screen.getByText('你好'));
    expect(useStore.getState().activeMessageId).toBe(msg.id);
    expect(hasClass(group, 'opacity-100')).toBe(true);
    expect(hasClass(group, 'pointer-events-auto')).toBe(true);

    fireEvent.click(screen.getByText('你好'));
    expect(useStore.getState().activeMessageId).toBeNull();
    expect(hasClass(group, 'opacity-0')).toBe(true);
  });

  it('点击另一条消息时，上一条消息的激活态隐藏', () => {
    const msgA = makeMessage({ role: 'user', content: '消息A' });
    const msgB = makeMessage({ role: 'assistant', content: '消息B' });
    render(
      <div>
        <div data-testid="wrap-a">
          <ChatMessage message={msgA} />
        </div>
        <div data-testid="wrap-b">
          <ChatMessage message={msgB} />
        </div>
      </div>,
    );
    const groupA = screen
      .getByTestId('wrap-a')
      .querySelector('[class*="transition-opacity"]');
    const groupB = screen
      .getByTestId('wrap-b')
      .querySelector('[class*="transition-opacity"]');

    fireEvent.click(screen.getByText('消息A'));
    expect(hasClass(groupA, 'opacity-100')).toBe(true);
    expect(hasClass(groupB, 'opacity-0')).toBe(true);

    fireEvent.click(screen.getByText('消息B'));
    expect(useStore.getState().activeMessageId).toBe(msgB.id);
    expect(hasClass(groupA, 'opacity-0')).toBe(true);
    expect(hasClass(groupB, 'opacity-100')).toBe(true);
  });

  it('激活其他消息后，isLast 与有分支的消息仍常显', () => {
    const lastMsg = makeMessage({ role: 'assistant', content: '最后回复' });
    const branchMsg = makeMessage({ role: 'assistant', content: '分支回复' });
    const otherMsg = makeMessage({ role: 'user', content: '普通消息' });
    render(
      <div>
        <div data-testid="wrap-last">
          <ChatMessage message={lastMsg} isLast />
        </div>
        <div data-testid="wrap-branch">
          <ChatMessage
            message={branchMsg}
            branchInfo={{
              current: 1,
              total: 2,
              prevSiblingId: null,
              nextSiblingId: 's2',
            }}
          />
        </div>
        <div data-testid="wrap-other">
          <ChatMessage message={otherMsg} />
        </div>
      </div>,
    );

    fireEvent.click(screen.getByText('普通消息'));

    const groupLast = screen
      .getByTestId('wrap-last')
      .querySelector('[class*="transition-opacity"]');
    const groupBranch = screen
      .getByTestId('wrap-branch')
      .querySelector('[class*="transition-opacity"]');
    expect(hasClass(groupLast, 'opacity-100')).toBe(true);
    expect(hasClass(groupBranch, 'opacity-100')).toBe(true);
  });

  it('流式消息点击不激活', () => {
    const msg = makeMessage({ role: 'assistant', content: '部分内容' });
    render(<ChatMessage message={msg} isStreaming />);
    fireEvent.click(screen.getByText('部分内容'));
    expect(useStore.getState().activeMessageId).toBeNull();
  });

  it('可 hover 设备（桌面端）点击气泡不激活操作栏', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: hover)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      const msg = makeMessage({ role: 'user', content: '你好' });
      const { container } = render(<ChatMessage message={msg} />);
      fireEvent.click(screen.getByText('你好'));
      expect(useStore.getState().activeMessageId).toBeNull();
      const group = getActionsGroup(container);
      expect(hasClass(group, 'opacity-0')).toBe(true);
      expect(hasClass(group, 'group-hover:opacity-100')).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
