/**
 * Draft engine — the professional model behind the weave editor.
 *
 * A woven structure is not just a bitmap: it is a *draft* made of
 *   threading  (which shaft each warp end is on)
 *   tie-up     (which shafts each treadle lifts)
 *   treadling  (which treadle is pressed for each pick)
 * and the visible weave is derived from those three. Cell structures
 * (honeycomb, waffle, pile fabrics…) are expressed as a *lift plan*
 * (peg plan), exactly like industrial dobby software.
 *
 * Row 0 is the bottom pick, column 0 is the first warp end.
 */

export type DraftMode = 'tieup' | 'liftplan'

export interface WeaveDraft {
  mode: DraftMode
  shafts: number
  treadles: number
  /** shaft index (0-based) for each warp end of the repeat */
  threading: number[]
  /** treadle index (0-based) for each pick of the repeat */
  treadling: number[]
  /** [shaft][treadle] — 1 when the treadle lifts the shaft */
  tieUp: number[][]
  /** [pick][shaft] — used when mode === 'liftplan' */
  liftPlan: number[][]
  repeatW: number
  repeatH: number
}

export type StructureFamily =
  | 'basic'
  | 'twill'
  | 'satin'
  | 'cell'
  | 'pile'
  | 'compound'
  | 'colour'

export interface StructureParam {
  key: string
  labelEn: string
  labelAr: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  options?: { value: string; labelEn: string; labelAr: string }[]
  default: number | string
}

export interface StructureDef {
  id: string
  family: StructureFamily
  nameEn: string
  nameAr: string
  descEn: string
  descAr: string
  params: StructureParam[]
  /** true when the structure is generated as a peg/lift plan */
  liftplan?: boolean
}

export interface StructureOptions {
  [key: string]: number | string | undefined
}

export interface StructureResult {
  weave: number[][]
  draft: WeaveDraft
  repeatW: number
  repeatH: number
}

/* ------------------------------------------------------------------ utils */

export function createMatrix(width: number, height: number, fill = 0): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(fill))
}

export function createColorMatrix(width: number, height: number): (string | null)[][] {
  return Array.from({ length: height }, () => Array<string | null>(width).fill(null))
}

const mod = (n: number, m: number) => ((n % m) + m) % m

