import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { renderHook, act } from '@testing-library/react'
import { ApiKeyProvider, useApiKey } from './useApiKey'

const STORAGE_KEY = 'ducksoup-deepseek-apikey'

function wrapper({ children }: { children: ReactNode }) {
  return <ApiKeyProvider>{children}</ApiKeyProvider>
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useApiKey', () => {
  describe('初始化 API Key', () => {
    it('localStorage 为空时应返回空字符串', () => {
      const { result } = renderHook(() => useApiKey(), { wrapper })
      expect(result.current.apiKey).toBe('')
    })

    it('localStorage 有值时应返回对应值', () => {
      localStorage.setItem(STORAGE_KEY, 'sk-test-key-123')
      const { result } = renderHook(() => useApiKey(), { wrapper })
      expect(result.current.apiKey).toBe('sk-test-key-123')
    })

    it('localStorage 中空字符串应返回空字符串', () => {
      localStorage.setItem(STORAGE_KEY, '')
      const { result } = renderHook(() => useApiKey(), { wrapper })
      expect(result.current.apiKey).toBe('')
    })

    it('localStorage.getItem 抛出异常时不崩溃，返回空字符串', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })
      const { result } = renderHook(() => useApiKey(), { wrapper })
      expect(result.current.apiKey).toBe('')
    })
  })

  describe('setApiKey', () => {
    it('设置后应更新状态', () => {
      const { result } = renderHook(() => useApiKey(), { wrapper })

      act(() => {
        result.current.setApiKey('sk-new-key')
      })
      expect(result.current.apiKey).toBe('sk-new-key')
    })

    it('设置后应持久化到 localStorage', () => {
      const { result } = renderHook(() => useApiKey(), { wrapper })

      act(() => {
        result.current.setApiKey('sk-persist-key')
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBe('sk-persist-key')
    })

    it('设置为空字符串应清除 localStorage 中的值', () => {
      localStorage.setItem(STORAGE_KEY, 'sk-old-key')
      const { result } = renderHook(() => useApiKey(), { wrapper })

      act(() => {
        result.current.setApiKey('')
      })
      expect(result.current.apiKey).toBe('')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('')
    })

    it('连续设置多个值应正确更新', () => {
      const { result } = renderHook(() => useApiKey(), { wrapper })

      act(() => result.current.setApiKey('key-1'))
      expect(result.current.apiKey).toBe('key-1')

      act(() => result.current.setApiKey('key-2'))
      expect(result.current.apiKey).toBe('key-2')

      act(() => result.current.setApiKey('key-3'))
      expect(result.current.apiKey).toBe('key-3')
    })

    it('设置新值后重新渲染 hook 应保留最新值', () => {
      const { result, rerender } = renderHook(() => useApiKey(), { wrapper })

      act(() => {
        result.current.setApiKey('sk-after-rerender')
      })

      rerender()
      expect(result.current.apiKey).toBe('sk-after-rerender')
    })
  })

  describe('localStorage 异常处理', () => {
    it('localStorage.setItem 抛出异常时不崩溃，且状态仍然更新', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      const { result } = renderHook(() => useApiKey(), { wrapper })

      expect(() => {
        act(() => {
          result.current.setApiKey('sk-error-key')
        })
      }).not.toThrow()

      // 状态应更新，即使持久化失败
      expect(result.current.apiKey).toBe('sk-error-key')
    })
  })
})
