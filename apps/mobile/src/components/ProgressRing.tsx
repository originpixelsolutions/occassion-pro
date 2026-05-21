import Svg, { Circle } from 'react-native-svg'
import { View, Text } from 'react-native'

interface ProgressRingProps {
  progress: number      // 0–1
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  sublabel?: string
}

export default function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 6,
  color = '#6366f1',
  trackColor = '#27272a',
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, progress)))

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center label */}
      {label !== undefined && (
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>{label}</Text>
          {sublabel && (
            <Text style={{ color: '#71717a', fontSize: 9, marginTop: 1 }}>{sublabel}</Text>
          )}
        </View>
      )}
    </View>
  )
}
