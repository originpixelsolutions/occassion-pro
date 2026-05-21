import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface FinanceSummary {
  total_budget: number
  total_spent: number
  total_revenue: number
  pending_invoices: number
  overdue_invoices: number
  profit_margin: number
}

interface Transaction {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  date: string
  status: 'pending' | 'completed' | 'overdue'
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#1c1917', text: '#fbbf24' },
  completed: { bg: '#14532d', text: '#86efac' },
  overdue:   { bg: '#3b0a0a', text: '#fca5a5' },
}

function StatCard({ label, value, icon, color, sub }: {
  label: string
  value: string
  icon: string
  color: string
  sub?: string
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#111111',
      borderWidth: 1,
      borderColor: '#1f1f1f',
      borderRadius: 14,
      padding: 14,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '500' }}>{label}</Text>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={{ color: '#fafafa', fontSize: 18, fontWeight: '700' }}>{value}</Text>
      {sub && <Text style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{sub}</Text>}
    </View>
  )
}

export default function FinanceScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: summary, refetch: refetchSummary } = useQuery<FinanceSummary>({
    queryKey: ['finance-summary'],
    queryFn: () => api.get('/finance/summary'),
  })

  const { data: transactions = [], refetch: refetchTx } = useQuery<Transaction[]>({
    queryKey: ['finance-transactions'],
    queryFn: () => api.get('/finance/transactions?limit=10'),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchSummary(), refetchTx()])
    setRefreshing(false)
  }

  const fmt = (n?: number) => n != null
    ? `₹${n >= 100000 ? (n / 100000).toFixed(1) + 'L' : (n / 1000).toFixed(0) + 'k'}`
    : '—'

  const spent = summary?.total_spent ?? 0
  const budget = summary?.total_budget ?? 1
  const progress = Math.min(spent / budget, 1)

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
          <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Finance</Text>
          <TouchableOpacity
            onPress={() => router.push('/finance/new' as never)}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <StatCard label="Revenue" value={fmt(summary?.total_revenue)} icon="trending-up-outline" color="#86efac" />
          <StatCard label="Expenses" value={fmt(summary?.total_spent)} icon="trending-down-outline" color="#fca5a5" />
        </View>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <StatCard
            label="Pending"
            value={String(summary?.pending_invoices ?? 0)}
            icon="time-outline"
            color="#fbbf24"
            sub="invoices"
          />
          <StatCard
            label="Overdue"
            value={String(summary?.overdue_invoices ?? 0)}
            icon="alert-circle-outline"
            color="#fca5a5"
            sub="invoices"
          />
        </View>

        {/* Budget progress */}
        {summary && (
          <View style={{ marginHorizontal: 20, backgroundColor: '#111111', borderWidth: 1, borderColor: '#1f1f1f', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600' }}>Budget Utilisation</Text>
              <Text style={{ color: '#71717a', fontSize: 13 }}>
                {fmt(summary.total_spent)} / {fmt(summary.total_budget)}
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#1f1f1f', borderRadius: 99 }}>
              <View style={{
                height: 6,
                width: `${Math.round(progress * 100)}%` as any,
                borderRadius: 99,
                backgroundColor: progress > 0.9 ? '#ef4444' : progress > 0.7 ? '#f59e0b' : '#6366f1',
              }} />
            </View>
            <Text style={{ color: '#71717a', fontSize: 11, marginTop: 6 }}>
              {Math.round(progress * 100)}% used · {fmt(summary.total_budget - summary.total_spent)} remaining
            </Text>
          </View>
        )}

        {/* Recent transactions */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#fafafa', fontSize: 16, fontWeight: '600' }}>Recent</Text>
            <TouchableOpacity onPress={() => router.push('/finance' as never)}>
              <Text style={{ color: '#6366f1', fontSize: 13 }}>See all</Text>
            </TouchableOpacity>
          </View>

          {(transactions as Transaction[]).map((tx) => {
            const colors = STATUS_COLORS[tx.status] ?? STATUS_COLORS.pending
            return (
              <View
                key={tx.id}
                style={{
                  backgroundColor: '#111111',
                  borderWidth: 1,
                  borderColor: '#1f1f1f',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{tx.category} · {tx.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: tx.type === 'income' ? '#86efac' : '#fca5a5', fontSize: 14, fontWeight: '700' }}>
                    {tx.type === 'income' ? '+' : '-'}₹{(tx.amount / 1000).toFixed(0)}k
                  </Text>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.bg }}>
                    <Text style={{ fontSize: 10, color: colors.text, fontWeight: '600' }}>{tx.status}</Text>
                  </View>
                </View>
              </View>
            )
          })}

          {(transactions as Transaction[]).length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="receipt-outline" size={40} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 10, fontSize: 14 }}>No transactions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
