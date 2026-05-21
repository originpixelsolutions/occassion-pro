'use client'

import { useEffect, useState } from 'react'
import {
  IndianRupee, ShoppingCart, TrendingUp, Ticket,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const PIE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6']

function StatCard({
  label, value, sub, icon: Icon, trend, color,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; trend?: number; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  )
}

export default function PaymentDashboard({ eventId }: { eventId: string }) {
  const { session } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token) return
    fetch(`${API}/api/v1/events/${eventId}/payments/dashboard`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [eventId, session])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
      Loading payment data…
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
      No payment data yet. Enable payments in Settings.
    </div>
  )

  const { revenue, orders, conversion_rate, tickets_sold, revenue_by_day, ticket_types } = data

  const pieData = [
    { name: 'Paid',    value: orders.paid },
    { name: 'Pending', value: orders.pending },
    { name: 'Failed',  value: orders.failed },
  ].filter(d => d.value > 0)

  const chartData = (revenue_by_day as any[]).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: d.amount,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`₹${Number(revenue.total).toLocaleString('en-IN')}`}
          icon={IndianRupee}
          color="bg-indigo-500/10 text-indigo-400"
        />
        <StatCard
          label="Total Orders"
          value={String(orders.total)}
          sub={`${orders.paid} paid · ${orders.failed} failed`}
          icon={ShoppingCart}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversion_rate}%`}
          sub="orders → paid"
          icon={TrendingUp}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Tickets Sold"
          value={String(tickets_sold)}
          icon={Ticket}
          color="bg-violet-500/10 text-violet-400"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Over Time</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
          )}
        </div>

        {/* Order Status Pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Order Status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No orders yet</div>
          )}
        </div>
      </div>

      {/* Ticket Types Breakdown */}
      {ticket_types?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ticket Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4 font-medium">Type</th>
                  <th className="text-right py-2 pr-4 font-medium">Price</th>
                  <th className="text-right py-2 pr-4 font-medium">Sold</th>
                  <th className="text-right py-2 pr-4 font-medium">Available</th>
                  <th className="text-right py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(ticket_types as any[]).map((t: any) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{t.category}</div>
                    </td>
                    <td className="text-right py-3 pr-4 text-foreground">₹{Number(t.price).toLocaleString('en-IN')}</td>
                    <td className="text-right py-3 pr-4 text-foreground">{t.sold_quantity}</td>
                    <td className="text-right py-3 pr-4">
                      {t.available === null ? (
                        <span className="text-emerald-400">Unlimited</span>
                      ) : (
                        <span className={t.available === 0 ? 'text-red-400' : 'text-foreground'}>{t.available}</span>
                      )}
                    </td>
                    <td className="text-right py-3 text-foreground font-medium">
                      ₹{Number(t.revenue).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
