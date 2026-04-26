import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router.tsx'
import { ApiKeyProvider } from './hooks/useApiKey'
import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiKeyProvider>
      <RouterProvider router={router} />
    </ApiKeyProvider>
  </StrictMode>,
)
