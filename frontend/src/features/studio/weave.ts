/**
 * Weave rendering + colour utilities.
 *
 * The structures themselves live in `draft.ts` (threading / tie-up /
 * treadling). This module turns a weave matrix into a fabric image and
 * provides the colourways, stripe tools and colour-and-weave effects.
 */

import {
  COLORWAYS,
  STRUCTURES,
  STRUCTURE_FAMILIES,
  createColorMatrix,
  createMatrix,
  defaultOptions,
  draftCell,
  draftToMatrix,
  generateCompoundWeave,
  generateStructure,
  generateWeave as generateStructureWeave,
  plainDraft,
  structureById,
  twillDraft,
  type StructureDef,
  type StructureOptions,
  type WeaveDraft,
} from './draft'

export {
  createColorMatrix,
  createMatrix,
  draftCell,
  draftToMatrix,
  generateCompoundWeave,
  generateStructure,
  STRUCTURES,
  STRUCTURE_FAMILIES,
  COLORWAYS,
  defaultOptions,
  structureById,
}
export type { StructureDef, StructureOptions, WeaveDraft }

export type WeaveType =
  | 'plain'
  | 'rib'
  | 'twill'
  | 'satin'
  | 'mockLeno'
  | 'honeycomb'
  | 'crepe'

export interface WeaveParams {
  type: WeaveType
  pattern?: string
  direction?: 'Z' | 'S'
  satinSize?: number
  size?: number
  warpPattern?: string
  weftPattern?: string
}

/** "1/1", "2/2", "3,1,2" → flat lift sequence (legacy helper). */
export function parsePatternToSequence(pattern: string | undefined): number[] {
  let nums = (pattern ?? '')
    .split(/[/,-]/)
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0)

  if (nums.length === 0) nums = [1, 1]
  if (nums.length % 2 !== 0) nums = nums.concat(nums)

  const sequence: number[] = []
  let isUp = true
  for (const n of nums) {
    for (let i = 0; i < n; i++) sequence.push(isUp ? 1 : 0)
    isUp = !isUp
  }
  return sequence
}

export const generateWeave = (
  width: number,
  height: number,
  params: WeaveParams,
): number[][] => generateStructureWeave(width, height, params)

/** Palette used by the quick generator (kept for backwards compatibility). */
export const GENERATOR_PALETTES: Record<WeaveType, { warp: string; weft: string }> = {
  plain: { warp: '#2B3A4A', weft: '#F3EFE6' },
  twill: { warp: '#1F3A5F', weft: '#E8E2D6' },
  satin: { warp: '#3E2C4F', weft: '#EFE7DA' },
  rib: { warp: '#6B4E3D', weft: '#F1E8DA' },
  mockLeno: { warp: '#2F5D50', weft: '#EDE6D6' },
  honeycomb: { warp: '#8A5A2B', weft: '#F5EEDF' },
  crepe: { warp: '#4A4A4A', weft: '#EFEAE0' },
}

/* ------------------------------------------------------------- colour maths */

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6)
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n)) return [200, 200, 200]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

/** amount > 0 lightens, < 0 darkens (−1…1). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const t = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p)
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function readableInk(hex: string): string {
  return luminance(hex) > 0.6 ? '#16202D' : '#FFFFFF'
}

/* --------------------------------------------------------------- palettes */

/** Curated colourway by id (falls back to the first one). */
export function colorway(id: string): { warp: string; weft: string } {
  const found = COLORWAYS.find((c) => c.id === id) ?? COLORWAYS[0]
  return { warp: found.warp, weft: found.weft }
}

/**
 * Deterministic harmonious colourway. Saturation is deliberately capped so
 * the result looks like dyed yarn rather than a neon gradient.
 */
export function buildColorway(seed: number, count: number, light = true): string[] {
  const base = ((seed % 360) + 360) % 360
  const offsets = [0, 24, 168, 192, 48, 336]
  return Array.from({ length: count }, (_, i) => {
    const hue = (base + offsets[i % offsets.length]) % 360
    const saturation = light ? 26 + ((i * 7) % 14) : 34 + ((i * 9) % 16)
    const lightness = light ? 78 + ((i * 3) % 10) : 32 + ((i * 7) % 18)
    return hslToHex(hue, saturation, Math.min(92, lightness))
  })
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) =>
    Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return rgbToHex(f(0), f(8), f(4))
}

