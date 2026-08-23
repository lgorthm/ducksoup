import { test, expect } from '@playwright/test';
import { setupApp, typeAndSend } from '../helpers/setup';
import {
  mockDeepSeekSSE,
  mockDeepSeekPrefixSSE,
  mockDeepSeekError,
  mockDeepSeekNetworkError,
} from '../helpers/sse-mock';
import { getIndexedDBData } from '../fixtures/db-seed';

test.describe('聊天流程', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
  });

  test('发送消息并收到流式回复', async ({ page }) => {
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: ['你好！', '我是', 'DeepSeek'],
    });

    await typeAndSend(page, '你好');

    // 等待流式回复完成，出现 2 条消息（用户 + 助手）
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.getByTestId('message-item').first()).toContainText(
      '你好',
    );

    // MarkdownRenderer 是懒加载，需要更长超时等待内容渲染
    await expect(page.getByTestId('message-item').nth(1)).toContainText(
      '你好！我是DeepSeek',
      { timeout: 15000 },
    );
  });

  test('深度思考模式显示思考过程', async ({ page }) => {
    // 第一条消息：不带深度思考（从 ChatWelcome 发送，ChatWelcome 不传递 deepThink）
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: ['第一条回复'],
    });
    await typeAndSend(page, '第一条消息');
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });

    // 等待流式完成（发送按钮重新出现）
    await expect(page.getByTestId('send-button')).toBeVisible({
      timeout: 10000,
    });

    // 第二条消息：带深度思考（此时已在 ChatArea，正确传递 deepThink）
    await mockDeepSeekSSE(page, {
      thinking: ['首先分析问题', '然后寻找答案'],
      content: ['最终答案'],
    });

    // 启用深度思考
    await page.getByTestId('deep-think-button').click();

    await typeAndSend(page, '复杂问题');

    // 等待第 3、4 条消息出现
    await expect(page.getByTestId('message-item')).toHaveCount(4, {
      timeout: 10000,
    });

    // 验证思考过程区域出现在最后一条消息中
    await expect(page.getByText(/思考过程/)).toBeVisible({
      timeout: 5000,
    });
  });

  test('网页搜索模式显示搜索过程与来源', async ({ page }) => {
    await mockDeepSeekSSE(page, {
      thinking: [],
      webSearch: [
        {
          id: 'ws_1',
          action: {
            type: 'search',
            query: '今日新闻',
            sources: [{ type: 'url', url: 'https://example.com/news' }],
          },
        },
      ],
      citations: [
        {
          url: 'https://example.com/news',
          title: 'Example News',
        },
      ],
      content: ['根据搜索结果，今天的要闻如下。'],
    });

    await page.getByTestId('web-search-button').click();
    await typeAndSend(page, '今天有什么新闻');

    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.getByTestId('thinking-label')).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId('thinking-label').click();
    await expect(page.getByTestId('thinking-search-row')).toContainText(
      '搜索到 1 个网页',
    );
    const source = page.getByTestId('web-search-source');
    await expect(source).toHaveAttribute('href', 'https://example.com/news');
  });

  test('流式传输中显示停止按钮', async ({ page }) => {
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: ['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5'],
      delayMs: 300,
    });

    await typeAndSend(page, '测试中止');

    // 停止按钮出现
    await expect(page.getByTestId('stop-button')).toBeVisible({
      timeout: 5000,
    });

    // 点击停止
    await page.getByTestId('stop-button').click();

    // 等待一段时间确保没有更多内容更新
    const content1 = await page
      .getByTestId('message-item')
      .nth(1)
      .textContent();
    await page.waitForTimeout(1000);
    const content2 = await page
      .getByTestId('message-item')
      .nth(1)
      .textContent();

    // 内容不再变化（中止后冻结）
    expect(content2).toBe(content1);
  });

  test('思考阶段停止后显示已停止，继续生成在同一条消息上续写', async ({
    page,
  }) => {
    await mockDeepSeekSSE(page, {
      thinking: ['首先分析', '然后推导', '最后总结'],
      content: [],
      delayMs: 400,
    });

    await typeAndSend(page, '复杂问题');

    await expect(page.getByTestId('thinking-label')).toHaveText('思考中...', {
      timeout: 10000,
    });
    await expect(page.getByText('首先分析')).toBeVisible();
    await page.getByTestId('stop-button').click();

    await expect(page.getByTestId('thinking-label')).toHaveText('已停止', {
      timeout: 5000,
    });
    await expect(page.getByTestId('message-continue-button')).toBeVisible();
    await expect(page.getByTestId('message-item')).toHaveCount(2);

    await mockDeepSeekPrefixSSE(page, {
      thinking: ['继续推理'],
      content: ['续写答案'],
    });
    await page.getByTestId('message-continue-button').click();

    await expect(page.getByTestId('message-item').nth(1)).toContainText(
      '续写答案',
      { timeout: 15000 },
    );
    await expect(page.getByTestId('message-item')).toHaveCount(2);
    await expect(page.getByTestId('message-continue-button')).toHaveCount(0);
    await expect(page.getByTestId('thinking-label')).toHaveText('思考过程');
  });

  test('回复阶段停止后思考标题不变，继续生成追加正文', async ({ page }) => {
    await mockDeepSeekSSE(page, {
      thinking: ['分析完毕'],
      content: ['第一段', '第二段', '第三段', '第四段'],
      delayMs: 300,
    });

    await typeAndSend(page, '写一篇长文');

    await expect(page.getByTestId('message-item').nth(1)).toContainText(
      '第一段',
      { timeout: 15000 },
    );
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await page.getByTestId('stop-button').click();

    await expect(page.getByTestId('message-continue-button')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId('thinking-label')).toHaveText('思考过程');

    await mockDeepSeekPrefixSSE(page, {
      thinking: [],
      content: ['后续段落'],
    });
    await page.getByTestId('message-continue-button').click();

    await expect(page.getByTestId('message-item').nth(1)).toContainText(
      '后续段落',
      { timeout: 15000 },
    );
    await expect(page.getByTestId('message-item')).toHaveCount(2);
    await expect(page.getByTestId('message-continue-button')).toHaveCount(0);
  });

  test('API 401 错误显示错误信息', async ({ page }) => {
    await mockDeepSeekError(page, 401, 'Invalid API key');

    await typeAndSend(page, '触发错误');

    // 错误信息出现
    await expect(page.getByTestId('error-message')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('error-message')).toContainText('401');
  });

  test('网络错误显示错误信息', async ({ page }) => {
    await mockDeepSeekNetworkError(page);

    await typeAndSend(page, '触发网络错误');

    await expect(page.getByTestId('error-message')).toBeVisible({
      timeout: 10000,
    });
  });

  test('消息持久化到 IndexedDB', async ({ page }) => {
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: ['回复内容'],
    });

    await typeAndSend(page, '持久化测试');

    // 等待回复完成
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });

    // 轮询等待 IndexedDB 写入完成（store 中 db.addMessage 是异步未 await）
    await expect
      .poll(
        async () => {
          const data = await getIndexedDBData(page);
          return data.messages.some((m) => m.content === '回复内容');
        },
        { timeout: 10000, intervals: [500, 1000, 2000] },
      )
      .toBeTruthy();

    const data = await getIndexedDBData(page);
    expect(data.messages.some((m) => m.content === '持久化测试')).toBeTruthy();
  });
});
