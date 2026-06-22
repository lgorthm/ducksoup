import type { Page } from '@playwright/test';

export interface PerfMeasurement {
  duration: number;
  timestamp: number;
}

export async function measureAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
}

export async function measureClickToVisible(
  page: Page,
  selector: string,
): Promise<number> {
  const start = await page.evaluate(() => performance.now());
  await page.click(selector);
  await page.waitForSelector(selector, { state: 'visible' });
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

export interface LighthouseMetrics {
  FCP?: number;
  LCP?: number;
  TBT?: number;
  CLS?: number;
  INP?: number;
  TTFB?: number;
}

export async function getPerformanceMetrics(
  page: Page,
): Promise<LighthouseMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');

    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');

    return {
      FCP: fcp?.startTime,
      TTFB: nav?.responseStart,
    };
  });
}

export async function measureConversationSwitch(
  page: Page,
  conversationTitle: string,
  messageSelector: string,
): Promise<number> {
  const start = await page.evaluate(() => performance.now());
  await page.getByText(conversationTitle).click();
  await page.waitForSelector(messageSelector, { state: 'visible' });
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

export function formatPerfResult(label: string, duration: number): string {
  return `${label}: ${duration.toFixed(2)}ms`;
}
