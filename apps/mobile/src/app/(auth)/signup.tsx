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

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function SignupScreen() {
  const [form, setForm] = useState({ full_name: '', company: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSignup = async () => {
    const { full_name, company, email, password } = form
    if (!full_name || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          tenant_name: company || full_name,
          tenant_slug: slugify(company || full_name),
        },
      },
    })
    setLoading(false)
    if (error) {
      Alert.alert('Sign Up Failed', error.message)
    } else {
      Alert.alert('Account Created', 'Check your email to verify your account', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
    }
  }

  const fields: Array<{
    key: keyof typeof form
    label: string
    placeholder: string
    type?: 'email-address' | 'default'
    secure?: boolean
    required?: boolean
  }> = [
    { key: 'full_name', label: 'Full Name', placeholder: 'John Smith', required: true },
    { key: 'company', label: 'Company Name', placeholder: 'Acme Events' },
    { key: 'email', label: 'Email', placeholder: 'you@company.com', type: 'email-address', required: true },
    { key: 'password', label: 'Password', placeholder: 'Min. 8 characters', secure: true, required: true },
  ]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 36 }}>
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
          <Text style={{ color: '#fafafa', fontSize: 26, fontWeight: '700', marginBottom: 4 }}>
            Create account
          </Text>
          <Text style={{ color: '#71717a', fontSize: 14 }}>Start managing events with OccasionPro</Text>
        </View>

        <View style={{ gap: 14, marginBottom: 24 }}>
          {fields.map(field => (
            <View key={field.key}>
              <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {field.label}{field.required ? ' *' : ''}
              </Text>
              <TextInput
                value={form[field.key]}
                onChangeText={set(field.key)}
                placeholder={field.placeholder}
                placeholderTextColor="#52525b"
                keyboardType={field.type ?? 'default'}
                autoCapitalize={field.type === 'email-address' ? 'none' : 'words'}
                secureTextEntry={field.secure}
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
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSignup}
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
            {loading ? 'Creating Account…' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: '#71717a', fontSize: 14 }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={{ color: '#6366f1', fontSize: 14, fontWeight: '600' }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
