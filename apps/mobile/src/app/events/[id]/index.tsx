import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import ProgressRing from '@/components/ProgressRing'
import QuickStats from '@/components/QuickStats'

interface EventDetail {
  id: string
  name: string
  event_type?: string
  status: string
  start_date: string
  end_date?: string
  expected_guests?: number
  notes?: string
  budget?: number
  currency?: string
  venues?: { name: string; city: string }
}

interface GuestStats {
  total: number
  checkedIn: number
  checkInRate: number
  vipCount: number
  confirmed: number
  pending: number
}

interface TaskStats {
  total: number
  done: number
  overdue: number
  inProgress: number
}

interface Module {
  key: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  route: string
  color: string
  badge?: string | number
  description: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function daysLabel(startDate: string): { text: string; urgent: boolean } {
  const diff = Math.ceil((new Date(startDate).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { text: 'Concluded', urgent: false }
  if (diff === 0) return { text: 'Today!', urgent: true }
  if (diff === 1) return { text: 'Tomorrow', urgent: true }
  if (diff <= 7) return { text: `${diff}d away`, urgent: true }
  return { text: `${diff}d away`, urgent: false }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const { data: event, isLoading: loadingEvent, refetch: refetchEvent } = useQuery<EventDetail>({
    queryKey: ['event-detail', id],
    queryFn: () => api.get(`/events/${id}`),
    enabled: !!id,
  })

  const { data: guestStats, refetch: refetchGuests } = useQuery<GuestStats>({
    queryKey: ['event-guest-stats', id],
    queryFn: () => api.get(`/portal/guests/${id}/stats`),
    enabled: !!id,
  })

  const { data: taskStats, refetch: refetchTasks } = useQuery<TaskStats>({
    queryKey: ['event-task-stats', id],
    queryFn: () => api.get(`/events/${id}/tasks/stats`),
    enabled: !!id,
  })

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['event-notif-count', id],
    queryFn: () => api.get(`/notifications?event_id=${id}&unread=true&count=true`),
    enabled: !!id,
    refetchInterval: 30000,
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchEvent(), refetchGuests(), refetchTasks()])
    setRefreshing(false)
  }

  const MODULES: Module[] = [
    {
      key: 'guests',
      label: 'Guests',
      icon: 'people',
      route: `/events/${id}/guests`,
      color: '#6366f1',
      badge: guestStats?.total,
      description: `${guestStats?.checkedIn ?? 0} checked in`,
    },
    {
      key: 'checkin',
      label: 'QR Check-In',
      icon: 'qr-code',
      route: `/events/${id}/checkin`,
      color: '#22c55e',
      description: `${guestStats?.checkInRate ?? 0}% arrived`,
    },
    {
      key: 'runsheet',
      label: 'Runsheet',
      icon: 'list',
      route: `/events/${id}/runsheet`,
      color: '#f59e0b',
      description: 'Live schedule',
    },
    {
      key: 'notifications',
      label: 'Alerts',
      icon: 'notifications',
      route: `/events/${id}/notifications`,
      color: '#ec4899',
      badge: (unreadCount?.count ?? 0) > 0 ? unreadCount?.count : undefined,
      description: `${unreadCount?.count ?? 0} unread`,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: 'checkmark-circle',
      route: `/events/${id}/tasks` as never,
      color: '#8b5cf6',
      badge: taskStats?.overdue ? `${taskStats.overdue}!` : taskStats?.inProgress,
      description: taskStats ? `${taskStats.done}/${taskStats.total} done` : 'View tasks',
    },
    {
      key: 'floorplan',
      label: 'Floor Plan',
      icon: 'map',
      route: `/events/${id}/floorplan` as never,
      color: '#14b8a6',
      description: 'Seating layout',
    },
  ]

  const dayInfo = event ? daysLabel(event.start_date) : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1f1f1f',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fafafa" />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fafafa', fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
            {event?.name ?? 'Loading…'}
          </Text>
          {event?.venues && (
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 1 }}>
              {event.venues.name}, {event.venues.city}
            </Text>
          )}
        </View>
        {event && <StatusBadge status={event.status} size="sm" />}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || loadingEvent} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Hero card */}
        {event && (
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#1f1f1f',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Progress ring */}
            <ProgressRing
              progress={guestStats ? guestStats.checkInRate / 100 : 0}
              size={80}
              strokeWidth={7}
              color="#6366f1"
              label={guestStats ? `${guestStats.checkInRate}%` : '—'}
              sublabel="checked in"
            />

            {/* Event info */}
            <View style={{ flex: 1, gap: 6 }}>
              {event.event_type && (
                <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {event.event_type}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={13} color="#52525b" />
                <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                  {formatDate(event.start_date)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={13} color="#52525b" />
                <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                  {formatTime(event.start_date)}
                  {event.end_date ? ` – ${formatTime(event.end_date)}` : ''}
                </Text>
              </View>
              {dayInfo && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: dayInfo.urgent ? '#78350f' : '#1f1f1f',
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      color: dayInfo.urgent ? '#fbbf24' : '#71717a',
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {dayInfo.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Quick stats */}
        <QuickStats
          columns={4}
          stats={[
            {
              label: 'Guests',
              value: guestStats?.total ?? '—',
              color: '#6366f1',
            },
            {
              label: 'Checked In',
              value: guestStats?.checkedIn ?? '—',
              color: '#22c55e',
            },
            {
              label: 'Tasks Done',
              value: taskStats ? `${taskStats.done}/${taskStats.total}` : '—',
              color: '#f59e0b',
            },
            {
              label: 'VIP',
              value: guestStats?.vipCount ?? '—',
              color: '#a855f7',
            },
          ]}
        />

        {/* Module grid */}
        <View>
          <Text
            style={{
              color: '#52525b',
              fontSize: 11,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 10,
            }}
          >
            Event Modules
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MODULES.map(mod => (
              <TouchableOpacity
                key={mod.key}
                onPress={() => router.push(mod.route as never)}
                activeOpacity={0.75}
                style={{
                  width: '47%',
                  backgroundColor: '#111111',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#1f1f1f',
                  padding: 14,
                  gap: 8,
                }}
              >
                {/* Icon + badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: mod.color + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={mod.icon} size={20} color={mod.color} />
                  </View>
                  {mod.badge !== undefined && (
                    <View
                      style={{
                        backgroundColor: typeof mod.badge === 'string' && mod.badge.includes('!')
                          ? '#450a0a'
                          : '#1f1f1f',
                        borderRadius: 8,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        minWidth: 24,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: typeof mod.badge === 'string' && mod.badge.includes('!')
                            ? '#f87171'
                            : '#a1a1aa',
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {mod.badge}
                      </Text>
                    </View>
                  )}
                </View>

                <View>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>{mod.label}</Text>
                  <Text style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>{mod.description}</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color="#3f3f46"
                  style={{ position: 'absolute', bottom: 14, right: 14 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        {event?.notes && (
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#1f1f1f',
              padding: 14,
            }}
          >
            <Text
              style={{
                color: '#52525b',
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Notes
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 13, lineHeight: 20 }}>{event.notes}</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
