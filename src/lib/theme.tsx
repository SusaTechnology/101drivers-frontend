/**
 * Custom theme provider — drop-in replacement for next-themes.
 *
 * Uses React context + localStorage + CSS class on <html>.
 * API is identical to next-themes useTheme():
 *   const { theme, setTheme } = useTheme()
 *
 * Usage in root:
 *   <ThemeProvider attribute="class" defaultTheme="light">
 *     <App />
 *   </ThemeProvider>
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme | undefined
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: undefined,
  setTheme: () => {},
})

interface ThemeProviderProps {
  children: ReactNode
  /** HTML attribute to set — only "class" is supported */
  attribute?: string
  /** Default theme when nothing is stored */
  defaultTheme?: Theme
  /** Respect OS preference (not used — kept for API compat) */
  enableSystem?: boolean
  /** Disable CSS transitions when changing theme (not used — kept for API compat) */
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme | undefined>(() => {
    if (typeof window === 'undefined') return defaultTheme
    return (localStorage.getItem('theme') as Theme) || defaultTheme
  })

  // Apply the theme to <html> whenever it changes
  useEffect(() => {
    if (!theme) return

    const root = document.documentElement

    if (attribute === 'class') {
      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    localStorage.setItem('theme', theme)
  }, [theme, attribute])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a <ThemeProvider>')
  }
  return context
}
