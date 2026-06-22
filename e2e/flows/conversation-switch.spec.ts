import { test, expect } from '@playwright/test';
import { setupApp, openSidebarIfNeeded } from '../helpers/setup';
import { getIndexedDBData } from '../fixtures/db-seed';
import { generateConversation, generateMessages } from '../fixtures/test-data';

test.describe('会话切换', () => {
  test.beforeEach(async ({ page }) => {
    const conv1 = generateConversation({
      id: 'c1',
      title: '第一个会话',
      updatedAt: 1000,
    });
    const conv2 = generateConversation({
      id: 'c2',
      title: '第二个会话',
      updatedAt: 2000,
    });
    const msgs1 = generateMessages('c1', 4);
    const msgs2 = generateMessages('c2', 2);

    await setupApp(page, {
      conversations: [conv1, conv2],
      messages: [...msgs1, ...msgs2],
    });
  });

  test('切换会话时消息正确加载', async ({ page }) => {
    await openSidebarIfNeeded(page);

    // 初始状态：第二个会话是当前会话（updatedAt 更大）
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });

    // 点击第一个会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '第一个会话' })
      .click();

    // 消息数量应变为 4
    await expect(page.getByTestId('message-item')).toHaveCount(4, {
      timeout: 10000,
    });
  });

  test('切换会话后消息内容正确', async ({ page }) => {
    await openSidebarIfNeeded(page);

    // 切换到第一个会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '第一个会话' })
      .click();

    await expect(page.getByTestId('message-item')).toHaveCount(4, {
      timeout: 10000,
    });

    // 切换回第二个会话
    await page
      .getByTestId('conversation-item')
      .filter({ hasText: '第二个会话' })
      .click();

    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });
  });

  test('删除当前会话后自动切换', async ({ page }) => {
    await openSidebarIfNeeded(page);

    // 当前是第二个会话，有 2 条消息
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });

    // 悬停并打开删除菜单
    const item = page
      .getByTestId('conversation-item')
      .filter({ hasText: '第二个会话' });
    await item.hover();
    await page.waitForTimeout(300);
    await item.locator('[data-slot="dropdown-menu-trigger"]').click();

    // 点击删除
    await page.getByTestId('conversation-delete-menu').click();

    // 应自动切换到第一个会话（4 条消息）
    await expect(page.getByTestId('message-item')).toHaveCount(4, {
      timeout: 10000,
    });

    // 第二个会话从列表中消失
    await expect(
      page.getByTestId('conversation-item').filter({ hasText: '第二个会话' }),
    ).toHaveCount(0);
  });

  test('删除非当前会话不影响当前消息', async ({ page }) => {
    await openSidebarIfNeeded(page);

    // 当前是第二个会话
    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });

    // 删除第一个会话（非当前）
    const item = page
      .getByTestId('conversation-item')
      .filter({ hasText: '第一个会话' });
    await item.hover();
    await page.waitForTimeout(300);
    await item.locator('[data-slot="dropdown-menu-trigger"]').click();
    await page.getByTestId('conversation-delete-menu').click();

    // 当前消息不变
    await expect(page.getByTestId('message-item')).toHaveCount(2);
    // 第一个会话从列表中消失
    await expect(
      page.getByTestId('conversation-item').filter({ hasText: '第一个会话' }),
    ).toHaveCount(0);
  });

  test('新建对话不创建空记录（惰性创建）', async ({ page }) => {
    await openSidebarIfNeeded(page);

    // 记录当前会话数量
    const dataBefore = await getIndexedDBData(page);
    const countBefore = dataBefore.conversations.length;

    // 点击"开启新对话"
    await page.getByTestId('new-conversation').click();

    // 应显示欢迎页
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 5000,
    });

    // IndexedDB 中会话数量不变
    const dataAfter = await getIndexedDBData(page);
    expect(dataAfter.conversations.length).toBe(countBefore);
  });
});
