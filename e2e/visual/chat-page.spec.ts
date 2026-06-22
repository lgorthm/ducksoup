import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { generateConversation, generateMessages } from '../fixtures/test-data';

test.describe('聊天页面视觉回归', () => {
  test.describe('桌面端 - 亮色主题', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('i18nLang', 'zh-CN');
      });
    });

    test('空状态 - 欢迎页', async ({ page }) => {
      await setupApp(page);
      await expect(page).toHaveScreenshot('chat-page-desktop-light-empty.png', {
        maxDiffPixelRatio: 0.05,
      });
    });

    test('有消息状态', async ({ page }) => {
      const conv = generateConversation({
        id: 'vis-conv',
        title: '视觉测试会话',
      });
      await setupApp(page, {
        conversations: [conv],
        messages: generateMessages('vis-conv', 6),
      });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(
        'chat-page-desktop-light-messages.png',
        { maxDiffPixelRatio: 0.01 },
      );
    });
  });

  test.describe('桌面端 - 暗色主题', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('i18nLang', 'zh-CN');
      });
    });

    test('空状态 - 欢迎页', async ({ page }) => {
      await setupApp(page);
      await expect(page).toHaveScreenshot('chat-page-desktop-dark-empty.png', {
        maxDiffPixelRatio: 0.01,
      });
    });

    test('有消息状态', async ({ page }) => {
      const conv = generateConversation({
        id: 'vis-conv-d',
        title: '视觉测试会话',
      });
      await setupApp(page, {
        conversations: [conv],
        messages: generateMessages('vis-conv-d', 6),
      });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(
        'chat-page-desktop-dark-messages.png',
        { maxDiffPixelRatio: 0.01 },
      );
    });
  });

  test.describe('移动端', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('i18nLang', 'zh-CN');
      });
    });

    test('空状态 - 欢迎页', async ({ page }) => {
      await setupApp(page);
      await expect(page).toHaveScreenshot('chat-page-mobile-light-empty.png', {
        maxDiffPixelRatio: 0.01,
      });
    });
  });
});
