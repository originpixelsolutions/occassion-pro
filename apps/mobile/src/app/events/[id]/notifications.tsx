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
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import NotificationItem, { AppNotification } from '@/components/NotificationItem'

type FilterType = 'all' | AppNotification['type']

const TYPE_FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'task',    label: 'Tasks' },
  { key: 'guest',   label: 'Guests' },
  { key: 'warning', label: 'Warnings' },
  { key: 'finance', label: 'Finance' },
]

export default function EventNotificationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')

  const { data: notifications = [], isLoading, refetch } = useQuery<AppNotification[]>({
    queryKey: ['event-notifications', id],
    queryFn: () => api.get(`/notifications?event_id=${id}&limit=100`),
    enabled: !!id,
  })

  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => api.patch(`/notifications/${notifId}/read`, {}),
    onMutate: async notifId => {
      await qc.cancelQueries({ queryKey: ['event-notifications', id] })
      const prev = qc.getQueryData<AppNotification[]>(['event-notifications', id]) ?? []
      qc.setQueryData(
        ['event-notifications', id],
        prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['event-notifications', id], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['event-notif-count', id] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post(`/notifications/mark-all-read`, { event_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-notifications', id] })
      qc.invalidateQueries({ queryKey: ['event-notif-count', id] })
    },
  })

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`notifications:event:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `event_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['event-notifications', id] })
          qc.invalidateQueries({ queryKey: ['event-notif-count', id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, qc])

  const filtered = (notifications as AppNotification[]).filter(
    n => typeFilter === 'all' || n.type === typeFilter
  )

  const unreadCount = (notifications as AppNotification[]).filter(n => !n.is_read).length

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
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fafafa', fontWeight: '700', fontSize: 16 }}>Event Alerts</Text>
          {unreadCount > 0 && (
            <Text style={{ color: '#6366f1', fontSize: 12, marginTop: 1 }}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => markAllReadMutation.mutate()}
            style={{ padding: 4 }}
          >
            <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#1f1f1f',
        }}
      >
        {TYPE_FILTERS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setTypeFilter(tab.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: typeFilter === tab.key ? '#6366f1' : '#1f1f1f',
            }}
          >
            <Text
              style={{
                color: typeFilter === tab.key ? '#ffffff' : '#71717a',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onMarkRead={nid => markReadMutation.mutate(nid)}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="notifications-outline" size={44} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>
                No notifications for this event
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
