import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ──────────────────────────────────────────────────────────────────

type NotificationModule =
  | 'guests' | 'finance' | 'fnb' | 'floorplan' | 'runsheet'
  | 'vendors' | 'clients' | 'team' | 'conference' | 'post_event'
  | 'system' | 'marketing'

type UrgencyThreshold = 'all' | 'warning_and_above' | 'critical_only'
type DigestMode       = 'instant' | 'hourly' | 'daily'

interface GlobalSettings {
  email_enabled:        boolean
  sms_enabled:          boolean
  whatsapp_enabled:     boolean
  push_enabled:         boolean
  in_app_enabled:       boolean
  quiet_hours_enabled:  boolean
  quiet_from:           string    // 'HH:MM'
  quiet_to:             string    // 'HH:MM'
  quiet_days:           number[]  // 0=Sun … 6=Sat
  digest_mode:          DigestMode
  digest_time:          string    // 'HH:MM' (daily digest time)
}

interface ModulePref {
  module:              NotificationModule
  urgency_threshold:   UrgencyThreshold
  in_app_enabled:      boolean
  email_enabled:       boolean
  sms_enabled:         boolean
  whatsapp_enabled:    boolean
  push_enabled:        boolean
}

// ─── Module meta ─────────────────────────────────────────────────────────────

const MODULE_META: Array<{ key: NotificationModule; label: string; icon: string; color: string }> = [
  { key: 'guests',     label: 'Guests',       icon: 'people-outline',          color: '#60a5fa' },
  { key: 'finance',    label: 'Finance',       icon: 'cash-outline',            color: '#34d399' },
  { key: 'fnb',        label: 'F&B',           icon: 'restaurant-outline',      color: '#fb923c' },
  { key: 'floorplan',  label: 'Floor Plan',    icon: 'map-outline',             color: '#22d3ee' },
  { key: 'runsheet',   label: 'Runsheet',      icon: 'time-outline',            color: '#a78bfa' },
  { key: 'vendors',    label: 'Vendors',       icon: 'briefcase-outline',       color: '#fbbf24' },
  { key: 'clients',    label: 'Clients',       icon: 'person-circle-outline',   color: '#818cf8' },
  { key: 'team',       label: 'Team',          icon: 'people-circle-outline',   color: '#2dd4bf' },
  { key: 'conference', label: 'Conference',    icon: 'mic-outline',             color: '#c084fc' },
  { key: 'post_event', label: 'Post-Event',    icon: 'bar-chart-outline',       color: '#fb7185' },
  { key: 'system',     label: 'System',        icon: 'settings-outline',        color: '#a1a1aa' },
  { key: 'marketing',  label: 'Marketing',     icon: 'megaphone-outline',       color: '#f472b6' },
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const DEFAULT_GLOBAL: GlobalSettings = {
  email_enabled: true, sms_enabled: false, whatsapp_enabled: false,
  push_enabled: true, in_app_enabled: true,
  quiet_hours_enabled: false, quiet_from: '22:00', quiet_to: '08:00',
  quiet_days: [0, 1, 2, 3, 4, 5, 6],
  digest_mode: 'instant', digest_time: '08:00',
}

const DEFAULT_MODULE_PREFS: ModulePref[] = MODULE_META.map(m => ({
  module: m.key,
  urgency_threshold: 'all',
  in_app_enabled: true, email_enabled: true,
  sms_enabled: false, whatsapp_enabled: false, push_enabled: true,
}))

// ─── Foreground Toast ─────────────────────────────────────────────────────────

function ForegroundToast({
  notification,
  onDismiss,
}: {
  notification: Notifications.Notification
  onDismiss: () => void
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start()

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss())
    }, 4000)

    return () => clearTimeout(t)
  }, [])

  const title = notification.request.content.title ?? 'Notification'
  const body  = notification.request.content.body  ?? ''
  const urgency = (notification.request.content.data?.urgency ?? 'info') as string

  const borderColor = urgency === 'critical' ? '#ef4444'
    : urgency === 'warning' ? '#f59e0b'
    : '#6366f1'

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 12,
        left: 16,
        right: 16,
        zIndex: 999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onDismiss}
        style={{
          backgroundColor: '#111111',
          borderWidth: 1,
          borderColor: '#1f1f1f',
          borderLeftWidth: 3,
          borderLeftColor: borderColor,
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons
          name={urgency === 'critical' ? 'alert-circle' : urgency === 'warning' ? 'warning' : 'information-circle'}
          size={18}
          color={borderColor}
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 13 }}>{title}</Text>
          {!!body && (
            <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {body}
            </Text>
          )}
        </View>
        <Ionicons name="close" size={14} color="#52525b" />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
      <Text style={{ color: '#fafafa', fontWeight: '700', fontSize: 15 }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: '#71717a', fontSize: 12, marginTop: 3 }}>{subtitle}</Text>
      )}
    </View>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: '#111111',
        borderWidth: 1,
        borderColor: '#1f1f1f',
        borderRadius: 16,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </View>
  )
}

