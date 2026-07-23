import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { generateConversation, generateMessages } from '../fixtures/test-data';

// 滚动导航栏（ChatScrollNav）：激活精度与全覆盖

/** 滚动到指定位置并等待两帧（scroll 事件 + 组件 rAF + React 更新落定） */
async function scrollAndSettle(page: Page, top: number) {
  await page.getByTestId('message-list').evaluate((el, t) => {
    el.scrollTo({ top: t });
  }, top);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** 当前激活横杠的序号（无激活时返回 -1） */
async function activeBarIndex(page: Page): Promise<number> {
  const idx = await page
    .getByTestId('chat-scroll-nav')
    .locator('button.bg-yellow-400')
    .evaluateAll((els) =>
      els.map((el) =>
        Array.from(el.parentElement!.parentElement!.children).indexOf(
          el.parentElement!,
        ),
      ),
    );
  return idx.length === 1 ? idx[0] : -1;
}

/** 把指定虚拟索引的消息滚到视口中心（按容器坐标计算，不依赖 scrollIntoView） */
async function scrollMessageToCenter(page: Page, index: number) {
  await page.getByTestId('message-list').evaluate((el, i) => {
    const item = el.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (!item) throw new Error(`message ${i} not rendered`);
    // 虚拟项通过 transform 定位（translateY 或 translate3d），offsetTop 恒为 0，需解析 transform
    const style = item.style.transform;
    const match =
      /translateY\(([\d.]+)px\)/.exec(style) ??
      /translate3d\([^,]+,\s*([\d.]+)px/.exec(style);
    const start = match ? Number(match[1]) : 0;
    el.scrollTo({
      top: start + item.offsetHeight / 2 - el.clientHeight / 2,
    });
  }, index);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe('scroll nav 激活精度', () => {
  // 导航栏仅在 >1200px 宽屏渲染，移动端项目跳过
  test.skip(({ isMobile }) => Boolean(isMobile), '移动端不渲染导航栏');

  test('只有滚动到对应消息时才激活其横杠', async ({ page }) => {
    const conv = generateConversation({
      id: 'c1',
      title: '长会话',
      updatedAt: 1000,
    });
    // 40 条消息（20 用户 + 20 回复），内容足够长使列表可滚动
    const msgs = generateMessages('c1', 40, { contentLength: 300 });
    await setupApp(page, { conversations: [conv], messages: msgs });

    const nav = page.getByTestId('chat-scroll-nav');
    await expect(nav).toBeVisible({ timeout: 10000 });
    const bars = nav.locator('button');
    await expect(bars).toHaveCount(20);

    // 初始贴底 → 最后一根横杠激活，且只有一根激活
    await expect(bars.last()).toHaveClass(/bg-yellow-400/);
    await expect(nav.locator('button.bg-yellow-400')).toHaveCount(1);

    // 滚到顶部 → 第一根激活
    await scrollAndSettle(page, 0);
    await expect(bars.first()).toHaveClass(/bg-yellow-400/);
    await expect(nav.locator('button.bg-yellow-400')).toHaveCount(1);

    // 把第 2 条用户消息（虚拟索引 2）滚到视口中心 → 第 2 根激活，第 3 根不激活
    await scrollMessageToCenter(page, 2);
    await expect(bars.nth(1)).toHaveClass(/bg-yellow-400/);
    await expect(bars.nth(2)).not.toHaveClass(/bg-yellow-400/);

    // 把它的回复（虚拟索引 3）滚到视口中心：第 3 条用户消息（索引 4）
    // 还在视口中心之下 → 仍激活第 2 根，不超前激活第 3 根
    await scrollMessageToCenter(page, 3);
    await expect(bars.nth(1)).toHaveClass(/bg-yellow-400/);
    await expect(bars.nth(2)).not.toHaveClass(/bg-yellow-400/);
  });

  test('从头滚到尾每根横杠依次激活且不回跳', async ({ page }) => {
    test.setTimeout(90000);
    const conv = generateConversation({
      id: 'c2',
      title: '长会话',
      updatedAt: 1000,
    });
    const msgs = generateMessages('c2', 40, { contentLength: 300 });
    await setupApp(page, { conversations: [conv], messages: msgs });

    const nav = page.getByTestId('chat-scroll-nav');
    await expect(nav).toBeVisible({ timeout: 10000 });
    const bars = nav.locator('button');
    await expect(bars).toHaveCount(20);

    // 从顶部开始，以 50px 小步滚到底（动态测量会让 scrollHeight 增长，逐步逼近）
    await scrollAndSettle(page, 0);
    const seen: number[] = [await activeBarIndex(page)];

    for (let step = 0; step < 3000; step++) {
      const { scrollTop, max } = await page
        .getByTestId('message-list')
        .evaluate((el) => ({
          scrollTop: el.scrollTop,
          max: el.scrollHeight - el.clientHeight,
        }));
      if (scrollTop >= max - 1) break;
      const top = Math.min(scrollTop + 50, max);
      await scrollAndSettle(page, top);
      const idx = await activeBarIndex(page);
      if (idx !== -1 && seen[seen.length - 1] !== idx) seen.push(idx);
    }

    // 从第 1 根开始单调逐根前进、覆盖全部 20 根、以最后一根结束
    expect(seen[0]).toBe(0);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i] - seen[i - 1]).toBe(1);
    }
    expect(seen).toHaveLength(20);
    expect(seen[seen.length - 1]).toBe(19);
  });
});
