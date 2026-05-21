import { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '@/lib/api'
import GuestRow, { Guest } from '@/components/GuestRow'
import QuickStats from '@/components/QuickStats'

type FilterTab = 'all' | 'checked_in' | 'confirmed' | 'invited' | 'vip'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'checked_in', label: 'Here' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'invited', label: 'Invited' },
  { key: 'vip', label: 'VIP' },
]

interface GuestStats {
  total: number
  checkedIn: number
  checkInRate: number
  vipCount: number
  confirmed: number
}

export default function EventGuestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')

  const { data: guests = [], isLoading, refetch } = useQuery<Guest[]>({
    queryKey: ['event-guests', id],
    queryFn: () => api.get(`/events/${id}/guests`),
    enabled: !!id,
  })

  const { data: stats } = useQuery<GuestStats>({
    queryKey: ['event-guest-stats', id],
    queryFn: () => api.get(`/portal/guests/${id}/stats`),
    enabled: !!id,
  })

  const checkInMutation = useMutation({
    mutationFn: (guestId: string) =>
      api.post(`/events/${id}/guests/${guestId}/check-in`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-guests', id] })
      qc.invalidateQueries({ queryKey: ['event-guest-stats', id] })
    },
    onError: () => Alert.alert('Error', 'Failed to check in guest'),
  })

  const handleCheckIn = (guest: Guest) => {
    Alert.alert(
      'Check In',
      `Check in ${guest.guest_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check In', onPress: () => checkInMutation.mutate(guest.id) },
      ]
    )
  }

  const filtered = useMemo(() => {
    let list = guests as Guest[]
    // Apply tab filter
    if (filter === 'checked_in') list = list.filter(g => g.checked_in)
    else if (filter === 'confirmed') list = list.filter(g => g.rsvp_status === 'confirmed' && !g.checked_in)
    else if (filter === 'invited') list = list.filter(g => g.rsvp_status === 'invited')
    else if (filter === 'vip') list = list.filter(g => g.category === 'VIP')
    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(g =>
        g.guest_name.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.company?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q)
      )
    }
    return list
  }, [guests, filter, search])

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
        <Text style={{ flex: 1, color: '#fafafa', fontWeight: '700', fontSize: 16 }}>
          Guests
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/events/${id}/checkin` as never)}
          style={{
            backgroundColor: '#6366f1',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      {stats && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <QuickStats
            columns={4}
            stats={[
              { label: 'Total', value: stats.total, color: '#6366f1' },
              { label: 'Here', value: stats.checkedIn, color: '#22c55e' },
              { label: 'Confirmed', value: stats.confirmed ?? 0, color: '#60a5fa' },
              { label: 'VIP', value: stats.vipCount, color: '#a855f7' },
            ]}
          />
        </View>
      )}

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#111111',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#1f1f1f',
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={16} color="#52525b" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search guests…"
            placeholderTextColor="#52525b"
            style={{ flex: 1, color: '#fafafa', fontSize: 14, paddingVertical: 12 }}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#52525b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingTop: 10,
          gap: 8,
        }}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: filter === tab.key ? '#6366f1' : '#1f1f1f',
            }}
          >
            <Text
              style={{
                color: filter === tab.key ? '#ffffff' : '#71717a',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          renderItem={({ item }) => (
            <GuestRow
              guest={item}
              showCheckIn
              onCheckIn={handleCheckIn}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={44} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>
                {search ? 'No guests match your search' : 'No guests in this category'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366f1" />
          }
        />
      )}
    </SafeAreaView>
  )
}