function num(options: StructureOptions, key: string, fallback: number, min: number, max: number) {
  const raw = options[key]
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function str(options: StructureOptions, key: string, fallback: string) {
  const raw = options[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : fallback
}

/* ------------------------------------------------------- draft primitives */

function tieUpDraft(
  shafts: number,
  threading: number[],
  treadling: number[],
  tieUp: number[][],
): WeaveDraft {
  return {
    mode: 'tieup',
    shafts,
    treadles: tieUp[0]?.length ?? shafts,
    threading,
    treadling,
    tieUp,
    liftPlan: [],
    repeatW: threading.length,
    repeatH: treadling.length,
  }
}

function liftPlanDraft(bitmap: number[][]): WeaveDraft {
  const repeatH = bitmap.length
  const repeatW = bitmap[0]?.length ?? 0
  return {
    mode: 'liftplan',
    shafts: repeatW,
    treadles: repeatH,
    threading: Array.from({ length: repeatW }, (_, i) => i),
    treadling: Array.from({ length: repeatH }, (_, i) => i),
    tieUp: [],
    liftPlan: bitmap.map((row) => [...row]),
    repeatW,
    repeatH,
  }
}

/** O(1) evaluation of a single draft cell — use this in tight loops. */
export function draftCell(draft: WeaveDraft, row: number, col: number): number {
  if (draft.mode === 'liftplan' && draft.liftPlan.length > 0) {
    const shaft = draft.threading[mod(col, draft.threading.length)] ?? 0
    return draft.liftPlan[mod(row, draft.liftPlan.length)]?.[shaft] === 1 ? 1 : 0
  }
  const treadle = draft.treadling[mod(row, draft.treadling.length)] ?? 0
  const shaft = draft.threading[mod(col, draft.threading.length)] ?? 0
  return draft.tieUp?.[shaft]?.[treadle] === 1 ? 1 : 0
}

export function draftToMatrix(draft: WeaveDraft, width: number, height: number): number[][] {
  const out = createMatrix(width, height)
  if (draft.mode === 'liftplan' && draft.liftPlan.length > 0) {
    for (let r = 0; r < height; r++) {
      const row = draft.liftPlan[mod(r, draft.liftPlan.length)]
      for (let c = 0; c < width; c++) {
        const shaft = draft.threading[mod(c, draft.threading.length)] ?? 0
        out[r][c] = row?.[shaft] === 1 ? 1 : 0
      }
    }
    return out
  }
  for (let r = 0; r < height; r++) {
    const treadle = draft.treadling[mod(r, draft.treadling.length)] ?? 0
    for (let c = 0; c < width; c++) {
      const shaft = draft.threading[mod(c, draft.threading.length)] ?? 0
      out[r][c] = draft.tieUp?.[shaft]?.[treadle] === 1 ? 1 : 0
    }
  }
  return out
}

/** A plain-weave draft on two shafts — the base of most structures. */
export function plainDraft(): WeaveDraft {
  return tieUpDraft(2, [0, 1], [0, 1], [
    [1, 0],
    [0, 1],
  ])
}

/** Regular twill a/b (a up, b down) on (a+b) shafts. */
export function twillDraft(a: number, b: number, direction: 'Z' | 'S' = 'Z'): WeaveDraft {
  const n = Math.max(2, a + b)
  const up = Math.max(1, Math.min(n - 1, a))
  const threading = Array.from({ length: n }, (_, i) => i)
  const treadling = Array.from({ length: n }, (_, i) => i)
  const tieUp = Array.from({ length: n }, (_, shaft) =>
    Array.from({ length: n }, (_, treadle) => {
      const pos = direction === 'Z' ? mod(shaft - treadle, n) : mod(shaft + treadle, n)
      return pos < up ? 1 : 0
    }),
  )
  return tieUpDraft(n, threading, treadling, tieUp)
}

/** Warp satin (warp-faced) or sateen (weft-faced) on n shafts. */
export function satinDraft(n: number, step: number, faced: 'warp' | 'weft' = 'warp'): WeaveDraft {
  const size = Math.max(3, n)
  const s = validSatinStep(size, step)
  const threading = Array.from({ length: size }, (_, i) => i)
  const treadling = Array.from({ length: size }, (_, i) => i)
  // Sateen: one end lifted per pick. Warp satin: one end down per pick.
  const tieUp = Array.from({ length: size }, (_, shaft) =>
    Array.from({ length: size }, (_, treadle) => {
      const lifted = mod(treadle * s, size) === shaft
      if (faced === 'weft') return lifted ? 1 : 0
      return lifted ? 0 : 1
    }),
  )
  return tieUpDraft(size, threading, treadling, tieUp)
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * A satin step must be coprime with the repeat and must not be 1 or n-1
 * (those collapse into a twill). If the requested step is impossible we pick
 * the valid step closest to half the repeat, which gives the longest float
 * with even distribution.
 */
function validSatinStep(n: number, requested: number): number {
  const s = mod(requested, n)
  if (s > 1 && s < n - 1 && gcd(s, n) === 1) return s
  let best = 0
  let bestDist = Infinity
  for (let candidate = 2; candidate <= n - 2; candidate++) {
    if (gcd(candidate, n) !== 1) continue
    const dist = Math.abs(candidate - n / 2)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best || Math.max(1, n - 1)
}

/* --------------------------------------------------- structure generators */

function generateBasic(id: string, options: StructureOptions): WeaveDraft {
  switch (id) {
    case 'plain':
      return plainDraft()

    case 'basket': {
      const n = num(options, 'size', 2, 2, 6)
      return tieUpDraft(
        2,
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        [
          [1, 0],
          [0, 1],
        ],
      )
    }

    case 'warpRib': {
      // Warp rib produces horizontal ridges; warp threads float over consecutive picks
      const n = num(options, 'size', 2, 2, 6)
      return tieUpDraft(
        2,
        [0, 1],
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        [
          [1, 0],
          [0, 1],
        ],
      )
    }

    case 'weftRib': {
      // Weft rib produces vertical ridges; weft picks float over consecutive ends
      const n = num(options, 'size', 2, 2, 6)
      return tieUpDraft(
        2,
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        [0, 1],
        [
          [1, 0],
          [0, 1],
        ],
      )
    }

    case 'hopsack': {
      const n = num(options, 'size', 3, 2, 6)
      return tieUpDraft(
        2,
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        Array.from({ length: n * 2 }, (_, i) => (i < n ? 0 : 1)),
        [
          [1, 0],
          [0, 1],
        ],
      )
    }

    default:
      return plainDraft()
  }
}

function generateTwill(id: string, options: StructureOptions): WeaveDraft {
  const direction = str(options, 'direction', 'Z') === 'S' ? 'S' : 'Z'

  if (id === 'twill') {
    const a = num(options, 'up', 2, 1, 6)
    const b = num(options, 'down', 2, 1, 6)
    return twillDraft(a, b, direction)
  }

  const base = twillDraft(2, 2, direction)
  const n = base.shafts

  if (id === 'herringbone' || id === 'chevron' || id === 'diamond') {
    // Pointed threading: 0,1,…,n-1,n-2,…,1. Every reversal becomes a V.
    const pointedThreading: number[] = []
    for (let i = 0; i < n; i++) pointedThreading.push(i)
    for (let i = n - 2; i > 0; i--) pointedThreading.push(i)

    if (id === 'diamond') {
      // Diamond needs the point in BOTH directions: pointed threading and
      // pointed treadling close the V's into diamond cells.
      const pointedTreadling: number[] = []
      for (let i = 0; i < n; i++) pointedTreadling.push(i)
      for (let i = n - 2; i > 0; i--) pointedTreadling.push(i)
      return tieUpDraft(n, pointedThreading, pointedTreadling, base.tieUp)
    }

    if (id === 'chevron') {
      // Chevron is the sharp version: the point end is repeated, so the twill
      // reverses with no break (2n ends per repeat).
      const sharp: number[] = []
      for (let i = 0; i < n; i++) sharp.push(i)
      for (let i = n - 1; i >= 0; i--) sharp.push(i)
      return tieUpDraft(n, sharp, base.treadling, base.tieUp)
    }

    // Herringbone: pointed threading with a single break end, straight
    // treadling — the classic broken V with the herringbone spine.
    return tieUpDraft(n, pointedThreading, base.treadling, base.tieUp)
  }

  if (id === 'brokenTwill') {
    // Balanced 4-shaft broken twill (1, 2, 4, 3) - classic denim weave
    const order = [0, 1, 3, 2].slice(0, n)
    return tieUpDraft(n, base.threading, order, base.tieUp)
  }

  if (id === 'steepTwill') {
    // 63.4° steep twill: advances 2 picks per end on 2/2 twill base
    const threading = [0, 1, 2, 3]
    const treadling = [0, 1, 2, 3]
    const tieUp = Array.from({ length: 4 }, (_, s) =>
      Array.from({ length: 4 }, (_, t) => {
        const pos = direction === 'Z' ? mod(s * 2 - t, 4) : mod(s * 2 + t, 4)
        return pos < 2 ? 1 : 0
      }),
    )
    return tieUpDraft(4, threading, treadling, tieUp)
  }

  if (id === 'recliningTwill') {
    // 26.6° reclining twill: advances 1 pick per 2 ends
    const threading = [0, 1, 2, 3]
    const treadling = [0, 1, 2, 3]
    const tieUp = Array.from({ length: 4 }, (_, s) =>
      Array.from({ length: 4 }, (_, t) => {
        const pos = direction === 'Z' ? mod(s - t * 2, 4) : mod(s + t * 2, 4)
        return pos < 2 ? 1 : 0
      }),
    )
    return tieUpDraft(4, threading, treadling, tieUp)
  }

  if (id === 'curvedTwill') {
    // Sinusoidal wavy twill
    const size = num(options, 'size', 8, 6, 16)
    const out = createMatrix(size, size)
    for (let r = 0; r < size; r++) {
      const shift = Math.round(Math.sin((r / size) * Math.PI * 2) * (size / 3))
      for (let c = 0; c < size; c++) {
        const pos = mod(c + shift - r, size)
        out[r][c] = pos < size / 2 ? 1 : 0
      }
    }
    return liftPlanDraft(out)
  }

  return base
}

function generateSatin(id: string, options: StructureOptions): WeaveDraft {
  const faced = id === 'sateen' ? 'weft' : 'warp'
  const n = num(options, 'size', 5, 3, 16)
  const auto = validSatinStep(n, Math.round(n / 2))
  const step = num(options, 'step', auto, 1, n - 1)
  return satinDraft(n, step, faced)
}

/** Ordinary Honeycomb: Watson's pointed draft method (zero floating threads). */
function ordinaryHoneycombBitmap(n: number): number[][] {
  const size = Math.max(6, Math.floor(n / 2) * 2)
  const m = Math.floor(size / 2)
  const draft: number[] = []
  for (let c = 0; c <= m; c++) draft.push(c)
  for (let c = m - 1; c >= 1; c--) draft.push(c)

  const lifts: Set<number>[] = []
  for (let r = 0; r < size; r++) {
    const rowLift: number[] = []
    if (r < m) {
      for (let s = 0; s <= r; s++) rowLift.push(s)
    } else {
      for (let s = r - m + 1; s <= m; s++) rowLift.push(s)
    }
    lifts.push(new Set(rowLift))
  }

  const out = createMatrix(size, size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r][c] = lifts[r].has(draft[c]) ? 1 : 0
    }
  }
  return out
}

/** Brighton Honeycomb: 4 cells per repeat (2 large, 2 small) on straight draft. */
function brightonHoneycombBitmap(n: number): number[][] {
  const size = Math.max(8, Math.floor(n / 4) * 4)
  const out = createMatrix(size, size)
  const half = size / 2
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const d1 = Math.abs((c % half) - (r % half))
      const d2 = (c % half) + (r % half)
      const isLargeBlock = (c < half && r < half) || (c >= half && r >= half)
      if (isLargeBlock) {
        out[r][c] = d1 === 0 || d2 === half - 1 ? 1 : 0
      } else {
        out[r][c] = d1 === 1 || d2 === half ? 1 : 0
      }
    }
  }
  return out
}

