'use client'

/**
 * QrScanner
 *
 * Continuous QR code scanning using @zxing/browser (no native deps, works in all
 * modern browsers including iOS Safari 14.3+).
 *
 * Behaviours:
 *   - Success scan → Web Audio "ding" beep + green flash + callback
 *   - Already checked in → red flash + different tone
 *   - Decoding errors are silently ignored (happens every frame with no QR present)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { CachedGuest } from '../hooks/useCheckinCache'

interface QrScannerProps {
  onScan: (guest: CachedGuest) => void
  onNotFound: (qrValue: string) => void
  onAlreadyCheckedIn: (guest: CachedGuest) => void
  lookupByQr: (qrCode: string) => Promise<CachedGuest | undefined>
  disabled?: boolean
}

type FlashState = 'none' | 'success' | 'duplicate'

export function QrScanner({
  onScan,
  onNotFound,
  onAlreadyCheckedIn,
  lookupByQr,
  disabled = false,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<InstanceType<typeof import('@zxing/browser').BrowserMultiFormatReader> | null>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedAtRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [flash, setFlash] = useState<FlashState>('none')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  // Deduplicate scans — ignore same QR value within 2 seconds
  const isDuplicate = useCallback((value: string) => {
    const now = Date.now()
    if (value === lastScannedRef.current && now - lastScannedAtRef.current < 2000) {
      return true
    }
    lastScannedRef.current = value
    lastScannedAtRef.current = now
    return false
  }, [])

  // Web Audio API beep — no external files needed
  const playBeep = useCallback((success: boolean) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(success ? 880 : 320, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch {
      // AudioContext may be suspended on iOS until user interaction — ignore
    }
  }, [])

  const triggerFlash = useCallback((state: FlashState) => {
    setFlash(state)
    setTimeout(() => setFlash('none'), 600)
  }, [])

  const handleResult = useCallback(
    async (text: string) => {
      if (isDuplicate(text)) return

      const guest = await lookupByQr(text)
      if (!guest) {
        playBeep(false)
        onNotFound(text)
        return
      }

      if (guest.is_checked_in) {
        playBeep(false)
        triggerFlash('duplicate')
        onAlreadyCheckedIn(guest)
        return
      }

      playBeep(true)
      triggerFlash('success')
      onScan(guest)
    },
    [isDuplicate, lookupByQr, onScan, onNotFound, onAlreadyCheckedIn, playBeep, triggerFlash],
  )

  useEffect(() => {
    if (disabled || !videoRef.current) return

    let cancelled = false

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        const videoElement = videoRef.current!
        await reader.decodeFromConstraints(
          {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoElement,
          (result, err) => {
            if (cancelled) return
            if (result) {
              handleResult(result.getText())
            }
            // err fires every frame with no QR — silently ignore
          },
        )
        if (!cancelled) setStarted(true)
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error
              ? err.message.includes('Permission')
                ? 'Camera permission denied. Please allow camera access and reload.'
                : err.message
              : 'Failed to start camera'
          setCameraError(msg)
        }
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (readerRef.current) {
        try {
          readerRef.current.reset()
        } catch {
          // ignore cleanup errors
        }
        readerRef.current = null
      }
    }
  }, [disabled, handleResult])

  const flashStyles: Record<FlashState, string> = {
    none: '',
    success: 'ring-4 ring-emerald-400',
    duplicate: 'ring-4 ring-red-400',
  }

  return (
    <div className="relative w-full flex flex-col items-center gap-3">
      {/* Camera viewport */}
      <div
        className={`relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black transition-all duration-150 ${flashStyles[flash]}`}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Scanning overlay — corner brackets */}
        {started && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 relative">
              {/* TL */}
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              {/* TR */}
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              {/* BL */}
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              {/* BR */}
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
              {/* Scan line */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-400/60 animate-pulse" />
            </div>
          </div>
        )}

        {/* Flash overlay */}
        {flash === 'success' && (
          <div className="absolute inset-0 bg-emerald-400/20 pointer-events-none" />
        )}
        {flash === 'duplicate' && (
          <div className="absolute inset-0 bg-red-400/20 pointer-events-none" />
        )}

        {/* Loading state */}
        {!started && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2 text-white">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Starting camera…</span>
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <p className="text-red-400 text-sm text-center">{cameraError}</p>
          </div>
        )}
      </div>

      <p className="text-sm text-white/40">Point camera at a guest QR code</p>
    </div>
  )
}
