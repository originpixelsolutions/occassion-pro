import { View, Text } from 'react-native'

interface Stat {
  label: string
  value: string | number
  color?: string
  sublabel?: string
}

interface QuickStatsProps {
  stats: Stat[]
  columns?: 2 | 3 | 4
}

export default function QuickStats({ stats, columns = 2 }: QuickStatsProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {stats.map((stat, idx) => (
        <View
          key={idx}
          style={{
            flex: 1,
            minWidth: `${Math.floor(100 / columns) - 2}%`,
            backgroundColor: '#111111',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#1f1f1f',
            padding: 14,
            alignItems: 'flex-start',
          }}
        >
          <Text
            style={{
              color: stat.color ?? '#ffffff',
              fontSize: 22,
              fontWeight: '700',
              letterSpacing: -0.5,
            }}
          >
            {stat.value}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 4, fontWeight: '500' }}>
            {stat.label}
          </Text>
          {stat.sublabel && (
            <Text style={{ color: '#3f3f46', fontSize: 10, marginTop: 2 }}>{stat.sublabel}</Text>
          )}
        </View>
      ))}
    </View>
  )
}
