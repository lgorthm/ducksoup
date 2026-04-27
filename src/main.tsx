import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router.tsx'
import { ApiKeyProvider } from './hooks/useApiKey'
import { AssistantsProvider } from './hooks/useAssistants'
import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiKeyProvider>
      <AssistantsProvider>
        <RouterProvider router={router} />
      </AssistantsProvider>
    </ApiKeyProvider>
  </StrictMode>,
)
