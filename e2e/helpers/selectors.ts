import type { Page, Locator } from '@playwright/test';

export const SELECTORS = {
  // 布局
  fixedToolbar: '[data-testid="fixed-toolbar"]',
  sidebarTrigger: '[data-testid="sidebar-trigger"]',
  settingsButton: '[data-testid="settings-button"]',
  header: 'header',

  // 会话列表
  conversationList: '[data-testid="conversation-list"]',
  newConversationButton: '[data-testid="new-conversation"]',
  conversationItem: '[data-testid="conversation-item"]',
  conversationDeleteMenu: '[data-testid="conversation-delete-menu"]',

  // 消息
  messageList: '[data-testid="message-list"]',
  messageItem: '[data-testid="message-item"]',
  chatInput: '[data-testid="chat-input"]',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  deepThinkButton: '[data-testid="deep-think-button"]',

  // 对话框
  apiKeyDialog: '[data-testid="api-key-dialog"]',
  apiKeyInput: '[data-testid="api-key-input"]',
  apiKeySave: '[data-testid="api-key-save"]',
  settingsDialog: '[data-testid="settings-dialog"]',

  // 其他
  chatWelcome: '[data-testid="chat-welcome"]',
  disclaimer: '[data-testid="chat-disclaimer"]',
  errorMessage: '[data-testid="error-message"]',
  loadingIndicator: '[data-testid="loading-indicator"]',
} as const;

export function getConversationItem(page: Page, title: string): Locator {
  return page.locator(SELECTORS.conversationItem, { hasText: title });
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}
