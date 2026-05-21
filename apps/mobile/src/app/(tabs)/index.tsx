import { useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'

interface DashboardStats {
  total_events: number
  active_events: number
  total_revenue: number
  open_leads: number
  upcoming_events: Array<{
    id: string
    name: string
    start_date: string
    status: string
  }>
}

const QUICK_ACTIONS = [
  { label: 'New Event', icon: 'calendar-outline' as const, route: '/events/new', color: '#6366f1' },
  { label: 'Add Lead', icon: 'person-add-outline' as const, route: '/crm/new', color: '#8b5cf6' },
  { label: 'Check In', icon: 'qr-code-outline' as const, route: '/kiosk', color: '#0ea5e9' },
  { label: 'AI Generate', icon: 'sparkles-outline' as const, route: '/ai', color: '#a855f7' },
]

export default function DashboardScreen() {
  const { profile, setProfile } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/events/stats'),
  })

  // Load profile on mount
  useEffect(() => {
    if (!profile) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name ?? '',
            email: user.email ?? '',
            avatar_url: user.user_metadata?.avatar_url,
            tenant_id: user.user_metadata?.tenant_id ?? '',
            role: user.user_metadata?.role ?? 'staff',
          })
        }
      })
    }
  }, [profile, setProfile])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
              refetch()
            }}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#71717a', fontSize: 13 }}>{greeting()},</Text>
            <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
              {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#6366f1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            { label: 'Total Events', value: stats?.total_events ?? 0, icon: 'calendar' as const, color: '#6366f1' },
            { label: 'Active', value: stats?.active_events ?? 0, icon: 'flash' as const, color: '#22c55e' },
            {
              label: 'Revenue',
              value: stats?.total_revenue
                ? `₹${(stats.total_revenue / 100000).toFixed(1)}L`
                : '₹0',
              icon: 'cash' as const,
              color: '#f59e0b',
            },
            { label: 'Open Leads', value: stats?.open_leads ?? 0, icon: 'people' as const, color: '#8b5cf6' },
          ].map(stat => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                minWidth: (Dimensions.get('window').width - 52) / 2,
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 16,
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: `${stat.color}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>{stat.value}</Text>
              <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View>
          <Text style={{ color: '#fafafa', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {QUICK_ACTIONS.map(action => (
              <TouchableOpacity
                key={action.label}
                onPress={() => router.push(action.route as never)}
                style={{
                  flex: 1,
                  backgroundColor: '#111111',
                  borderWidth: 1,
                  borderColor: '#1f1f1f',
                  borderRadius: 14,
                  padding: 12,
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${action.color}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '500', textAlign: 'center' }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Events */}
        {(stats?.upcoming_events ?? []).length > 0 && (
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#fafafa', fontSize: 16, fontWeight: '600' }}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/events')}>
                <Text style={{ color: '#6366f1', fontSize: 13 }}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10 }}>
              {stats!.upcoming_events.map(event => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.push(`/events/${event.id}` as never)}
                  style={{
                    backgroundColor: '#111111',
                    borderWidth: 1,
                    borderColor: '#1f1f1f',
                    borderRadius: 14,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: '#6366f120',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 14 }}>
                      {new Date(event.start_date).getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                      {new Date(event.start_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor:
                        event.status === 'confirmed' ? '#14532d' : '#1c1917',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: event.status === 'confirmed' ? '#86efac' : '#a8a29e',
                        fontWeight: '600',
                      }}
                    >
                      {event.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
