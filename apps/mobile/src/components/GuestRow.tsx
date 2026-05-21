import { TouchableOpacity, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StatusBadge from './StatusBadge'

export interface Guest {
  id: string
  guest_name: string
  email?: string
  phone?: string
  category?: string
  rsvp_status?: string
  checked_in?: boolean
  checked_in_at?: string
  table_number?: string
  seat_number?: string
  plus_one?: boolean
  company?: string
}

interface GuestRowProps {
  guest: Guest
  onPress?: (guest: Guest) => void
  onCheckIn?: (guest: Guest) => void
  showCheckIn?: boolean
  highlight?: boolean
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(p => p[0] ?? '')
    .join('')
    .toUpperCase()
}

const CATEGORY_COLORS: Record<string, string> = {
  VIP: '#a855f7',
  Family: '#3b82f6',
  Friends: '#22c55e',
  Corporate: '#f59e0b',
  Media: '#ec4899',
  Speaker: '#14b8a6',
}

export default function GuestRow({
  guest,
  onPress,
  onCheckIn,
  showCheckIn = false,
  highlight = false,
}: GuestRowProps) {
  const categoryColor = CATEGORY_COLORS[guest.category ?? ''] ?? '#6366f1'
  const status = guest.checked_in ? 'checked_in' : (guest.rsvp_status ?? 'invited')

  return (
    <TouchableOpacity
      onPress={() => onPress?.(guest)}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: highlight ? '#1a1a2e' : '#111111',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: highlight ? '#3730a3' : '#1f1f1f',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
        gap: 12,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: categoryColor + '22',
          borderWidth: 1,
          borderColor: categoryColor + '44',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ color: categoryColor, fontSize: 13, fontWeight: '700' }}>
          {initials(guest.guest_name)}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', flexShrink: 1 }}
            numberOfLines={1}
          >
            {guest.guest_name}
          </Text>
          {guest.plus_one && (
            <Text style={{ color: '#52525b', fontSize: 11 }}>+1</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {guest.category && (
            <Text style={{ color: categoryColor, fontSize: 11, fontWeight: '500' }}>
              {guest.category}
            </Text>
          )}
          {guest.company && (
            <Text style={{ color: '#52525b', fontSize: 11 }} numberOfLines={1}>
              {guest.company}
            </Text>
          )}
          {guest.table_number && (
            <Text style={{ color: '#52525b', fontSize: 11 }}>
              T{guest.table_number}
              {guest.seat_number ? `·S${guest.seat_number}` : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Right side */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StatusBadge status={status} size="sm" />
        {showCheckIn && !guest.checked_in && (
          <TouchableOpacity
            onPress={() => onCheckIn?.(guest)}
            style={{
              backgroundColor: '#6366f1',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Ionicons name="checkmark" size={14} color="#ffffff" />
          </TouchableOpacity>
        )}
        {guest.checked_in && (
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
        )}
      </View>
    </TouchableOpacity>
  )
}
