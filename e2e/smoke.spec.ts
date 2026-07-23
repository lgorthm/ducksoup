import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/db-seed';

const API_KEY_STORAGE = 'deepseek-api-key';

test.describe('冒烟测试', () => {
  test.beforeEach(async ({ page }) => {
    // 先导航到 baseURL，使 localStorage 和 IndexedDB 可用
    await page.goto('/');
    // 清空 IndexedDB（会触发 onupgradeneeded 创建 schema）
    await clearIndexedDB(page);
    // 预设 API Key，避免 API Key 对话框拦截
    await page.evaluate(
      (key) => localStorage.setItem(key, 'sk-test-key'),
      API_KEY_STORAGE,
    );
    // 预设语言为中文
    await page.evaluate(() => localStorage.setItem('i18nLang', 'zh-CN'));
    await page.reload();
  });

  test('应用加载并显示欢迎页', async ({ page }) => {
    await expect(page).toHaveTitle(/ducksoup/i);
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 10000,
    });
  });

  test('侧边栏可见且包含设置按钮', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端侧边栏为 Sheet 抽屉，跳过桌面端侧边栏测试',
    );
    await expect(page.getByTestId('settings-button')).toBeVisible({
      timeout: 10000,
    });
  });

  test('点击设置按钮打开设置弹窗', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端侧边栏为 Sheet 抽屉，跳过桌面端设置弹窗测试',
    );
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('d 键切换主题', async ({ page }) => {
    await expect(page.getByTestId('chat-welcome')).toBeVisible({
      timeout: 10000,
    });

    // 点击 body 使焦点离开 contentEditable
    await page.locator('body').click();

    const isDarkBefore = await page
      .locator('html')
      .evaluate((el) => el.classList.contains('dark'));

    await page.keyboard.press('d');
    await page.waitForTimeout(500);

    const isDarkAfter = await page
      .locator('html')
      .evaluate((el) => el.classList.contains('dark'));
    expect(isDarkAfter).not.toBe(isDarkBefore);
  });

  test('输入框存在且可编辑', async ({ page }) => {
    await expect(page.getByTestId('chat-input')).toBeVisible({
      timeout: 10000,
    });
    const editor = page.getByTestId('chat-input-editor');
    await expect(editor).toBeVisible();
    await expect(editor).toBeEditable();
  });
});
