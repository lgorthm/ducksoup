import { useEffect, useState } from 'react'

type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const MOBILE_QUERY = '(max-width: 767px)'
const DESKTOP_QUERY = '(min-width: 1024px)'

function deriveBreakpoint(isMobile: boolean, isDesktop: boolean): Breakpoint {
  if (isMobile) return 'mobile'
  if (isDesktop) return 'desktop'
  return 'tablet'
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    // SSR 安全
    if (typeof window === 'undefined') return 'desktop' // 或 'mobile'，按实际需求定
    const mobileMatches = window.matchMedia(MOBILE_QUERY).matches
    const desktopMatches = window.matchMedia(DESKTOP_QUERY).matches
    return deriveBreakpoint(mobileMatches, desktopMatches)
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mobileQuery = window.matchMedia(MOBILE_QUERY)
    const desktopQuery = window.matchMedia(DESKTOP_QUERY)

    const handleChange = () => {
      setBreakpoint(deriveBreakpoint(mobileQuery.matches, desktopQuery.matches))
    }

    // 统一用一个处理函数，避免重复触发
    mobileQuery.addEventListener('change', handleChange)
    desktopQuery.addEventListener('change', handleChange)

    return () => {
      mobileQuery.removeEventListener('change', handleChange)
      desktopQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return breakpoint
}