/** Waffle weave: true symmetrical 3D pocket pyramids on pointed draft. */
function waffleBitmap(n: number): number[][] {
  const size = Math.max(6, Math.floor(n / 2) * 2)
  const m = Math.floor(size / 2)
  const draft: number[] = []
  for (let c = 0; c <= m; c++) draft.push(c)
  for (let c = m - 1; c >= 1; c--) draft.push(c)

  const out = createMatrix(size, size)
  for (let r = 0; r < size; r++) {
    const peak = r < m ? r : size - 1 - r
    for (let c = 0; c < size; c++) {
      const shaft = draft[c]
      out[r][c] = shaft <= peak + 1 ? 1 : 0
    }
  }
  return out
}

/** Huckaback toweling: authentic Watson 4-quadrant layout with plain ground + float motifs. */
function huckBitmap(n: number): number[][] {
  const size = n <= 6 ? 6 : 10
  const half = size / 2
  const out = createMatrix(size, size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isQuadrantA = (r < half && c < half) || (r >= half && c >= half)
      if (isQuadrantA) {
        out[r][c] = (r + c) % 2 === 0 ? 1 : 0
      } else {
        const lr = r % half
        const lc = c % half
        out[r][c] = lr === 1 || lr === half - 2 || lc === 1 || lc === half - 2 ? 1 : 0
      }
    }
  }
  return out
}

