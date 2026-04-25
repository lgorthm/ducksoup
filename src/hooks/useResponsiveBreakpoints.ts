import { useEffect, useState } from 'react'

type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export function useResponsiveBreakpoints(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint(window.innerWidth))

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const desktopQuery = window.matchMedia('(min-width: 1024px)')

    const updateBreakpoint = () => {
      setBreakpoint(getBreakpoint(window.innerWidth))
    }

    // 现代浏览器推荐使用 addEventListener
    mobileQuery.addEventListener('change', updateBreakpoint)
    desktopQuery.addEventListener('change', updateBreakpoint)

    return () => {
      mobileQuery.removeEventListener('change', updateBreakpoint)
      desktopQuery.removeEventListener('change', updateBreakpoint)
    }
  }, [])

  return breakpoint
}

function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}
