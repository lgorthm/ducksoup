import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { generateConversation, generateMessages } from '../fixtures/test-data';

async function scrollAndSettle(page: Page, top: number) {
  await page.getByTestId('message-list').evaluate((el, t) => {
    el.scrollTo({ top: t });
  }, top);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function seedLongConversation(page: Page) {
  const conv = generateConversation({
    id: 'scroll-bottom',
    title: '长会话',
    updatedAt: 1000,
  });
  const msgs = generateMessages('scroll-bottom', 40, { contentLength: 300 });
  await setupApp(page, { conversations: [conv], messages: msgs });
  await expect(page.getByTestId('message-list')).toBeVisible({
    timeout: 10000,
  });
}

test.describe('回到底部按钮', () => {
  test('贴底时隐藏，上翻后出现，点击回到底部', async ({ page }) => {
    await seedLongConversation(page);

    const button = page.getByTestId('scroll-to-bottom');
    await expect(button).toHaveCount(0);

    await scrollAndSettle(page, 0);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', '回到底部');

    await button.click();
    await expect(button).toHaveCount(0);

    const atBottom = await page.getByTestId('message-list').evaluate((el) => {
      const max = el.scrollHeight - el.clientHeight;
      return el.scrollTop >= max - 50;
    });
    expect(atBottom).toBe(true);
  });
});
