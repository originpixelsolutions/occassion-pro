import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: 'owner' | 'event_manager' | 'team_lead' | 'team_member'
  avatar_url?: string
  department?: string
  is_active: boolean
  current_event?: string
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:         { bg: '#2e1065', text: '#c4b5fd' },
  event_manager: { bg: '#1e3a5f', text: '#93c5fd' },
  team_lead:     { bg: '#14532d', text: '#86efac' },
  team_member:   { bg: '#1c1917', text: '#a8a29e' },
}

const ROLE_LABELS: Record<string, string> = {
  owner:         'Owner',
  event_manager: 'Event Manager',
  team_lead:     'Team Lead',
  team_member:   'Team Member',
}

function AvatarPlaceholder({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1a1a2e',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#a78bfa', fontSize: size * 0.35, fontWeight: '700' }}>{initials}</Text>
    </View>
  )
}

export default function TeamScreen() {
  const [search, setSearch] = useState('')
  const router = useRouter()
  const qc = useQueryClient()

  const { data: members = [], isLoading, refetch } = useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: () => api.get('/team'),
  })

  const filtered = (members as TeamMember[]).filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()),
  )

  const renderItem = ({ item }: { item: TeamMember }) => {
    const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.team_member

    return (
      <TouchableOpacity
        onPress={() => router.push(`/team/${item.id}` as never)}
        style={{
          backgroundColor: '#111111',
          borderWidth: 1,
          borderColor: '#1f1f1f',
          borderRadius: 16,
          padding: 16,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AvatarPlaceholder name={item.full_name} />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 15, flex: 1 }} numberOfLines={1}>
              {item.full_name}
            </Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.bg }}>
              <Text style={{ fontSize: 10, color: colors.text, fontWeight: '600' }}>
                {ROLE_LABELS[item.role]}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="mail-outline" size={12} color="#71717a" />
              <Text style={{ color: '#71717a', fontSize: 12 }} numberOfLines={1}>{item.email}</Text>
            </View>
            {!item.is_active && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: '#3b0a0a' }}>
                <Text style={{ fontSize: 10, color: '#fca5a5', fontWeight: '600' }}>Inactive</Text>
              </View>
            )}
          </View>

          {item.current_event && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="calendar-outline" size={11} color="#6366f1" />
              <Text style={{ color: '#6366f1', fontSize: 11 }} numberOfLines={1}>
                {item.current_event}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Team</Text>
        <TouchableOpacity
          onPress={() => router.push('/team/invite' as never)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="person-add-outline" size={18} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search team members…"
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
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['team'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>No team members found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
