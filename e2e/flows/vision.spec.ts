import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/setup';
import { mockDeepSeekSSE, mockDeepSeekFiles } from '../helpers/sse-mock';

/** 1×1 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('图像理解', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
  });

  test('Flash 默认可加图，切到 Pro 后隐藏', async ({ page }) => {
    await expect(page.getByTestId('attach-button')).toBeEnabled();
    await page.locator('[data-value="deepseek-v4-pro"]').click();
    await expect(page.getByTestId('attach-button')).toHaveCount(0);
  });

  test('选择图片后隐藏模型切换并可纯图发送', async ({ page }) => {
    await mockDeepSeekFiles(page);
    await mockDeepSeekSSE(page, {
      thinking: [],
      content: ['我看到了一张图'],
    });

    await page.getByTestId('attach-file-input').setInputFiles({
      name: 'tiny.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });

    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    await expect(page.locator('[data-value="deepseek-v4-pro"]')).toHaveCount(0);
    await expect(page.getByTestId('send-button')).toBeEnabled();

    await page.getByTestId('send-button').click();

    await expect(page.getByTestId('message-item')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.getByTestId('message-images')).toBeVisible();
    await expect(page.getByTestId('message-image')).toBeVisible();
    await page.getByTestId('message-image').click();
    await expect(page.getByTestId('image-lightbox')).toBeVisible();
    await page.getByTestId('image-lightbox-close').click();
    await expect(page.getByTestId('image-lightbox')).toHaveCount(0);
    await expect(page.getByTestId('message-item').nth(1)).toContainText(
      '我看到了一张图',
      { timeout: 15000 },
    );
  });
});
