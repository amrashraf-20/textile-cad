/**
 * Industrial Loom Drafting & Feasibility Engine.
 *
 * Implements standard textile engineering algorithms for dobby & jacquard looms:
 * - Straight / Reduced Draft factorization (unique warp interlacing columns)
 * - Peg Plan / Lifting Plan generation
 * - Dobby capacity check (alert when shafts > 24 -> Jacquard required)
 * - Float flaw analysis (completely unbound threads, long floats > 6)
 * - Reed denting and calculation (ends per dent, reed width)
 */

export interface FloatFlaw {
  type: 'floating_warp' | 'floating_weft' | 'long_warp_float' | 'long_weft_float'
  index: number // 1-based index
  length: number
}

export interface ReedCalc {
  reedCount: number // dents per cm (e.g. 10 dents/cm = 25 dents/inch)
  endsPerDent: number // e.g. 2 for plain, 3 for mock leno, 4 for double cloth
  fabricWidthCm: number
  totalEnds: number
  reedWidthCm: number
}

export interface LoomAnalysis {
  numShafts: number
  isJacquardRequired: boolean
  draftAssignments: number[] // shaft index (0-based) for each warp end
  pegPlan: number[][] // [pick][shaft] (1 = lifted, 0 = lowered)
  uniqueCols: number[][] // [shaft][pick]
  faceShaftsCount: number
  backShaftsCount: number
  flaws: FloatFlaw[]
  floatingWarp: number[]
  floatingWeft: number[]
  longFloatWarp: { end: number; run: number }[]
  longFloatWeft: { pick: number; run: number }[]
  reed: ReedCalc
}

const MAX_STANDARD_SHAFTS = 24
const MAX_ALLOWED_FLOAT = 6

/**
 * Analyzes any weave matrix for industrial loom execution.
 */
