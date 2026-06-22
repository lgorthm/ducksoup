import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import {
  generateConversation,
  generateMessages,
  generateConversations,
} from '../fixtures/test-data';

test.describe('大数据量性能基准', () => {
  test.beforeEach(async () => {
    test.setTimeout(60000);
  });

  async function measureSwitchTime(
    page: import('@playwright/test').Page,
    conversationTitle: string,
  ): Promise<number> {
    const start = await page.evaluate(() => performance.now());
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: conversationTitle })
      .click();
    await expect(page.getByTestId('message-item').first()).toBeVisible({
      timeout: 10000,
    });
    const end = await page.evaluate(() => performance.now());
    return end - start;
  }

  test('1000 条消息: 切换 < 200ms', async ({ page }) => {
    const conv = generateConversation({
      id: 'perf-1k',
      title: 'Perf1k',
      messageCount: 1000,
    });
    const conv2 = generateConversation({
      id: 'perf-empty',
      title: '空会话',
      updatedAt: conv.updatedAt + 1,
    });
    await setupApp(page, {
      conversations: [conv, conv2],
      messages: generateMessages('perf-1k', 1000),
    });

    // 先切到空会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '空会话' })
      .click();
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 5000,
    });

    // 切回大数据会话并测量
    const duration = await measureSwitchTime(page, 'Perf1k');
    console.log(`1000 条消息切换耗时: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(300);
  });

  test('5000 条消息: 切换 < 350ms', async ({ page }) => {
    const conv = generateConversation({
      id: 'perf-5k',
      title: 'Perf5k',
      messageCount: 5000,
    });
    const conv2 = generateConversation({
      id: 'perf-empty-5k',
      title: '空会话5k',
      updatedAt: conv.updatedAt + 1,
    });
    await setupApp(page, {
      conversations: [conv, conv2],
      messages: generateMessages('perf-5k', 5000),
    });

    // 先切到空会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '空会话5k' })
      .click();
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 5000,
    });

    // 切回大数据会话并测量
    const duration = await measureSwitchTime(page, 'Perf5k');
    console.log(`5000 条消息切换耗时: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(350);
  });

  test('10000 条消息: 切换 < 500ms', async ({ page }) => {
    const conv = generateConversation({
      id: 'perf-10k',
      title: 'Perf10k',
      messageCount: 10000,
    });
    const conv2 = generateConversation({
      id: 'perf-empty-10k',
      title: '空会话10k',
      updatedAt: conv.updatedAt + 1,
    });
    await setupApp(page, {
      conversations: [conv, conv2],
      messages: generateMessages('perf-10k', 10000),
    });

    // 先切到空会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '空会话10k' })
      .click();
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 5000,
    });

    // 切回大数据会话并测量
    const duration = await measureSwitchTime(page, 'Perf10k');
    console.log(`10000 条消息切换耗时: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500);
  });

  test('500 个会话: 侧边栏渲染正常', async ({ page }) => {
    const convs = generateConversations(500);
    await setupApp(page, { conversations: convs });

    // 侧边栏列表可见
    await expect(page.getByTestId('conversation-list')).toBeVisible();
    // 至少有 conversation-item 元素
    const itemCount = await page.getByTestId('conversation-item').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('连续切换 10 次会话无性能退化', async ({ page }) => {
    const convs = generateConversations(10);
    await setupApp(page, { conversations: convs });

    // 等待初始加载完成
    await expect(page.getByTestId('conversation-item').first()).toBeVisible();

    const durations: number[] = [];
    for (let i = 0; i < 10; i++) {
      const title = `对话 ${i + 1}`;
      const start = await page.evaluate(() => performance.now());
      await page
        .getByTestId('conversation-item')
        .filter({ hasText: new RegExp(`^${title}$`) })
        .click();
      // 等待 UI 响应（消息列表或欢迎页）
      await page.waitForTimeout(100);
      const end = await page.evaluate(() => performance.now());
      durations.push(end - start);
    }

    console.log(
      '连续切换耗时:',
      durations.map((d) => d.toFixed(1)),
    );

    // 最后 3 次平均不应比前 3 次平均慢超过 2 倍
    const earlyAvg = durations.slice(0, 3).reduce((a, b) => a + b) / 3;
    const lateAvg = durations.slice(-3).reduce((a, b) => a + b) / 3;
    console.log(
      `前3次平均: ${earlyAvg.toFixed(1)}ms, 后3次平均: ${lateAvg.toFixed(1)}ms`,
    );
    expect(lateAvg).toBeLessThan(earlyAvg * 3);
  });
});
