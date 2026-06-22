import { describe, it, expect } from 'vitest';
import i18n from './index';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe('i18n 初始化', () => {
  it('已初始化且可用', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('支持 zh-CN 和 en 两种语言', () => {
    expect(i18n.options.resources).toHaveProperty('zh-CN');
    expect(i18n.options.resources).toHaveProperty('en');
  });

  it('fallback 语言为 en', () => {
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });
});

describe('key 一致性', () => {
  const zhKeys = getKeys(zhCN).sort();
  const enKeys = getKeys(en).sort();

  it('zh-CN 和 en 的 key 结构完全一致', () => {
    expect(zhKeys).toEqual(enKeys);
  });

  it('key 列表不为空', () => {
    expect(zhKeys.length).toBeGreaterThan(0);
  });

  it('包含必要的 key', () => {
    expect(zhKeys).toContain('common.save');
    expect(zhKeys).toContain('chat.input.placeholder');
    expect(zhKeys).toContain('conversation.empty');
    expect(zhKeys).toContain('apiKey.dialogTitle');
    expect(zhKeys).toContain('settings.title');
  });
});

describe('翻译功能', () => {
  it('zh-CN 返回中文翻译', () => {
    i18n.changeLanguage('zh-CN');
    expect(i18n.t('common.save')).toBe('保存');
    expect(i18n.t('conversation.empty')).toBe('暂无对话');
    expect(i18n.t('settings.title')).toBe('系统设置');
  });

  it('en 返回英文翻译', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('common.save')).toBe('Save');
    expect(i18n.t('conversation.empty')).toBe('No conversations');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('插值 {{model}} 正确替换', () => {
    i18n.changeLanguage('zh-CN');
    expect(i18n.t('chat.welcome.startChat', { model: 'DeepSeek V4' })).toBe(
      '使用 DeepSeek V4 开始对话',
    );
  });

  it('英文插值正确替换', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('chat.welcome.startChat', { model: 'DeepSeek V4' })).toBe(
      'Start chatting with DeepSeek V4',
    );
  });

  it('未知 key 返回 key 本身', () => {
    i18n.changeLanguage('zh-CN');
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
  });
});

describe('语言检测', () => {
  it('检测顺序为 localStorage → navigator', () => {
    const order = i18n.options.detection?.order;
    expect(order).toEqual(['localStorage', 'navigator']);
  });

  it('缓存到 localStorage key "i18nLang"', () => {
    const caches = i18n.options.detection?.caches;
    expect(caches).toEqual(['localStorage']);
    expect(i18n.options.detection?.lookupLocalStorage).toBe('i18nLang');
  });
});
