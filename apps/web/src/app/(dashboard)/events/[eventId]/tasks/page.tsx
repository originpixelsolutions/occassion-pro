'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Plus, CheckSquare, Circle, Clock, AlertCircle,
  CheckCircle2, Trash2, Edit2, Flag, User, Calendar,
  MoreHorizontal, GripVertical, ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical'
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  due_date: string | null
  assigned_to: string | null
  assigned_name: string | null
  category: string | null
  created_at: string
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:      { label: 'Low',      color: 'text-slate-500',   dot: 'bg-slate-400' },
  medium:   { label: 'Medium',   color: 'text-blue-600',    dot: 'bg-blue-500' },
  high:     { label: 'High',     color: 'text-orange-600',  dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-600',     dot: 'bg-red-500' },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  todo:        { label: 'To Do',       icon: Circle,        color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock,         color: 'text-blue-600' },
  done:        { label: 'Done',        icon: CheckCircle2,  color: 'text-green-600' },
  blocked:     { label: 'Blocked',     icon: AlertCircle,   color: 'text-red-600' },
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EventTasksPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')

  // Add task state
  const [showAdd, setShowAdd] = useState(false)
  const [targetStatus, setTargetStatus] = useState<TaskStatus>('todo')
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    due_date: '', category: '',
  })

  // ── Data ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return
    setLoading(true)
    const { data } = await supabase
      .from('event_tasks')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at')
    setTasks(data ?? [])
    setLoading(false)
  }, [eventId, profile?.tenant_id, supabase])

  useEffect(() => { load() }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────

  const addTask = async () => {
    if (!newTask.title.trim()) return
    await supabase.from('event_tasks').insert({
      event_id: eventId,
      tenant_id: profile!.tenant_id,
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      status: targetStatus,
      due_date: newTask.due_date || null,
      category: newTask.category || null,
    })
    setShowAdd(false)
    setNewTask({ title: '', description: '', priority: 'medium', due_date: '', category: '' })
    load()
  }

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from('event_tasks').update({ status }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  const deleteTask = async (taskId: string) => {
    await supabase.from('event_tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = filterPriority === 'all' ? tasks : tasks.filter(t => t.priority === filterPriority)
  const byStatus = (status: TaskStatus) => filtered.filter(t => t.status === status)
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event Overview
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Tasks</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {done} of {total} complete · {pct}% done
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            {(['board', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-sm capitalize transition-colors',
                  view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Priority filter */}
          <select
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
          >
            <option value="all">All priorities</option>
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
          <button
            onClick={() => { setTargetStatus('todo'); setShowAdd(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-xl px-5 py-3">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Board view */}
      {view === 'board' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = byStatus(col)
            const cfg = STATUS_CONFIG[col]
            const Icon = cfg.icon
            return (
              <div key={col} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('flex items-center gap-2 font-medium text-sm', cfg.color)}>
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{colTasks.length}</span>
                    <button
                      onClick={() => { setTargetStatus(col); setShowAdd(true) }}
                      className="p-1 hover:bg-muted rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={updateStatus}
                      onDelete={deleteTask}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && !loading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {['Task', 'Priority', 'Status', 'Due', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(task => {
                  const pCfg = PRIORITY_CONFIG[task.priority]
                  const sCfg = STATUS_CONFIG[task.status]
                  const SIcon = sCfg.icon
                  return (
                    <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className={cn('font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
                          {task.title}
                        </p>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium', pCfg.color)}>
                          <span className={cn('w-2 h-2 rounded-full', pCfg.dot)} />
                          {pCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={e => updateStatus(task.id, e.target.value as TaskStatus)}
                          className={cn('text-xs font-medium bg-transparent border-none cursor-pointer', sCfg.color)}
                        >
                          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Task</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input
                  autoFocus
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newTask.title}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newTask.description}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={newTask.priority}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Priority }))}
                  >
                    {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={targetStatus}
                    onChange={e => setTargetStatus(e.target.value as TaskStatus)}
                  >
                    {COLUMNS.map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={newTask.due_date}
                    onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={newTask.category}
                    onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Logistics"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={addTask} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Task Card (board) ──────────────────────────────────────────────────────────

function TaskCard({
  task, onStatusChange, onDelete,
}: {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
}) {
  const pCfg = PRIORITY_CONFIG[task.priority]
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-background border border-border rounded-lg p-3 group">
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-sm font-medium leading-snug flex-1', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="relative">
          <button onClick={() => setOpen(p => !p)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-all">
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute right-0 top-6 z-10 bg-popover border border-border rounded-lg shadow-lg py-1 w-36">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(task.id, s); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  Move to {STATUS_CONFIG[s].label}
                </button>
              ))}
              <hr className="my-1 border-border" />
              <button
                onClick={() => { onDelete(task.id); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-muted transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={cn('flex items-center gap-1 text-xs', pCfg.color)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', pCfg.dot)} />
          {pCfg.label}
        </span>
        {task.due_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}