/** Mock Leno: textbook open-work mesh based on grouped threads and denting gaps. */
function mockLenoBitmap(n: number): number[][] {
  const size = Math.max(6, Math.floor(n / 2) * 2)
  const half = size / 2
  const out = createMatrix(size, size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const block = (r < half && c < half) || (r >= half && c >= half)
      out[r][c] = block ? ((r + c) % 2 === 0 ? 1 : 0) : ((r + c) % 2 === 1 ? 1 : 0)
    }
  }
  return out
}

/** Crepe: industrial satin-base pebble crepe with zero twill stripes and max float of 2. */
function crepeBitmap(n: number): number[][] {
  const size = Math.max(6, Math.min(16, n))
  const step = validSatinStep(size, 3)
  const out = createMatrix(size, size)
  for (let r = 0; r < size; r++) {
    const c = (r * step) % size
    out[r][c] = 1
    out[r][(c + 1) % size] = 1
    out[(r + 1) % size][c] = 1
  }
  return out
}

function bedfordBitmap(n: number): number[][] {
  const out = createMatrix(n, n)
  const cord = Math.max(2, Math.floor(n / 2))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inCord = mod(c, cord) < cord - 1
      const binding = mod(r, n) === n - 1
      out[r][c] = inCord ? (binding ? 0 : 1) : (mod(r + c, 2) === 0 ? 1 : 0)
    }
  }
  return out
}

function terryBitmap(n: number): number[][] {
  const out = createMatrix(n, n)
  for (let r = 0; r < n; r++) {
    const phase = mod(r, 3)
    for (let c = 0; c < n; c++) {
      out[r][c] = phase === 2 ? 1 : mod(r + c, 2) === 0 ? 1 : 0
    }
  }
  return out
}

function corduroyBitmap(n: number): number[][] {
  const out = createMatrix(n, n)
  const cord = Math.max(2, Math.floor(n / 3))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cut = mod(c, cord) === 0
      out[r][c] = cut ? (mod(r, 2) === 0 ? 1 : 0) : 1
    }
  }
  return out
}

function velvetBitmap(n: number): number[][] {
  const out = createMatrix(n, n)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[r][c] = mod(r, 4) === 3 ? (mod(c, 2) === 0 ? 1 : 0) : 1
    }
  }
  return out
}

function generateCell(id: string, options: StructureOptions): WeaveDraft {
  switch (id) {
    case 'honeycomb': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(ordinaryHoneycombBitmap(n))
    }
    case 'brightonHoneycomb': {
      const n = num(options, 'size', 8, 8, 16)
      return liftPlanDraft(brightonHoneycombBitmap(n))
    }
    case 'waffle': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(waffleBitmap(n))
    }
    case 'huckaback': {
      const n = num(options, 'size', 10, 6, 10)
      return liftPlanDraft(huckBitmap(n))
    }
    case 'mockLeno': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(mockLenoBitmap(n))
    }
    case 'crepe': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(crepeBitmap(n))
    }
    case 'bedfordCord': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(bedfordBitmap(n))
    }
    case 'terry': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(terryBitmap(n))
    }
    case 'corduroy': {
      const n = num(options, 'size', 9, 6, 15)
      return liftPlanDraft(corduroyBitmap(n))
    }
    case 'velvet': {
      const n = num(options, 'size', 8, 6, 16)
      return liftPlanDraft(velvetBitmap(n))
    }
    default:
      return liftPlanDraft(ordinaryHoneycombBitmap(8))
  }
}