/** Expands a comma separated stripe pattern across a colour array. */
export function applyStripePattern(
  current: string[],
  patternStr: string,
  palette: string[],
): string[] {
  const pattern = patternStr
    .split(',')
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0)
  if (pattern.length === 0) return current
  const colors = palette.filter(Boolean)
  if (colors.length === 0) return current

  const out = [...current]
  let step = 0
  let countInStep = 0
  for (let i = 0; i < out.length; i++) {
    out[i] = colors[step % colors.length]
    countInStep++
    if (countInStep >= pattern[step % pattern.length]) {
      countInStep = 0
      step = (step + 1) % pattern.length
    }
  }
  return out
}

/** Tiles the top-left unit across the matrix (repeat tool). */
export function repeatMatrix(
  data: number[][],
  colors: (string | null)[][],
  unitWidth: number,
  unitHeight: number,
): { weave: number[][]; cellColors: (string | null)[][] } {
  const height = data.length
  const width = data[0]?.length ?? 0
  const uW = Math.max(1, unitWidth)
  const uH = Math.max(1, unitHeight)

  const base: number[][] = []
  const baseColors: (string | null)[][] = []
  for (let r = 0; r < uH; r++) {
    const row: number[] = []
    const crow: (string | null)[] = []
    for (let c = 0; c < uW; c++) {
      row.push(data[r]?.[c] === 1 ? 1 : 0)
      crow.push(colors[r]?.[c] ?? null)
    }
    base.push(row)
    baseColors.push(crow)
  }

  const weave = createMatrix(width, height)
  const cellColors = createColorMatrix(width, height)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      weave[r][c] = base[r % uH][c % uW]
      cellColors[r][c] = baseColors[r % uH][c % uW]
    }
  }
  return { weave, cellColors }
}

/* --------------------------------------------------------------- drawing */

export interface DrawWeaveOptions {
  cell?: number
  gap?: number
  showGuides?: boolean
  background?: string
  guideColor?: string
  /** Shaded, yarn-like rendering (defaults to true when cell ≥ 7px). */
  realistic?: boolean
}

export interface WeaveRenderInput {
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors?: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
}

