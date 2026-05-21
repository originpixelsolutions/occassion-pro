import { TouchableOpacity, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export interface RunsheetEntry {
  id: string
  title: string
  description?: string
  start_time: string
  end_time?: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'skipped'
  category?: string
  assigned_to?: string
  location?: string
  is_critical?: boolean
  notes?: string
}

interface RunsheetItemProps {
  item: RunsheetEntry
  onPress?: (item: RunsheetEntry) => void
  onStatusChange?: (item: RunsheetEntry) => void
  isNow?: boolean
  isPast?: boolean
}

const STATUS_CONFIG = {
  pending:     { color: '#52525b', icon: 'ellipse-outline' as const,        bg: '#27272a' },
  in_progress: { color: '#f59e0b', icon: 'play-circle' as const,            bg: '#78350f' },
  done:        { color: '#22c55e', icon: 'checkmark-circle' as const,       bg: '#14532d' },
  blocked:     { color: '#f87171', icon: 'close-circle' as const,           bg: '#450a0a' },
  skipped:     { color: '#52525b', icon: 'remove-circle-outline' as const,  bg: '#27272a' },
}

function formatTime(isoOrTime: string) {
  // Accept either ISO datetime or "HH:MM" string
  if (isoOrTime.includes('T')) {
    return new Date(isoOrTime).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }
  return isoOrTime
}

export default function RunsheetItem({
  item,
  onPress,
  onStatusChange,
  isNow = false,
  isPast = false,
}: RunsheetItemProps) {
  const cfg = STATUS_CONFIG[item.status]

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {/* Timeline column */}
      <View style={{ width: 52, alignItems: 'center', paddingTop: 4 }}>
        <Text style={{ color: isNow ? '#6366f1' : '#52525b', fontSize: 11, fontWeight: '600' }}>
          {formatTime(item.start_time)}
        </Text>
        {item.end_time && (
          <Text style={{ color: '#3f3f46', fontSize: 10, marginTop: 2 }}>
            {formatTime(item.end_time)}
          </Text>
        )}
      </View>

      {/* Connector line */}
      <View style={{ width: 2, backgroundColor: isNow ? '#6366f1' : '#1f1f1f', marginTop: 4, borderRadius: 1 }} />

      {/* Card */}
      <TouchableOpacity
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        style={{
          flex: 1,
          backgroundColor: isNow ? '#1a1a2e' : '#111111',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isNow ? '#3730a3' : '#1f1f1f',
          padding: 12,
          marginBottom: 10,
          opacity: isPast && item.status !== 'in_progress' ? 0.6 : 1,
        }}
      >
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.is_critical && (
                <Ionicons name="alert-circle" size={14} color="#f87171" />
              )}
              <Text
                style={{
                  color: isPast ? '#71717a' : '#ffffff',
                  fontSize: 14,
                  fontWeight: '600',
                  lineHeight: 18,
                  flexShrink: 1,
                }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
            {item.description && (
              <Text
                style={{ color: '#71717a', fontSize: 12, marginTop: 3, lineHeight: 16 }}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            )}
          </View>

          {/* Status button */}
          <TouchableOpacity
            onPress={() => onStatusChange?.(item)}
            style={{
              backgroundColor: cfg.bg,
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Ionicons name={cfg.icon} size={18} color={cfg.color} />
          </TouchableOpacity>
        </View>

        {/* Meta */}
        {(item.assigned_to || item.location || item.category) && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
            }}
          >
            {item.category && (
              <View
                style={{
                  backgroundColor: '#1f1f1f',
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '500' }}>
                  {item.category}
                </Text>
              </View>
            )}
            {item.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="location-outline" size={11} color="#52525b" />
                <Text style={{ color: '#71717a', fontSize: 11 }}>{item.location}</Text>
              </View>
            )}
            {item.assigned_to && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                <Ionicons name="person-outline" size={11} color="#52525b" />
                <Text style={{ color: '#71717a', fontSize: 11 }}>{item.assigned_to}</Text>
              </View>
            )}
          </View>
        )}

        {/* Live indicator */}
        {isNow && item.status === 'in_progress' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: '#3730a3',
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
            <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>LIVE NOW</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}
