import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'

const MENU_ITEMS = [
  { label: 'Account Settings', icon: 'person-outline' as const, route: '/settings/account' },
  { label: 'Notifications', icon: 'notifications-outline' as const, route: '/settings/notifications' },
  { label: 'Security', icon: 'shield-outline' as const, route: '/settings/security' },
  { label: 'Kiosk Mode', icon: 'qr-code-outline' as const, route: '/kiosk' },
  { label: 'Help & Support', icon: 'help-circle-outline' as const, route: '/support' },
  { label: 'About', icon: 'information-circle-outline' as const, route: '/about' },
]

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()
  const router = useRouter()

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          signOut()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        {/* Profile Card */}
        <View
          style={{
            backgroundColor: '#111111',
            borderWidth: 1,
            borderColor: '#1f1f1f',
            borderRadius: 20,
            padding: 20,
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#6366f1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#fafafa', fontSize: 18, fontWeight: '700' }}>
              {profile?.full_name ?? 'User'}
            </Text>
            <Text style={{ color: '#71717a', fontSize: 13, marginTop: 2 }}>
              {profile?.email}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              backgroundColor: '#6366f120',
              borderRadius: 20,
            }}
          >
            <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
              {profile?.role ?? 'staff'}
            </Text>
          </View>
        </View>

        {/* Menu */}
        <View
          style={{
            backgroundColor: '#111111',
            borderWidth: 1,
            borderColor: '#1f1f1f',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                gap: 12,
                borderBottomWidth: index < MENU_ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: '#1f1f1f',
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: '#1a1a1a',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon} size={18} color="#71717a" />
              </View>
              <Text style={{ flex: 1, color: '#fafafa', fontSize: 14, fontWeight: '500' }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#3f3f46" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: '#3b0a0a',
            borderWidth: 1,
            borderColor: '#7f1d1d',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={{ color: '#3f3f46', fontSize: 11, textAlign: 'center' }}>
          OccasionPro v1.0.0 · occasionpro.in
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
