import { test, expect } from '@playwright/test';
import { setupApp, openSidebarIfNeeded } from '../helpers/setup';
import { generateConversation } from '../fixtures/test-data';

function daysAgo(days: number): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

test.describe('会话置顶与分组', () => {
  test.beforeEach(async ({ page }) => {
    const today = generateConversation({
      id: 'c-today',
      title: '今天的会话',
      updatedAt: daysAgo(0),
    });
    const yesterday = generateConversation({
      id: 'c-yesterday',
      title: '昨天的会话',
      updatedAt: daysAgo(1),
    });
    const older = generateConversation({
      id: 'c-older',
      title: '更早的会话',
      updatedAt: daysAgo(40),
    });

    await setupApp(page, {
      conversations: [today, yesterday, older],
    });
  });

  test('按今天、昨天、年-月分组，今天在昨天之上', async ({ page }) => {
    await openSidebarIfNeeded(page);

    const groups = page.getByTestId('conversation-group');
    await expect(groups.first()).toBeVisible();

    const attrs = await groups.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-group')),
    );
    expect(attrs[0]).toBe('today');
    expect(attrs[1]).toBe('yesterday');
    expect(attrs[2]).toMatch(/^\d{4}-\d{2}$/);

    await expect(page.getByTestId('conversation-item')).toHaveCount(3);
  });

  test('置顶后进入置顶组，刷新后仍置顶', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 768,
      '移动端抽屉中 hover 交互不可靠',
    );
    await openSidebarIfNeeded(page);

    const item = page
      .getByTestId('conversation-item')
      .filter({ hasText: '今天的会话' });
    await item.hover();
    await page.waitForTimeout(300);
    await item.locator('[data-slot="dropdown-menu-trigger"]').click();
    await page.getByTestId('conversation-pin-menu').click();

    const groups = page.getByTestId('conversation-group');
    await expect(groups.first()).toHaveAttribute('data-group', 'pinned');
    await expect(
      page.getByTestId('conversation-item').filter({ hasText: '今天的会话' }),
    ).toBeVisible();

    await page.reload();
    await page
      .getByTestId('settings-button')
      .waitFor({ state: 'visible', timeout: 10000 });

    await expect(
      page.getByTestId('conversation-group').first(),
    ).toHaveAttribute('data-group', 'pinned');
    await expect(
      page.getByTestId('conversation-item').filter({ hasText: '今天的会话' }),
    ).toBeVisible();
  });
});