export function analyzeLoomFeasibility(
  weaveData: number[][],
  warpEnds: number,
  weftPicks: number,
  options?: {
    isDoubleMode?: boolean
    faceRatio?: number
    backRatio?: number
    reedCount?: number
    fabricWidthCm?: number
  },
): LoomAnalysis {
  const isDouble = Boolean(options?.isDoubleMode)
  const fRatio = Math.max(1, options?.faceRatio ?? 1)
  const bRatio = Math.max(1, options?.backRatio ?? 1)
  const repeat = isDouble ? fRatio + bRatio : 1

  // Extract columns (each warp end's interlacing sequence from pick 0 to weftPicks-1)
  const columns: { data: number[]; isFace: boolean; originalIndex: number }[] = []
  for (let c = 0; c < warpEnds; c++) {
    const col: number[] = []
    for (let r = 0; r < weftPicks; r++) {
      col.push(weaveData[r]?.[c] === 1 ? 1 : 0)
    }
    columns.push({
      data: col,
      isFace: isDouble ? c % repeat < fRatio : true,
      originalIndex: c,
    })
  }

  const uniqueFaceCols: number[][] = []
  const uniqueBackCols: number[][] = []
  const draftAssignments: number[] = new Array(warpEnds).fill(0)

  if (isDouble) {
    // Face warp shafts
    for (const cObj of columns) {
      if (cObj.isFace) {
        const colStr = cObj.data.join(',')
        let idx = uniqueFaceCols.findIndex((u) => u.join(',') === colStr)
        if (idx === -1) {
          uniqueFaceCols.push(cObj.data)
          idx = uniqueFaceCols.length - 1
        }
        draftAssignments[cObj.originalIndex] = idx
      }
    }

    const faceShaftsCount = uniqueFaceCols.length

    // Back warp shafts
    for (const cObj of columns) {
      if (!cObj.isFace) {
        const colStr = cObj.data.join(',')
        let idx = uniqueBackCols.findIndex((u) => u.join(',') === colStr)
        if (idx === -1) {
          uniqueBackCols.push(cObj.data)
          idx = uniqueBackCols.length - 1
        }
        draftAssignments[cObj.originalIndex] = faceShaftsCount + idx
      }
    }
  } else {
    // Single cloth
    for (const cObj of columns) {
      const colStr = cObj.data.join(',')
      let idx = uniqueFaceCols.findIndex((u) => u.join(',') === colStr)
      if (idx === -1) {
        uniqueFaceCols.push(cObj.data)
        idx = uniqueFaceCols.length - 1
      }
      draftAssignments[cObj.originalIndex] = idx
    }
  }

  const allUniqueCols = isDouble ? uniqueFaceCols.concat(uniqueBackCols) : uniqueFaceCols
  const numShafts = Math.max(1, allUniqueCols.length)

  // Construct Peg Plan / Lifting Plan: [pick r][shaft s]
  // Row 0 is pick 0 (bottom pick), matching textile CAD standards
  const pegPlan: number[][] = []
  for (let r = 0; r < weftPicks; r++) {
    const row: number[] = []
    for (let s = 0; s < numShafts; s++) {
      row.push(allUniqueCols[s]?.[r] === 1 ? 1 : 0)
    }
    pegPlan.push(row)
  }

  // Float flaw analysis
  const floatingWarp: number[] = []
  const floatingWeft: number[] = []
  const longFloatWarp: { end: number; run: number }[] = []
  const longFloatWeft: { pick: number; run: number }[] = []
  const flaws: FloatFlaw[] = []

  // Check Warp floats
  for (let c = 0; c < warpEnds; c++) {
    let lifts = 0
    let currentRun = 1
    let maxRun = 1
    for (let r = 0; r < weftPicks; r++) {
      const val = weaveData[r]?.[c] === 1 ? 1 : 0
      lifts += val
      if (r > 0) {
        const prev = weaveData[r - 1]?.[c] === 1 ? 1 : 0
        if (val === prev) {
          currentRun++
          if (currentRun > maxRun) maxRun = currentRun
        } else {
          currentRun = 1
        }
      }
    }
    if (lifts === 0 || lifts === weftPicks) {
      floatingWarp.push(c + 1)
      flaws.push({ type: 'floating_warp', index: c + 1, length: weftPicks })
    } else if (!isDouble && maxRun > MAX_ALLOWED_FLOAT) {
      longFloatWarp.push({ end: c + 1, run: maxRun })
      flaws.push({ type: 'long_warp_float', index: c + 1, length: maxRun })
    }
  }

  // Check Weft floats
  for (let r = 0; r < weftPicks; r++) {
    let lifts = 0
    let currentRun = 1
    let maxRun = 1
    for (let c = 0; c < warpEnds; c++) {
      const val = weaveData[r]?.[c] === 1 ? 1 : 0
      lifts += val
      if (c > 0) {
        const prev = weaveData[r]?.[c - 1] === 1 ? 1 : 0
        if (val === prev) {
          currentRun++
          if (currentRun > maxRun) maxRun = currentRun
        } else {
          currentRun = 1
        }
      }
    }
    if (lifts === 0 || lifts === warpEnds) {
      floatingWeft.push(r + 1)
      flaws.push({ type: 'floating_weft', index: r + 1, length: warpEnds })
    } else if (!isDouble && maxRun > MAX_ALLOWED_FLOAT) {
      longFloatWeft.push({ pick: r + 1, run: maxRun })
      flaws.push({ type: 'long_weft_float', index: r + 1, length: maxRun })
    }
  }

  // Reed calculation
  const reedCount = Math.max(1, options?.reedCount ?? 12) // dents/cm
  const endsPerDent = isDouble ? 4 : numShafts % 3 === 0 ? 3 : 2
  const fabricWidthCm = Math.max(10, options?.fabricWidthCm ?? 150)
  const totalEnds = Math.round(fabricWidthCm * reedCount * endsPerDent)
  const reedWidthCm = Math.round((totalEnds / (reedCount * endsPerDent)) * 10) / 10

  return {
    numShafts,
    isJacquardRequired: numShafts > MAX_STANDARD_SHAFTS,
    draftAssignments,
    pegPlan,
    uniqueCols: allUniqueCols,
    faceShaftsCount: uniqueFaceCols.length,
    backShaftsCount: uniqueBackCols.length,
    flaws,
    floatingWarp,
    floatingWeft,
    longFloatWarp,
    longFloatWeft,
    reed: {
      reedCount,
      endsPerDent,
      fabricWidthCm,
      totalEnds,
      reedWidthCm,
    },
  }
}
