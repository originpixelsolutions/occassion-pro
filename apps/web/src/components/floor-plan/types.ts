// ─── Floor Plan Editor Types ──────────────────────────────────────────────────

export type ToolId =
  | 'select' | 'pan'
  | 'wall' | 'fence' | 'stage' | 'dance-floor' | 'bar' | 'entrance' | 'pillar'
  | 'table-round' | 'table-rect' | 'table-cocktail' | 'chair'
  | 'label' | 'zone' | 'eraser'

export type ShapeKind =
  | 'wall' | 'fence' | 'stage' | 'dance-floor' | 'bar' | 'entrance' | 'pillar'
  | 'table-round' | 'table-rect' | 'table-cocktail' | 'chair'
  | 'label' | 'zone'

export type LayerName = 'structure' | 'furniture' | 'labels'

export interface FPShape {
  id: string
  kind: ShapeKind
  layer: LayerName
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  rotation: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  label?: string
  fontSize?: number
  tableId?: string        // DB table id (for furniture shapes)
  capacity?: number
  assignedCount?: number
  draggable: boolean
  zIndex: number
}

export interface GuestAssignment {
  assignmentId: string
  guestId: string
  fullName: string
  category?: string
  mealPreference?: string
  seatNumber?: number | null
}

export interface FPTable {
  id: string
  name: string
  shapeId: string
  tableType: string
  capacity: number
  xPos: number
  yPos: number
  rotation: number
  zoneId?: string | null
  guests: GuestAssignment[]
}

export interface FPZone {
  id: string
  name: string
  color: string
  shapeId?: string
  capacity?: number
  zoneType: string
}

export interface FloorPlanData {
  id: string
  eventId: string
  name: string
  canvasData?: { shapes?: FPShape[] }
  canvasWidth: number
  canvasHeight: number
  gridSize: number
  scaleLabel: string
  isPublished: boolean
  zones: FPZone[]
  tables: FPTable[]
}

export interface UnassignedGuest {
  id: string
  fullName: string
  category?: string
  mealPreference?: string
  phone?: string
  email?: string
}

export interface EditorState {
  shapes: FPShape[]
  history: FPShape[][]     // undo stack
  future: FPShape[][]      // redo stack
}
