'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { useParams } from 'next/navigation'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Circle, Line, Text, Group,
  Transformer, RegularPolygon,
} from 'react-konva'
import {
  MousePointer2, Hand, Square, Minus, Triangle, Music2,
  Circle as CircleIcon, Users, Tag, Layers, Grid3X3,
  ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Save,
  Globe, Download, ChevronDown, Trash2, Copy, ArrowUp,
  ArrowDown, Edit2, Plus, X, Check, Search, Loader2,
  LayoutGrid, Zap,
} from 'lucide-react'
import type { FPShape, FPTable, FPZone, FloorPlanData, UnassignedGuest, ShapeKind, LayerName, ToolId } from './types'
import { useFloorPlan } from './useFloorPlan'

// ─── Constants ────────────────────────────────────────────────────────────────

const API = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1')
  : ''

const GRID_COLOR = 'rgba(255,255,255,0.06)'
const SNAP_THRESHOLD = 10

// Shape default colors by kind
const KIND_DEFAULTS: Record<ShapeKind, { fill: string; stroke: string }> = {
  wall:         { fill: '#374151', stroke: '#6b7280' },
  fence:        { fill: 'rgba(0,0,0,0)', stroke: '#92400e' },
  stage:        { fill: '#1e3a5f', stroke: '#3b82f6' },
  'dance-floor':{ fill: 'rgba(139,92,246,0.2)', stroke: '#8b5cf6' },
  bar:          { fill: '#1c1917', stroke: '#f59e0b' },
  entrance:     { fill: 'rgba(16,185,129,0.2)', stroke: '#10b981' },
  pillar:       { fill: '#44403c', stroke: '#78716c' },
  'table-round':{ fill: '#1e293b', stroke: '#94a3b8' },
  'table-rect': { fill: '#1e293b', stroke: '#94a3b8' },
  'table-cocktail':{ fill: '#1e293b', stroke: '#f59e0b' },
  chair:        { fill: '#0f172a', stroke: '#475569' },
  label:        { fill: 'transparent', stroke: 'transparent' },
  zone:         { fill: 'rgba(99,102,241,0.15)', stroke: '#6366f1' },
}

const LAYER_OF_KIND: Record<ShapeKind, LayerName> = {
  wall: 'structure', fence: 'structure', stage: 'structure',
  'dance-floor': 'structure', bar: 'structure', entrance: 'structure', pillar: 'structure',
  'table-round': 'furniture', 'table-rect': 'furniture', 'table-cocktail': 'furniture', chair: 'furniture',
  label: 'labels', zone: 'structure',
}

