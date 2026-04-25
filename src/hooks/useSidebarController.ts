import { useCallback, useEffect, useRef, useState } from 'react'
import { useResponsiveBreakpoints } from './useResponsiveBreakpoints'

export function useSidebarController() {
  const breakpoint = useResponsiveBreakpoints()
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    // 初始：仅 desktop（>=1024）自动打开，其余关闭
    breakpoint === 'desktop',
  )
  const [userClosedManually, setUserClosedManually] = useState(false)

  // 使用 ref 追踪上一次断点，避免过多依赖
  const prevBreakpointRef = useRef(breakpoint)
  const prevSidebarOpenRef = useRef(sidebarOpen)
  prevSidebarOpenRef.current = sidebarOpen

  useEffect(() => {
    const prev = prevBreakpointRef.current
    prevBreakpointRef.current = breakpoint

    // 从 desktop 缩小到 tablet 且侧栏打开 → 自动关闭（不改变标记）
    if (prev === 'desktop' && breakpoint === 'tablet' && prevSidebarOpenRef.current) {
      setSidebarOpen(false)
      // userClosedManually 保持不变
      return
    }

    // 从 tablet 或 mobile 扩大到 desktop，且侧栏关闭时
    if (breakpoint === 'desktop' && prev !== 'desktop' && !prevSidebarOpenRef.current) {
      if (!userClosedManually) {
        setSidebarOpen(true)
      }
      return
    }

    // 进入移动端（<768）：强制关闭，不改变标记
    if (breakpoint === 'mobile' && prev !== 'mobile' && prevSidebarOpenRef.current) {
      setSidebarOpen(false)
      return
    }

    // 从移动端进入 tablet（768-1023）：强制关闭（如果开着），不改变标记
    if (breakpoint === 'tablet' && prev === 'mobile' && prevSidebarOpenRef.current) {
      setSidebarOpen(false)
      return
    }
  }, [breakpoint, userClosedManually]) // 注意这里保留了 userClosedManually 依赖

  // 手动打开：重置标记，打开侧栏
  const openSidebar = useCallback(() => {
    setSidebarOpen(true)
    setUserClosedManually(false)
  }, [])

  // 手动关闭：桌面断点才设置 userClosedManually
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
    if (breakpoint === 'desktop') {
      setUserClosedManually(true)
    }
    // tablet 或 mobile 手动关闭不改变标记
  }, [breakpoint])

  return {
    sidebarOpen,
    userClosedManually,
    openSidebar,
    closeSidebar,
    breakpoint,
  }
}
