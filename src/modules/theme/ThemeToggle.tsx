import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'copilot-theme'

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'dark' || stored === 'light') {
    return stored
  }

  return 'dark'
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  window.dispatchEvent(
    new CustomEvent('copilot-theme-change', {
      detail: { theme },
    }),
  )
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(current => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return (
    <button
      type="button"
      className="copilot-theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
