import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  assigned_to?: string
  event_id?: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#71717a',
}

const FILTERS = ['All', 'Pending', 'In Progress', 'Done']

export default function TasksScreen() {
  const [filter, setFilter] = useState('All')
  const qc = useQueryClient()

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/tasks?assigned_to_me=true'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}`, { status: 'done' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tasks'] }),
  })

  const filtered = (tasks as Task[]).filter(t => {
    if (filter === 'All') return true
    if (filter === 'Pending') return t.status === 'pending'
    if (filter === 'In Progress') return t.status === 'in_progress'
    if (filter === 'Done') return t.status === 'done'
    return true
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>Tasks</Text>
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#6366f1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: filter === f ? '#6366f1' : '#111111',
              borderWidth: 1,
              borderColor: filter === f ? '#6366f1' : '#1f1f1f',
            }}
          >
            <Text style={{ color: filter === f ? 'white' : '#71717a', fontSize: 12, fontWeight: '500' }}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); refetch() }}
            tintColor="#6366f1"
          />
        }
        renderItem={({ item }) => {
          const isDone = item.status === 'done'
          return (
            <View
              style={{
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#1f1f1f',
                borderRadius: 14,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <TouchableOpacity
                onPress={() => !isDone && completeMutation.mutate(item.id)}
                style={{ marginTop: 2 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: isDone ? '#22c55e' : '#3f3f46',
                    backgroundColor: isDone ? '#22c55e' : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDone && <Ionicons name="checkmark" size={13} color="white" />}
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: isDone ? '#71717a' : '#fafafa',
                    fontWeight: '600',
                    fontSize: 14,
                    textDecorationLine: isDone ? 'line-through' : 'none',
                  }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.description && (
                  <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  {item.priority && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: PRIORITY_COLORS[item.priority] ?? '#71717a',
                        }}
                      />
                      <Text style={{ color: '#71717a', fontSize: 11, textTransform: 'capitalize' }}>
                        {item.priority}
                      </Text>
                    </View>
                  )}
                  {item.due_date && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="time-outline" size={11} color="#71717a" />
                      <Text style={{ color: '#71717a', fontSize: 11 }}>
                        {new Date(item.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>
                {filter === 'All' ? 'No tasks assigned to you' : `No ${filter.toLowerCase()} tasks`}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
