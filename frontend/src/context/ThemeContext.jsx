import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'asanlink.theme'
export const THEMES = ['light', 'dark']

const initialTheme = () => {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (THEMES.includes(saved)) return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((nextTheme) => {
    if (THEMES.includes(nextTheme)) setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length
      return THEMES[nextIndex]
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, themes: THEMES }),
    [theme, setTheme, toggleTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider.')
  return value
}
