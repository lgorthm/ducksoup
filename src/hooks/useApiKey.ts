import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react'

const STORAGE_KEY = 'ducksoup-deepseek-apikey'

function readApiKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeApiKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // silently ignore localStorage failures
  }
}

interface ApiKeyContextValue {
  apiKey: string
  setApiKey: (key: string) => void
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null)

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState(readApiKey)

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key)
    writeApiKey(key)
  }, [])

  const value = useMemo(() => ({ apiKey, setApiKey }), [apiKey, setApiKey])

  return createElement(ApiKeyContext.Provider, { value }, children)
}

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext)
  if (!ctx) {
    throw new Error('useApiKey must be used within an <ApiKeyProvider>')
  }
  return ctx
}
