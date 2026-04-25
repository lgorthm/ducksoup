// useSidebar.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { useSidebar } from './useSidebar'

// 模拟 useBreakpoint，使其返回可控的断点值
const mockUseBreakpoint = vi.fn()
vi.mock('./useBreakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}))

describe('useSidebar', () => {
  let currentBreakpoint: 'mobile' | 'tablet' | 'desktop'

  beforeEach(() => {
    // 每个用例前重置为 desktop，可根据需要调整
    currentBreakpoint = 'desktop'
    mockUseBreakpoint.mockImplementation(() => currentBreakpoint)
  })

  const renderSidebarHook = () => renderHook(() => useSidebar())

  // 辅助：改变断点并重渲染
  const changeBreakpoint = (rerender: () => void, breakpoint: 'mobile' | 'tablet' | 'desktop') => {
    currentBreakpoint = breakpoint
    act(() => rerender())
  }

  it('初始断点为 desktop 时，侧栏打开，userClosedManually 为 false', () => {
    const { result } = renderSidebarHook()
    expect(result.current.sidebarOpen).toBe(true)
    expect(result.current.userClosedManually).toBe(false)
  })

  it('初始断点为 tablet 时，侧栏关闭', () => {
    currentBreakpoint = 'tablet'
    const { result } = renderSidebarHook()
    expect(result.current.sidebarOpen).toBe(false)
  })

  it('初始断点为 mobile 时，侧栏关闭', () => {
    currentBreakpoint = 'mobile'
    const { result } = renderSidebarHook()
    expect(result.current.sidebarOpen).toBe(false)
  })

  describe('自动响应断点变化', () => {
    it('从 desktop 缩小到 tablet（侧栏正打开）→ 自动关闭，标记不变', () => {
      const { result, rerender } = renderSidebarHook()
      expect(result.current.sidebarOpen).toBe(true)

      changeBreakpoint(rerender, 'tablet')

      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('从 desktop 缩小到 tablet（侧栏已关闭）→ 保持关闭', () => {
      const { result, rerender } = renderSidebarHook()
      // 先手动关闭，设置标记为 true
      act(() => result.current.closeSidebar())
      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(true)

      changeBreakpoint(rerender, 'tablet')

      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(true)
    })

    it('从 desktop 直接缩小到 mobile（侧栏正打开）→ 强制关闭', () => {
      const { result, rerender } = renderSidebarHook()
      expect(result.current.sidebarOpen).toBe(true)

      changeBreakpoint(rerender, 'mobile')

      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('从 mobile 扩大到 desktop（未手动关闭过）→ 自动打开', () => {
      currentBreakpoint = 'mobile'
      const { result, rerender } = renderSidebarHook()
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'desktop')

      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('从 mobile 扩大到 desktop（已手动关闭过）→ 保持关闭', () => {
      currentBreakpoint = 'desktop'
      const { result, rerender } = renderSidebarHook()
      // 在 desktop 手动关闭，设置 userClosedManually = true
      act(() => result.current.closeSidebar())
      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(true)

      changeBreakpoint(rerender, 'mobile')
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'desktop')
      // 因为 userClosedManually 为 true，不会自动打开
      expect(result.current.sidebarOpen).toBe(false)
    })

    it('从 tablet 扩大到 desktop（未手动关闭过）→ 自动打开', () => {
      currentBreakpoint = 'tablet'
      const { result, rerender } = renderSidebarHook()
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'desktop')

      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('从 tablet 扩大到 desktop（已手动关闭过）→ 保持关闭', () => {
      currentBreakpoint = 'desktop'
      const { result, rerender } = renderSidebarHook()
      act(() => result.current.closeSidebar())
      expect(result.current.userClosedManually).toBe(true)

      changeBreakpoint(rerender, 'tablet')
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'desktop')
      expect(result.current.sidebarOpen).toBe(false)
    })

    it('从 mobile 进入 tablet（侧栏被手动打开时）→ 强制关闭', () => {
      currentBreakpoint = 'mobile'
      const { result, rerender } = renderSidebarHook()
      // 在 mobile 手动打开侧栏
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)

      changeBreakpoint(rerender, 'tablet')

      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('从 tablet 进入 mobile（侧栏打开时）→ 强制关闭', () => {
      currentBreakpoint = 'tablet'
      const { result, rerender } = renderSidebarHook()
      // 在 tablet 手动打开侧栏
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)

      changeBreakpoint(rerender, 'mobile')

      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(false)
    })
  })

  describe('手动操作', () => {
    it('openSidebar 可在任意断点打开侧栏并重置 userClosedManually', () => {
      // desktop
      currentBreakpoint = 'desktop'
      const { result, rerender } = renderSidebarHook()
      act(() => result.current.closeSidebar())
      expect(result.current.userClosedManually).toBe(true)
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)

      // tablet
      changeBreakpoint(rerender, 'tablet')
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)

      // mobile
      changeBreakpoint(rerender, 'mobile')
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('closeSidebar 在 desktop 会设置 userClosedManually 为 true', () => {
      currentBreakpoint = 'desktop'
      const { result } = renderSidebarHook()
      act(() => result.current.closeSidebar())
      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(true)
    })

    it('closeSidebar 在 tablet 不会改变 userClosedManually', () => {
      currentBreakpoint = 'tablet'
      const { result } = renderSidebarHook()
      act(() => result.current.closeSidebar())
      expect(result.current.sidebarOpen).toBe(false)
      // 初始为 false，手动关闭后仍为 false
      expect(result.current.userClosedManually).toBe(false)
    })

    it('closeSidebar 在 mobile 不会改变 userClosedManually', () => {
      currentBreakpoint = 'mobile'
      const { result } = renderSidebarHook()
      act(() => result.current.closeSidebar())
      expect(result.current.sidebarOpen).toBe(false)
      expect(result.current.userClosedManually).toBe(false)
    })
  })

  describe('边界场景', () => {
    it('在 tablet 手动打开后放大到 desktop 保持打开', () => {
      currentBreakpoint = 'tablet'
      const { result, rerender } = renderSidebarHook()
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)

      changeBreakpoint(rerender, 'desktop')
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('在 mobile 手动打开后放大到 desktop 保持打开', () => {
      currentBreakpoint = 'mobile'
      const { result, rerender } = renderSidebarHook()
      act(() => result.current.openSidebar())
      expect(result.current.sidebarOpen).toBe(true)

      changeBreakpoint(rerender, 'desktop')
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.userClosedManually).toBe(false)
    })

    it('连续快速切换断点不会产生错误状态', () => {
      const { result, rerender } = renderSidebarHook()
      // desktop -> tablet -> mobile -> tablet -> desktop
      changeBreakpoint(rerender, 'tablet')
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'mobile')
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'tablet')
      expect(result.current.sidebarOpen).toBe(false)

      changeBreakpoint(rerender, 'desktop')
      // 从未手动关闭，应自动打开
      expect(result.current.sidebarOpen).toBe(true)
    })

    it('返回的 breakpoint 与模拟值一致', () => {
      const { result } = renderSidebarHook()
      expect(result.current.breakpoint).toBe('desktop')
    })
  })
})
