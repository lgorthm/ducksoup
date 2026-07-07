/**
 * DeepSeek 余额查询服务
 *
 * 调用 GET /user/balance 端点查询当前账户余额信息。
 * https://api.deepseek.com/user/balance
 */

import type { BalanceResponse } from '@/features/chat/types/deepseek';

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_CACHE_KEY = 'deepseek-balance-cache';

// ========== sessionStorage 缓存 ==========

interface BalanceCache {
  /** 余额数据 */
  data: BalanceResponse;
  /** 缓存时间戳 */
  timestamp: number;
  /** API Key 末尾 4 位，用于检测 Key 变更后使缓存失效 */
  keyHint: string;
}

/** 取 API Key 末尾 4 位作为标识（不存储完整 Key） */
function getKeyHint(apiKey: string): string {
  return apiKey.length > 4 ? apiKey.slice(-4) : 'short';
}

/**
 * 从 sessionStorage 恢复缓存的余额数据
 *
 * 当 apiKey 变更时（keyHint 不匹配）自动返回 null，
 * 确保不会展示其他账户的余额。
 */
export function loadBalanceCache(
  apiKey: string,
): { balance: BalanceResponse; lastUpdated: number } | null {
  if (!apiKey) return null;
  try {
    const raw = sessionStorage.getItem(BALANCE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as BalanceCache;
    if (cache.keyHint !== getKeyHint(apiKey)) return null;
    return { balance: cache.data, lastUpdated: cache.timestamp };
  } catch {
    return null;
  }
}

/**
 * 将余额数据写入 sessionStorage 缓存
 */
export function saveBalanceCache(apiKey: string, data: BalanceResponse): void {
  if (!apiKey) return;
  try {
    const cache: BalanceCache = {
      data,
      timestamp: Date.now(),
      keyHint: getKeyHint(apiKey),
    };
    sessionStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sessionStorage 不可用时静默失败
  }
}

/**
 * 清除余额缓存
 */
export function clearBalanceCache(): void {
  try {
    sessionStorage.removeItem(BALANCE_CACHE_KEY);
  } catch {
    // 静默
  }
}

export class BalanceError extends Error {
  /** HTTP 状态码，网络错误时为 0 */
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BalanceError';
    this.statusCode = statusCode;
  }
}

/**
 * 查询 DeepSeek 账户余额
 *
 * @param apiKey DeepSeek API Key
 * @param signal 可选的 AbortSignal，用于取消请求
 * @returns 余额查询响应
 * @throws {BalanceError} 当请求失败或响应格式不正确时抛出
 */
export async function fetchBalance(
  apiKey: string,
  signal?: AbortSignal,
): Promise<BalanceResponse> {
  if (!apiKey) {
    throw new BalanceError('API Key is required', 0);
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_BALANCE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    });
  } catch (err) {
    // AbortError 可能是 DOMException 或普通 Error，通过 name 判断更健壮
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new BalanceError(
      err instanceof Error ? err.message : 'Network error',
      0,
    );
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) {
        message = body.error.message;
      }
    } catch {
      // 响应体不是 JSON，使用默认消息
    }
    throw new BalanceError(message, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BalanceError('Invalid JSON response', response.status);
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('is_available' in data) ||
    !('balance_infos' in data)
  ) {
    throw new BalanceError('Invalid response format', response.status);
  }

  return data as BalanceResponse;
}
