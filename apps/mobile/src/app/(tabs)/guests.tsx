import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'

interface Event {
  id: string
  name: string
  start_date: string
}

interface Guest {
  id: string
  name: string
  email?: string
  phone?: string
  category: string
  rsvp_status: string
  check_in_status: string
  is_vip: boolean
  plus_ones: number
  meal_preference?: string
}

interface GuestStats {
  total: number
  checkedIn: number
  checkInRate: number
  confirmed: number
  vipCount: number
}

const RSVP_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#14532d', text: '#86efac' },
  pending: { bg: '#451a03', text: '#fcd34d' },
  declined: { bg: '#3b0a0a', text: '#fca5a5' },
  waitlisted: { bg: '#1e1b4b', text: '#a5b4fc' },
  maybe: { bg: '#1c1917', text: '#d6d3d1' },
}

const CHECKIN_COLORS: Record<string, { icon: string; color: string }> = {
  checked_in: { icon: 'checkmark-circle', color: '#22c55e' },
  pending: { icon: 'ellipse-outline', color: '#71717a' },
  no_show: { icon: 'close-circle', color: '#ef4444' },
}

export default function GuestsScreen() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'checked_in' | 'vip'>('all')
  const [showEventPicker, setShowEventPicker] = useState(false)
  const qc = useQueryClient()
  const router = useRouter()

  // Load events for selector
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['events-list'],
    queryFn: () => api.get('/events?page_size=20&status=planning,confirmed,ongoing'),
  })

  const selectedEvent = (events as Event[]).find(e => e.id === selectedEventId) ?? (events as Event[])[0]
  const activeEventId = selectedEvent?.id ?? null

  // Load guests for selected event
  const { data: guests = [], isLoading, refetch } = useQuery<Guest[]>({
    queryKey: ['mobile-guests', activeEventId],
    queryFn: () => activeEventId ? api.get(`/portal/guests/${activeEventId}`) : Promise.resolve([]),
    enabled: !!activeEventId,
  })

  // Load stats
  const { data: stats } = useQuery<GuestStats>({
    queryKey: ['mobile-guest-stats', activeEventId],
    queryFn: () => activeEventId ? api.get(`/portal/guests/${activeEventId}/stats`) : Promise.resolve(null),
    enabled: !!activeEventId,
  })

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: (guestId: string) => api.patch(`/portal/guests/${guestId}/checkin`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-guests', activeEventId] })
      qc.invalidateQueries({ queryKey: ['mobile-guest-stats', activeEventId] })
    },
    onError: (err: unknown) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Check-in failed')
    },
  })

  const handleCheckIn = useCallback((guest: Guest) => {
    if (guest.check_in_status === 'checked_in') return
    Alert.alert(
      'Check In Guest',
      `Check in ${guest.name}${guest.plus_ones > 0 ? ` (+${guest.plus_ones})` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In',
          style: 'default',
          onPress: () => checkInMutation.mutate(guest.id),
        },
      ],
    )
  }, [checkInMutation])

  const filteredGuests = (guests as Guest[]).filter(g => {
    const matchesSearch =
      !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.email?.toLowerCase().includes(search.toLowerCase()) ||
      g.phone?.includes(search)

    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && g.check_in_status === 'pending') ||
      (filter === 'checked_in' && g.check_in_status === 'checked_in') ||
      (filter === 'vip' && g.is_vip)

    return matchesSearch && matchesFilter
  })

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Awaiting' },
    { key: 'checked_in', label: 'Checked In' },
    { key: 'vip', label: 'VIP' },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Guests</Text>
          <TouchableOpacity
            onPress={() => router.push('/kiosk' as never)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#6366f120',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#6366f140',
            }}
          >
            <Ionicons name="qr-code-outline" size={16} color="#6366f1" />
            <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '600' }}>QR Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Event Selector */}
        <TouchableOpacity
          onPress={() => setShowEventPicker(!showEventPicker)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#111111',
            borderWidth: 1,
            borderColor: '#1f1f1f',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color="#71717a" />
          <Text style={{ flex: 1, color: selectedEvent ? '#fafafa' : '#71717a', fontSize: 13 }} numberOfLines={1}>
            {selectedEvent?.name ?? 'Select event…'}
          </Text>
          <Ionicons name={showEventPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#71717a" />
        </TouchableOpacity>

        {/* Event picker dropdown */}
        {showEventPicker && (
          <View style={{
            backgroundColor: '#111111',
            borderWidth: 1,
            borderColor: '#1f1f1f',
            borderRadius: 12,
            marginBottom: 8,
            overflow: 'hidden',
          }}>
            {(events as Event[]).slice(0, 8).map(event => (
              <TouchableOpacity
                key={event.id}
                onPress={() => {
                  setSelectedEventId(event.id)
                  setShowEventPicker(false)
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#1a1a1a',
                  backgroundColor: selectedEventId === event.id ? '#6366f110' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {selectedEventId === event.id && (
                  <Ionicons name="checkmark" size={14} color="#6366f1" />
                )}
                <Text style={{ color: '#fafafa', fontSize: 13, flex: 1 }} numberOfLines={1}>{event.name}</Text>
                <Text style={{ color: '#71717a', fontSize: 11 }}>
                  {new Date(event.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats bar */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Total', value: stats.total, color: '#6366f1' },
              { label: 'In', value: stats.checkedIn, color: '#22c55e' },
              { label: `${stats.checkInRate}%`, value: null, color: '#f59e0b', sublabel: 'Rate' },
              { label: 'VIP', value: stats.vipCount, color: '#a855f7' },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1,
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 10,
                padding: 8,
                alignItems: 'center',
              }}>
                <Text style={{ color: s.color, fontSize: 16, fontWeight: '700' }}>
                  {s.value !== null ? s.value : s.label}
                </Text>
                <Text style={{ color: '#71717a', fontSize: 10, marginTop: 1 }}>
                  {s.value !== null ? s.label : s.sublabel}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Search */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#111111',
          borderWidth: 1,
          borderColor: '#1f1f1f',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 8,
          marginBottom: 10,
        }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search guests…"
            placeholderTextColor="#71717a"
            style={{ flex: 1, color: '#fafafa', fontSize: 14 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close" size={16} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: filter === f.key ? '#6366f1' : '#111111',
                borderWidth: 1,
                borderColor: filter === f.key ? '#6366f1' : '#1f1f1f',
              }}
            >
              <Text style={{
                color: filter === f.key ? 'white' : '#71717a',
                fontSize: 12,
                fontWeight: '500',
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Guest List */}
      <FlatList
        data={filteredGuests}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ['mobile-guests', activeEventId] })
              refetch()
            }}
            tintColor="#6366f1"
          />
        }
        renderItem={({ item: guest }) => {
          const checkinInfo = CHECKIN_COLORS[guest.check_in_status] ?? CHECKIN_COLORS.pending
          const rsvpInfo = RSVP_COLORS[guest.rsvp_status] ?? RSVP_COLORS.pending
          const isCheckedIn = guest.check_in_status === 'checked_in'
          const isMutating = checkInMutation.isPending

          return (
            <View style={{
              backgroundColor: '#111111',
              borderWidth: 1,
              borderColor: isCheckedIn ? '#166534' : '#1f1f1f',
              borderRadius: 14,
              padding: 14,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* Avatar */}
              <View style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: guest.is_vip ? '#7c3aed20' : '#3f3f4620',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: guest.is_vip ? '#7c3aed60' : '#3f3f46',
              }}>
                {guest.is_vip ? (
                  <Ionicons name="star" size={18} color="#a855f7" />
                ) : (
                  <Text style={{ color: '#a1a1aa', fontSize: 16, fontWeight: '700' }}>
                    {guest.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              {/* Info */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: isCheckedIn ? '#86efac' : '#fafafa', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                    {guest.name}
                  </Text>
                  {guest.is_vip && (
                    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: '#7c3aed20' }}>
                      <Text style={{ color: '#a855f7', fontSize: 9, fontWeight: '700' }}>VIP</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: rsvpInfo.bg }}>
                    <Text style={{ color: rsvpInfo.text, fontSize: 10, fontWeight: '500', textTransform: 'capitalize' }}>
                      {guest.rsvp_status}
                    </Text>
                  </View>
                  {guest.category !== 'general' && (
                    <Text style={{ color: '#71717a', fontSize: 11, textTransform: 'capitalize' }}>{guest.category}</Text>
                  )}
                  {guest.plus_ones > 0 && (
                    <Text style={{ color: '#71717a', fontSize: 11 }}>+{guest.plus_ones}</Text>
                  )}
                </View>
              </View>

              {/* Check-in button */}
              <TouchableOpacity
                onPress={() => !isCheckedIn && handleCheckIn(guest)}
                disabled={isCheckedIn || isMutating}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isCheckedIn ? '#14532d' : '#1f1f1f',
                  borderWidth: 1.5,
                  borderColor: isCheckedIn ? '#166534' : '#3f3f46',
                }}
              >
                {isMutating ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Ionicons
                    name={checkinInfo.icon as any}
                    size={22}
                    color={checkinInfo.color}
                  />
                )}
              </TouchableOpacity>
            </View>
          )
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14, textAlign: 'center' }}>
                {!activeEventId
                  ? 'Select an event to view guests'
                  : search
                  ? 'No guests match your search'
                  : 'No guests found'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
