import { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import NotificationItem, { AppNotification } from '@/components/NotificationItem'
import { useAuthStore } from '@/store/auth.store'

type FilterTab = 'all' | 'unread' | 'task' | 'guest' | 'warning' | 'finance'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'unread',  label: 'Unread' },
  { key: 'task',    label: 'Tasks' },
  { key: 'guest',   label: 'Guests' },
  { key: 'warning', label: 'Alerts' },
]

export default function GlobalNotificationsScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const { session } = useAuthStore()
  const [filter, setFilter] = useState<FilterTab>('all')

  const { data: notifications = [], isLoading, refetch } = useQuery<AppNotification[]>({
    queryKey: ['global-notifications'],
    queryFn: () => api.get('/notifications?limit=200'),
    enabled: !!session,
    refetchInterval: 60000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onMutate: async notifId => {
      await qc.cancelQueries({ queryKey: ['global-notifications'] })
      const prev = qc.getQueryData<AppNotification[]>(['global-notifications']) ?? []
      qc.setQueryData(
        ['global-notifications'],
        prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
      )
    },
    onSettled: () => {
      // Update badge count
      const current = qc.getQueryData<AppNotification[]>(['global-notifications']) ?? []
      const unread = current.filter(n => !n.is_read).length
      Notifications.setBadgeCountAsync(unread).catch(() => {})
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-notifications'] })
      Notifications.setBadgeCountAsync(0).catch(() => {})
    },
  })

  // Realtime subscription for incoming notifications
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          qc.invalidateQueries({ queryKey: ['global-notifications'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, qc])

  // Sync badge count with unread count on mount
  useEffect(() => {
    const unread = (notifications as AppNotification[]).filter(n => !n.is_read).length
    Notifications.setBadgeCountAsync(unread).catch(() => {})
  }, [notifications])

  const filtered = (notifications as AppNotification[]).filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'all') return true
    return n.type === filter
  })

  const unreadCount = (notifications as AppNotification[]).filter(n => !n.is_read).length

  const handleNotificationPress = (notif: AppNotification) => {
    if (notif.event_id) {
      router.push(`/events/${notif.event_id}` as never)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1f1f1f',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fafafa', fontWeight: '700', fontSize: 22 }}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={{ color: '#6366f1', fontSize: 13, marginTop: 2 }}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            style={{
              backgroundColor: '#1f1f1f',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '600' }}>
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
        }}
      >
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'unread'
            ? unreadCount
            : tab.key !== 'all'
            ? (notifications as AppNotification[]).filter(n => n.type === tab.key).length
            : 0

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
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
              {count > 0 && tab.key !== 'all' && (
                <View
                  style={{
                    backgroundColor: filter === tab.key ? '#ffffff33' : '#27272a',
                    borderRadius: 8,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    minWidth: 18,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: filter === tab.key ? '#ffffff' : '#a1a1aa',
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handleNotificationPress}
              onMarkRead={id => markReadMutation.mutate(id)}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#111111',
                  borderWidth: 1,
                  borderColor: '#1f1f1f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="notifications-outline" size={32} color="#27272a" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                {filter === 'unread' ? 'All caught up!' : 'No notifications'}
              </Text>
              <Text style={{ color: '#71717a', fontSize: 13, textAlign: 'center', maxWidth: 240 }}>
                {filter === 'unread'
                  ? "You've read everything."
                  : 'Notifications will appear here as your events progress.'}
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
