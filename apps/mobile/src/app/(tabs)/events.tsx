import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface Event {
  id: string
  name: string
  event_type: string
  status: string
  start_date: string
  end_date?: string
  venue?: { name: string }
  guest_count: number
  budget: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#1c1917', text: '#a8a29e' },
  confirmed: { bg: '#14532d', text: '#86efac' },
  in_progress: { bg: '#1e3a5f', text: '#93c5fd' },
  completed: { bg: '#1a1a2e', text: '#a78bfa' },
  cancelled: { bg: '#3b0a0a', text: '#fca5a5' },
}

export default function EventsScreen() {
  const [search, setSearch] = useState('')
  const router = useRouter()
  const qc = useQueryClient()

  const { data: events = [], isLoading, refetch } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/events'),
  })

  const filtered = (events as Event[]).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  const renderItem = ({ item }: { item: Event }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft
    return (
      <TouchableOpacity
        onPress={() => router.push(`/events/${item.id}` as never)}
        style={{
          backgroundColor: '#111111',
          borderWidth: 1,
          borderColor: '#1f1f1f',
          borderRadius: 16,
          padding: 16,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.bg }}>
            <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' }}>{item.status}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 12 }}>
              {new Date(item.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          {item.venue && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }} numberOfLines={1}>
                {item.venue.name}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 12 }}>{item.guest_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Events</Text>
        <TouchableOpacity
          onPress={() => router.push('/events/new' as never)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#6366f1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search events…"
            placeholderTextColor="#52525b"
            style={{ flex: 1, height: 44, color: '#fafafa', fontSize: 14 }}
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['events'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="calendar-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>No events found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
