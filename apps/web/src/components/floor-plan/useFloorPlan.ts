'use client'
import { useState, useCallback, useRef } from 'react'
import type { FPShape, EditorState } from './types'

const MAX_HISTORY = 50

export function useFloorPlan(initial: FPShape[] = []) {
  const [state, setState] = useState<EditorState>({
    shapes: initial,
    history: [],
    future: [],
  })

  // Snapshot for undo
  const pushHistory = useCallback((prev: FPShape[], next: FPShape[]) => {
    setState(s => ({
      shapes: next,
      history: [...s.history.slice(-MAX_HISTORY + 1), prev],
      future: [],
    }))
  }, [])

  const addShape = useCallback((shape: FPShape) => {
    setState(s => {
      const next = [...s.shapes, shape]
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const updateShape = useCallback((id: string, updates: Partial<FPShape>) => {
    setState(s => {
      const next = s.shapes.map(sh => sh.id === id ? { ...sh, ...updates } : sh)
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const removeShape = useCallback((id: string) => {
    setState(s => {
      const next = s.shapes.filter(sh => sh.id !== id)
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setState(s => {
      if (!s.history.length) return s
      const prev = s.history[s.history.length - 1]
      return {
        shapes: prev,
        history: s.history.slice(0, -1),
        future: [s.shapes, ...s.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState(s => {
      if (!s.future.length) return s
      const next = s.future[0]
      return {
        shapes: next,
        history: [...s.history, s.shapes],
        future: s.future.slice(1),
      }
    })
  }, [])

  const bringToFront = useCallback((id: string) => {
    setState(s => {
      const max = Math.max(...s.shapes.map(sh => sh.zIndex), 0)
      const next = s.shapes.map(sh => sh.id === id ? { ...sh, zIndex: max + 1 } : sh)
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const sendToBack = useCallback((id: string) => {
    setState(s => {
      const min = Math.min(...s.shapes.map(sh => sh.zIndex), 0)
      const next = s.shapes.map(sh => sh.id === id ? { ...sh, zIndex: min - 1 } : sh)
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const duplicateShape = useCallback((id: string) => {
    setState(s => {
      const src = s.shapes.find(sh => sh.id === id)
      if (!src) return s
      const copy: FPShape = { ...src, id: `shape_${Date.now()}`, x: src.x + 40, y: src.y + 40, zIndex: src.zIndex + 1 }
      const next = [...s.shapes, copy]
      return { shapes: next, history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes], future: [] }
    })
  }, [])

  const replaceAll = useCallback((shapes: FPShape[]) => {
    setState(s => ({
      shapes,
      history: [...s.history.slice(-MAX_HISTORY + 1), s.shapes],
      future: [],
    }))
  }, [])

  return {
    shapes: state.shapes,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    addShape, updateShape, removeShape,
    undo, redo,
    bringToFront, sendToBack, duplicateShape,
    replaceAll,
  }
}
