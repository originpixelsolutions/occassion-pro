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
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface Lead {
  id: string
  contact_name: string
  company?: string
  email: string
  phone?: string
  status: string
  event_type?: string
  budget?: number
  created_at: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  new: { bg: '#172554', text: '#93c5fd', dot: '#3b82f6' },
  contacted: { bg: '#1e3a5f', text: '#7dd3fc', dot: '#0ea5e9' },
  qualified: { bg: '#1a2e05', text: '#86efac', dot: '#22c55e' },
  proposal: { bg: '#2e1065', text: '#c4b5fd', dot: '#8b5cf6' },
  negotiation: { bg: '#431407', text: '#fdba74', dot: '#f97316' },
  won: { bg: '#14532d', text: '#4ade80', dot: '#16a34a' },
  lost: { bg: '#1c1917', text: '#a8a29e', dot: '#78716c' },
}

export default function CrmScreen() {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: leads = [], isLoading, refetch } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: () => api.get('/crm/leads'),
  })

  const filtered = (leads as Lead[]).filter(
    l =>
      l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      l.company?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>CRM</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
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
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search leads…"
            placeholderTextColor="#52525b"
            style={{ flex: 1, height: 44, color: '#fafafa', fontSize: 14 }}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['leads'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        renderItem={({ item }) => {
          const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.new
          return (
            <View
              style={{
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                    {item.contact_name}
                  </Text>
                  {item.company && (
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 1 }}>{item.company}</Text>
                  )}
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.bg }}>
                  <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {item.event_type && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={12} color="#71717a" />
                    <Text style={{ color: '#71717a', fontSize: 12 }}>{item.event_type}</Text>
                  </View>
                )}
                {item.budget && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="cash-outline" size={12} color="#71717a" />
                    <Text style={{ color: '#71717a', fontSize: 12 }}>
                      ₹{(item.budget / 100000).toFixed(1)}L
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>No leads yet</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
