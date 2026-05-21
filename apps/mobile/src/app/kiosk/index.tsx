import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, Vibration } from 'react-native'
import { Camera, CameraView, useCameraPermissions } from 'expo-camera'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'

type ScanResult = {
  type: 'success' | 'error' | 'duplicate'
  name?: string
  message?: string
}

export default function KioskScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [permission, requestPermission])

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)
    Vibration.vibrate(100)

    try {
      // Expect QR data format: "guest:{guestId}:{eventId}"
      const parts = data.split(':')
      if (parts.length !== 3 || parts[0] !== 'guest') {
        setResult({ type: 'error', message: 'Invalid QR code format' })
        return
      }
      const [, guestId, eventId] = parts
      const response = await api.post<{ success: boolean; guest: { name: string }; duplicate?: boolean }>(
        `/events/${eventId}/guests/${guestId}/check-in`,
        {},
      )
      if (response.duplicate) {
        setResult({ type: 'duplicate', name: response.guest?.name, message: 'Already checked in' })
      } else {
        setResult({ type: 'success', name: response.guest?.name })
      }
    } catch (err: unknown) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Check-in failed' })
    }

    // Reset after 3 seconds
    setTimeout(() => {
      setScanned(false)
      setResult(null)
    }, 3000)
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#71717a' }}>Requesting camera permission…</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="camera-outline" size={48} color="#27272a" />
        <Text style={{ color: '#fafafa', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          Camera Permission Required
        </Text>
        <Text style={{ color: '#71717a', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          OccasionPro needs camera access to scan guest QR codes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            marginTop: 24,
            backgroundColor: '#6366f1',
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 52,
          paddingBottom: 16,
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Guest Check-In</Text>
      </View>

      {/* Camera */}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Scan frame overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: result
              ? result.type === 'success'
                ? '#22c55e'
                : result.type === 'duplicate'
                ? '#f59e0b'
                : '#ef4444'
              : 'rgba(255,255,255,0.5)',
          }}
        />
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 14 }}>
          {scanned ? 'Processing…' : 'Align QR code within frame'}
        </Text>
      </View>

      {/* Result overlay */}
      {result && (
        <View
          style={{
            position: 'absolute',
            bottom: 80,
            left: 24,
            right: 24,
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            backgroundColor:
              result.type === 'success'
                ? '#14532d'
                : result.type === 'duplicate'
                ? '#451a03'
                : '#3b0a0a',
            borderWidth: 1,
            borderColor:
              result.type === 'success'
                ? '#166534'
                : result.type === 'duplicate'
                ? '#78350f'
                : '#7f1d1d',
          }}
        >
          <Ionicons
            name={
              result.type === 'success'
                ? 'checkmark-circle'
                : result.type === 'duplicate'
                ? 'alert-circle'
                : 'close-circle'
            }
            size={36}
            color={
              result.type === 'success'
                ? '#22c55e'
                : result.type === 'duplicate'
                ? '#f59e0b'
                : '#ef4444'
            }
          />
          {result.name && (
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginTop: 8 }}>
              {result.name}
            </Text>
          )}
          <Text
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {result.type === 'success'
              ? 'Checked in successfully!'
              : result.type === 'duplicate'
              ? 'Already checked in'
              : result.message ?? 'Check-in failed'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}
