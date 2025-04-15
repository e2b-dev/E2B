'use client'

import { useEffect } from 'react'
import { ThemeProvider, useTheme } from 'next-themes'

function ThemeWatcher() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function onMediaChange() {
      const systemTheme = media.matches ? 'dark' : 'light'
      if (resolvedTheme === systemTheme) {
        setTheme('system')
      }
    }

    onMediaChange()
    media.addEventListener('change', onMediaChange)

    return () => {
      media.removeEventListener('change', onMediaChange)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export function Providers({ children }) {
  return (
    // Make the dark theme the default theme.
    <ThemeProvider
      attribute="class"
      disableTransitionOnChange
      forcedTheme="dark"
    >
      <ThemeWatcher />
      {children}
    </ThemeProvider>
  )
}
