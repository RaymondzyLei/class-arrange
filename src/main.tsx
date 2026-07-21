import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/print.css'
import App from './App.tsx'
import { SemesterCatalogProvider } from './data/SemesterCatalogContext.tsx'
import { UpdateAwarenessProvider } from './updates/UpdateAwarenessContext.tsx'
import { EducationLevelReminderProvider } from './updates/EducationLevelReminderContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Standalone old-user education-level rollout reminder. */}
    <EducationLevelReminderProvider>
      <SemesterCatalogProvider>
        <UpdateAwarenessProvider>
          <App />
        </UpdateAwarenessProvider>
      </SemesterCatalogProvider>
    </EducationLevelReminderProvider>
  </StrictMode>,
)
