'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn(
        'w-9 h-9 rounded-lg bg-muted animate-pulse',
        className
      )} />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative w-9 h-9 rounded-lg flex items-center justify-center',
        'border border-border bg-card hover:bg-accent',
        'transition-all duration-200 group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {/* Sun icon — visible in dark mode */}
      <Sun
        className={cn(
          'absolute w-4 h-4 text-amber-400 transition-all duration-300',
          isDark
            ? 'opacity-100 scale-100 rotate-0'
            : 'opacity-0 scale-50 rotate-90'
        )}
      />
      {/* Moon icon — visible in light mode */}
      <Moon
        className={cn(
          'absolute w-4 h-4 text-slate-500 transition-all duration-300',
          isDark
            ? 'opacity-0 scale-50 -rotate-90'
            : 'opacity-100 scale-100 rotate-0'
        )}
      />
    </button>
  )
}
