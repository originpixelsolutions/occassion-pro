import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Vibration,
  Animated,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

type ScanState = 'scanning' | 'processing' | 'success' | 'error' | 'already_in'

interface CheckInResult {
  guest: {
    id: string
    guest_name: string
    category?: string
    table_number?: string
    company?: string
  }
  already_checked_in: boolean
  checked_in_at?: string
}

const SCAN_COOLDOWN_MS = 2500

export default function QRCheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [permission, requestPermission] = useCameraPermissions()
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [torch, setTorch] = useState(false)
  const [totalScanned, setTotalScanned] = useState(0)

  const scanLockRef = useRef(false)
  const flashAnim = useRef(new Animated.Value(0)).current

  const checkInMutation = useMutation({
    mutationFn: (qrData: string) =>
      api.post(`/events/${id}/guests/check-in/qr`, { qr_data: qrData }),
    onSuccess: (data: CheckInResult) => {
      setResult(data)
      Vibration.vibrate(data.already_checked_in ? [0, 100, 100, 100] : [0, 200])

      setScanState(data.already_checked_in ? 'already_in' : 'success')

      if (!data.already_checked_in) {
        setTotalScanned(n => n + 1)
        qc.invalidateQueries({ queryKey: ['event-guest-stats', id] })
        qc.invalidateQueries({ queryKey: ['event-guests', id] })
      }

      // Flash animation
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()

      // Auto-reset to scanning
      setTimeout(() => {
        setScanState('scanning')
        setResult(null)
        scanLockRef.current = false
      }, SCAN_COOLDOWN_MS)
    },
    onError: (err: Error) => {
      setScanState('error')
      Vibration.vibrate([0, 100, 100, 100, 100, 100])
      setTimeout(() => {
        setScanState('scanning')
        setResult(null)
        scanLockRef.current = false
      }, SCAN_COOLDOWN_MS)
    },
  })

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanLockRef.current || scanState !== 'scanning') return
      scanLockRef.current = true
      setScanState('processing')
      checkInMutation.mutate(data)
    },
    [scanState, checkInMutation]
  )

  if (!permission) return null

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Ionicons name="camera-outline" size={56} color="#27272a" />
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Camera Access Required
          </Text>
          <Text style={{ color: '#71717a', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            OccasionPro needs camera access to scan QR codes for guest check-in.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{
              backgroundColor: '#6366f1',
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 14,
              marginTop: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
              Grant Camera Access
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const overlayColor = scanState === 'success'
    ? '#22c55e'
    : scanState === 'error'
    ? '#f87171'
    : scanState === 'already_in'
    ? '#f59e0b'
    : '#6366f1'

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Full-screen camera */}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
      />

      {/* Flash feedback overlay */}
      <Animated.View
        pointerEvents="none"
        style={{
          ...{ position: 'absolute', inset: 0 },
          backgroundColor: overlayColor,
          opacity: flashAnim,
        }}
      />

      {/* UI overlay */}
      <View style={{ position: 'absolute', inset: 0 }}>
        {/* Top bar */}
        <SafeAreaView edges={['top']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#00000080',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>QR Check-In</Text>
              {totalScanned > 0 && (
                <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 1 }}>
                  {totalScanned} checked in this session
                </Text>
              )}
            </View>

            {/* Torch toggle */}
            <TouchableOpacity
              onPress={() => setTorch(t => !t)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: torch ? '#fbbf24' : '#00000080',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color={torch ? '#000000' : '#ffffff'} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Scanner frame */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 240,
              height: 240,
              position: 'relative',
            }}
          >
            {/* Corner markers */}
            {[
              { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
              { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
              { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
              { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
            ].map((style, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: 28,
                  height: 28,
                  borderColor: overlayColor,
                  borderRadius: 3,
                  ...style,
                }}
              />
            ))}
          </View>

          <Text
            style={{
              color: '#ffffff',
              fontSize: 13,
              marginTop: 20,
              opacity: 0.75,
              textAlign: 'center',
            }}
          >
            {scanState === 'processing'
              ? 'Processing…'
              : scanState === 'success'
              ? '✓ Checked in!'
              : scanState === 'already_in'
              ? '⚠ Already checked in'
              : scanState === 'error'
              ? '✗ Invalid QR code'
              : 'Point camera at guest QR code'}
          </Text>
        </View>

        {/* Bottom result card */}
        {result && (
          <View
            style={{
              margin: 16,
              backgroundColor: scanState === 'success'
                ? '#14532d'
                : scanState === 'already_in'
                ? '#78350f'
                : '#450a0a',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: scanState === 'success'
                ? '#22c55e40'
                : scanState === 'already_in'
                ? '#f59e0b40'
                : '#f8717140',
              marginBottom: 40,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor:
                    scanState === 'success'
                      ? '#22c55e33'
                      : scanState === 'already_in'
                      ? '#f59e0b33'
                      : '#f8717133',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={
                    scanState === 'success'
                      ? 'checkmark-circle'
                      : scanState === 'already_in'
                      ? 'warning'
                      : 'close-circle'
                  }
                  size={26}
                  color={
                    scanState === 'success'
                      ? '#22c55e'
                      : scanState === 'already_in'
                      ? '#f59e0b'
                      : '#f87171'
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                  {result.guest.guest_name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                  {result.guest.category && (
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{result.guest.category}</Text>
                  )}
                  {result.guest.table_number && (
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                      Table {result.guest.table_number}
                    </Text>
                  )}
                  {result.guest.company && (
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }} numberOfLines={1}>
                      {result.guest.company}
                    </Text>
                  )}
                </View>
                <Text
                  style={{
                    color:
                      scanState === 'success'
                        ? '#4ade80'
                        : scanState === 'already_in'
                        ? '#fbbf24'
                        : '#f87171',
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: '600',
                  }}
                >
                  {scanState === 'success'
                    ? 'Successfully checked in'
                    : scanState === 'already_in'
                    ? 'Already checked in earlier'
                    : 'Check-in failed'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
