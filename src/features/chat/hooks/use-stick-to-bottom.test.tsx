import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import type { RefObject } from 'react';
import {
  STICK_TO_BOTTOM_THRESHOLD,
  shouldAdjustScrollOnItemSizeChange,
  useStickToBottom,
  type StickVirtualizer,
} from './use-stick-to-bottom';

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
        el.dispatchEvent(new Event('scroll'));
      },
      configurable: true,
    },
  });
  return { el, metrics };
}

interface ObserverStub {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const observers: ObserverStub[] = [];
const OriginalResizeObserver = window.ResizeObserver;

function Harness({
  scrollRef,
  virtualizerRef,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  virtualizerRef: RefObject<StickVirtualizer | null>;
}) {
  const stick = useStickToBottom(scrollRef, virtualizerRef);
  return (
    <div>
      <span data-testid="stuck">{String(stick.stuck)}</span>
      <button type="button" onClick={stick.reStick}>
        restick
      </button>
    </div>
  );
}

function renderStick(
  el: HTMLElement,
  virtualizer: StickVirtualizer = {
    options: { scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD, count: 0 },
    range: null,
  },
) {
  const scrollRef: RefObject<HTMLElement | null> = { current: el };
  const virtualizerRef: RefObject<typeof virtualizer | null> = {
    current: virtualizer,
  };
  const view = render(
    <Harness scrollRef={scrollRef} virtualizerRef={virtualizerRef} />,
  );
  return { ...view, virtualizer, virtualizerRef };
}

beforeEach(() => {
  observers.length = 0;
  window.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      observers.push({
        callback,
        observe: this.observe,
        disconnect: this.disconnect,
      });
    }
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  window.ResizeObserver = OriginalResizeObserver;
});

describe('shouldAdjustScrollOnItemSizeChange', () => {
  const instance = {
    options: { count: 4 },
    scrollOffset: 400,
    scrollDirection: null as 'forward' | 'backward' | null,
  };

  it('贴底时不补偿，交给 wasAtEnd', () => {
    expect(
      shouldAdjustScrollOnItemSizeChange(
        true,
        { index: 1, start: 0 },
        instance,
      ),
    ).toBe(false);
  });

  it('取消贴底后最后一项增高不补偿', () => {
    expect(
      shouldAdjustScrollOnItemSizeChange(
        false,
        { index: 3, start: 100 },
        instance,
      ),
    ).toBe(false);
  });

  it('取消贴底后视口上方的更早条目仍补偿', () => {
    expect(
      shouldAdjustScrollOnItemSizeChange(
        false,
        { index: 1, start: 50 },
        instance,
      ),
    ).toBe(true);
  });

  it('取消贴底后视口内/下方的条目不补偿', () => {
    expect(
      shouldAdjustScrollOnItemSizeChange(
        false,
        { index: 1, start: 400 },
        instance,
      ),
    ).toBe(false);
  });

  it('向上滚动时不补偿，避免和手势抢位置', () => {
    expect(
      shouldAdjustScrollOnItemSizeChange(
        false,
        { index: 1, start: 50 },
        { ...instance, scrollDirection: 'backward' },
      ),
    ).toBe(false);
  });
});

