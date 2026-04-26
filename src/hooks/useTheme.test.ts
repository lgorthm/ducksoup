import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

const STORAGE_KEY = 'theme'

beforeEach(() => {
  // Clear localStorage mock
  localStorage.clear()

  // Mock window.matchMedia: default no preference
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? false : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))

  // Reset document class
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTheme', () => {
  describe('初始化主题', () => {
    it('当 localStorage 和系统偏好都没有设置时应返回 "light"', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
    })

    it('当 DOM 已有 dark class 时应返回 "dark"（inline script 已设置）', () => {
      document.documentElement.classList.add('dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
    })

    it('当 DOM 已有 dark class 时，即使 localStorage 值为 "light"，仍应返回 "dark"（DOM 优先）', () => {
      localStorage.setItem(STORAGE_KEY, 'light')
      document.documentElement.classList.add('dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
    })

    it('当 DOM 无 dark class 且 localStorage 存储 "dark" 时应返回 "dark"（fallback）', () => {
      localStorage.setItem(STORAGE_KEY, 'dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
    })

    it('当 localStorage 存储 "light" 时应返回 "light"', () => {
      localStorage.setItem(STORAGE_KEY, 'light')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
    })

    it('忽略 localStorage 中的无效值，回退到系统偏好', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-value')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
    })

    it('当系统偏好为 dark 且无存储值时，应返回 "dark"', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
    })
  })

  describe('DOM class 管理', () => {
    it('初始化 light 主题时不应有 "dark" class', () => {
      renderHook(() => useTheme())
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('初始化 dark 主题时应有 "dark" class（由 inline script 预设）', () => {
      document.documentElement.classList.add('dark')
      renderHook(() => useTheme())
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('切换主题时应同步更新 "dark" class', () => {
      const { result } = renderHook(() => useTheme())
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      act(() => {
        result.current.toggleTheme()
      })
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      act(() => {
        result.current.toggleTheme()
      })
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('setTheme 应正确设置 "dark" class', () => {
      const { result } = renderHook(() => useTheme())
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      act(() => {
        result.current.setTheme('dark')
      })
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('localStorage 持久化', () => {
    it('toggleTheme 后应持久化到 localStorage', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.toggleTheme()
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })

    it('setTheme 后应持久化到 localStorage', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme('dark')
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')

      act(() => {
        result.current.setTheme('light')
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    })
  })

  describe('toggleTheme', () => {
    it('从 "light" 切换到 "dark"', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('dark')
    })

    it('从 "dark" 切换到 "light"', () => {
      localStorage.setItem(STORAGE_KEY, 'dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('light')
    })

    it('连续切换应正确翻转状态', () => {
      const { result } = renderHook(() => useTheme())

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe('dark')

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe('light')

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe('dark')
    })
  })

  describe('localStorage 异常处理', () => {
    it('localStorage.getItem 抛出异常时不崩溃', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
    })

    it('localStorage.setItem 抛出异常时不崩溃', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error')
      })
      const { result } = renderHook(() => useTheme())

      expect(() => {
        act(() => {
          result.current.toggleTheme()
        })
      }).not.toThrow()

      expect(result.current.theme).toBe('dark')
    })
  })
})
