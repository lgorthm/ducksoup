import { useState, useCallback, useRef, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const userClosedRef = useRef(false)
  const prevWidthRef = useRef(0)

  useEffect(() => {
    const width = window.innerWidth
    prevWidthRef.current = width
    if (width >= DESKTOP_BREAKPOINT) {
      setIsOpen(true)
    }
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    userClosedRef.current = false
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    if (window.innerWidth >= DESKTOP_BREAKPOINT) {
      userClosedRef.current = true
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth
      const prevWidth = prevWidthRef.current

      let shouldClose = false
      let shouldOpenConditionally = false

      // 768px breakpoint: crossing between mobile and tablet
      const crossedMobileBoundary =
        (prevWidth >= MOBILE_BREAKPOINT && currentWidth < MOBILE_BREAKPOINT) ||
        (prevWidth < MOBILE_BREAKPOINT &&
          currentWidth >= MOBILE_BREAKPOINT &&
          currentWidth < DESKTOP_BREAKPOINT)

      if (crossedMobileBoundary) {
        shouldClose = true
      }

      // 1024px breakpoint: auto-close when shrinking past threshold
      if (prevWidth >= DESKTOP_BREAKPOINT && currentWidth < DESKTOP_BREAKPOINT) {
        shouldClose = true
      } else if (prevWidth < DESKTOP_BREAKPOINT && currentWidth >= DESKTOP_BREAKPOINT) {
        shouldOpenConditionally = true
      }

      if (shouldClose) {
        setIsOpen(false)
      } else if (shouldOpenConditionally && !userClosedRef.current) {
        setIsOpen(true)
      }

      prevWidthRef.current = currentWidth
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isOpen, open, close, toggle: () => (isOpen ? close() : open()) }
}
