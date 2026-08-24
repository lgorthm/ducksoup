import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import { ChatScrollToBottom } from './chat-scroll-to-bottom';
import type { ChatListController } from '@/features/chat/hooks/use-chat-list-controller';
import { useStore } from '@/stores';

interface ScrollMetrics {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

function createScrollContainer(init: ScrollMetrics) {
  const el = document.createElement('div');
  const metrics = { ...init };
  Object.defineProperties(el, {
    scrollHeight: {
      get: () => metrics.scrollHeight,
      configurable: true,
    },
    clientHeight: {
      get: () => metrics.clientHeight,
      configurable: true,
    },
    scrollTop: {
      get: () => metrics.scrollTop,
      set: (value: number) => {
        metrics.scrollTop = value;
      },
      configurable: true,
    },
  });
  return { el, metrics };
}

function createController(
  el: HTMLDivElement,
  scrollToEnd = vi.fn(),
): {
  controllerRef: RefObject<ChatListController | null>;
  scrollToEnd: ReturnType<typeof vi.fn>;
} {
  return {
    controllerRef: {
      current: {
        scrollContainer: el,
        scrollToIndex: vi.fn(),
        scrollToEnd,
        getItemOffset: vi.fn(),
      },
    },
    scrollToEnd,
  };
}

async function flushScrollFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

beforeEach(() => {
  useStore.setState({
    isLoading: false,
    streamingMessageId: null,
    error: null,
  });
});

describe('ChatScrollToBottom', () => {
  it('贴底时不渲染', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });

  it('内容不足以溢出时不渲染', () => {
    const { el } = createScrollContainer({
      scrollHeight: 500,
      clientHeight: 500,
      scrollTop: 0,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });

  it('距底超过阈值时显示回到底部按钮', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    const button = screen.getByTestId('scroll-to-bottom');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAccessibleName('回到底部');
  });

  it('距底恰好 50px 时仍视为贴底', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1450,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });

  it('上滚后显示，滚回底部后隐藏', async () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);
    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();

    metrics.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
    await flushScrollFrame();
    expect(screen.getByTestId('scroll-to-bottom')).toBeInTheDocument();

    metrics.scrollTop = 1500;
    el.dispatchEvent(new Event('scroll'));
    await flushScrollFrame();
    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });

  it('点击后调用 scrollToEnd 并立即隐藏', async () => {
    const user = userEvent.setup();
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
    });
    const { controllerRef, scrollToEnd } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);
    await user.click(screen.getByTestId('scroll-to-bottom'));

    expect(scrollToEnd).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });

  it('流式且未贴底时显示未读圆点', () => {
    useStore.setState({ streamingMessageId: 's1' });
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(screen.getByTestId('scroll-to-bottom-unread')).toBeInTheDocument();
  });

  it('非流式时不显示未读圆点', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
    });
    const { controllerRef } = createController(el);

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(
      screen.queryByTestId('scroll-to-bottom-unread'),
    ).not.toBeInTheDocument();
  });

  it('控制器尚未就绪时不渲染', () => {
    const controllerRef: RefObject<ChatListController | null> = {
      current: null,
    };

    render(<ChatScrollToBottom controllerRef={controllerRef} />);

    expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
  });
});
