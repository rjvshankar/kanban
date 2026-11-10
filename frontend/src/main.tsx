// App entry point: mounts the React app into the #root element in index.html.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Follow the OS light/dark setting by toggling the "dark" class that the theme in index.css keys off.
const media = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches)
applyTheme()
media.addEventListener('change', applyTheme)

// StrictMode double-runs effects in development to surface bugs; it has no effect in production.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