/* -------------------------------------------------------- compound cloths */

export interface CompoundOptions extends StructureOptions {
  face?: string
  back?: string
  faceRatio?: number | string
  backRatio?: number | string
  stitching?: number | string
}

/**
 * Double cloth: face and back layers interchanged on a colour-and-weave
 * block plan. Face warp lifts over back weft, back warp stays down under
 * face weft; stitching points bind the layers.
 */
export function generateCompoundWeave(
  width: number,
  height: number,
  layers: number,
  options: CompoundOptions = {},
): { weave: number[][] } {
  const ratio = Math.max(1, Math.min(3, Number(options.faceRatio ?? 1) || 1))
  const block = Math.max(4, ratio * 4)
  const weave = createMatrix(width, height)
  const face = twillDraft(2, 2, 'Z')
  const back = plainDraft()
  const stitch = options.stitching === undefined || options.stitching === '1' || options.stitching === 1

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const faceBlock = Math.floor(c / block) % 2 === 0
      const facePick = Math.floor(r / block) % 2 === 0
      const f = draftToMatrix(face, 1, 1)[0][0]
      void f
      if (layers >= 2) {
        if (faceBlock && facePick) {
          weave[r][c] = face.tieUp[mod(c, face.shafts)]?.[mod(r, face.treadles)] ?? 0
        } else if (!faceBlock && !facePick) {
          weave[r][c] = back.tieUp[mod(c, back.shafts)]?.[mod(r, back.treadles)] ?? 0
        } else if (faceBlock && !facePick) {
          weave[r][c] = 1
        } else {
          weave[r][c] = 0
        }
        if (stitch && mod(r, block) === 0 && mod(c, block) === Math.floor(block / 2)) {
          weave[r][c] = 1
        }
      } else {
        weave[r][c] = face.tieUp[mod(c, face.shafts)]?.[mod(r, face.treadles)] ?? 0
      }
    }
  }
  return { weave }
}

/* --------------------------------------------------------------- catalog */

const dirParam: StructureParam = {
  key: 'direction',
  labelEn: 'Direction',
  labelAr: 'الاتجاه',
  type: 'select',
  options: [
    { value: 'Z', labelEn: 'Z (right)', labelAr: 'Z (يمين)' },
    { value: 'S', labelEn: 'S (left)', labelAr: 'S (يسار)' },
  ],
  default: 'Z',
}

const sizeParam = (min: number, max: number, def: number): StructureParam => ({
  key: 'size',
  labelEn: 'Repeat size',
  labelAr: 'حجم التكرار',
  type: 'number',
  min,
  max,
  default: def,
})

