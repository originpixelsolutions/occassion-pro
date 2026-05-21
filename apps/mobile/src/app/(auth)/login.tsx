import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { StatusBar } from 'expo-status-bar'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      Alert.alert('Sign In Failed', error.message)
    }
    // Auth guard handles redirect
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={{ marginBottom: 48 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: '#6366f1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>OP</Text>
          </View>
          <Text style={{ color: '#fafafa', fontSize: 28, fontWeight: '700', marginBottom: 4 }}>
            Welcome back
          </Text>
          <Text style={{ color: '#71717a', fontSize: 14 }}>Sign in to your OccasionPro account</Text>
        </View>

        {/* Form */}
        <View style={{ gap: 16, marginBottom: 24 }}>
          <View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 12,
                padding: 14,
                color: '#fafafa',
                fontSize: 15,
              }}
            />
          </View>

          <View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#52525b"
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 12,
                padding: 14,
                color: '#fafafa',
                fontSize: 15,
              }}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end' }}
          >
            <Text style={{ color: '#6366f1', fontSize: 13 }}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#4338ca' : '#6366f1',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: '#71717a', fontSize: 14 }}>Don&apos;t have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={{ color: '#6366f1', fontSize: 14, fontWeight: '600' }}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