function rgbCss(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Paints the fabric face. Each visible thread is a rounded bar with a
 * highlight down the middle and a shadow at float ends, which reads as real
 * yarn instead of flat pixels.
 */
export function drawWeave(
  ctx: CanvasRenderingContext2D,
  input: WeaveRenderInput,
  options: DrawWeaveOptions = {},
) {
  const { warpEnds, weftPicks, weaveData, cellColors, warpColors, weftColors } = input
  const cell = options.cell ?? 18
  const gap = options.gap ?? 1
  const realistic = options.realistic ?? cell >= 7
  const width = warpEnds * cell
  const height = weftPicks * cell

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = options.background ?? '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // Float lengths drive the subtle shading at the end of long floats.
  const warpRun = createMatrix(warpEnds, weftPicks)
  const weftRun = createMatrix(warpEnds, weftPicks)
  for (let r = 0; r < weftPicks; r++) {
    let run = 0
    for (let c = 0; c < warpEnds; c++) {
      const up = weaveData[r]?.[c] === 1
      run = up ? run + 1 : 0
      warpRun[r][c] = run
    }
    run = 0
    for (let c = warpEnds - 1; c >= 0; c--) {
      const up = weaveData[r]?.[c] === 1
      if (up) warpRun[r][c] = Math.max(warpRun[r][c], run + 1)
      run = up ? run + 1 : 0
    }
  }
  for (let c = 0; c < warpEnds; c++) {
    let run = 0
    for (let r = 0; r < weftPicks; r++) {
      const down = weaveData[r]?.[c] !== 1
      run = down ? run + 1 : 0
      weftRun[r][c] = run
    }
  }

  for (let r = 0; r < weftPicks; r++) {
    // Row 0 is the bottom of the cloth.
    const y = height - (r + 1) * cell
    for (let c = 0; c < warpEnds; c++) {
      const x = c * cell
      const up = weaveData[r]?.[c] === 1
      const override = cellColors?.[r]?.[c] ?? null
      const base = override ?? (up ? warpColors[c] ?? '#CBD5E1' : weftColors[r] ?? '#E2E8F0')

      if (!realistic || cell < 5) {
        ctx.fillStyle = base
        ctx.fillRect(x, y, Math.max(1, cell - gap), Math.max(1, cell - gap))
        continue
      }

      const inset = gap > 0 ? 0.6 : 1
      const w = cell - inset * 2
      const h = cell - inset * 2
      const radius = Math.min(w, h) * (up ? 0.32 : 0.32)

      // shadow under the thread
      ctx.fillStyle = 'rgba(16,24,40,0.10)'
      roundRect(ctx, x + inset, y + inset + 0.8, w, h, radius)
      ctx.fill()

      // body of the yarn
      ctx.fillStyle = base
      roundRect(ctx, x + inset, y + inset, w, h, radius)
      ctx.fill()

      // soft highlight along the thread direction
      const light = shade(base, 0.34)
      ctx.fillStyle = rgbCss(light, 0.55)
      if (up) {
        roundRect(ctx, x + inset + w * 0.28, y + inset + h * 0.12, Math.max(1, w * 0.22), h * 0.76, w * 0.1)
      } else {
        roundRect(ctx, x + inset + w * 0.12, y + inset + h * 0.28, w * 0.76, Math.max(1, h * 0.22), h * 0.1)
      }
      ctx.fill()

      // dense shadow at the float end (crimp)
      const runLength = up ? warpRun[r][c] : weftRun[r][c]
      if (runLength >= 3) {
        ctx.fillStyle = 'rgba(16,24,40,0.10)'
        if (up) ctx.fillRect(x + inset, y + inset + 0.4, w, Math.max(1, h * 0.12))
        else ctx.fillRect(x + inset + 0.4, y + inset, Math.max(1, w * 0.12), h)
      }
    }
  }

  if (options.showGuides) {
    ctx.strokeStyle = options.guideColor ?? 'rgba(22,32,45,0.10)'
    ctx.lineWidth = 1
    for (let c = 0; c <= warpEnds; c++) {
      ctx.beginPath()
      ctx.moveTo(c * cell - 0.5, 0)
      ctx.lineTo(c * cell - 0.5, height)
      ctx.stroke()
    }
    for (let r = 0; r <= weftPicks; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * cell - 0.5)
      ctx.lineTo(width, r * cell - 0.5)
      ctx.stroke()
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** Renders a design to a PNG data URL for storage as a thumbnail. */
export function renderThumbnail(input: WeaveRenderInput, size = 480): string {
  const canvas = document.createElement('canvas')
  const aspect = input.warpEnds / Math.max(1, input.weftPicks)
  const width = aspect >= 1 ? size : Math.round(size * aspect)
  const height = aspect >= 1 ? Math.round(size / aspect) : size
  canvas.width = Math.max(32, width)
  canvas.height = Math.max(32, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const cell = Math.max(
    1,
    Math.floor(Math.min(canvas.width / input.warpEnds, canvas.height / input.weftPicks)),
  )
  drawWeave(ctx, input, { cell, gap: 0, background: '#FFFFFF', realistic: cell >= 6 })
  return canvas.toDataURL('image/png')
}

/** Small live preview used by the structure gallery. */
export function renderStructurePreview(
  structureId: string,
  options: StructureOptions,
  size = 120,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const cells = 16
  const cell = Math.floor(size / cells)
  const res = generateStructure(structureId, cells, cells, options)
  drawWeave(
    ctx,
    {
      warpEnds: cells,
      weftPicks: cells,
      weaveData: res.weave,
      warpColors: Array(cells).fill('#243447'),
      weftColors: Array(cells).fill('#F2ECDD'),
    },
    { cell, gap: 0, background: '#FFFFFF', realistic: true },
  )
  return canvas.toDataURL('image/png')
}

/* ------------------------------------------------------------- double cloth */

export interface DoubleClothParams {
  faceType: WeaveType
  backType: WeaveType
  facePattern?: string
  backPattern?: string
  faceDirection?: 'Z' | 'S'
  backDirection?: 'Z' | 'S'
  faceRatio: number
  backRatio: number
  stitching: boolean
}

export function generateDoubleClothWeave(
  width: number,
  height: number,
  params: DoubleClothParams,
): { weave: number[][]; warpColors: string[]; weftColors: string[] } {
  const fRatio = Math.max(1, params.faceRatio || 1)
  const bRatio = Math.max(1, params.backRatio || 1)
  const repeat = fRatio + bRatio
  const face = twillDraft(2, 2, params.faceDirection ?? 'Z')
  const back = params.backType === 'plain' ? plainDraft() : twillDraft(2, 2, params.backDirection ?? 'S')

  const warpColors: string[] = Array.from({ length: width }, (_, i) =>
    i % repeat < fRatio ? '#D92D20' : '#1D4ED8',
  )
  const weftColors: string[] = Array.from({ length: height }, (_, i) =>
    i % repeat < fRatio ? '#FEE2E2' : '#DBEAFE',
  )

  const weave = createMatrix(width, height)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const faceEnd = c % repeat < fRatio
      const facePick = r % repeat < fRatio
      if (faceEnd && facePick) {
        weave[r][c] = draftCell(face, r, c)
      } else if (!faceEnd && !facePick) {
        weave[r][c] = draftCell(back, r, c)
      } else if (faceEnd && !facePick) {
        weave[r][c] = 1
      } else {
        weave[r][c] = 0
        if (params.stitching && r % Math.max(4, repeat * 2) === 0 && c % 4 === 1) {
          weave[r][c] = 1
        }
      }
    }
  }

  return { weave, warpColors, weftColors }
}

/* ------------------------------------------------- colour & weave effects */

export type ColorAndWeaveEffect =
  | 'houndstooth'
  | 'hairline'
  | 'step'
  | 'glenPlaid'
  | 'pincheck'
  | 'birdseye'
  | 'algorithmic'

export function applyColorAndWeaveEffect(
  width: number,
  height: number,
  effect: ColorAndWeaveEffect,
  c1 = '#F5F2E9',
  c2 = '#16202D',
): { weave: number[][]; warpColors: string[]; weftColors: string[] } {
  const twill = twillDraft(2, 2, 'Z')
  const plain = plainDraft()
  const base = (r: number, c: number) => draftCell(twill, r, c)
  const plainCell = (r: number, c: number) => draftCell(plain, r, c)

  const weave = createMatrix(width, height)
  const warpColors = Array<string>(width).fill(c1)
  const weftColors = Array<string>(height).fill(c1)

  if (effect === 'houndstooth') {
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) weave[r][c] = base(r, c)
    for (let i = 0; i < width; i++) warpColors[i] = Math.floor(i / 4) % 2 === 0 ? c1 : c2
    for (let i = 0; i < height; i++) weftColors[i] = Math.floor(i / 4) % 2 === 0 ? c1 : c2
  } else if (effect === 'hairline') {
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) weave[r][c] = plainCell(r, c)
    for (let i = 0; i < width; i++) warpColors[i] = i % 2 === 0 ? c1 : c2
    for (let i = 0; i < height; i++) weftColors[i] = i % 2 === 0 ? c2 : c1
  } else if (effect === 'step') {
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) weave[r][c] = plainCell(r, c)
    for (let i = 0; i < width; i++) warpColors[i] = i % 4 < 2 ? c1 : c2
    for (let i = 0; i < height; i++) weftColors[i] = i % 4 < 2 ? c2 : c1
  } else if (effect === 'glenPlaid') {
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) weave[r][c] = base(r, c)
    const block = [1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]
    for (let i = 0; i < width; i++) warpColors[i] = block[i % block.length] ? c1 : c2
    for (let i = 0; i < height; i++) weftColors[i] = block[(i + 8) % block.length] ? c1 : c2
  } else if (effect === 'pincheck') {
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) weave[r][c] = plainCell(r, c)
    for (let i = 0; i < width; i++) warpColors[i] = i % 3 === 0 ? c2 : c1
    for (let i = 0; i < height; i++) weftColors[i] = i % 3 === 0 ? c2 : c1
  } else if (effect === 'birdseye') {
    const n = 6
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const mr = r % (n * 2)
        const mc = c % (n * 2)
        const pr = mr < n ? mr : n * 2 - 1 - mr
        const pc = mc < n ? mc : n * 2 - 1 - mc
        weave[r][c] = Math.abs(pr - pc) <= 1 ? 1 : 0
      }
    }
    for (let i = 0; i < width; i++) warpColors[i] = i % 2 === 0 ? c1 : c2
    for (let i = 0; i < height; i++) weftColors[i] = i % 2 === 0 ? c2 : c1
  } else {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const wave = Math.sin((r * Math.PI) / 7) + Math.cos((c * Math.PI) / 7)
        weave[r][c] = wave > 0.15 ? 1 : 0
      }
    }
    const palW = buildColorway(210, width, true)
    const palF = buildColorway(30, height, false)
    for (let i = 0; i < width; i++) warpColors[i] = palW[i]
    for (let i = 0; i < height; i++) weftColors[i] = palF[i]
  }

  return { weave, warpColors, weftColors }
}