export const STRUCTURES: StructureDef[] = [
  {
    id: 'plain',
    family: 'basic',
    nameEn: 'Plain (1/1)',
    nameAr: 'سادة (1/1)',
    descEn: 'The strongest, simplest interlacing — one up, one down.',
    descAr: 'أبسط وأقوى تركيب — خيط سداء لأعلى وخيط لحمة لأعلى بالتبادل.',
    params: [],
  },
  {
    id: 'basket',
    family: 'basic',
    nameEn: 'Basket / Hopsack',
    nameAr: 'سلة / هوبساك',
    descEn: 'Two or more ends and picks interlace as one — a soft, chunky cloth.',
    descAr: 'خيطان أو أكثر ينسجان كوحدة واحدة — قماش ناعم وسميك.',
    params: [sizeParam(2, 6, 2)],
  },
  {
    id: 'warpRib',
    family: 'basic',
    nameEn: 'Warp rib',
    nameAr: 'تضليع سداء',
    descEn: 'Vertical ribs formed by grouped warp ends.',
    descAr: 'أضلاع رأسية ناتجة عن تجميع خيوط السداء.',
    params: [sizeParam(2, 6, 2)],
  },
  {
    id: 'weftRib',
    family: 'basic',
    nameEn: 'Weft rib',
    nameAr: 'تضليع لحمة',
    descEn: 'Horizontal ribs formed by grouped weft picks.',
    descAr: 'أضلاع أفقية ناتجة عن تجميع خيوط اللحمة.',
    params: [sizeParam(2, 6, 2)],
  },
  {
    id: 'twill',
    family: 'twill',
    nameEn: 'Twill',
    nameAr: 'مبرد',
    descEn: 'Diagonal lines created by a stepped lift plan (2/2, 3/1, 1/3…).',
    descAr: 'خطوط مائلة ناتجة عن خطة رفع متدرجة (2/2، 3/1، 1/3…).',
    params: [
      { key: 'up', labelEn: 'Up ends', labelAr: 'خيوط لأعلى', type: 'number', min: 1, max: 6, default: 2 },
      { key: 'down', labelEn: 'Down ends', labelAr: 'خيوط لأسفل', type: 'number', min: 1, max: 6, default: 2 },
      dirParam,
    ],
  },
  {
    id: 'herringbone',
    family: 'twill',
    nameEn: 'Herringbone',
    nameAr: 'عظم السمكة',
    descEn: 'Twill that reverses direction, forming a broken V pattern.',
    descAr: 'مبرد يعكس اتجاهه ليكوّن نمط V متقطع.',
    params: [dirParam],
  },
  {
    id: 'chevron',
    family: 'twill',
    nameEn: 'Chevron',
    nameAr: 'شيفرون',
    descEn: 'Pointed twill with clean zig-zag lines.',
    descAr: 'مبرد مدبب بخطوط متعرجة حادة.',
    params: [dirParam],
  },
  {
    id: 'diamond',
    family: 'twill',
    nameEn: 'Diamond twill',
    nameAr: 'مبرد معيني',
    descEn: 'Pointed threading and treadling produce diamond cells.',
    descAr: 'تسنين السداء واللحمة ينتج خلايا معينية.',
    params: [dirParam],
  },
  {
    id: 'brokenTwill',
    family: 'twill',
    nameEn: 'Broken twill',
    nameAr: 'مبرد مكسور',
    descEn: 'Twill with a broken step — a denim staple.',
    descAr: 'مبرد بخطوة مكسورة — أساس الدنيم.',
    params: [dirParam],
  },
  {
    id: 'steepTwill',
    family: 'twill',
    nameEn: 'Steep twill (63°)',
    nameAr: 'مبرد حاد (63°)',
    descEn: 'Steep 63-degree twill advancing two picks per end.',
    descAr: 'مبرد حاد بزاوية 63 درجة يتقدم حدفتين لكل خيط سداء.',
    params: [dirParam],
  },
  {
    id: 'recliningTwill',
    family: 'twill',
    nameEn: 'Reclining twill (27°)',
    nameAr: 'مبرد منبطح (27°)',
    descEn: 'Shallow 27-degree twill advancing one pick per two ends.',
    descAr: 'مبرد منبطح بزاوية 27 درجة يتقدم حدفة واحدة لكل خيطي سداء.',
    params: [dirParam],
  },
  {
    id: 'curvedTwill',
    family: 'twill',
    nameEn: 'Curved / Waved twill',
    nameAr: 'مبرد موجي',
    descEn: 'Sinusoidal undulating diagonal waves.',
    descAr: 'خطوط مائلة متعرجة وموجية بشكل جيبي متناغم.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'satin',
    family: 'satin',
    nameEn: 'Warp satin',
    nameAr: 'أطلس سداء',
    descEn: 'Long warp floats give a lustrous, smooth face.',
    descAr: 'طفوات سداء طويلة تعطي سطحاً لامعاً وناعماً.',
    params: [
      { key: 'size', labelEn: 'Repeat', labelAr: 'التكرار', type: 'number', min: 5, max: 16, default: 5 },
      { key: 'step', labelEn: 'Step', labelAr: 'الخطوة', type: 'number', min: 1, max: 15, default: 2 },
    ],
  },
  {
    id: 'sateen',
    family: 'satin',
    nameEn: 'Sateen',
    nameAr: 'ساتان',
    descEn: 'Weft-faced satin — soft hand, high sheen.',
    descAr: 'أطلس مواجه للحمة — ملمس ناعم ولمعان عالٍ.',
    params: [
      { key: 'size', labelEn: 'Repeat', labelAr: 'التكرار', type: 'number', min: 5, max: 16, default: 5 },
      { key: 'step', labelEn: 'Step', labelAr: 'الخطوة', type: 'number', min: 1, max: 15, default: 2 },
    ],
  },
  {
    id: 'honeycomb',
    family: 'cell',
    nameEn: 'Ordinary Honeycomb',
    nameAr: 'قرص العسل عادي',
    descEn: 'Cell structure with symmetrical diamond ridges and recessed centres.',
    descAr: 'تركيب خلايا بحلقات معينية متناظرة ومراكز غائرة بدون تطفيل زائد.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'brightonHoneycomb',
    family: 'cell',
    nameEn: 'Brighton Honeycomb',
    nameAr: 'قرص العسل برايتون',
    descEn: 'Four prominent textured cells per repeat (two large, two small).',
    descAr: 'أربع خلايا بارزة لكل تكرار (خليتان كبيرتان وخليتان صغيرتان).',
    params: [sizeParam(8, 16, 8)],
  },
  {
    id: 'waffle',
    family: 'cell',
    nameEn: 'Waffle',
    nameAr: 'وافل',
    descEn: 'Graduated floats create a deep, absorbent grid.',
    descAr: 'طفوات متدرجة تصنع شبكة عميقة عالية الامتصاص.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'huckaback',
    family: 'cell',
    nameEn: 'Huckaback',
    nameAr: 'هاكاباك',
    descEn: 'Small blocks with floats — classic towel weave.',
    descAr: 'مربعات صغيرة بطفوات — تركيب المناشف الكلاسيكي.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'mockLeno',
    family: 'cell',
    nameEn: 'Mock leno',
    nameAr: 'شاش كاذب',
    descEn: 'Open, airy cells that imitate leno without doup ends.',
    descAr: 'خلايا مفتوحة تحاكي الشاش بدون خيوط مزدوجة.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'crepe',
    family: 'cell',
    nameEn: 'Crepe',
    nameAr: 'كريب',
    descEn: 'Granular, random interlacing with a pebbled surface.',
    descAr: 'تشابك حبيبي عشوائي بسطح محبب.',
    params: [sizeParam(4, 16, 8)],
  },
  {
    id: 'bedfordCord',
    family: 'cell',
    nameEn: 'Bedford cord',
    nameAr: 'كورد بيدفورد',
    descEn: 'Raised vertical cords with a hidden binding end.',
    descAr: 'حبال رأسية بارزة مع خيط ربط مخفي.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'terry',
    family: 'pile',
    nameEn: 'Terry',
    nameAr: 'تيري',
    descEn: 'Three-pick terry: two ground picks and one pile pick.',
    descAr: 'تيري ثلاث لحامات: لحمتان أرضيتان ولحمة وبرة.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'corduroy',
    family: 'pile',
    nameEn: 'Corduroy',
    nameAr: 'كوردوروي',
    descEn: 'Warp pile cords separated by a cutting end.',
    descAr: 'حبال وبرة سداء تفصلها خيوط قطع.',
    params: [sizeParam(6, 15, 9)],
  },
  {
    id: 'velvet',
    family: 'pile',
    nameEn: 'Velvet',
    nameAr: 'قطيفة',
    descEn: 'Dense warp pile on a fine ground cloth.',
    descAr: 'وبرة سداء كثيفة على أرضية رقيقة.',
    params: [sizeParam(6, 16, 8)],
  },
  {
    id: 'doubleCloth',
    family: 'compound',
    nameEn: 'Double cloth',
    nameAr: 'نسيج مزدوج',
    descEn: 'Two independent layers bound together at stitching points.',
    descAr: 'طبقتان مستقلتان تُربطان عند نقاط الخياطة.',
    params: [
      { key: 'faceRatio', labelEn: 'Face ratio', labelAr: 'نسبة الوجه', type: 'number', min: 1, max: 3, default: 1 },
      { key: 'stitching', labelEn: 'Stitching (1/0)', labelAr: 'خياطة (1/0)', type: 'number', min: 0, max: 1, default: 1 },
    ],
  },
  {
    id: 'tripleCloth',
    family: 'compound',
    nameEn: 'Triple cloth',
    nameAr: 'نسيج ثلاثي',
    descEn: 'Three layers for heavy coatings and blankets.',
    descAr: 'ثلاث طبقات للأقمشة الثقيلة والبطانيات.',
    params: [
      { key: 'faceRatio', labelEn: 'Face ratio', labelAr: 'نسبة الوجه', type: 'number', min: 1, max: 3, default: 2 },
      { key: 'stitching', labelEn: 'Stitching (1/0)', labelAr: 'خياطة (1/0)', type: 'number', min: 0, max: 1, default: 1 },
    ],
  },
]

