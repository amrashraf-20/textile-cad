import * as React from 'react'
import {
  createColorMatrix,
  createMatrix,
  generateWeave,
  type WeaveType,
} from './weave'

export interface EditorDoc {
  name: string
  description: string
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
  settings: Record<string, unknown>
}

const DEFAULT_WARP = '#23364C'
const DEFAULT_WEFT = '#F5F1E8'

export function makeColors(count: number, palette: string[]) {
  return Array.from({ length: count }, (_, i) => palette[i % palette.length])
}

export function createDoc(warpEnds = 16, weftPicks = 16, name = ''): EditorDoc {
  return {
    name,
    description: '',
    warpEnds,
    weftPicks,
    weaveData: generateWeave(warpEnds, weftPicks, { type: 'plain' }),
    cellColors: createColorMatrix(warpEnds, weftPicks),
    // Professional default: one solid yarn colour per system, so the weave
    // structure reads clearly instead of a rainbow of stripes.
    warpColors: Array(warpEnds).fill(DEFAULT_WARP),
    weftColors: Array(weftPicks).fill(DEFAULT_WEFT),
    settings: {},
  }
}

export function cloneDoc(doc: EditorDoc): EditorDoc {
  return {
    ...doc,
    weaveData: doc.weaveData.map((row) => [...row]),
    cellColors: doc.cellColors.map((row) => [...row]),
    warpColors: [...doc.warpColors],
    weftColors: [...doc.weftColors],
    settings: { ...doc.settings },
  }
}

interface State {
  doc: EditorDoc
  past: EditorDoc[]
  future: EditorDoc[]
  dirty: boolean
}

type Action =
  | { type: 'commit'; updater: (doc: EditorDoc) => EditorDoc }
  | { type: 'load'; doc: EditorDoc }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' }

const MAX_HISTORY = 60

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'commit': {
      const next = action.updater(state.doc)
      if (next === state.doc) return state
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future: [],
        dirty: true,
      }
    }
    case 'load':
      return { doc: action.doc, past: [], future: [], dirty: false }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, MAX_HISTORY),
        dirty: true,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        dirty: true,
      }
    }
    case 'saved':
      return { ...state, dirty: false }
    default:
      return state
  }
}

export function useEditor(initial: EditorDoc) {
  const [state, dispatch] = React.useReducer(reducer, {
    doc: initial,
    past: [],
    future: [],
    dirty: false,
  })

  const update = React.useCallback((fn: (doc: EditorDoc) => EditorDoc) => {
    dispatch({ type: 'commit', updater: fn })
  }, [])

  const load = React.useCallback((doc: EditorDoc) => dispatch({ type: 'load', doc }), [])
  const markSaved = React.useCallback(() => dispatch({ type: 'saved' }), [])
  const undo = React.useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = React.useCallback(() => dispatch({ type: 'redo' }), [])

  const applyCells = React.useCallback(
    (cells: [number, number][], value: number, color?: string | null) => {
      if (cells.length === 0) return
      update((doc) => {
        const weave = doc.weaveData.map((row) => [...row])
        const colors = doc.cellColors.map((row) => [...row])
        for (const [r, c] of cells) {
          if (r < 0 || r >= doc.weftPicks || c < 0 || c >= doc.warpEnds) continue
          if (color !== undefined) {
            colors[r][c] = color
          }
          if (color === undefined || color === null || value !== undefined) {
            weave[r][c] = value
          }
        }
        return { ...doc, weaveData: weave, cellColors: colors }
      })
    },
    [update],
  )

  const resize = React.useCallback(
    (warpEnds: number, weftPicks: number) => {
      update((doc) => {
        const weave = createMatrix(warpEnds, weftPicks)
        const colors = createColorMatrix(warpEnds, weftPicks)
        for (let r = 0; r < Math.min(weftPicks, doc.weftPicks); r++) {
          for (let c = 0; c < Math.min(warpEnds, doc.warpEnds); c++) {
            weave[r][c] = doc.weaveData[r]?.[c] === 1 ? 1 : 0
            colors[r][c] = doc.cellColors[r]?.[c] ?? null
          }
        }
        return {
          ...doc,
          warpEnds,
          weftPicks,
          weaveData: weave,
          cellColors: colors,
          warpColors: Array.from({ length: warpEnds }, (_, i) => doc.warpColors[i] ?? doc.warpColors[doc.warpColors.length - 1] ?? DEFAULT_WARP),
          weftColors: Array.from({ length: weftPicks }, (_, i) => doc.weftColors[i] ?? doc.weftColors[doc.weftColors.length - 1] ?? DEFAULT_WEFT),
        }
      })
    },
    [update],
  )

  const applyGenerated = React.useCallback(
    (type: WeaveType, params: { pattern?: string; direction?: 'Z' | 'S'; size?: number; satinSize?: number }) => {
      update((doc) => ({
        ...doc,
        // Keep the user's yarn colours: a structure change must not repaint
        // the fabric unless they explicitly ask for a colourway.
        weaveData: generateWeave(doc.warpEnds, doc.weftPicks, {
          type,
          pattern: params.pattern,
          direction: params.direction,
          size: params.size,
          satinSize: params.satinSize,
        }),
        cellColors: createColorMatrix(doc.warpEnds, doc.weftPicks),
      }))
    },
    [update],
  )

  return {
    doc: state.doc,
    dirty: state.dirty,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    update,
    load,
    markSaved,
    undo,
    redo,
    applyCells,
    resize,
    applyGenerated,
  }
}

export type EditorApi = ReturnType<typeof useEditor>
