import type { Page } from '@playwright/test';
import { clearIndexedDB, seedIndexedDB } from '../fixtures/db-seed';
import type {
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';

export async function setupApp(
  page: Page,
  options: {
    conversations?: Conversation[];
    messages?: StoredMessage[];
  } = {},
): Promise<void> {
  // 第一阶段：加载应用并设置 localStorage
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    (key) => localStorage.setItem(key, 'sk-test-key'),
    'deepseek-api-key',
  );
  await page.evaluate(() => localStorage.setItem('i18nLang', 'zh-CN'));
  await page.reload();
  // 等待应用初始化完成（init() 中的 DB 操作已结束）
  // 移动端侧边栏隐藏时 settings-button 不可见，改用 chat-welcome 或 sidebar-trigger
  const width = page.viewportSize()?.width ?? 1440;
  if (width < 768) {
    await page
      .locator('[data-slot="sidebar-trigger"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
  } else {
    await page
      .getByTestId('settings-button')
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  // 第二阶段：清空 DB 并种子数据
  await clearIndexedDB(page);
  if (options.conversations || options.messages) {
    await seedIndexedDB(
      page,
      options.conversations ?? [],
      options.messages ?? [],
    );
  }

  // 第三阶段：重新加载以读取种子数据
  await page.reload();
  // 同上：移动端用 sidebar-trigger 等待
  if (width < 768) {
    await page
      .locator('[data-slot="sidebar-trigger"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
  } else {
    await page
      .getByTestId('settings-button')
      .waitFor({ state: 'visible', timeout: 10000 });
  }
}

export async function typeAndSend(page: Page, text: string): Promise<void> {
  const editor = page.getByTestId('chat-input-editor');
  await editor.click();
  await page.keyboard.type(text);
  await page.getByTestId('send-button').click();
}

export async function openSidebarIfNeeded(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 1440;
  if (width < 768) {
    await page.locator('[data-slot="sidebar-trigger"]').first().click();
    await page.waitForTimeout(500);
  }
}
