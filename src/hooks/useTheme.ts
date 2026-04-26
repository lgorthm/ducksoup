import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (private browsing, permissions, etc.)
  }
  return null
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'

    // The inline script in index.html resolves the theme before first paint
    // and sets the dark class on <html>. Read from DOM to guarantee React
    // state matches what's already rendered — no flicker on hydration.
    if (document.documentElement.classList.contains('dark')) return 'dark'

    // Fallback for environments where the inline script didn't run (tests, SSR)
    return getStoredTheme() ?? getSystemTheme()
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // silently ignore localStorage failures
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // silently ignore
      }
      return next
    })
  }, [])

  return { theme, toggleTheme, setTheme } as const
}
