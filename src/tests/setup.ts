import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from '@/mocks/server';
import i18n from '@/shared/i18n';

// 测试默认使用中文（与项目默认语言一致）
void i18n.changeLanguage('zh-CN');

// --- matchMedia 全局 mock（shadcn sidebar 等组件依赖）---
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// --- ResizeObserver mock（@tanstack/react-virtual 依赖）---
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// --- IntersectionObserver mock ---
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
window.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

// --- scrollTo mock（jsdom 不实现）---
window.scrollTo = vi.fn();

// --- MSW server 生命周期 ---
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- localStorage / sessionStorage 隔离 ---
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