describe('useStickToBottom', () => {
  it('默认贴底', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);
    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
  });

  it('向上滚轮立即取消贴底，并同步 virtualizer 阈值为 0', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const { virtualizer } = renderStick(el);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
    expect(virtualizer.options.scrollEndThreshold).toBe(0);
  });

  it('scrollTop 减小且未在底部时取消贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      metrics.scrollTop = 200;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
  });

  it('滚回底部后重新贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const { virtualizer } = renderStick(el);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });
    expect(screen.getByTestId('stuck')).toHaveTextContent('false');

    act(() => {
      metrics.scrollTop = 1500;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
    expect(virtualizer.options.scrollEndThreshold).toBe(
      STICK_TO_BOTTOM_THRESHOLD,
    );
  });

  it('小幅上滑后距底仍小于 50px 不会立刻重新贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 }));
      metrics.scrollTop = 1480;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
  });

  it('已在底部时钉底不会吞掉随后的用户上滑', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      observers[0]?.callback(
        [] as unknown as ResizeObserverEntry[],
        observers[0] as unknown as ResizeObserver,
      );
    });
    expect(screen.getByTestId('stuck')).toHaveTextContent('true');

    act(() => {
      metrics.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
  });

  it('程序性钉底的 scroll 事件不会取消贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      observers[0]?.callback(
        [] as unknown as ResizeObserverEntry[],
        observers[0] as unknown as ResizeObserver,
      );
    });

    expect(metrics.scrollTop).toBe(1500);
    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
  });

  it('取消贴底后视口缩放不再钉底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 200,
    });
    renderStick(el);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });

    act(() => {
      metrics.scrollHeight = 2400;
      observers[0]?.callback(
        [] as unknown as ResizeObserverEntry[],
        observers[0] as unknown as ResizeObserver,
      );
    });

    expect(metrics.scrollTop).toBe(200);
    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
  });

  it('同时观察视口和内部内容容器', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const inner = document.createElement('div');
    el.appendChild(inner);
    renderStick(el);

    expect(observers[0]?.observe).toHaveBeenCalledTimes(2);
    expect(observers[0]?.observe).toHaveBeenCalledWith(el);
    expect(observers[0]?.observe).toHaveBeenCalledWith(inner);
  });

  it('贴底时内容变高会钉到底部', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      metrics.scrollHeight = 2400;
      observers[0]?.callback(
        [] as unknown as ResizeObserverEntry[],
        observers[0] as unknown as ResizeObserver,
      );
    });

    expect(metrics.scrollTop).toBe(1900);
    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
  });

  it('估算高度触底但最后一项未进入视口时不重新贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 800,
      clientHeight: 500,
      scrollTop: 0,
    });
    const virtualizer: StickVirtualizer = {
      options: { scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD, count: 10 },
      range: { startIndex: 0, endIndex: 3 },
    };
    renderStick(el, virtualizer);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });
    expect(screen.getByTestId('stuck')).toHaveTextContent('false');

    act(() => {
      metrics.scrollTop = 300;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
    expect(virtualizer.options.scrollEndThreshold).toBe(0);
  });

  it('最后一项已在视口且滚到 DOM 底部时重新贴底', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 200,
    });
    const virtualizer: StickVirtualizer = {
      options: { scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD, count: 10 },
      range: { startIndex: 0, endIndex: 3 },
    };
    renderStick(el, virtualizer);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });

    act(() => {
      virtualizer.range = { startIndex: 8, endIndex: 9 };
      metrics.scrollTop = 1500;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
    expect(virtualizer.options.scrollEndThreshold).toBe(
      STICK_TO_BOTTOM_THRESHOLD,
    );
  });

  it('reStick 重新贴底并钉到 DOM 底部', () => {
    const { el, metrics } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 200,
    });
    const { virtualizer } = renderStick(el);

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });
    expect(screen.getByTestId('stuck')).toHaveTextContent('false');

    act(() => {
      screen.getByRole('button', { name: 'restick' }).click();
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('true');
    expect(metrics.scrollTop).toBe(1500);
    expect(virtualizer.options.scrollEndThreshold).toBe(
      STICK_TO_BOTTOM_THRESHOLD,
    );
  });

  it('手指下拉取消贴底', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    renderStick(el);

    act(() => {
      el.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [{ clientY: 80 } as Touch],
        }),
      );
      el.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [{ clientY: 140 } as Touch],
        }),
      );
    });

    expect(screen.getByTestId('stuck')).toHaveTextContent('false');
  });

  it('无滚动元素时不抛错', () => {
    const scrollRef = { current: null };
    const virtualizerRef = { current: null };
    expect(() =>
      renderHook(() => useStickToBottom(scrollRef, virtualizerRef)),
    ).not.toThrow();
  });
});

describe('useStickToBottom ref 同步', () => {
  it('stuckRef 与 stuck 同步', () => {
    const { el } = createScrollContainer({
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 1500,
    });
    const scrollRef: RefObject<HTMLElement | null> = { current: el };
    const virtualizerRef = {
      current: {
        options: { scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD, count: 0 },
        range: null,
      },
    };

    function ReadRef() {
      const stick = useStickToBottom(scrollRef, virtualizerRef);
      const latest = useRef(stick.stuckRef);
      latest.current = stick.stuckRef;
      return <span data-testid="ref">{String(stick.stuckRef.current)}</span>;
    }

    render(<ReadRef />);
    expect(screen.getByTestId('ref')).toHaveTextContent('true');

    act(() => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    });
    expect(screen.getByTestId('ref')).toHaveTextContent('false');
  });
});
