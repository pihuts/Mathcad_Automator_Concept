import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import './styles/variables.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider as CustomThemeProvider } from './theme/ThemeContext'
import { cssVariables } from './theme/mui-theme'

// Register AG Grid modules (required for v35+)
ModuleRegistry.registerModules([AllCommunityModule])

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <CssBaseline />
        <style>{cssVariables}</style>
        <App />
      </CustomThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