export const STRUCTURE_FAMILIES: { id: StructureFamily; nameEn: string; nameAr: string }[] = [
  { id: 'basic', nameEn: 'Basic', nameAr: 'أساسية' },
  { id: 'twill', nameEn: 'Twill family', nameAr: 'عائلة المبرد' },
  { id: 'satin', nameEn: 'Satin / Sateen', nameAr: 'أطلس / ساتان' },
  { id: 'cell', nameEn: 'Cell structures', nameAr: 'تراكيب خلوية' },
  { id: 'pile', nameEn: 'Pile fabrics', nameAr: 'أقمشة وبرية' },
  { id: 'compound', nameEn: 'Compound cloths', nameAr: 'أقمشة مركبة' },
]

export function structureById(id: string): StructureDef | undefined {
  return STRUCTURES.find((s) => s.id === id)
}

export function defaultOptions(def: StructureDef): StructureOptions {
  const out: StructureOptions = {}
  for (const p of def.params) out[p.key] = p.default
  return out
}

/** Builds a draft + bitmap for a catalog structure at the requested size. */
export function generateStructure(
  id: string,
  width: number,
  height: number,
  options: StructureOptions = {},
): StructureResult {
  const def = structureById(id)
  let draft: WeaveDraft

  if (def?.family === 'compound') {
    const weave = generateCompoundWeave(width, height, id === 'tripleCloth' ? 3 : 2, options).weave
    // expose a simple peg plan so the draft view still works
    const rep = Math.min(16, Math.max(4, Number(options.faceRatio ?? 1) * 4))
    const bitmap = createMatrix(rep, rep)
    for (let r = 0; r < rep; r++) for (let c = 0; c < rep; c++) bitmap[r][c] = weave[r]?.[c] ?? 0
    draft = liftPlanDraft(bitmap)
    return { weave, draft, repeatW: rep, repeatH: rep }
  }

  if (def?.family === 'twill') draft = generateTwill(id, options)
  else if (def?.family === 'satin') draft = generateSatin(id, options)
  else if (def?.family === 'cell' || def?.family === 'pile') draft = generateCell(id, options)
  else draft = generateBasic(id, options)

  const weave = draftToMatrix(draft, width, height)
  return { weave, draft, repeatW: draft.repeatW, repeatH: draft.repeatH }
}