function RowToggle({
  label,
  sublabel,
  value,
  onValueChange,
  disabled = false,
  showBorder = true,
  iconName,
  iconColor = '#71717a',
}: {
  label: string
  sublabel?: string
  value: boolean
  onValueChange: (v: boolean) => void
  disabled?: boolean
  showBorder?: boolean
  iconName?: string
  iconColor?: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: '#1f1f1f',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {iconName && (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#1a1a1a',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={iconName as any} size={16} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fafafa', fontWeight: '500', fontSize: 14 }}>{label}</Text>
        {sublabel && (
          <Text style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>{sublabel}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#27272a', true: '#6366f1' }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? '#ffffff' : '#71717a'}
        ios_backgroundColor="#27272a"
      />
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const { session } = useAuthStore()
  const qc = useQueryClient()

  const [pushPermission, setPushPermission]             = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [toastNotification, setToastNotification]       = useState<Notifications.Notification | null>(null)
  const [testLoading, setTestLoading]                   = useState(false)
  const [expandedModule, setExpandedModule]             = useState<NotificationModule | null>(null)

  // ── Push permission check ────────────────────────────────────────────────
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPushPermission(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown')
    })
  }, [])

  const requestPushPermission = async () => {
    if (!Device.isDevice) {
      Alert.alert('Simulator', 'Push notifications only work on a real device.')
      return
    }
    const { status } = await Notifications.requestPermissionsAsync()
    if (status === 'granted') {
      setPushPermission('granted')
      // Register the new token
      try {
        const token = await Notifications.getExpoPushTokenAsync()
        await api.post('/notifications/device-token', {
          token: token.data,
          platform: Platform.OS,
        })
      } catch {}
    } else {
      setPushPermission('denied')
      Alert.alert(
        'Permission Denied',
        'Push notifications are disabled. Enable them in your device Settings → OccasionPro.',
        [{ text: 'OK' }]
      )
    }
  }

  // ── Global settings ──────────────────────────────────────────────────────
  const { data: global = DEFAULT_GLOBAL, isLoading: globalLoading } = useQuery<GlobalSettings>({
    queryKey: ['notif-global-settings'],
    queryFn:  () => api.get('/notifications/preferences/global'),
    enabled: !!session,
  })

  const globalMutation = useMutation({
    mutationFn: (settings: GlobalSettings) =>
      api.put('/notifications/preferences/global', settings),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: ['notif-global-settings'] })
      qc.setQueryData(['notif-global-settings'], updated)
    },
    onError: () => qc.invalidateQueries({ queryKey: ['notif-global-settings'] }),
  })

  const updateGlobal = useCallback((patch: Partial<GlobalSettings>) => {
    const next = { ...global, ...patch }
    globalMutation.mutate(next)
  }, [global, globalMutation])

  // ── Per-module prefs ─────────────────────────────────────────────────────
  const { data: modulePrefs = DEFAULT_MODULE_PREFS, isLoading: prefsLoading } = useQuery<ModulePref[]>({
    queryKey: ['notif-module-prefs'],
    queryFn:  () => api.get('/notifications/preferences'),
    enabled: !!session,
  })

  const moduleMutation = useMutation({
    mutationFn: (prefs: ModulePref[]) =>
      api.put('/notifications/preferences', { preferences: prefs }),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: ['notif-module-prefs'] })
      qc.setQueryData(['notif-module-prefs'], updated)
    },
    onError: () => qc.invalidateQueries({ queryKey: ['notif-module-prefs'] }),
  })

  const updateModulePref = useCallback((mod: NotificationModule, patch: Partial<ModulePref>) => {
    const updated = modulePrefs.map(p =>
      p.module === mod ? { ...p, ...patch } : p
    )
    moduleMutation.mutate(updated)
  }, [modulePrefs, moduleMutation])

  // ── Foreground notification toast ────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      setToastNotification(notification)
    })
    return () => sub.remove()
  }, [])

  // ── Test push ─────────────────────────────────────────────────────────────
  const handleTestPush = async () => {
    setTestLoading(true)
    try {
      await api.post('/notifications/test', { channel: 'push' })
      Alert.alert('Test Sent', 'A test push notification has been dispatched.')
    } catch {
      Alert.alert('Error', 'Could not send test notification. Check your device token is registered.')
    } finally {
      setTestLoading(false)
    }
  }

  const isLoading = globalLoading || prefsLoading

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Notifications' }} />

      {/* Foreground toast overlay */}
      {toastNotification && (
        <ForegroundToast
          notification={toastNotification}
          onDismiss={() => setToastNotification(null)}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Push Permission Banner ─────────────────────────────────────── */}
        {pushPermission !== 'granted' && (
          <View
            style={{
              margin: 16,
              padding: 16,
              backgroundColor: pushPermission === 'denied' ? '#3b0a0a' : '#1a1040',
              borderWidth: 1,
              borderColor: pushPermission === 'denied' ? '#7f1d1d' : '#4c1d95',
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <Ionicons
              name={pushPermission === 'denied' ? 'ban' : 'notifications-off-outline'}
              size={22}
              color={pushPermission === 'denied' ? '#ef4444' : '#a78bfa'}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fafafa', fontWeight: '600', fontSize: 14 }}>
                {pushPermission === 'denied'
                  ? 'Push notifications blocked'
                  : 'Enable push notifications'}
              </Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                {pushPermission === 'denied'
                  ? 'Go to Settings → OccasionPro → Notifications to re-enable.'
                  : 'Get instant alerts for critical events, guest arrivals, and team updates.'}
              </Text>
              {pushPermission !== 'denied' && (
                <TouchableOpacity
                  onPress={requestPushPermission}
                  style={{
                    marginTop: 10,
                    backgroundColor: '#6366f1',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    Allow notifications
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Global Channels ───────────────────────────────────────────── */}
        <SectionHeader
          title="Delivery Channels"
          subtitle="Master switches — turning off a channel stops all its notifications."
        />
        <Card>
          <RowToggle
            label="In-App"
            sublabel="Bell icon and notification centre"
            iconName="notifications-outline"
            iconColor="#a78bfa"
            value={global.in_app_enabled}
            onValueChange={v => updateGlobal({ in_app_enabled: v })}
          />
          <RowToggle
            label="Push Notifications"
            sublabel={pushPermission === 'denied' ? 'Blocked by system — enable in Settings' : 'Requires device permission'}
            iconName="phone-portrait-outline"
            iconColor="#60a5fa"
            value={global.push_enabled && pushPermission === 'granted'}
            onValueChange={v => {
              if (v && pushPermission !== 'granted') {
                requestPushPermission()
              } else {
                updateGlobal({ push_enabled: v })
              }
            }}
            disabled={pushPermission === 'denied'}
          />
          <RowToggle
            label="Email"
            sublabel="Digest summaries and critical alerts"
            iconName="mail-outline"
            iconColor="#34d399"
            value={global.email_enabled}
            onValueChange={v => updateGlobal({ email_enabled: v })}
          />
          <RowToggle
            label="SMS"
            sublabel="Critical-only text messages"
            iconName="chatbox-outline"
            iconColor="#fbbf24"
            value={global.sms_enabled}
            onValueChange={v => updateGlobal({ sms_enabled: v })}
          />
          <RowToggle
            label="WhatsApp"
            sublabel="Rich message delivery via WhatsApp"
            iconName="logo-whatsapp"
            iconColor="#25d366"
            value={global.whatsapp_enabled}
            onValueChange={v => updateGlobal({ whatsapp_enabled: v })}
            showBorder={false}
          />
        </Card>

        {/* ── Quiet Hours ───────────────────────────────────────────────── */}
        <SectionHeader
          title="Quiet Hours"
          subtitle="Notifications are queued during quiet hours. Critical alerts always break through."
        />
        <Card>
          <RowToggle
            label="Enable Quiet Hours"
            iconName="moon-outline"
            iconColor="#818cf8"
            value={global.quiet_hours_enabled}
            onValueChange={v => updateGlobal({ quiet_hours_enabled: v })}
          />

          {global.quiet_hours_enabled && (
            <>
              {/* Time range display */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#1f1f1f',
                  gap: 8,
                }}
              >
                <Ionicons name="time-outline" size={16} color="#52525b" />
                <Text style={{ color: '#a1a1aa', fontSize: 13 }}>
                  From{' '}
                  <Text style={{ color: '#fafafa', fontWeight: '600' }}>{global.quiet_from}</Text>
                  {' '}to{' '}
                  <Text style={{ color: '#fafafa', fontWeight: '600' }}>{global.quiet_to}</Text>
                </Text>
                <Text style={{ color: '#52525b', fontSize: 11, marginLeft: 'auto' }}>
                  Edit in web settings
                </Text>
              </View>

              {/* Day-of-week chips */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  gap: 6,
                }}
              >
                {DAY_LABELS.map((day, idx) => {
                  const active = global.quiet_days.includes(idx)
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => {
                        const next = active
                          ? global.quiet_days.filter(d => d !== idx)
                          : [...global.quiet_days, idx]
                        updateGlobal({ quiet_days: next })
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 7,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: active ? '#4c1d95' : '#1a1a1a',
                        borderWidth: 1,
                        borderColor: active ? '#6366f1' : '#27272a',
                      }}
                    >
                      <Text
                        style={{
                          color: active ? '#c4b5fd' : '#52525b',
                          fontSize: 11,
                          fontWeight: '600',
                        }}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Critical bypass note */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                }}
              >
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={{ color: '#71717a', fontSize: 11 }}>
                  Critical alerts bypass quiet hours
                </Text>
              </View>
            </>
          )}
        </Card>

        {/* ── Digest Mode ───────────────────────────────────────────────── */}
        <SectionHeader
          title="Digest Mode"
          subtitle="How frequently non-critical notifications are bundled."
        />
        <Card>
          {([
            { key: 'instant' as DigestMode, label: 'Instant',      sublabel: 'Each notification immediately' },
            { key: 'hourly'  as DigestMode, label: 'Hourly Bundle', sublabel: 'Summary once per hour' },
            { key: 'daily'   as DigestMode, label: 'Daily Digest',  sublabel: `Every day at ${global.digest_time}` },
          ]).map((opt, i, arr) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => updateGlobal({ digest_mode: opt.key })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                gap: 12,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: '#1f1f1f',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: global.digest_mode === opt.key ? '#6366f1' : '#27272a',
                  backgroundColor: global.digest_mode === opt.key ? '#6366f1' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {global.digest_mode === opt.key && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fafafa', fontWeight: '500', fontSize: 14 }}>{opt.label}</Text>
                <Text style={{ color: '#52525b', fontSize: 11, marginTop: 1 }}>{opt.sublabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* ── Per-Module Prefs ──────────────────────────────────────────── */}
        <SectionHeader
          title="Module Preferences"
          subtitle="Tap a module to customise its channel settings."
        />
        <Card>
          {MODULE_META.map((meta, idx) => {
            const pref = modulePrefs.find(p => p.module === meta.key) ?? {
              module: meta.key,
              urgency_threshold: 'all' as UrgencyThreshold,
              in_app_enabled: true, email_enabled: true,
              sms_enabled: false, whatsapp_enabled: false, push_enabled: true,
            }
            const isExpanded = expandedModule === meta.key

            return (
              <View
                key={meta.key}
                style={{
                  borderBottomWidth: idx < MODULE_META.length - 1 ? 1 : 0,
                  borderBottomColor: '#1f1f1f',
                }}
              >
                {/* Module row */}
                <TouchableOpacity
                  onPress={() => setExpandedModule(isExpanded ? null : meta.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: meta.color + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                  </View>
                  <Text style={{ flex: 1, color: '#fafafa', fontWeight: '500', fontSize: 14 }}>
                    {meta.label}
                  </Text>

                  {/* Channel dots summary */}
                  <View style={{ flexDirection: 'row', gap: 3, marginRight: 6 }}>
                    {[
                      { key: 'in_app_enabled', color: '#a78bfa' },
                      { key: 'push_enabled',   color: '#60a5fa' },
                      { key: 'email_enabled',  color: '#34d399' },
                    ].map(ch => (
                      <View
                        key={ch.key}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: (pref as any)[ch.key] ? ch.color : '#27272a',
                        }}
                      />
                    ))}
                  </View>

                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#3f3f46"
                  />
                </TouchableOpacity>

                {/* Expanded channel toggles */}
                {isExpanded && (
                  <View
                    style={{
                      backgroundColor: '#0d0d0d',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      gap: 2,
                    }}
                  >
                    {/* Urgency threshold */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: '#71717a', fontSize: 11, width: 80 }}>Minimum</Text>
                      {([
                        { key: 'all',                label: 'All' },
                        { key: 'warning_and_above',  label: 'Warning+' },
                        { key: 'critical_only',      label: 'Critical' },
                      ] as Array<{ key: UrgencyThreshold; label: string }>).map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => updateModulePref(meta.key, { urgency_threshold: opt.key })}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: 6,
                            backgroundColor: pref.urgency_threshold === opt.key
                              ? '#4c1d95'
                              : '#1a1a1a',
                            borderWidth: 1,
                            borderColor: pref.urgency_threshold === opt.key
                              ? '#6366f1'
                              : '#27272a',
                          }}
                        >
                          <Text
                            style={{
                              color: pref.urgency_threshold === opt.key ? '#c4b5fd' : '#52525b',
                              fontSize: 11,
                              fontWeight: '600',
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Per-channel switches */}
                    {([
                      { field: 'in_app_enabled'   as const, label: 'In-App',    icon: 'notifications-outline', color: '#a78bfa', globalKey: 'in_app_enabled' },
                      { field: 'push_enabled'      as const, label: 'Push',      icon: 'phone-portrait-outline', color: '#60a5fa', globalKey: 'push_enabled' },
                      { field: 'email_enabled'     as const, label: 'Email',     icon: 'mail-outline',          color: '#34d399', globalKey: 'email_enabled' },
                      { field: 'sms_enabled'       as const, label: 'SMS',       icon: 'chatbox-outline',       color: '#fbbf24', globalKey: 'sms_enabled' },
                      { field: 'whatsapp_enabled'  as const, label: 'WhatsApp',  icon: 'logo-whatsapp',         color: '#25d366', globalKey: 'whatsapp_enabled' },
                    ]).map((ch, i, arr) => {
                      const globalOff = !(global as any)[ch.globalKey]
                      return (
                        <View
                          key={ch.field}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 4,
                            borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                            borderBottomColor: '#1a1a1a',
                            opacity: globalOff ? 0.4 : 1,
                          }}
                        >
                          <Ionicons name={ch.icon as any} size={14} color={ch.color} style={{ marginRight: 8 }} />
                          <Text style={{ flex: 1, color: '#a1a1aa', fontSize: 13 }}>{ch.label}</Text>
                          {globalOff && (
                            <Text style={{ color: '#3f3f46', fontSize: 10, marginRight: 8 }}>
                              channel off
                            </Text>
                          )}
                          <Switch
                            value={pref[ch.field] && !globalOff}
                            onValueChange={v => updateModulePref(meta.key, { [ch.field]: v })}
                            disabled={globalOff}
                            trackColor={{ false: '#27272a', true: ch.color + '88' }}
                            thumbColor={Platform.OS === 'ios' ? undefined : pref[ch.field] ? '#ffffff' : '#71717a'}
                            ios_backgroundColor="#27272a"
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                          />
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            )
          })}
        </Card>

        {/* ── Test Notification ─────────────────────────────────────────── */}
        <SectionHeader
          title="Test Notifications"
          subtitle="Send a test push to verify your device is connected."
        />
        <Card>
          <TouchableOpacity
            onPress={handleTestPush}
            disabled={testLoading || pushPermission !== 'granted'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              gap: 8,
              opacity: pushPermission !== 'granted' ? 0.4 : 1,
            }}
          >
            {testLoading ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Ionicons name="send-outline" size={16} color="#6366f1" />
            )}
            <Text style={{ color: '#6366f1', fontWeight: '600', fontSize: 14 }}>
              {testLoading ? 'Sending…' : 'Send test push notification'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <Text
          style={{
            color: '#3f3f46',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 24,
            paddingHorizontal: 32,
            lineHeight: 18,
          }}
        >
          Full notification preferences (email templates, WhatsApp, quiet hours timing) are available
          in the web dashboard under Settings → Notifications.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
