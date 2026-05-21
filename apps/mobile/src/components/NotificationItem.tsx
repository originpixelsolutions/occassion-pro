import { TouchableOpacity, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error' | 'task' | 'guest' | 'vendor' | 'finance'
  is_read: boolean
  created_at: string
  event_id?: string
  event_name?: string
  action_url?: string
}

interface NotificationItemProps {
  notification: AppNotification
  onPress?: (n: AppNotification) => void
  onMarkRead?: (id: string) => void
}

const TYPE_CONFIG = {
  info:    { icon: 'information-circle' as const,  color: '#60a5fa', bg: '#1e3a5f' },
  warning: { icon: 'warning' as const,              color: '#fbbf24', bg: '#78350f' },
  success: { icon: 'checkmark-circle' as const,     color: '#4ade80', bg: '#14532d' },
  error:   { icon: 'close-circle' as const,         color: '#f87171', bg: '#450a0a' },
  task:    { icon: 'checkmark-done-circle' as const, color: '#818cf8', bg: '#1e1b4b' },
  guest:   { icon: 'people' as const,               color: '#c084fc', bg: '#3b0764' },
  vendor:  { icon: 'business' as const,             color: '#34d399', bg: '#064e3b' },
  finance: { icon: 'card' as const,                 color: '#f59e0b', bg: '#451a03' },
}

function relativeTime(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationItem({
  notification,
  onPress,
  onMarkRead,
}: NotificationItemProps) {
  const cfg = TYPE_CONFIG[notification.type]

  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(notification)
        if (!notification.is_read) onMarkRead?.(notification.id)
      }}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: notification.is_read ? '#0d0d0d' : '#111111',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: notification.is_read ? '#141414' : '#1f1f1f',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: cfg.bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Text
            style={{
              color: notification.is_read ? '#a1a1aa' : '#ffffff',
              fontSize: 13,
              fontWeight: notification.is_read ? '400' : '600',
              flex: 1,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text style={{ color: '#52525b', fontSize: 11, flexShrink: 0 }}>
            {relativeTime(notification.created_at)}
          </Text>
        </View>
        <Text
          style={{ color: '#71717a', fontSize: 12, lineHeight: 16 }}
          numberOfLines={3}
        >
          {notification.message}
        </Text>
        {notification.event_name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="calendar-outline" size={11} color="#52525b" />
            <Text style={{ color: '#52525b', fontSize: 11 }}>{notification.event_name}</Text>
          </View>
        )}
      </View>

      {/* Unread dot */}
      {!notification.is_read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#6366f1',
            marginTop: 4,
            flexShrink: 0,
          }}
        />
      )}
    </TouchableOpacity>
  )
}
