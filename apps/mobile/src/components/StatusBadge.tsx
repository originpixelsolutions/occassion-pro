import { View, Text } from 'react-native'

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  // Event statuses
  draft:       { bg: '#27272a', text: '#a1a1aa', label: 'Draft' },
  planning:    { bg: '#1e3a5f', text: '#60a5fa', label: 'Planning' },
  confirmed:   { bg: '#14532d', text: '#4ade80', label: 'Confirmed' },
  in_progress: { bg: '#78350f', text: '#fbbf24', label: 'In Progress' },
  live:        { bg: '#7c2d12', text: '#fb923c', label: 'Live' },
  completed:   { bg: '#1e1b4b', text: '#818cf8', label: 'Completed' },
  cancelled:   { bg: '#27272a', text: '#71717a', label: 'Cancelled' },
  // Guest statuses
  invited:     { bg: '#1e3a5f', text: '#60a5fa', label: 'Invited' },
  confirmed_guest: { bg: '#14532d', text: '#4ade80', label: 'Confirmed' },
  checked_in:  { bg: '#7c2d12', text: '#fb923c', label: 'Checked In' },
  declined:    { bg: '#27272a', text: '#71717a', label: 'Declined' },
  // Task/runsheet statuses
  pending:     { bg: '#27272a', text: '#a1a1aa', label: 'Pending' },
  done:        { bg: '#14532d', text: '#4ade80', label: 'Done' },
  blocked:     { bg: '#450a0a', text: '#f87171', label: 'Blocked' },
  skipped:     { bg: '#27272a', text: '#71717a', label: 'Skipped' },
}

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { bg: '#27272a', text: '#a1a1aa', label: status }

  return (
    <View
      style={{
        backgroundColor: config.bg,
        borderRadius: 999,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        paddingVertical: size === 'sm' ? 2 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: config.text,
          fontSize: size === 'sm' ? 10 : 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {config.label}
      </Text>
    </View>
  )
}
