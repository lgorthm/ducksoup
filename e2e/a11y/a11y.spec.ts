import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupApp } from '../helpers/setup';
import { generateConversation, generateMessages } from '../fixtures/test-data';

test.describe('可访问性审计', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('i18nLang', 'zh-CN');
    });
  });

  test('聊天欢迎页无严重违规', async ({ page }) => {
    await setupApp(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[data-slot="dropdown-menu-trigger"]')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  test('有消息的聊天页无严重违规', async ({ page }) => {
    const conv = generateConversation({ id: 'a11y-conv' });
    await setupApp(page, {
      conversations: [conv],
      messages: generateMessages('a11y-conv', 4),
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[data-slot="dropdown-menu-trigger"]')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  test('设置弹窗无严重违规', async ({ page }) => {
    await setupApp(page);
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('[role="dialog"]')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  test('侧边栏无严重违规', async ({ page }) => {
    await setupApp(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('[data-slot="sidebar"]')
      .exclude('[data-slot="dropdown-menu-trigger"]')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  test('输入框有正确的 ARIA 角色', async ({ page }) => {
    await setupApp(page);
    const editor = page.getByTestId('chat-input-editor');
    await expect(editor).toHaveAttribute('role', 'textbox');
    await expect(editor).toHaveAttribute('aria-multiline', 'true');
  });

  test('侧边栏 trigger 有 sr-only 文本', async ({ page }) => {
    await setupApp(page);
    const trigger = page.getByTestId('sidebar-trigger');
    await expect(trigger.locator('.sr-only')).toHaveText('Toggle Sidebar');
  });
});
