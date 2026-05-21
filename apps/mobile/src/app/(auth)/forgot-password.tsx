import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()

  const handleReset = async () => {
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'occasionpro://auth/reset-password',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: 32, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: '#6366f1', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ color: '#fafafa', fontSize: 26, fontWeight: '700', marginBottom: 6 }}>
          Reset Password
        </Text>
        <Text style={{ color: '#71717a', fontSize: 14, marginBottom: 32 }}>
          Enter your email and we&apos;ll send a reset link
        </Text>

        {sent ? (
          <View
            style={{
              backgroundColor: '#14532d',
              borderWidth: 1,
              borderColor: '#166534',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text style={{ color: '#86efac', fontSize: 14, textAlign: 'center' }}>
              ✓ Check your email for the reset link
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 12,
                padding: 14,
                color: '#fafafa',
                fontSize: 15,
                marginBottom: 20,
              }}
            />
            <TouchableOpacity
              onPress={handleReset}
              disabled={loading || !email.trim()}
              style={{
                backgroundColor: '#6366f1',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
                opacity: !email.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
