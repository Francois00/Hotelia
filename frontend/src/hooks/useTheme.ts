import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('hotel_theme') as Theme
    if (stored) return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('hotel_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState(t => t === 'light' ? 'dark' : 'light')
  }, [])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' }
}