/* ---------------------------------------------------- generative structures */

export type GenerativeStyle = 'symmetric' | 'diamond' | 'tartan' | 'modern' | 'optical'

export function generateGenerativeWeave(
  width: number,
  height: number,
  style: GenerativeStyle,
  seed = Math.floor(Math.random() * 1_000_000),
): { weave: number[][]; warpColors: string[]; weftColors: string[] } {
  const weave = createMatrix(width, height)
  const hue = seed % 360
  const warpColors = buildColorway(hue, width, true)
  const weftColors = buildColorway((hue + 180) % 360, height, false)

  if (style === 'symmetric') {
    const midX = Math.floor(width / 2)
    const midY = Math.floor(height / 2)
    for (let r = 0; r <= midY; r++) {
      for (let c = 0; c <= midX; c++) {
        const v = (r * 7 + c * 13 + seed) % 5 < 2 ? 1 : 0
        weave[r][c] = v
        weave[r][width - 1 - c] = v
        weave[height - 1 - r][c] = v
        weave[height - 1 - r][width - 1 - c] = v
      }
    }
  } else if (style === 'diamond') {
    const period = Math.max(4, Math.min(12, Math.floor(width / 3)))
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const dr = r % (period * 2)
        const dc = c % (period * 2)
        const pr = dr < period ? dr : period * 2 - 1 - dr
        const pc = dc < period ? dc : period * 2 - 1 - dc
        weave[r][c] = pr + pc >= period - 1 ? 1 : 0
      }
    }
  } else if (style === 'tartan') {
    const twill = twillDraft(2, 2, 'Z')
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) weave[r][c] = draftCell(twill, r, c)
    const a = hslToHex(hue, 52, 28)
    const b = hslToHex((hue + 40) % 360, 58, 46)
    const accent = hslToHex((hue + 180) % 360, 60, 62)
    for (let i = 0; i < width; i++) {
      const m = i % 16
      warpColors[i] = m < 6 ? a : m < 12 ? b : accent
    }
    for (let i = 0; i < height; i++) {
      const m = (i + 8) % 16
      weftColors[i] = m < 6 ? a : m < 12 ? b : accent
    }
  } else if (style === 'optical') {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const wave = Math.sin(((r + seed % 7) * Math.PI) / 6) * Math.cos((c * Math.PI) / 6)
        weave[r][c] = wave > 0 ? 1 : 0
      }
    }
  } else {
    const twill = twillDraft(3, 1, 'Z')
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const t = draftCell(twill, r, c)
        const p = (r + c) % 2 === 0 ? 1 : 0
        weave[r][c] = (r + c) % 4 < 2 ? t : p
      }
    }
  }

  return { weave, warpColors, weftColors }
}
