import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface FloorPlan {
  id: string
  name: string
  event_name: string
  layout_type: 'theater' | 'banquet' | 'cocktail' | 'classroom' | 'ushape' | 'custom'
  capacity: number
  tables?: number
  zones?: number
  status: 'draft' | 'review' | 'approved' | 'active'
  updated_at: string
  thumbnail_url?: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#1c1917', text: '#a8a29e' },
  review:   { bg: '#1c1917', text: '#fbbf24' },
  approved: { bg: '#14532d', text: '#86efac' },
  active:   { bg: '#1e3a5f', text: '#93c5fd' },
}

const LAYOUT_ICONS: Record<string, string> = {
  theater:   'film-outline',
  banquet:   'restaurant-outline',
  cocktail:  'wine-outline',
  classroom: 'school-outline',
  ushape:    'git-merge-outline',
  custom:    'grid-outline',
}

export default function FloorPlanScreen() {
  const [search, setSearch] = useState('')
  const router = useRouter()
  const qc = useQueryClient()

  const { data: plans = [], isLoading, refetch } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plans'],
    queryFn: () => api.get('/floor-plans'),
  })

  const filtered = (plans as FloorPlan[]).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.event_name?.toLowerCase().includes(search.toLowerCase()),
  )

  const renderItem = ({ item }: { item: FloorPlan }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft
    const iconName = LAYOUT_ICONS[item.layout_type] ?? 'grid-outline'

    return (
      <TouchableOpacity
        onPress={() => router.push(`/floor-plans/${item.id}` as never)}
        style={{
          backgroundColor: '#111111',
          borderWidth: 1,
          borderColor: '#1f1f1f',
          borderRadius: 16,
          padding: 16,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          {/* Layout icon */}
          <View style={{
            width: 48, height: 48, borderRadius: 12,
            backgroundColor: '#1a1a2e',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={iconName as any} size={22} color="#a78bfa" />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 15, flex: 1 }} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.bg }}>
                <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' }}>{item.status}</Text>
              </View>
            </View>
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {item.event_name}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 12 }}>{item.capacity} cap.</Text>
          </View>
          {item.tables != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="grid-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }}>{item.tables} tables</Text>
            </View>
          )}
          {item.zones != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="layers-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }}>{item.zones} zones</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#27272a', fontSize: 11, textTransform: 'capitalize' }}>{item.layout_type}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Floor Plans</Text>
        <TouchableOpacity
          onPress={() => router.push('/floor-plans/new' as never)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search floor plans…"
            placeholderTextColor="#52525b"
            style={{ flex: 1, height: 44, color: '#fafafa', fontSize: 14 }}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['floor-plans'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="grid-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>No floor plans found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
