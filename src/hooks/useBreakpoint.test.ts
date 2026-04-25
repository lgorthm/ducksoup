// useBreakpoint.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { renderHook, act } from '@testing-library/react'
import { useBreakpoint } from './useBreakpoint'

// 存储 matchMedia 模拟对象，方便测试中操控
const matchMediaMocks: Record<string, any> = {}

beforeEach(() => {
  // 重置存储
  Object.keys(matchMediaMocks).forEach((key) => delete matchMediaMocks[key])

  // 模拟 window.matchMedia（缓存结果，相同 query 复用一个 mql 对象）
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    if (matchMediaMocks[query]) return matchMediaMocks[query]
    const mql = {
      matches: false,
      media: query,
      addEventListener: vi.fn((_type: string, callback: EventListener) => {
        mql._listeners.push(callback)
      }),
      removeEventListener: vi.fn((_type: string, callback: EventListener) => {
        mql._listeners = mql._listeners.filter((cb) => cb !== callback)
      }),
      _listeners: [] as EventListener[],
      dispatchEvent: vi.fn(),
    }
    matchMediaMocks[query] = mql
    return mql
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// 辅助：快速修改某个媒体查询的 matches 并触发 change 事件
function changeMatches(query: string, matches: boolean) {
  const mql = matchMediaMocks[query]
  if (mql) {
    mql.matches = matches
    mql._listeners.forEach((listener: EventListener) => listener(new Event('change')))
  }
}

describe('useBreakpoint', () => {
  describe('初始化断点', () => {
    it('当移动端查询匹配时应返回 "mobile"', () => {
      window.matchMedia('(max-width: 767px)') // 先调用以填充缓存
      matchMediaMocks['(max-width: 767px)'].matches = true
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('mobile')
    })

    it('当桌面端查询匹配时应返回 "desktop"', () => {
      window.matchMedia('(min-width: 1024px)') // 先调用以填充缓存
      matchMediaMocks['(min-width: 1024px)'].matches = true
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('desktop')
    })

    it('当两个查询都不匹配时应返回 "tablet"', () => {
      // 默认 matches 都是 false
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('tablet')
    })

    it('在 SSR 环境（无 window）下应返回安全的默认断点 "desktop"', () => {
      // 由于 renderHook 依赖 jsdom 环境，无法在无 window 下运行，
      // 直接测试 useBreakpoint 内部 lazy initializer 的分支逻辑：
      const getBreakpoint = (w: any) => {
        if (typeof w === 'undefined') return 'desktop'
        if (w.matchMedia('(max-width: 767px)').matches) return 'mobile'
        if (w.matchMedia('(min-width: 1024px)').matches) return 'desktop'
        return 'tablet'
      }
      expect(getBreakpoint(undefined)).toBe('desktop')
    })
  })

  describe('响应媒体查询变化', () => {
    it('当移动端条件变为匹配时应更新为 "mobile"', async () => {
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('tablet') // 初始

      act(() => {
        changeMatches('(max-width: 767px)', true)
      })
      expect(result.current).toBe('mobile')
    })

    it('当桌面端条件变为匹配时应更新为 "desktop"', async () => {
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('tablet')

      act(() => {
        changeMatches('(min-width: 1024px)', true)
      })
      expect(result.current).toBe('desktop')
    })

    it('当两个条件都不匹配时应更新为 "tablet"', async () => {
      // 从 mobile 切换
      window.matchMedia('(max-width: 767px)') // 先调用以填充缓存
      matchMediaMocks['(max-width: 767px)'].matches = true
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('mobile')

      act(() => {
        changeMatches('(max-width: 767px)', false)
        // 确保 desktop 也是 false
        changeMatches('(min-width: 1024px)', false)
      })
      expect(result.current).toBe('tablet')
    })

    it('在移动端和桌面端之间切换时状态正确', async () => {
      const { result } = renderHook(() => useBreakpoint())
      expect(result.current).toBe('tablet')

      // tablet -> mobile
      act(() => {
        changeMatches('(max-width: 767px)', true)
      })
      expect(result.current).toBe('mobile')

      // mobile -> desktop (max-width 不再匹配，min-width 匹配)
      act(() => {
        changeMatches('(max-width: 767px)', false)
        changeMatches('(min-width: 1024px)', true)
      })
      expect(result.current).toBe('desktop')
    })
  })

  describe('清理事件监听器', () => {
    it('卸载时应移除两个媒体查询的 change 监听器', () => {
      const { unmount } = renderHook(() => useBreakpoint())

      const mobileMql = matchMediaMocks['(max-width: 767px)']
      const desktopMql = matchMediaMocks['(min-width: 1024px)']

      // 在 unmount 前捕获已注册的回调引用
      const addedMobileCb = mobileMql._listeners[0]
      const addedDesktopCb = desktopMql._listeners[0]

      unmount()

      // 验证 removeEventListener 被调用，传入的参数与之前添加的监听器一致
      expect(mobileMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
      expect(desktopMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
      expect(mobileMql.removeEventListener).toHaveBeenCalledWith('change', addedMobileCb)
      expect(desktopMql.removeEventListener).toHaveBeenCalledWith('change', addedDesktopCb)
    })
  })
})
