import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { generateConversations } from '../fixtures/test-data';

test.describe('侧边栏视觉回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('i18nLang', 'zh-CN');
    });
  });

  test('桌面端 - 展开状态 - 空会话', async ({ page }) => {
    await setupApp(page);
    await expect(page.getByTestId('conversation-list')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveScreenshot(
      'sidebar-desktop-expanded-empty.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('桌面端 - 展开状态 - 有会话', async ({ page }) => {
    const convs = generateConversations(5);
    await setupApp(page, { conversations: convs });
    await expect(page.getByTestId('conversation-list')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveScreenshot(
      'sidebar-desktop-expanded-items.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('桌面端 - 折叠状态', async ({ page }) => {
    await setupApp(page);
    await page.getByTestId('sidebar-trigger').click();
    await page.waitForTimeout(500);

    // 折叠后 FixedToolbar 可见
    await expect(page.getByTestId('fixed-toolbar')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('fixed-toolbar')).toHaveScreenshot(
      'sidebar-desktop-collapsed-toolbar.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('桌面端 - 暗色主题', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });
    const convs = generateConversations(5);
    await setupApp(page, { conversations: convs });
    await expect(page.getByTestId('conversation-list')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveScreenshot(
      'sidebar-desktop-dark-expanded.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
