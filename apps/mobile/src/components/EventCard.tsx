import { TouchableOpacity, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'

export interface EventCardProps {
  id: string
  title: string
  status: string
  event_type?: string
  start_date?: string
  end_date?: string
  venue?: string
  guest_count?: number
  task_count?: number
  task_done?: number
  budget?: number
  currency?: string
  onPress?: () => void
}

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

function useAlertBadge(eventId: string) {
  const [counts, setCounts] = useState({ critical: 0, warning: 0 })
  useEffect(() => {
    fetch(`${API}/v1/events/${eventId}/intelligence/alerts`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{ severity: string }>) => {
        setCounts({
          critical: data.filter((a) => a.severity === 'critical').length,
          warning: data.filter((a) => a.severity === 'warning').length,
        })
      })
      .catch(() => {})
  }, [eventId])
  return counts
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount?: number, currency = 'INR') {
  if (!amount) return ''
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function EventCard({
  id,
  title,
  status,
  event_type,
  start_date,
  venue,
  guest_count,
  task_count,
  task_done,
  budget,
  currency,
  onPress,
}: EventCardProps) {
  const router = useRouter()
  const alertCounts = useAlertBadge(id)

  const handlePress = () => {
    onPress ? onPress() : router.push(`/events/${id}`)
  }

  const taskProgress = task_count ? (task_done ?? 0) / task_count : 0
  const totalAlerts = alertCounts.critical + alertCounts.warning

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#111111',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1f1f1f',
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{ color: '#ffffff', fontSize: 15, fontWeight: '600', lineHeight: 20 }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {event_type && (
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{event_type}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {totalAlerts > 0 && (
            <View
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: alertCounts.critical > 0 ? '#ef4444' : '#f59e0b',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{totalAlerts}</Text>
            </View>
          )}
          <StatusBadge status={status} size="sm" />
        </View>
      </View>

      {/* Meta row */}
      <View style={{ gap: 6 }}>
        {start_date && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={13} color="#52525b" />
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{formatDate(start_date)}</Text>
          </View>
        )}
        {venue && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={13} color="#52525b" />
            <Text style={{ color: '#a1a1aa', fontSize: 12 }} numberOfLines={1}>{venue}</Text>
          </View>
        )}
      </View>

      {/* Footer stats */}
      {(guest_count !== undefined || task_count !== undefined || budget !== undefined) && (
        <View
          style={{
            flexDirection: 'row',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#1f1f1f',
            gap: 16,
          }}
        >
          {guest_count !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="people-outline" size={13} color="#52525b" />
              <Text style={{ color: '#71717a', fontSize: 12 }}>{guest_count} guests</Text>
            </View>
          )}
          {task_count !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#52525b" />
              <Text style={{ color: '#71717a', fontSize: 12 }}>
                {task_done ?? 0}/{task_count} tasks
              </Text>
            </View>
          )}
          {budget !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
              <Text style={{ color: '#71717a', fontSize: 12 }}>{formatCurrency(budget, currency)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Task progress bar */}
      {task_count !== undefined && task_count > 0 && (
        <View
          style={{
            height: 2,
            backgroundColor: '#1f1f1f',
            borderRadius: 1,
            marginTop: 10,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${taskProgress * 100}%`,
              height: '100%',
              backgroundColor: '#6366f1',
              borderRadius: 1,
            }}
          />
        </View>
      )}
    </TouchableOpacity>
  )
}
