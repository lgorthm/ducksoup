import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupApp, typeAndSend } from '../helpers/setup';
import { mockDeepSeekSSE } from '../helpers/sse-mock';
import { generateConversation, generateMessages } from '../fixtures/test-data';

const STREAM_CHUNKS = Array.from(
  { length: 16 },
  (_, i) => `流式段落${i + 1}，${'内容'.repeat(40)}。`,
);

async function seedScrollableChat(page: Page): Promise<void> {
  const conv = generateConversation({
    id: 'stick-bottom',
    title: '贴底测试',
    updatedAt: 1000,
  });
  const msgs = generateMessages('stick-bottom', 24, { contentLength: 280 });
  await setupApp(page, { conversations: [conv], messages: msgs });
  await expect(page.getByTestId('message-list')).toBeVisible({
    timeout: 10000,
  });
}

async function listScrollMetrics(page: Page) {
  return page.getByTestId('message-list').evaluate((el) => ({
    scrollTop: el.scrollTop,
    max: el.scrollHeight - el.clientHeight,
  }));
}

test.describe('流式回复贴底', () => {
  test('停在底部时跟随流式增高', async ({ page }) => {
    await seedScrollableChat(page);
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: STREAM_CHUNKS,
      chunkDelayMs: 60,
    });

    await typeAndSend(page, '继续写长文');
    await expect(page.getByTestId('stop-button')).toBeVisible({
      timeout: 10000,
    });

    await expect
      .poll(
        async () => {
          const { scrollTop, max } = await listScrollMetrics(page);
          return max > 0 && scrollTop >= max - 50;
        },
        { timeout: 8000 },
      )
      .toBe(true);

    const before = await listScrollMetrics(page);
    await expect
      .poll(
        async () => {
          const { scrollTop, max } = await listScrollMetrics(page);
          return max >= before.max && scrollTop >= max - 50;
        },
        { timeout: 3000 },
      )
      .toBe(true);
  });

  test('流式中上滑后保持阅读位置', async ({ page }) => {
    await seedScrollableChat(page);
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: STREAM_CHUNKS,
      chunkDelayMs: 60,
    });

    await typeAndSend(page, '继续写长文');
    await expect(page.getByTestId('stop-button')).toBeVisible({
      timeout: 10000,
    });
    await expect
      .poll(async () => (await listScrollMetrics(page)).max, { timeout: 8000 })
      .toBeGreaterThan(100);

    const parked = await page.getByTestId('message-list').evaluate((el) => {
      el.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -180, bubbles: true }),
      );
      const max = el.scrollHeight - el.clientHeight;
      const top = Math.min(240, Math.max(0, max - 400));
      el.scrollTop = top;
      return el.scrollTop;
    });

    await page.waitForTimeout(700);
    const after = await listScrollMetrics(page);

    expect(after.scrollTop).toBeLessThan(after.max - 80);
    expect(Math.abs(after.scrollTop - parked)).toBeLessThan(80);
  });
});
