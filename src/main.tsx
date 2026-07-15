import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/print.css'
import App from './App.tsx'
import { SemesterCatalogProvider } from './data/SemesterCatalogContext.tsx'
import { UpdateAwarenessProvider } from './updates/UpdateAwarenessContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SemesterCatalogProvider>
      <UpdateAwarenessProvider>
        <App />
      </UpdateAwarenessProvider>
    </SemesterCatalogProvider>
  </StrictMode>,
)
