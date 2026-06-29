import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';

test.describe('设置弹窗视觉回归', () => {
  test.beforeEach(async ({ page }) => {
    // 桌面端专用测试，移动端侧边栏为 Sheet 抽屉
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端侧边栏为 Sheet 抽屉，跳过桌面端设置视觉测试',
    );
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('i18nLang', 'zh-CN');
    });
  });

  test('桌面端 - 通用设置标签', async ({ page }) => {
    await setupApp(page);
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    // 等待懒加载完成
    await page.getByText('浅色').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(page.locator('[role="dialog"]')).toHaveScreenshot(
      'settings-desktop-general.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('桌面端 - API Key 标签', async ({ page }) => {
    await setupApp(page);
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    await page.getByText('API KEY 设置').click();
    await page.waitForTimeout(300);

    await expect(page.locator('[role="dialog"]')).toHaveScreenshot(
      'settings-desktop-apikey.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('桌面端 - 暗色主题', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });
    await setupApp(page);
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    await page.getByText('浅色').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(page.locator('[role="dialog"]')).toHaveScreenshot(
      'settings-desktop-dark-general.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});

test.describe('设置弹窗视觉回归 - 移动端', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('i18nLang', 'zh-CN');
    });
  });

  test('移动端 - 通用设置', async ({ page }) => {
    await setupApp(page);
    // 移动端 header 内有 isMobile 版 SidebarTrigger
    await page
      .locator('header [data-slot="sidebar-trigger"]')
      .click({ force: true });
    await page.waitForTimeout(500);
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    await page.getByText('浅色').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(
      page.getByRole('dialog', { name: '系统设置' }),
    ).toHaveScreenshot('settings-mobile-general.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
