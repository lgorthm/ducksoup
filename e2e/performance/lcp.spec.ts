import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { generateConversation, generateMessages } from '../fixtures/test-data';

declare global {
  interface Window {
    __lcp?: {
      time: number;
      size: number;
      tag: string;
      className: string;
    } | null;
  }
}

/**
 * 首屏 LCP 测量：预置带历史消息的会话，通过 PerformanceObserver
 * 记录 largest-contentful-paint。用于验证消息加载链路（IDB → 渲染
 * → markdown）的首屏绘制耗时，防止懒加载瀑布等回归。
 */
test.describe('首屏 LCP（带历史消息）', () => {
  test.beforeEach(async ({ page }) => {
    // 与 large-dataset.spec.ts 一致：桌面端专用
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端交互模式不同，跳过桌面端 LCP 基准',
    );
    test.setTimeout(60000);

    // 在每次导航（含 reload）前注入 LCP 观察器
    await page.addInitScript(() => {
      window.__lcp = null;
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1) as
          | LargestContentfulPaint
          | undefined;
        if (last) {
          window.__lcp = {
            time: last.startTime,
            size: last.size,
            tag: last.element?.tagName ?? '',
            className: String(last.element?.className ?? ''),
          };
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
  });

  test('加载带历史消息的会话: LCP < 3000ms', async ({ page }) => {
    const conv = generateConversation({
      id: 'lcp-conv',
      title: 'LCP 会话',
      messageCount: 50,
    });
    // 末尾一条长 assistant 消息，作为预期的 LCP 元素
    const messages = generateMessages('lcp-conv', 50, { contentLength: 2000 });

    await setupApp(page, { conversations: [conv], messages });

    // 消息渲染完成后，等待 LCP 条目出现并稍作稳定
    await expect(page.getByTestId('message-item').first()).toBeVisible({
      timeout: 10000,
    });
    await page.waitForFunction(() => window.__lcp != null, null, {
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    const lcp = await page.evaluate(() => window.__lcp);
    expect(lcp).not.toBeNull();
    console.log(
      `LCP: ${lcp!.time.toFixed(0)}ms, size=${lcp!.size}, ` +
        `element=<${lcp!.tag.toLowerCase()}> class="${lcp!.className}"`,
    );
    // 宽松阈值：主要作用是记录数值供前后对比，并拦截严重回归
    expect(lcp!.time).toBeLessThan(3000);
  });
});