/** Legacy quick-generator used by the inspector panel. */
export function generateWeave(
  width: number,
  height: number,
  params: {
    type: 'plain' | 'rib' | 'twill' | 'satin' | 'mockLeno' | 'honeycomb' | 'crepe'
    pattern?: string
    direction?: 'Z' | 'S'
    satinSize?: number
    size?: number
    warpPattern?: string
    weftPattern?: string
  },
): number[][] {
  switch (params.type) {
    case 'plain':
      return generateStructure('plain', width, height).weave
    case 'rib':
      return generateStructure('warpRib', width, height, {
        size: Number(params.warpPattern?.split('/')[0] ?? 2) || 2,
      }).weave
    case 'twill': {
      const [a, b] = (params.pattern ?? '2/2')
        .split(/[/,-]/)
        .map((n) => Number.parseInt(n, 10))
        .filter((n) => Number.isFinite(n))
      return generateStructure('twill', width, height, {
        up: a ?? 2,
        down: b ?? 2,
        direction: params.direction ?? 'Z',
      }).weave
    }
    case 'satin':
      return generateStructure('satin', width, height, { size: params.satinSize ?? 5 }).weave
    case 'mockLeno':
      return generateStructure('mockLeno', width, height, { size: params.size ?? 8 }).weave
    case 'honeycomb':
      return generateStructure('honeycomb', width, height, { size: params.size ?? 8 }).weave
    case 'crepe':
      return generateStructure('crepe', width, height, { size: params.size ?? 8 }).weave
    default:
      return createMatrix(width, height)
  }
}

/* --------------------------------------------------------------- palettes */

export const GENERATOR_PALETTES: Record<string, { warp: string; weft: string }> = {
  plain: { warp: '#2B3A4A', weft: '#F3EFE6' },
  twill: { warp: '#1F3A5F', weft: '#E8E2D6' },
  satin: { warp: '#3E2C4F', weft: '#EFE7DA' },
  rib: { warp: '#6B4E3D', weft: '#F1E8DA' },
  mockLeno: { warp: '#2F5D50', weft: '#EDE6D6' },
  honeycomb: { warp: '#8A5A2B', weft: '#F5EEDF' },
  crepe: { warp: '#4A4A4A', weft: '#EFEAE0' },
}

/** Curated, production-safe colourways (dye-house friendly). */
export const COLORWAYS: { id: string; nameEn: string; nameAr: string; warp: string; weft: string }[] = [
  { id: 'ecru', nameEn: 'Ecru / Natural', nameAr: 'إيكرو / طبيعي', warp: '#D8CBB4', weft: '#F4EFE4' },
  { id: 'indigo', nameEn: 'Indigo / White', nameAr: 'نيلي / أبيض', warp: '#1F3A5F', weft: '#F5F2E9' },
  { id: 'oxblood', nameEn: 'Oxblood / Sand', nameAr: 'أحمر داكن / رملي', warp: '#7A1F27', weft: '#E8DCC8' },
  { id: 'forest', nameEn: 'Forest / Cream', nameAr: 'أخضر غامق / كريمي', warp: '#2C4A3B', weft: '#F0EADC' },
  { id: 'charcoal', nameEn: 'Charcoal / Grey', nameAr: 'فحمي / رمادي', warp: '#33383D', weft: '#CFCBC2' },
  { id: 'terracotta', nameEn: 'Terracotta / Oat', nameAr: 'طيني / شوفان', warp: '#A85438', weft: '#EFE3D2' },
  { id: 'navy', nameEn: 'Navy / Sky', nameAr: 'كحلي / سماوي', warp: '#16202D', weft: '#BFD3E6' },
  { id: 'mustard', nameEn: 'Mustard / Ecru', nameAr: 'خردلي / إيكرو', warp: '#B98A2E', weft: '#F3EDDD' },
]
