import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface FnBItem {
  id: string
  name: string
  menu_category: string
  event_name: string
  pax_count: number
  vendor_name?: string
  cost_per_pax?: number
  status: 'pending' | 'confirmed' | 'in_preparation' | 'served' | 'cancelled'
  dietary_tags?: string[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:        { bg: '#1c1917', text: '#a8a29e' },
  confirmed:      { bg: '#14532d', text: '#86efac' },
  in_preparation: { bg: '#1e3a5f', text: '#93c5fd' },
  served:         { bg: '#1a1a2e', text: '#a78bfa' },
  cancelled:      { bg: '#3b0a0a', text: '#fca5a5' },
}

const DIETARY_COLORS: Record<string, string> = {
  veg:     '#86efac',
  vegan:   '#6ee7b7',
  jain:    '#fde68a',
  halal:   '#93c5fd',
  kosher:  '#c4b5fd',
  'gluten-free': '#fca5a5',
}

export default function FnBScreen() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const router = useRouter()
  const qc = useQueryClient()

  const { data: items = [], isLoading, refetch } = useQuery<FnBItem[]>({
    queryKey: ['fnb'],
    queryFn: () => api.get('/fnb'),
  })

  const categories = Array.from(new Set((items as FnBItem[]).map((i) => i.menu_category)))

  const filtered = (items as FnBItem[]).filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.event_name?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !activeCategory || item.menu_category === activeCategory
    return matchSearch && matchCategory
  })

  const renderItem = ({ item }: { item: FnBItem }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending
    return (
      <TouchableOpacity
        onPress={() => router.push(`/fnb/${item.id}` as never)}
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
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{item.event_name}</Text>
          </View>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.bg }}>
            <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' }}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 12 }}>{item.pax_count} pax</Text>
          </View>
          {item.vendor_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="restaurant-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }} numberOfLines={1}>{item.vendor_name}</Text>
            </View>
          )}
          {item.cost_per_pax != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cash-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }}>₹{item.cost_per_pax}/pax</Text>
            </View>
          )}
        </View>

        {item.dietary_tags && item.dietary_tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {item.dietary_tags.map((tag) => (
              <View key={tag} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: '#111' }}>
                <Text style={{ fontSize: 10, color: DIETARY_COLORS[tag] ?? '#a8a29e', fontWeight: '600' }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>F&B</Text>
        <TouchableOpacity
          onPress={() => router.push('/fnb/new' as never)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search menus…"
            placeholderTextColor="#52525b"
            style={{ flex: 1, height: 44, color: '#fafafa', fontSize: 14 }}
          />
        </View>
      </View>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <FlatList
            data={['All', ...categories]}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: cat }) => {
              const active = cat === 'All' ? !activeCategory : activeCategory === cat
              return (
                <TouchableOpacity
                  onPress={() => setActiveCategory(cat === 'All' ? null : cat)}
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? '#6366f1' : '#111111',
                    borderWidth: 1,
                    borderColor: active ? '#6366f1' : '#1f1f1f',
                  }}
                >
                  <Text style={{ color: active ? 'white' : '#71717a', fontSize: 13, fontWeight: '500', textTransform: 'capitalize' }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['fnb'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="restaurant-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>No F&B items found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
