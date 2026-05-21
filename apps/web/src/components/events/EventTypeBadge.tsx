'use client'

interface EventType {
  id: string
  name: string
  icon: string
  color?: string
}

interface Props {
  eventType?: EventType | null
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-sm px-2 py-0.5 gap-1.5',
  lg: 'text-base px-3 py-1 gap-2',
}

const ICON_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export default function EventTypeBadge({
  eventType,
  size = 'sm',
  showIcon = true,
  className = '',
}: Props) {
  if (!eventType) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] text-white/30 font-medium ${SIZE_CLASSES[size]} ${className}`}
      >
        📅 <span>General</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: `${eventType.color || '#6366f1'}18`,
        borderColor: `${eventType.color || '#6366f1'}35`,
        color: eventType.color || '#a5b4fc',
      }}
    >
      {showIcon && (
        <span className={ICON_SIZES[size]}>{eventType.icon}</span>
      )}
      <span>{eventType.name}</span>
    </span>
  )
}
