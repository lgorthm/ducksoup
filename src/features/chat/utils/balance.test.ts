import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchBalance,
  BalanceError,
  loadBalanceCache,
  saveBalanceCache,
  clearBalanceCache,
} from './balance';
import { server } from '@/mocks/server';
import {
  mockBalanceResponse,
  mockBalanceError,
  mockBalanceNetworkError,
} from '@/mocks/handlers/deepseek';
import type { BalanceResponse } from '@/features/chat/types/deepseek';

describe('fetchBalance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('成功返回余额数据', async () => {
    const result = await fetchBalance('test-key');
    expect(result.is_available).toBe(true);
    expect(result.balance_infos).toHaveLength(1);
    expect(result.balance_infos[0].currency).toBe('CNY');
    expect(result.balance_infos[0].total_balance).toBe('110.00');
  });

  it('返回多币种余额数据', async () => {
    const multiCurrency: BalanceResponse = {
      is_available: true,
      balance_infos: [
        {
          currency: 'CNY',
          total_balance: '50.00',
          granted_balance: '10.00',
          topped_up_balance: '40.00',
        },
        {
          currency: 'USD',
          total_balance: '5.00',
          granted_balance: '1.00',
          topped_up_balance: '4.00',
        },
      ],
    };
    server.use(mockBalanceResponse(multiCurrency));

    const result = await fetchBalance('test-key');
    expect(result.balance_infos).toHaveLength(2);
    expect(result.balance_infos[1].currency).toBe('USD');
  });

  it('is_available 为 false 时仍正常返回', async () => {
    server.use(
      mockBalanceResponse({
        is_available: false,
        balance_infos: [],
      }),
    );

    const result = await fetchBalance('test-key');
    expect(result.is_available).toBe(false);
    expect(result.balance_infos).toHaveLength(0);
  });

  it('空 API Key 抛出 BalanceError', async () => {
    await expect(fetchBalance('')).rejects.toThrow(BalanceError);
    await expect(fetchBalance('')).rejects.toThrow('API Key is required');
  });

  it('HTTP 错误时抛出 BalanceError 并包含状态码', async () => {
    server.use(mockBalanceError(401, 'Invalid API key'));

    try {
      await fetchBalance('bad-key');
      expect.fail('应该抛出错误');
    } catch (err) {
      expect(err).toBeInstanceOf(BalanceError);
      expect((err as BalanceError).statusCode).toBe(401);
      expect((err as BalanceError).message).toBe('Invalid API key');
    }
  });

  it('500 错误时抛出 BalanceError', async () => {
    server.use(mockBalanceError(500, 'Internal server error'));

    try {
      await fetchBalance('test-key');
      expect.fail('应该抛出错误');
    } catch (err) {
      expect(err).toBeInstanceOf(BalanceError);
      expect((err as BalanceError).statusCode).toBe(500);
    }
  });

  it('网络错误时抛出 BalanceError (statusCode=0)', async () => {
    server.use(mockBalanceNetworkError());

    try {
      await fetchBalance('test-key');
      expect.fail('应该抛出错误');
    } catch (err) {
      expect(err).toBeInstanceOf(BalanceError);
      expect((err as BalanceError).statusCode).toBe(0);
    }
  });

  it('AbortSignal 取消请求时抛出 AbortError', async () => {
    const controller = new AbortController();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const promise = fetchBalance('test-key', controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow();
    // 确认是 AbortError，不是 BalanceError
    await expect(promise).rejects.not.toSatisfy(
      (err: unknown) => err instanceof BalanceError,
    );
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('余额 sessionStorage 缓存', () => {
  const mockData: BalanceResponse = {
    is_available: true,
    balance_infos: [
      {
        currency: 'CNY',
        total_balance: '200.00',
        granted_balance: '20.00',
        topped_up_balance: '180.00',
      },
    ],
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saveBalanceCache 写入后 loadBalanceCache 可读回', () => {
    saveBalanceCache('sk-mykey1234', mockData);

    const cached = loadBalanceCache('sk-mykey1234');
    expect(cached).not.toBeNull();
    expect(cached!.balance).toEqual(mockData);
    expect(cached!.lastUpdated).toBeTypeOf('number');
  });

  it('loadBalanceCache 无缓存时返回 null', () => {
    expect(loadBalanceCache('sk-mykey1234')).toBeNull();
  });

  it('loadBalanceCache 空 apiKey 返回 null', () => {
    saveBalanceCache('sk-mykey1234', mockData);
    expect(loadBalanceCache('')).toBeNull();
  });

  it('saveBalanceCache 空 apiKey 不写入', () => {
    saveBalanceCache('', mockData);
    expect(sessionStorage.getItem('deepseek-balance-cache')).toBeNull();
  });

  it('apiKey 变更后缓存失效', () => {
    saveBalanceCache('sk-key-aaaa', mockData);

    // 换一个不同的 key
    const cached = loadBalanceCache('sk-key-bbbb');
    expect(cached).toBeNull();

    // 原 key 仍可读回
    expect(loadBalanceCache('sk-key-aaaa')).not.toBeNull();
  });

  it('clearBalanceCache 清除缓存', () => {
    saveBalanceCache('sk-mykey1234', mockData);
    expect(loadBalanceCache('sk-mykey1234')).not.toBeNull();

    clearBalanceCache();
    expect(loadBalanceCache('sk-mykey1234')).toBeNull();
  });

  it('损坏的缓存数据不会崩溃，返回 null', () => {
    sessionStorage.setItem('deepseek-balance-cache', 'not-json');
    expect(loadBalanceCache('sk-mykey1234')).toBeNull();
  });
});