function genId() { return `sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

function snapToGrid(val: number, grid: number, snap: boolean) {
  if (!snap) return val
  return Math.round(val / grid) * grid
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-sm ${
        active
          ? 'bg-white text-black'
          : 'text-white/60 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
  x, y, onClose,
  onEdit, onDuplicate, onDelete, onBringFront, onSendBack,
}: {
  x: number; y: number; onClose: () => void
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void
  onBringFront: () => void; onSendBack: () => void
}) {
  const items = [
    { label: 'Edit Label', icon: Edit2, action: onEdit },
    { label: 'Duplicate', icon: Copy, action: onDuplicate },
    { label: 'Bring to Front', icon: ArrowUp, action: onBringFront },
    { label: 'Send to Back', icon: ArrowDown, action: onSendBack },
    { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
  ]
  return (
    <div
      className="fixed z-50 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1.5 w-44 overflow-hidden"
      style={{ left: x, top: y }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-white/80 hover:bg-white/8'
          }`}
        >
          <item.icon size={13} />
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel({
  activeTool, setTool, onAddTable, zones, onAddZone,
  layerVisibility, toggleLayer,
}: {
  activeTool: ToolId
  setTool: (t: ToolId) => void
  onAddTable: (kind: ShapeKind, seats: number) => void
  zones: FPZone[]
  onAddZone: () => void
  layerVisibility: Record<LayerName, boolean>
  toggleLayer: (l: LayerName) => void
}) {
  const [leftTab, setLeftTab] = useState<'structure' | 'furniture' | 'zones' | 'layers'>('structure')

  const structureTools: { id: ToolId; label: string; icon: React.ReactNode }[] = [
    { id: 'wall', label: 'Wall', icon: <Square size={14} /> },
    { id: 'fence', label: 'Fence', icon: <Minus size={14} /> },
    { id: 'stage', label: 'Stage', icon: <Triangle size={14} /> },
    { id: 'dance-floor', label: 'Dance Floor', icon: <Music2 size={14} /> },
    { id: 'bar', label: 'Bar Counter', icon: <Square size={14} /> },
    { id: 'entrance', label: 'Entrance', icon: <ArrowUp size={14} /> },
    { id: 'pillar', label: 'Pillar', icon: <CircleIcon size={14} /> },
    { id: 'zone', label: 'Draw Zone', icon: <LayoutGrid size={14} /> },
    { id: 'label', label: 'Label', icon: <Tag size={14} /> },
  ]

  const tableOptions = [
    { kind: 'table-round' as ShapeKind, label: 'Round', seats: [4, 6, 8, 10] },
    { kind: 'table-rect' as ShapeKind, label: 'Rectangular', seats: [6, 8, 10, 12] },
    { kind: 'table-cocktail' as ShapeKind, label: 'Cocktail', seats: [2, 4] },
  ]

  return (
    <div className="w-[260px] shrink-0 flex flex-col bg-[#0d0d0d] border-r border-white/8 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex border-b border-white/8 shrink-0">
        {(['structure', 'furniture', 'zones', 'layers'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setLeftTab(tab)}
            className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors border-b-2 ${
              leftTab === tab ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Structure tools */}
        {leftTab === 'structure' && (
          <div className="grid grid-cols-2 gap-1.5">
            {structureTools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all border ${
                  activeTool === t.id
                    ? 'border-white/40 bg-white/10 text-white'
                    : 'border-white/8 bg-white/3 text-white/60 hover:text-white hover:border-white/20'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Furniture tools */}
        {leftTab === 'furniture' && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Single Chair</p>
              <button
                onClick={() => setTool('chair')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                  activeTool === 'chair'
                    ? 'border-white/40 bg-white/10 text-white'
                    : 'border-white/8 bg-white/3 text-white/60 hover:text-white hover:border-white/20'
                }`}
              >
                <CircleIcon size={13} />
                Place Chair
              </button>
            </div>
            {tableOptions.map(opt => (
              <div key={opt.kind}>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{opt.label} Table</p>
                <div className="grid grid-cols-4 gap-1">
                  {opt.seats.map(s => (
                    <button
                      key={s}
                      onClick={() => onAddTable(opt.kind, s)}
                      className="py-1.5 rounded-lg text-xs border border-white/8 bg-white/3 text-white/60 hover:text-white hover:border-white/20 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Zones */}
        {leftTab === 'zones' && (
          <div className="space-y-3">
            <button
              onClick={onAddZone}
              className="w-full flex items-center gap-2 py-2 rounded-lg text-xs border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-all"
            >
              <Plus size={13} />
              Add Zone
            </button>
            {zones.length === 0 && (
              <p className="text-xs text-white/30 text-center py-4">No zones yet. Draw one with the Zone tool.</p>
            )}
            {zones.map(z => (
              <div key={z.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/8">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: z.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{z.name}</p>
                  <p className="text-[10px] text-white/40 capitalize">{z.zoneType}</p>
                </div>
                {z.capacity && (
                  <span className="text-[10px] text-white/40">{z.capacity}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Layers */}
        {leftTab === 'layers' && (
          <div className="space-y-2">
            {(['structure', 'furniture', 'labels'] as LayerName[]).map(l => (
              <div key={l} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/8">
                <div className="flex items-center gap-2">
                  <Layers size={13} className="text-white/50" />
                  <span className="text-sm text-white capitalize">{l}</span>
                </div>
                <button
                  onClick={() => toggleLayer(l)}
                  className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${
                    layerVisibility[l] ? 'bg-white' : 'bg-white/10'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${
                    layerVisibility[l] ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel({
  selectedShape,
  selectedTable,
  tables,
  zones,
  unassignedGuests,
  unassignedSearch,
  setUnassignedSearch,
  onUpdateShape,
  onAssignGuest,
  onUnassignGuest,
  canvasProps,
  onUpdateCanvas,
}: {
  selectedShape: FPShape | null
  selectedTable: FPTable | null
  tables: FPTable[]
  zones: FPZone[]
  unassignedGuests: UnassignedGuest[]
  unassignedSearch: string
  setUnassignedSearch: (s: string) => void
  onUpdateShape: (id: string, updates: Partial<FPShape>) => void
  onAssignGuest: (tableId: string, guestId: string) => void
  onUnassignGuest: (tableId: string, guestId: string) => void
  canvasProps: { canvasWidth: number; canvasHeight: number; gridSize: number; scaleLabel: string }
  onUpdateCanvas: (u: Partial<typeof canvasProps>) => void
}) {
  const assigned = selectedTable?.guests.length ?? 0
  const capacity = selectedTable?.capacity ?? 0

  const filtered = useMemo(
    () => unassignedGuests.filter(g =>
      g.fullName.toLowerCase().includes(unassignedSearch.toLowerCase())
    ),
    [unassignedGuests, unassignedSearch],
  )

  const CATEGORY_COLORS: Record<string, string> = {
    vip: 'bg-amber-500/20 text-amber-400',
    family: 'bg-blue-500/20 text-blue-400',
    friend: 'bg-green-500/20 text-green-400',
    colleague: 'bg-purple-500/20 text-purple-400',
    other: 'bg-white/10 text-white/50',
  }

  return (
    <div className="w-[280px] shrink-0 flex flex-col bg-[#0d0d0d] border-l border-white/8 overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* Canvas / shape properties */}
        <div className="p-4 border-b border-white/8">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-3">Properties</p>

          {!selectedShape && (
            <div className="space-y-3">
              {[
                { label: 'Width (px)', key: 'canvasWidth', type: 'number' },
                { label: 'Height (px)', key: 'canvasHeight', type: 'number' },
                { label: 'Grid Size (px)', key: 'gridSize', type: 'number' },
                { label: 'Scale Label', key: 'scaleLabel', type: 'text' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] text-white/40">{f.label}</label>
                  <input
                    type={f.type}
                    value={String(canvasProps[f.key as keyof typeof canvasProps])}
                    onChange={e => onUpdateCanvas({ [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              ))}
            </div>
          )}

          {selectedShape && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Label</label>
                <input
                  value={selectedShape.label ?? ''}
                  onChange={e => onUpdateShape(selectedShape.id, { label: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  placeholder="e.g. VIP Stage"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-white/40">Fill</label>
                  <input
                    type="color"
                    value={selectedShape.fill.startsWith('rgba') ? '#4f46e5' : selectedShape.fill}
                    onChange={e => onUpdateShape(selectedShape.id, { fill: e.target.value })}
                    className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-white/40">Stroke</label>
                  <input
                    type="color"
                    value={selectedShape.stroke}
                    onChange={e => onUpdateShape(selectedShape.id, { stroke: e.target.value })}
                    className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Rotation (°)</label>
                <input
                  type="number"
                  value={selectedShape.rotation}
                  onChange={e => onUpdateShape(selectedShape.id, { rotation: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>
              {selectedShape.kind.startsWith('table') && (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-white/40">Table Name</label>
                    <input
                      value={selectedTable?.name ?? ''}
                      readOnly
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-white/40">Capacity</label>
                    <input
                      type="number"
                      value={selectedTable?.capacity ?? 8}
                      readOnly
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/50"
                    />
                  </div>
                  {zones.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/40">Zone</label>
                      <div className="text-xs text-white/40 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                        {zones.find(z => z.id === selectedTable?.zoneId)?.name ?? 'None'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Guest assignment panel — only when a table is selected */}
        {selectedTable && (
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Guest Assignment</p>
              <span className="text-[11px] text-white/60">{assigned}/{capacity}</span>
            </div>

            {/* Capacity bar */}
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  assigned >= capacity ? 'bg-red-400' : assigned > capacity * 0.75 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (assigned / capacity) * 100)}%` }}
              />
            </div>

            {/* Assigned guests */}
            {assigned > 0 && (
              <div className="space-y-1.5">
                {selectedTable.guests.map(g => (
                  <div key={g.guestId} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 group">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/50 shrink-0">
                      {g.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{g.fullName}</p>
                      {g.category && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${CATEGORY_COLORS[g.category] ?? CATEGORY_COLORS.other}`}>
                          {g.category}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onUnassignGuest(selectedTable.id, g.guestId)}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add guest search */}
            {assigned < capacity && (
              <div>
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={unassignedSearch}
                    onChange={e => setUnassignedSearch(e.target.value)}
                    placeholder="Search unassigned guests…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filtered.slice(0, 20).map(g => (
                    <button
                      key={g.id}
                      onClick={() => onAssignGuest(selectedTable.id, g.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/8 text-left transition-colors group"
                    >
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/50 shrink-0">
                        {g.fullName.charAt(0)}
                      </div>
                      <span className="flex-1 text-xs text-white/70 truncate group-hover:text-white">{g.fullName}</span>
                      <Plus size={11} className="text-white/30 group-hover:text-green-400 shrink-0" />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-xs text-white/30 text-center py-2">No unassigned guests</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Grid Layer ───────────────────────────────────────────────────────────────

function GridLines({ width, height, gridSize }: { width: number; height: number; gridSize: number }) {
  const lines: React.ReactNode[] = []
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke={GRID_COLOR} strokeWidth={1} listening={false} />)
  }
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke={GRID_COLOR} strokeWidth={1} listening={false} />)
  }
  return <>{lines}</>
}

// ─── Shape Renderer ───────────────────────────────────────────────────────────

function ShapeNode({
  shape, isSelected, onSelect, onDragEnd, onContextMenu, onDblClick,
}: {
  shape: FPShape
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onContextMenu: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
  onDblClick: (id: string) => void
}) {
  const common = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    draggable: shape.draggable,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(shape.id, e),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(shape.id, e.target.x(), e.target.y()),
    onContextMenu: (e: Konva.KonvaEventObject<MouseEvent>) => onContextMenu(shape.id, e),
    onDblClick: () => onDblClick(shape.id),
  }

  const selStroke = isSelected ? '#60a5fa' : shape.stroke

  switch (shape.kind) {
    case 'wall':
    case 'bar':
    case 'dance-floor':
    case 'zone':
    case 'entrance':
      return (
        <Group {...common}>
          <Rect
            width={shape.width ?? 200}
            height={shape.height ?? 60}
            fill={shape.fill}
            stroke={selStroke}
            strokeWidth={shape.kind === 'zone' ? 1.5 : 2}
            cornerRadius={shape.kind === 'zone' ? 4 : 0}
            dash={shape.kind === 'zone' ? [8, 4] : undefined}
          />
          {shape.label && (
            <Text
              text={shape.label}
              fontSize={shape.fontSize ?? 13}
              fill={shape.kind === 'zone' ? shape.stroke : 'rgba(255,255,255,0.7)'}
              x={4} y={4}
              fontStyle="bold"
            />
          )}
        </Group>
      )

    case 'fence':
      return (
        <Rect
          {...common}
          width={shape.width ?? 200}
          height={shape.height ?? 20}
          fill="transparent"
          stroke={selStroke}
          strokeWidth={2}
          dash={[12, 6]}
        />
      )

    case 'stage':
      return (
        <Group {...common}>
          <Rect
            width={shape.width ?? 300}
            height={shape.height ?? 120}
            fill={shape.fill}
            stroke={selStroke}
            strokeWidth={2}
            cornerRadius={6}
          />
          <Text
            text={shape.label ?? 'STAGE'}
            fontSize={shape.fontSize ?? 18}
            fill="rgba(255,255,255,0.6)"
            fontStyle="bold"
            x={(shape.width ?? 300) / 2}
            y={(shape.height ?? 120) / 2 - 9}
            offsetX={(shape.width ?? 300) / 4}
            align="center"
          />
        </Group>
      )

    case 'pillar':
      return (
        <Circle
          {...common}
          radius={shape.radius ?? 20}
          fill={shape.fill}
          stroke={selStroke}
          strokeWidth={2}
        />
      )

    case 'table-round':
    case 'table-cocktail': {
      const r = shape.radius ?? (shape.kind === 'table-cocktail' ? 18 : 45)
      return (
        <Group {...common}>
          <Circle
            radius={r}
            fill={shape.fill}
            stroke={selStroke}
            strokeWidth={2}
          />
          <Text
            text={shape.label ?? ''}
            fontSize={shape.fontSize ?? 11}
            fill="rgba(255,255,255,0.7)"
            align="center"
            width={r * 2}
            x={-r}
            y={-8}
          />
          {(shape.assignedCount !== undefined) && (
            <Text
              text={`${shape.assignedCount}/${shape.capacity}`}
              fontSize={9}
              fill="rgba(255,255,255,0.4)"
              align="center"
              width={r * 2}
              x={-r}
              y={5}
            />
          )}
        </Group>
      )
    }

    case 'table-rect':
      return (
        <Group {...common}>
          <Rect
            width={shape.width ?? 120}
            height={shape.height ?? 70}
            fill={shape.fill}
            stroke={selStroke}
            strokeWidth={2}
            cornerRadius={4}
          />
          <Text
            text={shape.label ?? ''}
            fontSize={shape.fontSize ?? 11}
            fill="rgba(255,255,255,0.7)"
            align="center"
            width={shape.width ?? 120}
            y={(shape.height ?? 70) / 2 - 7}
          />
          {(shape.assignedCount !== undefined) && (
            <Text
              text={`${shape.assignedCount}/${shape.capacity}`}
              fontSize={9}
              fill="rgba(255,255,255,0.4)"
              align="center"
              width={shape.width ?? 120}
              y={(shape.height ?? 70) / 2 + 5}
            />
          )}
        </Group>
      )

    case 'chair':
      return (
        <RegularPolygon
          {...common}
          sides={6}
          radius={shape.radius ?? 12}
          fill={shape.fill}
          stroke={selStroke}
          strokeWidth={1.5}
        />
      )

    case 'label':
      return (
        <Text
          {...common}
          text={shape.label ?? 'Label'}
          fontSize={shape.fontSize ?? 16}
          fill={shape.stroke || '#ffffff'}
          fontStyle="bold"
        />
      )

    default:
      return null
  }
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function FloorPlanEditorClient() {
  const { eventId } = useParams<{ eventId: string }>()

  // Data
  const [planData, setPlanData] = useState<FloorPlanData | null>(null)
  const [tables, setTables] = useState<FPTable[]>([])
  const [zones, setZones] = useState<FPZone[]>([])
  const [unassignedGuests, setUnassignedGuests] = useState<UnassignedGuest[]>([])
  const [canvasProps, setCanvasProps] = useState({
    canvasWidth: 3000,
    canvasHeight: 2000,
    gridSize: 50,
    scaleLabel: '1 cell = 1m',
  })

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolId>('select')
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerName, boolean>>({
    structure: true, furniture: true, labels: true,
  })

  // Stage state
  const [stageScale, setStageScale] = useState(0.6)
  const [stagePos, setStagePos] = useState({ x: 40, y: 40 })
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shapeId: string } | null>(null)

  // Draw state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Inline label edit
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search
  const [unassignedSearch, setUnassignedSearch] = useState('')

  // Floor plan state manager
  const {
    shapes, addShape, updateShape, removeShape,
    undo, redo, canUndo, canRedo,
    bringToFront, sendToBack, duplicateShape, replaceAll,
  } = useFloorPlan([])

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Init / get plan
        const initRes = await fetch(`${API}/floor-plan/events/${eventId}/init`, {
          method: 'POST', credentials: 'include',
        })
        if (!initRes.ok) return
        const plan: FloorPlanData = await initRes.json()
        setPlanData(plan)
        setCanvasProps({
          canvasWidth: plan.canvasWidth,
          canvasHeight: plan.canvasHeight,
          gridSize: plan.gridSize,
          scaleLabel: plan.scaleLabel,
        })

        // Restore canvas shapes
        if (plan.canvasData?.shapes?.length) {
          replaceAll(plan.canvasData.shapes)
        }

        // Full plan with assignments
        const fullRes = await fetch(`${API}/floor-plan/events/${eventId}`, { credentials: 'include' })
        if (fullRes.ok) {
          const full = await fullRes.json()
          if (full) {
            setTables(full.tables ?? [])
            setZones(full.zones ?? [])
          }
        }

        // Unassigned guests
        const ugRes = await fetch(`${API}/floor-plan/events/${eventId}/unassigned`, { credentials: 'include' })
        if (ugRes.ok) setUnassignedGuests(await ugRes.json())
      } catch {}
    }
    load()
  }, [eventId])

  // ── Auto-save (debounced 3s) ──────────────────────────────────────────────
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('idle')
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await fetch(`${API}/floor-plan/events/${eventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ canvasData: { shapes }, ...canvasProps }),
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 3000)
  }, [shapes, canvasProps, eventId])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redo() }
      if (e.key === 'v') setActiveTool('select')
      if (e.key === 'h') setActiveTool('pan')
      if (e.key === 'w') setActiveTool('wall')
      if (e.key === 't') addTableShape('table-round', 8)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) removeShape(selectedId)
      if (e.key === 'Escape') { setSelectedId(null); setContextMenu(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, undo, redo, removeShape])

  // ── Transformer sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return
    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) {
        transformerRef.current.nodes([node as Konva.Node])
        transformerRef.current.getLayer()?.batchDraw()
      } else {
        transformerRef.current.nodes([])
      }
    } else {
      transformerRef.current.nodes([])
    }
  }, [selectedId, shapes])

  // ── Stage scroll/zoom ────────────────────────────────────────────────────
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const scaleBy = 1.08
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()!
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clamped = Math.min(Math.max(newScale, 0.1), 5)
    setStageScale(clamped)
    setStagePos({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    })
  }

  function zoomIn()  { const n = Math.min(stageScale * 1.2, 5); setStageScale(n) }
  function zoomOut() { const n = Math.max(stageScale / 1.2, 0.1); setStageScale(n) }
  function fitScreen() {
    if (!containerRef.current) return
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight
    const scaleX = cw / canvasProps.canvasWidth
    const scaleY = ch / canvasProps.canvasHeight
    const s = Math.min(scaleX, scaleY) * 0.9
    setStageScale(s)
    setStagePos({ x: (cw - canvasProps.canvasWidth * s) / 2, y: (ch - canvasProps.canvasHeight * s) / 2 })
  }

  // ── Convert screen → canvas coords ──────────────────────────────────────
  function toCanvas(clientX: number, clientY: number) {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition() ?? { x: 0, y: 0 }
    return {
      x: (pos.x - stagePos.x) / stageScale,
      y: (pos.y - stagePos.y) / stageScale,
    }
  }

  // ── Draw start ───────────────────────────────────────────────────────────
  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (activeTool === 'select' || activeTool === 'pan') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    if (activeTool === 'eraser') return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const cx = (pos.x - stagePos.x) / stageScale
    const cy = (pos.y - stagePos.y) / stageScale

    if (activeTool === 'table-round' || activeTool === 'table-rect' || activeTool === 'table-cocktail') {
      // Place immediately on click
      const sg = canvasProps.gridSize
      addTableShape(
        activeTool as ShapeKind,
        activeTool === 'table-cocktail' ? 4 : 8,
        snapToGrid ? Math.round(cx / sg) * sg : cx,
        snapToGrid ? Math.round(cy / sg) * sg : cy,
      )
      return
    }
    if (activeTool === 'chair') {
      const sg = canvasProps.gridSize
      const sx = snapToGrid ? Math.round(cx / sg) * sg : cx
      const sy = snapToGrid ? Math.round(cy / sg) * sg : cy
      addShape({
        id: genId(), kind: 'chair', layer: 'furniture',
        x: sx, y: sy, radius: 12, rotation: 0,
        fill: KIND_DEFAULTS.chair.fill, stroke: KIND_DEFAULTS.chair.stroke, strokeWidth: 1.5,
        opacity: 1, draggable: true, zIndex: 10,
      })
      return
    }
    if (activeTool === 'label') {
      const sg = canvasProps.gridSize
      const sx = snapToGrid ? Math.round(cx / sg) * sg : cx
      const sy = snapToGrid ? Math.round(cy / sg) * sg : cy
      const id = genId()
      addShape({
        id, kind: 'label', layer: 'labels',
        x: sx, y: sy, rotation: 0,
        fill: 'transparent', stroke: '#ffffff', strokeWidth: 0,
        opacity: 1, label: 'Label', fontSize: 16, draggable: true, zIndex: 100,
      })
      return
    }

    // Draw rect shapes
    setIsDrawing(true)
    setDrawStart({ x: cx, y: cy })
    setDrawRect({ x: cx, y: cy, w: 0, h: 0 })
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!isDrawing) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const cx = (pos.x - stagePos.x) / stageScale
    const cy = (pos.y - stagePos.y) / stageScale
    setDrawRect({
      x: Math.min(drawStart.x, cx),
      y: Math.min(drawStart.y, cy),
      w: Math.abs(cx - drawStart.x),
      h: Math.abs(cy - drawStart.y),
    })
  }

  function handleStageMouseUp() {
    if (!isDrawing || !drawRect) return
    setIsDrawing(false)
    if (drawRect.w < 10 || drawRect.h < 10) { setDrawRect(null); return }

    const sg = canvasProps.gridSize
    const sx = snapToGrid ? Math.round(drawRect.x / sg) * sg : drawRect.x
    const sy = snapToGrid ? Math.round(drawRect.y / sg) * sg : drawRect.y
    const sw = snapToGrid ? Math.round(drawRect.w / sg) * sg : drawRect.w
    const sh = snapToGrid ? Math.round(drawRect.h / sg) * sg : drawRect.h

    const kind = activeTool as ShapeKind
    const defaults = KIND_DEFAULTS[kind] ?? KIND_DEFAULTS.wall
    const layer = LAYER_OF_KIND[kind] ?? 'structure'

    const labels: Partial<Record<ShapeKind, string>> = {
      stage: 'STAGE', 'dance-floor': 'DANCE FLOOR', bar: 'BAR', entrance: 'ENTRANCE',
    }

    addShape({
      id: genId(), kind, layer,
      x: sx, y: sy, width: sw, height: sh, rotation: 0,
      fill: defaults.fill, stroke: defaults.stroke, strokeWidth: 2,
      opacity: kind === 'zone' ? 1 : 0.95,
      label: labels[kind],
      fontSize: kind === 'stage' ? 18 : 13,
      draggable: true, zIndex: layer === 'structure' ? 1 : 5,
    })
    setDrawRect(null)
  }

  // ── Add table shape + DB record ──────────────────────────────────────────
  async function addTableShape(kind: ShapeKind, seats: number, x?: number, y?: number) {
    const cx = x ?? canvasProps.canvasWidth / 2 + Math.random() * 100 - 50
    const cy = y ?? canvasProps.canvasHeight / 2 + Math.random() * 100 - 50

    const tableNum = tables.length + 1
    const name = `Table ${tableNum}`

    // Create in DB
    try {
      const res = await fetch(`${API}/floor-plan/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          tableType: kind.replace('table-', ''),
          capacity: seats,
          xPos: cx,
          yPos: cy,
        }),
      })
      const dbTable = res.ok ? await res.json() : null

      const shapeId = genId()
      const isRound = kind === 'table-round' || kind === 'table-cocktail'

      const shape: FPShape = {
        id: shapeId, kind, layer: 'furniture',
        x: cx, y: cy,
        ...(isRound ? { radius: kind === 'table-cocktail' ? 18 : Math.max(30, seats * 7) } : { width: 120, height: 70 }),
        rotation: 0,
        fill: KIND_DEFAULTS[kind].fill,
        stroke: KIND_DEFAULTS[kind].stroke,
        strokeWidth: 2,
        opacity: 1,
        label: name,
        fontSize: 11,
        capacity: seats,
        assignedCount: 0,
        tableId: dbTable?.id,
        draggable: true,
        zIndex: 10,
      }

      addShape(shape)

      if (dbTable) {
        setTables(prev => [...prev, { ...dbTable, guests: [] }])
        // Update shape_id in DB
        await fetch(`${API}/floor-plan/events/${eventId}/tables/${dbTable.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ shapeId }),
        })
      }
    } catch {}
  }

  // ── Assign / unassign guest ──────────────────────────────────────────────
  async function handleAssignGuest(tableId: string, guestId: string) {
    try {
      await fetch(`${API}/floor-plan/events/${eventId}/tables/${tableId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guestId }),
      })
      // Refresh
      const [fullRes, ugRes] = await Promise.all([
        fetch(`${API}/floor-plan/events/${eventId}`, { credentials: 'include' }),
        fetch(`${API}/floor-plan/events/${eventId}/unassigned`, { credentials: 'include' }),
      ])
      if (fullRes.ok) { const d = await fullRes.json(); setTables(d?.tables ?? []) }
      if (ugRes.ok) setUnassignedGuests(await ugRes.json())
      // Sync shape assigned count
      const t = tables.find(t => t.id === tableId)
      if (t) {
        const shape = shapes.find(s => s.tableId === tableId)
        if (shape) updateShape(shape.id, { assignedCount: (t.guests.length ?? 0) + 1 })
      }
    } catch {}
  }

  async function handleUnassignGuest(tableId: string, guestId: string) {
    try {
      await fetch(`${API}/floor-plan/events/${eventId}/tables/${tableId}/guests/${guestId}`, {
        method: 'DELETE', credentials: 'include',
      })
      const [fullRes, ugRes] = await Promise.all([
        fetch(`${API}/floor-plan/events/${eventId}`, { credentials: 'include' }),
        fetch(`${API}/floor-plan/events/${eventId}/unassigned`, { credentials: 'include' }),
      ])
      if (fullRes.ok) { const d = await fullRes.json(); setTables(d?.tables ?? []) }
      if (ugRes.ok) setUnassignedGuests(await ugRes.json())
    } catch {}
  }

  // ── Auto-assign ─────────────────────────────────────────────────────────
  async function handleAutoAssign() {
    try {
      await fetch(`${API}/floor-plan/events/${eventId}/auto-assign`, {
        method: 'POST', credentials: 'include',
      })
      const [fullRes, ugRes] = await Promise.all([
        fetch(`${API}/floor-plan/events/${eventId}`, { credentials: 'include' }),
        fetch(`${API}/floor-plan/events/${eventId}/unassigned`, { credentials: 'include' }),
      ])
      if (fullRes.ok) { const d = await fullRes.json(); setTables(d?.tables ?? []); setZones(d?.zones ?? []) }
      if (ugRes.ok) setUnassignedGuests(await ugRes.json())
    } catch {}
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    try {
      await fetch(`${API}/floor-plan/events/${eventId}/publish`, {
        method: 'POST', credentials: 'include',
      })
      setPlanData(prev => prev ? { ...prev, isPublished: true } : prev)
    } catch {}
  }

  // ── Export PNG ───────────────────────────────────────────────────────────
  function exportPNG() {
    if (!stageRef.current) return
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
    const a = document.createElement('a')
    a.download = 'floor-plan.png'
    a.href = uri
    a.click()
  }

  // ── Context menu actions ──────────────────────────────────────────────────
  function handleContextMenu(shapeId: string, e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault()
    setSelectedId(shapeId)
    setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, shapeId })
  }

  // ── Shape drag end (update position in canvas + DB for tables) ───────────
  async function handleDragEnd(id: string, x: number, y: number) {
    const sg = canvasProps.gridSize
    const nx = snapToGrid ? Math.round(x / sg) * sg : x
    const ny = snapToGrid ? Math.round(y / sg) * sg : y
    updateShape(id, { x: nx, y: ny })

    // If it's a table shape, update DB
    const shape = shapes.find(s => s.id === id)
    if (shape?.tableId) {
      try {
        await fetch(`${API}/floor-plan/events/${eventId}/tables/${shape.tableId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ xPos: nx, yPos: ny }),
        })
      } catch {}
    }
  }

  // ── Delete shape ─────────────────────────────────────────────────────────
  async function handleDeleteShape(id: string) {
    const shape = shapes.find(s => s.id === id)
    removeShape(id)
    setSelectedId(null)
    if (shape?.tableId) {
      try {
        await fetch(`${API}/floor-plan/events/${eventId}/tables/${shape.tableId}`, {
          method: 'DELETE', credentials: 'include',
        })
        setTables(prev => prev.filter(t => t.id !== shape.tableId))
      } catch {}
    }
  }

  // ── Inline label editing ─────────────────────────────────────────────────
  function handleDblClick(id: string) {
    const shape = shapes.find(s => s.id === id)
    if (!shape) return
    setEditingLabelId(id)
    setLabelDraft(shape.label ?? '')
  }

  function commitLabel() {
    if (editingLabelId) {
      updateShape(editingLabelId, { label: labelDraft })
      setEditingLabelId(null)
    }
  }

  // ── Selected shape & table ────────────────────────────────────────────────
  const selectedShape = shapes.find(s => s.id === selectedId) ?? null
  const selectedTable = selectedShape?.tableId
    ? (tables.find(t => t.id === selectedShape.tableId) ?? null)
    : null

  // ── Sorted shapes (by zIndex) ────────────────────────────────────────────
  const sortedShapes = useMemo(
    () => [...shapes].sort((a, b) => a.zIndex - b.zIndex),
    [shapes],
  )

  const structureShapes  = sortedShapes.filter(s => s.layer === 'structure' && layerVisibility.structure)
  const furnitureShapes  = sortedShapes.filter(s => s.layer === 'furniture' && layerVisibility.furniture)
  const labelShapes      = sortedShapes.filter(s => s.layer === 'labels' && layerVisibility.labels)

  const containerW = containerRef.current?.clientWidth ?? 1200
  const containerH = containerRef.current?.clientHeight ?? 800

  return (
    <div className="h-screen flex flex-col bg-[#080808] text-white overflow-hidden select-none">

      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-1 px-3 py-2 bg-[#0d0d0d] border-b border-white/8 shrink-0 flex-wrap">

        {/* Main tools */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-white/10">
          <ToolBtn active={activeTool === 'select'} onClick={() => setActiveTool('select')} title="Select (V)">
            <MousePointer2 size={14} />
          </ToolBtn>
          <ToolBtn active={activeTool === 'pan'} onClick={() => setActiveTool('pan')} title="Pan (H)">
            <Hand size={14} />
          </ToolBtn>
          <ToolBtn active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} title="Eraser">
            <Trash2 size={14} />
          </ToolBtn>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 px-2 border-r border-white/10">
          <ToolBtn onClick={undo} title="Undo (Ctrl+Z)">
            <Undo2 size={14} className={canUndo ? '' : 'opacity-30'} />
          </ToolBtn>
          <ToolBtn onClick={redo} title="Redo (Ctrl+Y)">
            <Redo2 size={14} className={canRedo ? '' : 'opacity-30'} />
          </ToolBtn>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 px-2 border-r border-white/10">
          <ToolBtn onClick={zoomOut} title="Zoom Out"><ZoomOut size={14} /></ToolBtn>
          <span className="text-xs text-white/50 w-10 text-center tabular-nums">
            {Math.round(stageScale * 100)}%
          </span>
          <ToolBtn onClick={zoomIn} title="Zoom In"><ZoomIn size={14} /></ToolBtn>
          <ToolBtn onClick={fitScreen} title="Fit Screen"><Maximize size={14} /></ToolBtn>
        </div>

        {/* Grid toggles */}
        <div className="flex items-center gap-0.5 px-2 border-r border-white/10">
          <ToolBtn active={showGrid} onClick={() => setShowGrid(v => !v)} title="Toggle Grid">
            <Grid3X3 size={14} />
          </ToolBtn>
          <ToolBtn active={snapToGrid} onClick={() => setSnapToGrid(v => !v)} title="Snap to Grid">
            <LayoutGrid size={14} />
          </ToolBtn>
        </div>

        {/* Scale label */}
        <span className="text-[11px] text-white/30 px-2 border-r border-white/10">
          {canvasProps.scaleLabel}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 pr-2 border-r border-white/10">
          {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
          {saveStatus === 'saved' && <><Check size={12} className="text-green-400" /> Saved</>}
          {saveStatus === 'idle' && <Save size={12} />}
        </div>

        {/* Auto-assign */}
        <button
          onClick={handleAutoAssign}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all"
        >
          <Zap size={12} />
          Auto-Assign
        </button>

        {/* Export */}
        <button
          onClick={exportPNG}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all"
        >
          <Download size={12} />
          Export PNG
        </button>

        {/* Publish */}
        <button
          onClick={handlePublish}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            planData?.isPublished
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-white text-black hover:bg-white/90'
          }`}
        >
          <Globe size={12} />
          {planData?.isPublished ? 'Published' : 'Publish'}
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel */}
        <LeftPanel
          activeTool={activeTool}
          setTool={setActiveTool}
          onAddTable={addTableShape}
          zones={zones}
          onAddZone={() => setActiveTool('zone')}
          layerVisibility={layerVisibility}
          toggleLayer={(l) => setLayerVisibility(prev => ({ ...prev, [l]: !prev[l] }))}
        />

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{ cursor: activeTool === 'pan' ? 'grab' : activeTool === 'eraser' ? 'crosshair' : 'default' }}
          onClick={() => setContextMenu(null)}
        >
          <Stage
            ref={stageRef}
            width={containerW}
            height={containerH}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={activeTool === 'pan'}
            onDragEnd={e => setStagePos({ x: e.target.x(), y: e.target.y() })}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            {/* Background */}
            <Layer>
              <Rect
                x={0} y={0}
                width={canvasProps.canvasWidth}
                height={canvasProps.canvasHeight}
                fill="#0f0f0f"
                listening={false}
              />
              {/* Canvas border */}
              <Rect
                x={0} y={0}
                width={canvasProps.canvasWidth}
                height={canvasProps.canvasHeight}
                fill="transparent"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={2}
                listening={false}
              />
            </Layer>

            {/* Grid layer */}
            {showGrid && (
              <Layer listening={false}>
                <GridLines
                  width={canvasProps.canvasWidth}
                  height={canvasProps.canvasHeight}
                  gridSize={canvasProps.gridSize}
                />
              </Layer>
            )}

            {/* Structure layer */}
            <Layer visible={layerVisibility.structure}>
              {structureShapes.map(s => (
                <ShapeNode
                  key={s.id}
                  shape={s}
                  isSelected={selectedId === s.id}
                  onSelect={(id, e) => {
                    if (activeTool === 'eraser') { handleDeleteShape(id); return }
                    setSelectedId(id)
                  }}
                  onDragEnd={handleDragEnd}
                  onContextMenu={handleContextMenu}
                  onDblClick={handleDblClick}
                />
              ))}
            </Layer>

            {/* Furniture layer */}
            <Layer visible={layerVisibility.furniture}>
              {furnitureShapes.map(s => (
                <ShapeNode
                  key={s.id}
                  shape={s}
                  isSelected={selectedId === s.id}
                  onSelect={(id, _e) => {
                    if (activeTool === 'eraser') { handleDeleteShape(id); return }
                    setSelectedId(id)
                  }}
                  onDragEnd={handleDragEnd}
                  onContextMenu={handleContextMenu}
                  onDblClick={handleDblClick}
                />
              ))}
            </Layer>

            {/* Labels layer */}
            <Layer visible={layerVisibility.labels}>
              {labelShapes.map(s => (
                <ShapeNode
                  key={s.id}
                  shape={s}
                  isSelected={selectedId === s.id}
                  onSelect={(id, _e) => {
                    if (activeTool === 'eraser') { handleDeleteShape(id); return }
                    setSelectedId(id)
                  }}
                  onDragEnd={handleDragEnd}
                  onContextMenu={handleContextMenu}
                  onDblClick={handleDblClick}
                />
              ))}
            </Layer>

            {/* Draw preview */}
            {isDrawing && drawRect && (
              <Layer>
                <Rect
                  x={drawRect.x}
                  y={drawRect.y}
                  width={drawRect.w}
                  height={drawRect.h}
                  fill={KIND_DEFAULTS[activeTool as ShapeKind]?.fill ?? 'rgba(99,102,241,0.2)'}
                  stroke={KIND_DEFAULTS[activeTool as ShapeKind]?.stroke ?? '#6366f1'}
                  strokeWidth={1.5}
                  dash={[6, 3]}
                  listening={false}
                />
              </Layer>
            )}

            {/* Transformer */}
            <Layer>
              <Transformer
                ref={transformerRef}
                borderStroke="#60a5fa"
                borderStrokeWidth={1.5}
                anchorStroke="#60a5fa"
                anchorFill="#1e40af"
                anchorSize={8}
                rotateEnabled
                onTransformEnd={e => {
                  const node = e.target
                  if (selectedId) {
                    updateShape(selectedId, {
                      x: node.x(),
                      y: node.y(),
                      rotation: node.rotation(),
                      ...(node.getClassName() !== 'Circle' ? {
                        width: node.width() * node.scaleX(),
                        height: node.height() * node.scaleY(),
                      } : {
                        radius: (node as Konva.Circle).radius() * node.scaleX(),
                      }),
                    })
                    node.scaleX(1)
                    node.scaleY(1)
                  }
                }}
              />
            </Layer>
          </Stage>

          {/* Scale indicator */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/50">
            <div className="w-12 h-px bg-white/30" />
            {canvasProps.scaleLabel}
          </div>

          {/* Unassigned count */}
          {unassignedGuests.length > 0 && (
            <div className="absolute top-4 left-4 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-400">
              {unassignedGuests.length} guests unassigned
            </div>
          )}
        </div>

        {/* Right panel */}
        <RightPanel
          selectedShape={selectedShape}
          selectedTable={selectedTable}
          tables={tables}
          zones={zones}
          unassignedGuests={unassignedGuests}
          unassignedSearch={unassignedSearch}
          setUnassignedSearch={setUnassignedSearch}
          onUpdateShape={updateShape}
          onAssignGuest={handleAssignGuest}
          onUnassignGuest={handleUnassignGuest}
          canvasProps={canvasProps}
          onUpdateCanvas={(u) => setCanvasProps(prev => ({ ...prev, ...u }))}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => handleDblClick(contextMenu.shapeId)}
          onDuplicate={() => duplicateShape(contextMenu.shapeId)}
          onDelete={() => handleDeleteShape(contextMenu.shapeId)}
          onBringFront={() => bringToFront(contextMenu.shapeId)}
          onSendBack={() => sendToBack(contextMenu.shapeId)}
        />
      )}

      {/* Inline label editor (floating textarea) */}
      {editingLabelId && (() => {
        const shape = shapes.find(s => s.id === editingLabelId)
        const stage = stageRef.current
        if (!shape || !stage) return null
        const abs = {
          x: shape.x * stageScale + stagePos.x,
          y: shape.y * stageScale + stagePos.y,
        }
        return (
          <div
            className="fixed z-50"
            style={{ left: abs.x, top: abs.y }}
          >
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
              className="bg-[#1a1a2e] border border-blue-400 rounded px-2 py-1 text-sm text-white outline-none min-w-[120px]"
            />
          </div>
        )
      })()}
    </div>
  )
}
