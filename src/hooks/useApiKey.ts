import { useCallback, useState } from 'react'

const STORAGE_KEY = 'ducksoup-deepseek-apikey'

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key)
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // silently ignore localStorage failures
    }
  }, [])

  return { apiKey, setApiKey } as const
}
