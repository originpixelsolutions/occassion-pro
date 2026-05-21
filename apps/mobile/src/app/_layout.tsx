import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'

SplashScreen.preventAutoHideAsync()

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    })
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync()
    return token.data
  } catch {
    return null
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AuthGuard() {
  const { session, isLoading, setSession, setLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()
  const tokenRegistered = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      SplashScreen.hideAsync()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  // Register push token once session is established
  useEffect(() => {
    if (!session || tokenRegistered.current) return
    tokenRegistered.current = true

    registerForPushNotificationsAsync().then(token => {
      if (!token) return
      api.post('/notifications/device-token', {
        token,
        platform: Platform.OS,
      }).catch(() => {
        // Silent fail — push notifications are non-critical
      })
    })

    // Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // Badge count is updated automatically by the handler above
    })

    // Listen for notification interactions
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>
      if (data?.eventId) {
        router.push(`/events/${data.eventId}`)
      } else {
        router.push('/(tabs)/notifications')
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [session, router])

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments, isLoading, router])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="events" />
          <Stack.Screen name="kiosk" options={{ gestureEnabled: false }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
