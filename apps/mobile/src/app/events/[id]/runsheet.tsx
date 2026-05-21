import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import RunsheetItem, { RunsheetEntry } from '@/components/RunsheetItem'

type RunsheetStatus = RunsheetEntry['status']

const STATUS_OPTIONS: { value: RunsheetStatus; label: string; color: string }[] = [
  { value: 'pending',     label: 'Pending',     color: '#71717a' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'done',        label: 'Done',        color: '#22c55e' },
  { value: 'blocked',     label: 'Blocked',     color: '#f87171' },
  { value: 'skipped',     label: 'Skipped',     color: '#52525b' },
]

function isNowEntry(entry: RunsheetEntry) {
  const now = Date.now()
  const start = new Date(entry.start_time).getTime()
  const end = entry.end_time ? new Date(entry.end_time).getTime() : start + 30 * 60 * 1000
  return start <= now && now <= end
}

function isPastEntry(entry: RunsheetEntry) {
  const end = entry.end_time
    ? new Date(entry.end_time).getTime()
    : new Date(entry.start_time).getTime() + 30 * 60 * 1000
  return end < Date.now()
}

export default function RunsheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [selectedEntry, setSelectedEntry] = useState<RunsheetEntry | null>(null)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const listRef = useRef<FlatList>(null)

  const { data: entries = [], isLoading, refetch } = useQuery<RunsheetEntry[]>({
    queryKey: ['event-runsheet', id],
    queryFn: () => api.get(`/events/${id}/runsheet`),
    enabled: !!id,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ entryId, status }: { entryId: string; status: RunsheetStatus }) =>
      api.patch(`/events/${id}/runsheet/${entryId}`, { status }),
    onMutate: async ({ entryId, status }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['event-runsheet', id] })
      const prev = qc.getQueryData<RunsheetEntry[]>(['event-runsheet', id]) ?? []
      qc.setQueryData(
        ['event-runsheet', id],
        prev.map(e => (e.id === entryId ? { ...e, status } : e))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['event-runsheet', id], ctx.prev)
      Alert.alert('Error', 'Failed to update status')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['event-runsheet', id] })
    },
  })

  // Supabase Realtime subscription
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`runsheet:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'runsheet_entries', filter: `event_id=eq.${id}` },
        payload => {
          qc.invalidateQueries({ queryKey: ['event-runsheet', id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, qc])

  // Count in-progress entries
  useEffect(() => {
    const count = (entries as RunsheetEntry[]).filter(e => e.status === 'in_progress').length
    setLiveCount(count)
  }, [entries])

  const handleStatusChange = useCallback((entry: RunsheetEntry) => {
    setSelectedEntry(entry)
    setShowStatusPicker(true)
  }, [])

  const applyStatus = (status: RunsheetStatus) => {
    if (!selectedEntry) return
    setShowStatusPicker(false)
    updateStatusMutation.mutate({ entryId: selectedEntry.id, status })
    setSelectedEntry(null)
  }

  const scrollToNow = () => {
    const nowIdx = (entries as RunsheetEntry[]).findIndex(isNowEntry)
    if (nowIdx >= 0) {
      listRef.current?.scrollToIndex({ index: nowIdx, animated: true, viewOffset: 16 })
    }
  }

  const stats = {
    total: (entries as RunsheetEntry[]).length,
    done: (entries as RunsheetEntry[]).filter(e => e.status === 'done').length,
    inProgress: liveCount,
    blocked: (entries as RunsheetEntry[]).filter(e => e.status === 'blocked').length,
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1f1f1f',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fafafa" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fafafa', fontWeight: '700', fontSize: 16 }}>Runsheet</Text>
          {liveCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
              <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                {liveCount} item{liveCount !== 1 ? 's' : ''} in progress
              </Text>
            </View>
          )}
        </View>

        {/* Jump-to-now */}
        <TouchableOpacity
          onPress={scrollToNow}
          style={{
            backgroundColor: '#1f1f1f',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Ionicons name="time-outline" size={14} color="#71717a" />
          <Text style={{ color: '#71717a', fontSize: 12, fontWeight: '600' }}>Now</Text>
        </TouchableOpacity>
      </View>

      {/* Progress strip */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#1f1f1f',
        }}
      >
        {[
          { label: 'Total', value: stats.total, color: '#a1a1aa' },
          { label: 'Done', value: stats.done, color: '#22c55e' },
          { label: 'Live', value: stats.inProgress, color: '#f59e0b' },
          { label: 'Blocked', value: stats.blocked, color: '#f87171' },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ color: s.color, fontSize: 16, fontWeight: '700' }}>{s.value}</Text>
            <Text style={{ color: '#52525b', fontSize: 10 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Overall progress bar */}
      {stats.total > 0 && (
        <View style={{ height: 2, backgroundColor: '#1f1f1f', marginHorizontal: 0 }}>
          <View
            style={{
              height: '100%',
              backgroundColor: '#22c55e',
              width: `${(stats.done / stats.total) * 100}%`,
            }}
          />
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={entries as RunsheetEntry[]}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <RunsheetItem
              item={item}
              isNow={isNowEntry(item)}
              isPast={isPastEntry(item)}
              onStatusChange={handleStatusChange}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="list-outline" size={44} color="#27272a" />
              <Text style={{ color: '#71717a', marginTop: 12, fontSize: 14 }}>
                No runsheet entries yet
              </Text>
            </View>
          }
          onScrollToIndexFailed={() => {}}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366f1" />
          }
        />
      )}

      {/* Status picker modal (bottom sheet style) */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#00000099' }}
          activeOpacity={1}
          onPress={() => setShowStatusPicker(false)}
        />
        <View
          style={{
            backgroundColor: '#111111',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 8,
            paddingBottom: 40,
            borderTopWidth: 1,
            borderTopColor: '#1f1f1f',
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: '#3f3f46',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              color: '#71717a',
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              paddingHorizontal: 20,
              marginBottom: 12,
            }}
          >
            Update Status
          </Text>
          {selectedEntry && (
            <Text
              style={{
                color: '#ffffff',
                fontSize: 14,
                fontWeight: '600',
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
              numberOfLines={1}
            >
              {selectedEntry.title}
            </Text>
          )}
          {STATUS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => applyStatus(opt.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 14,
                backgroundColor:
                  selectedEntry?.status === opt.value ? '#1f1f1f' : 'transparent',
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: opt.color,
                }}
              />
              <Text style={{ color: opt.color, fontSize: 15, fontWeight: '600' }}>
                {opt.label}
              </Text>
              {selectedEntry?.status === opt.value && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={opt.color}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  )
}
