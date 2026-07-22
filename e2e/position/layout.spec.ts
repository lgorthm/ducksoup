import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';

test.describe('组件位置与层级', () => {
  test.beforeEach(async ({ page }) => {
    // 桌面端专用测试，移动端布局完全不同
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端布局不同，跳过桌面端布局测试',
    );
    await setupApp(page);
  });

  test('侧边栏展开时 FixedToolbar 不可见', async ({ page }) => {
    const toolbar = page.getByTestId('fixed-toolbar');
    await expect(toolbar).toHaveCSS('opacity', '0');
    await expect(toolbar).toHaveCSS('pointer-events', 'none');
  });

  test('侧边栏折叠时 FixedToolbar 可见且位置正确', async ({ page }) => {
    await page.getByTestId('sidebar-trigger').click();
    await page.waitForTimeout(500);

    const toolbar = page.getByTestId('fixed-toolbar');
    await expect(toolbar).toHaveCSS('opacity', '1');
    await expect(toolbar).toHaveCSS('pointer-events', 'auto');

    // 验证位置（宽度由内容决定：logo + 白盒内两个按钮，约 132px）
    const box = await toolbar.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.width).toBeLessThan(140);
  });

  test('SettingsDialog z-index 高于 FixedToolbar', async ({ page }) => {
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
      timeout: 10000,
    });

    const toolbarZ = await page
      .getByTestId('fixed-toolbar')
      .evaluate((el) => Number(getComputedStyle(el).zIndex));
    const dialogZ = await page
      .locator('[role="dialog"]')
      .first()
      .evaluate((el) => Number(getComputedStyle(el).zIndex));

    expect(dialogZ).toBeGreaterThan(toolbarZ);
  });

  test('header margin-left 随侧边栏状态切换', async ({ page }) => {
    // 侧边栏展开时 margin-left 为 0
    await expect(page.locator('header')).toHaveCSS('margin-left', '0px');

    // 折叠侧边栏
    await page.getByTestId('sidebar-trigger').click();
    await page.waitForTimeout(500);

    // margin-left 应为 140px
    await expect(page.locator('header')).toHaveCSS('margin-left', '140px');
  });

  test('侧边栏折叠后再展开恢复状态', async ({ page }) => {
    // 折叠
    await page.getByTestId('sidebar-trigger').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('fixed-toolbar')).toHaveCSS('opacity', '1');

    // 展开 — 折叠后 trigger 在视口外，用 force 或 FixedToolbar 内的 trigger
    await page
      .locator('[data-testid="fixed-toolbar"] [data-slot="sidebar-trigger"]')
      .click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('fixed-toolbar')).toHaveCSS('opacity', '0');
  });

  test('侧边栏包含会话列表和设置按钮', async ({ page }) => {
    await expect(page.getByTestId('conversation-list')).toBeVisible();
    await expect(page.getByTestId('settings-button')).toBeVisible();
    await expect(page.getByTestId('new-conversation')).toBeVisible();
  });
});

test.describe('移动端布局', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) >= 768, '移动端专用测试');
    await setupApp(page);
  });

  test('移动端侧边栏为 Sheet 抽屉', async ({ page }) => {
    // 侧边栏默认隐藏，点击 trigger 打开
    await page
      .locator('[data-slot="sidebar-trigger"]')
      .first()
      .dispatchEvent('click');
    await page.waitForTimeout(500);

    // 会话列表可见
    await expect(page.getByTestId('conversation-list')).toBeVisible({
      timeout: 5000,
    });
  });

  test('移动端 FixedToolbar 隐藏', async ({ page }) => {
    const toolbar = page.getByTestId('fixed-toolbar');
    // WebKit 用 matrix(1,0,0,1,-100,0)，Chromium 用 translateX(-100%)
    await expect(toolbar).toHaveCSS(
      'transform',
      /(translateX\(-100%\)|matrix\(1,\s*0,\s*0,\s*1,\s*-100,\s*0\))/,
    );
  });
});
