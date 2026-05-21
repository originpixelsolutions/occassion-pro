import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface BudgetLine {
  id: string
  category: string
  description: string
  estimated: number
  actual: number
  status: 'on_track' | 'over_budget' | 'under_budget' | 'pending'
  event_name: string
}

interface BudgetSummary {
  total_estimated: number
  total_actual: number
  variance: number
  categories_over_budget: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  on_track:     { bg: '#14532d', text: '#86efac', icon: 'checkmark-circle-outline' },
  over_budget:  { bg: '#3b0a0a', text: '#fca5a5', icon: 'arrow-up-circle-outline'  },
  under_budget: { bg: '#1a1a2e', text: '#a78bfa', icon: 'arrow-down-circle-outline' },
  pending:      { bg: '#1c1917', text: '#a8a29e', icon: 'time-outline'              },
}

function SummaryCard({ label, value, sub, trend }: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral'
}) {
  const trendColor = trend === 'up' ? '#86efac' : trend === 'down' ? '#fca5a5' : '#71717a'
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#111111',
      borderWidth: 1,
      borderColor: '#1f1f1f',
      borderRadius: 14,
      padding: 14,
    }}>
      <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '500', marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: trendColor, fontSize: 17, fontWeight: '700' }}>{value}</Text>
      {sub && <Text style={{ color: '#52525b', fontSize: 10, marginTop: 2 }}>{sub}</Text>}
    </View>
  )
}

export default function BudgetScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: summary, refetch: refetchSummary } = useQuery<BudgetSummary>({
    queryKey: ['budget-summary'],
    queryFn: () => api.get('/finance/budget-summary'),
  })

  const { data: lines = [], refetch: refetchLines } = useQuery<BudgetLine[]>({
    queryKey: ['budget-lines'],
    queryFn: () => api.get('/finance/budgets'),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchSummary(), refetchLines()])
    setRefreshing(false)
  }

  const fmt = (n?: number) => n != null
    ? `₹${Math.abs(n) >= 100000
        ? (Math.abs(n) / 100000).toFixed(1) + 'L'
        : (Math.abs(n) / 1000).toFixed(0) + 'k'}`
    : '—'

  const variancePositive = (summary?.variance ?? 0) >= 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Budget</Text>
          <TouchableOpacity
            onPress={() => router.push('/budget/new' as never)}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SummaryCard
            label="Estimated"
            value={fmt(summary?.total_estimated)}
            sub="total budget"
            trend="neutral"
          />
          <SummaryCard
            label="Actual"
            value={fmt(summary?.total_actual)}
            sub="spent so far"
            trend="neutral"
          />
        </View>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <SummaryCard
            label="Variance"
            value={`${variancePositive ? '+' : '-'}${fmt(summary?.variance)}`}
            sub={variancePositive ? 'under budget' : 'over budget'}
            trend={variancePositive ? 'up' : 'down'}
          />
          <SummaryCard
            label="Over Budget"
            value={String(summary?.categories_over_budget ?? 0)}
            sub="categories"
            trend={(summary?.categories_over_budget ?? 0) > 0 ? 'down' : 'up'}
          />
        </View>

        {/* Budget progress bar */}
        {summary && (
          <View style={{ marginHorizontal: 20, backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 16, padding: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600' }}>Budget vs Actual</Text>
              <Text style={{ color: '#71717a', fontSize: 13 }}>
                {summary.total_estimated > 0
                  ? `${Math.round((summary.total_actual / summary.total_estimated) * 100)}%`
                  : '—'}
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#1f1f1f', borderRadius: 99 }}>
              <View style={{
                height: 6,
                width: summary.total_estimated > 0
                  ? `${Math.min(Math.round((summary.total_actual / summary.total_estimated) * 100), 100)}%` as any
                  : '0%',
                borderRadius: 99,
                backgroundColor: !variancePositive ? '#ef4444' : '#6366f1',
              }} />
            </View>
          </View>
        )}

        {/* Budget line items */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: '#fafafa', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Line Items</Text>

          {(lines as BudgetLine[]).map((line) => {
            const s = STATUS_COLORS[line.status] ?? STATUS_COLORS.pending
            const over = line.actual > line.estimated
            return (
              <View
                key={line.id}
                style={{
                  backgroundColor: '#111111',
                  borderWidth: 1,
                  borderColor: '#1f1f1f',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                      {line.description}
                    </Text>
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{line.category}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: s.bg }}>
                    <Text style={{ fontSize: 10, color: s.text, fontWeight: '600' }}>
                      {line.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View>
                    <Text style={{ color: '#52525b', fontSize: 10 }}>Estimated</Text>
                    <Text style={{ color: '#71717a', fontSize: 13, fontWeight: '600' }}>{fmt(line.estimated)}</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#52525b', fontSize: 10 }}>Actual</Text>
                    <Text style={{ color: over ? '#fca5a5' : '#86efac', fontSize: 13, fontWeight: '700' }}>
                      {fmt(line.actual)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: '#52525b', fontSize: 10 }}>Variance</Text>
                    <Text style={{ color: over ? '#fca5a5' : '#86efac', fontSize: 13, fontWeight: '600' }}>
                      {over ? '-' : '+'}{fmt(Math.abs(line.actual - line.estimated))}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}

          {(lines as BudgetLine[]).length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="wallet-outline" size={40} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 10, fontSize: 14 }}>No budget lines yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
