/**
 * Realistic Fabric Simulation, Mockup Renderer, Cross-Section, and Jacquard Processor.
 * Pure Canvas 2D engine replicating the original 123.html studio behavior with high performance.
 */

export interface SimulationOptions {
  zoomLevel: number // 2, 4, 8, 12, 16
  yarnMaterial: 'cotton' | 'silk' | 'wool' | 'slub'
  warpTwist: 'Z' | 'S'
  weftTwist: 'Z' | 'S'
  warpDensity?: number
  weftDensity?: number
}

export interface WeaveSpec {
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors?: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
}

/**
 * Draws ultra-realistic 3D woven fabric with cylindrical thread gradients,
 * micro-twist fibers (Z/S twist), slub irregularities, specular sheen, and shadows.
 */
export function drawRealistic3DFabric(
  canvas: HTMLCanvasElement,
  spec: WeaveSpec,
  options: SimulationOptions,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  ctx.clearRect(0, 0, width, height)

  // Dark studio backdrop
  ctx.fillStyle = '#0F172A'
  ctx.fillRect(0, 0, width, height)

  const { warpEnds, weftPicks, weaveData, cellColors, warpColors, weftColors } = spec
  if (warpEnds <= 0 || weftPicks <= 0) return

  const zoom = Math.max(2, Math.min(24, options.zoomLevel || 8))
  const threadWidth = zoom * 1.6
  const pitch = threadWidth + 0.6

  const repeatsX = Math.ceil(width / (warpEnds * pitch)) + 1
  const repeatsY = Math.ceil(height / (weftPicks * pitch)) + 1

  function drawSegment(
    x: number,
    y: number,
    w: number,
    h: number,
    isWarp: boolean,
    baseColor: string,
    twist: 'Z' | 'S',
  ) {
    let actualX = x
    let actualY = y
    let actualW = w
    let actualH = h

    // Slub yarn thickness irregularities
    if (options.yarnMaterial === 'slub') {
      const wave = Math.sin((isWarp ? y * 0.08 + x : x * 0.08 + y)) * 0.22
      if (isWarp) {
        const dW = w * wave
        actualX -= dW / 2
        actualW += dW
      } else {
        const dH = h * wave
        actualY -= dH / 2
        actualH += dH
      }
    }

    // Base fill
    ctx!.fillStyle = baseColor
    ctx!.fillRect(actualX, actualY, actualW, actualH)

    // Cylindrical 3D gradient highlight
    const grad = isWarp
      ? ctx!.createLinearGradient(actualX, actualY, actualX + actualW, actualY)
      : ctx!.createLinearGradient(actualX, actualY, actualX, actualY + actualH)

    if (options.yarnMaterial === 'silk') {
      grad.addColorStop(0, 'rgba(0,0,0,0.65)')
      grad.addColorStop(0.3, 'rgba(255,255,255,0.25)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.85)')
      grad.addColorStop(0.7, 'rgba(255,255,255,0.25)')
      grad.addColorStop(1, 'rgba(0,0,0,0.65)')
    } else if (options.yarnMaterial === 'wool') {
      grad.addColorStop(0, 'rgba(0,0,0,0.55)')
      grad.addColorStop(0.25, 'rgba(255,255,255,0.08)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.22)')
      grad.addColorStop(0.75, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1, 'rgba(0,0,0,0.55)')
    } else {
      // Cotton & standard
      grad.addColorStop(0, 'rgba(0,0,0,0.7)')
      grad.addColorStop(0.2, 'rgba(255,255,255,0.12)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.45)')
      grad.addColorStop(0.8, 'rgba(255,255,255,0.12)')
      grad.addColorStop(1, 'rgba(0,0,0,0.7)')
    }

    ctx!.fillStyle = grad
    ctx!.fillRect(actualX, actualY, actualW, actualH)

    // Micro-fibers Z / S twist lines
    ctx!.lineWidth = zoom > 10 ? 0.9 : 0.5
    ctx!.strokeStyle =
      options.yarnMaterial === 'silk'
        ? 'rgba(0,0,0,0.08)'
        : options.yarnMaterial === 'wool'
          ? 'rgba(255,255,255,0.15)'
          : 'rgba(0,0,0,0.18)'

    ctx!.beginPath()
    const step = Math.max(2, zoom * 0.42)
    if (isWarp) {
      for (let i = -actualW; i < actualH + actualW; i += step) {
        if (twist === 'Z') {
          ctx!.moveTo(actualX, actualY + i)
          ctx!.lineTo(actualX + actualW, actualY + i - actualW * 0.6)
        } else {
          ctx!.moveTo(actualX, actualY + i)
          ctx!.lineTo(actualX + actualW, actualY + i + actualW * 0.6)
        }
      }
    } else {
      for (let i = -actualH; i < actualW + actualH; i += step) {
        if (twist === 'Z') {
          ctx!.moveTo(actualX + i, actualY + actualH)
          ctx!.lineTo(actualX + i + actualH * 0.6, actualY)
        } else {
          ctx!.moveTo(actualX + i, actualY)
          ctx!.lineTo(actualX + i + actualH * 0.6, actualY + actualH)
        }
      }
    }
    ctx!.stroke()
  }

  // Draw 2 passes for depth:
  // Pass 1: Underneath threads with shadow
  // Pass 2: Overlapping top threads
  for (let ry = 0; ry < repeatsY; ry++) {
    for (let rx = 0; rx < repeatsX; rx++) {
      for (let r = 0; r < weftPicks; r++) {
        // Weft row (y)
        const y = height - ((ry * weftPicks + r + 1) * pitch)
        if (y < -pitch || y > height + pitch) continue

        for (let c = 0; c < warpEnds; c++) {
          const x = (rx * warpEnds + c) * pitch
          if (x < -pitch || x > width + pitch) continue

          const warpUp = weaveData[r]?.[c] === 1
          const custom = cellColors?.[r]?.[c]

          const wCol = custom ?? warpColors[c] ?? '#23364C'
          const fCol = custom ?? weftColors[r] ?? '#D92D20'

          if (warpUp) {
            // Weft is under, warp is over
            // Under weft:
            drawSegment(x - 0.5, y, pitch + 1, threadWidth, false, fCol, options.weftTwist)
            // Soft drop shadow under warp
            ctx.fillStyle = 'rgba(0,0,0,0.32)'
            ctx.fillRect(x + threadWidth, y, 1.2, threadWidth)
            // Over warp:
            drawSegment(x, y - 0.5, threadWidth, pitch + 1, true, wCol, options.warpTwist)
          } else {
            // Warp is under, weft is over
            // Under warp:
            drawSegment(x, y - 0.5, threadWidth, pitch + 1, true, wCol, options.warpTwist)
            // Soft drop shadow under weft
            ctx.fillStyle = 'rgba(0,0,0,0.32)'
            ctx.fillRect(x, y + threadWidth, threadWidth, 1.2)
            // Over weft:
            drawSegment(x - 0.5, y, pitch + 1, threadWidth, false, fCol, options.weftTwist)
          }
        }
      }
    }
  }
}

/**
 * Creates an appearance tile pattern of the fabric to apply on mockups.
 */
function createFabricPattern(spec: WeaveSpec, tileSize = 12): HTMLCanvasElement {
  const { warpEnds, weftPicks, weaveData, cellColors, warpColors, weftColors } = spec
  const canvas = document.createElement('canvas')
  canvas.width = warpEnds * tileSize
  canvas.height = weftPicks * tileSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  for (let r = 0; r < weftPicks; r++) {
    const y = canvas.height - (r + 1) * tileSize
    for (let c = 0; c < warpEnds; c++) {
      const x = c * tileSize
      const up = weaveData[r]?.[c] === 1
      const custom = cellColors?.[r]?.[c]
      ctx.fillStyle = custom ?? (up ? warpColors[c] ?? '#23364C' : weftColors[r] ?? '#D92D20')
      ctx.fillRect(x, y, tileSize, tileSize)

      // Micro bevel
      ctx.fillStyle = up ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'
      ctx.fillRect(x, y, tileSize, tileSize / 2)
    }
  }
  return canvas
}

export type MockupType = 'sofa' | 'curtain' | 'cushion' | 'shirt'

/**
 * Renders realistic fabric draping onto 3D scenes (Sofa, Curtains, Cushion, Shirt).
 */
export function renderMockup(
  canvas: HTMLCanvasElement,
  type: MockupType,
  spec: WeaveSpec,
  scale = 1.0,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  ctx.clearRect(0, 0, width, height)

  // Studio background with gentle floor gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
  bgGrad.addColorStop(0, '#F1F5F9')
  bgGrad.addColorStop(0.7, '#E2E8F0')
  bgGrad.addColorStop(1, '#CBD5E1')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  const tile = createFabricPattern(spec, Math.max(4, Math.round(10 * scale)))
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return

  ctx.save()

  if (type === 'sofa') {
    // Ground shadow
    ctx.fillStyle = 'rgba(15,23,42,0.22)'
    ctx.beginPath()
    ctx.ellipse(width * 0.5, height * 0.88, width * 0.42, 22, 0, 0, Math.PI * 2)
    ctx.fill()

    // Backrest
    ctx.fillStyle = pattern
    ctx.beginPath()
    ctx.roundRect(width * 0.16, height * 0.28, width * 0.68, height * 0.32, [24, 24, 0, 0])
    ctx.fill()

    // Backrest shading & vertical tufts
    const backShade = ctx.createLinearGradient(0, height * 0.28, 0, height * 0.6)
    backShade.addColorStop(0, 'rgba(255,255,255,0.25)')
    backShade.addColorStop(0.5, 'rgba(0,0,0,0.0)')
    backShade.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = backShade
    ctx.fill()

    // Vertical seam lines on backrest
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    ctx.lineWidth = 2
    for (let i = 1; i <= 3; i++) {
      const sx = width * 0.16 + (width * 0.68 * i) / 4
      ctx.beginPath()
      ctx.moveTo(sx, height * 0.28)
      ctx.lineTo(sx, height * 0.6)
      ctx.stroke()
    }

    // Seat cushions
    ctx.fillStyle = pattern
    ctx.beginPath()
    ctx.roundRect(width * 0.14, height * 0.56, width * 0.72, height * 0.18, 16)
    ctx.fill()

    const seatShade = ctx.createLinearGradient(0, height * 0.56, 0, height * 0.74)
    seatShade.addColorStop(0, 'rgba(255,255,255,0.35)')
    seatShade.addColorStop(0.7, 'rgba(0,0,0,0.05)')
    seatShade.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = seatShade
    ctx.fill()

    // Armrests (Left & Right)
    ctx.fillStyle = pattern
    ctx.beginPath()
    ctx.roundRect(width * 0.1, height * 0.44, width * 0.12, height * 0.3, [16, 8, 8, 16])
    ctx.roundRect(width * 0.78, height * 0.44, width * 0.12, height * 0.3, [8, 16, 16, 8])
    ctx.fill()

    const armShade = ctx.createLinearGradient(width * 0.1, 0, width * 0.9, 0)
    armShade.addColorStop(0, 'rgba(0,0,0,0.25)')
    armShade.addColorStop(0.5, 'rgba(0,0,0,0)')
    armShade.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = armShade
    ctx.fill()

    // Wooden legs
    ctx.fillStyle = '#451A03'
    ctx.beginPath()
    ctx.moveTo(width * 0.16, height * 0.74)
    ctx.lineTo(width * 0.14, height * 0.86)
    ctx.lineTo(width * 0.18, height * 0.86)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(width * 0.84, height * 0.74)
    ctx.lineTo(width * 0.82, height * 0.86)
    ctx.lineTo(width * 0.86, height * 0.86)
    ctx.closePath()
    ctx.fill()
  } else if (type === 'curtain') {
    // Curtain Rod
    ctx.fillStyle = '#1E293B'
    ctx.fillRect(width * 0.08, height * 0.08, width * 0.84, 10)
    ctx.fillStyle = '#0F172A'
    ctx.beginPath()
    ctx.arc(width * 0.08, height * 0.08 + 5, 8, 0, Math.PI * 2)
    ctx.arc(width * 0.92, height * 0.08 + 5, 8, 0, Math.PI * 2)
    ctx.fill()

    // 2 Panels with wavy sinusoidal folds
    const panels = [
      { start: width * 0.12, end: width * 0.45 },
      { start: width * 0.55, end: width * 0.88 },
    ]

    for (const panel of panels) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(panel.start, height * 0.1, panel.end - panel.start, height * 0.78)
      ctx.clip()

      ctx.fillStyle = pattern
      ctx.fillRect(panel.start, height * 0.1, panel.end - panel.start, height * 0.78)

      // Sinusoidal wavy fold shadows
      const foldWidth = 26
      const count = Math.ceil((panel.end - panel.start) / foldWidth)
      for (let i = 0; i < count; i++) {
        const fx = panel.start + i * foldWidth
        const foldGrad = ctx.createLinearGradient(fx, 0, fx + foldWidth, 0)
        foldGrad.addColorStop(0, 'rgba(0,0,0,0.55)')
        foldGrad.addColorStop(0.4, 'rgba(255,255,255,0.3)')
        foldGrad.addColorStop(0.7, 'rgba(255,255,255,0.0)')
        foldGrad.addColorStop(1, 'rgba(0,0,0,0.55)')
        ctx.fillStyle = foldGrad
        ctx.fillRect(fx, height * 0.1, foldWidth, height * 0.78)
      }
      ctx.restore()
    }
  } else if (type === 'cushion') {
    // Ground Shadow
    ctx.fillStyle = 'rgba(15,23,42,0.2)'
    ctx.beginPath()
    ctx.ellipse(width * 0.5, height * 0.86, width * 0.32, 16, 0, 0, Math.PI * 2)
    ctx.fill()

    // Cushion Body
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(width * 0.22, height * 0.22, width * 0.56, height * 0.56, 42)
    ctx.clip()

    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)

    // Center bulbous radial highlight
    const radial = ctx.createRadialGradient(
      width * 0.46,
      height * 0.44,
      width * 0.08,
      width * 0.5,
      height * 0.5,
      width * 0.36,
    )
    radial.addColorStop(0, 'rgba(255,255,255,0.45)')
    radial.addColorStop(0.6, 'rgba(0,0,0,0.0)')
    radial.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, width, height)

    ctx.restore()

    // Border Piping seam
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(width * 0.22, height * 0.22, width * 0.56, height * 0.56, 42)
    ctx.stroke()
  } else if (type === 'shirt') {
    // Shirt silhouette
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(width * 0.35, height * 0.16)
    ctx.lineTo(width * 0.65, height * 0.16)
    ctx.lineTo(width * 0.82, height * 0.32)
    ctx.lineTo(width * 0.74, height * 0.42)
    ctx.lineTo(width * 0.68, height * 0.36)
    ctx.lineTo(width * 0.68, height * 0.84)
    ctx.lineTo(width * 0.32, height * 0.84)
    ctx.lineTo(width * 0.32, height * 0.36)
    ctx.lineTo(width * 0.26, height * 0.42)
    ctx.lineTo(width * 0.18, height * 0.32)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)

    // Shading
    const shirtShade = ctx.createLinearGradient(0, height * 0.16, 0, height * 0.84)
    shirtShade.addColorStop(0, 'rgba(255,255,255,0.25)')
    shirtShade.addColorStop(0.5, 'rgba(0,0,0,0.0)')
    shirtShade.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = shirtShade
    ctx.fillRect(0, 0, width, height)

    // Center button placket
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(width * 0.48, height * 0.24, width * 0.04, height * 0.6)
    for (let y = height * 0.3; y < height * 0.8; y += 45) {
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(width * 0.5, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#64748B'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.restore()

    // Collar
    ctx.fillStyle = pattern
    ctx.beginPath()
    ctx.moveTo(width * 0.42, height * 0.16)
    ctx.lineTo(width * 0.47, height * 0.26)
    ctx.lineTo(width * 0.5, height * 0.22)
    ctx.lineTo(width * 0.53, height * 0.26)
    ctx.lineTo(width * 0.58, height * 0.16)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Draws a cross-section diagram showing the selected weft yarn undulating
 * above and below the warp yarns along the row.
 */
export function drawCrossSection(
  canvas: HTMLCanvasElement,
  rowIndex: number,
  spec: WeaveSpec,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  ctx.clearRect(0, 0, width, height)

  const { warpEnds, weftPicks, weaveData, warpColors, weftColors } = spec
  const row = Math.max(0, Math.min(weftPicks - 1, rowIndex))

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  const margin = 40
  const usableWidth = width - margin * 2
  const colSpacing = usableWidth / Math.max(1, warpEnds)
  const centerY = height * 0.5
  const waveAmp = Math.min(28, height * 0.22)
  const warpRadius = Math.max(5, Math.min(14, colSpacing * 0.34))

  // 1. Draw Warp Yarn Circular Cross Sections
  for (let c = 0; c < warpEnds; c++) {
    const cx = margin + (c + 0.5) * colSpacing
    const color = warpColors[c] ?? '#23364C'

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, centerY, warpRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Inner 3D radial shine
    const shine = ctx.createRadialGradient(
      cx - warpRadius * 0.3,
      centerY - warpRadius * 0.3,
      1,
      cx,
      centerY,
      warpRadius,
    )
    shine.addColorStop(0, 'rgba(255,255,255,0.6)')
    shine.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = shine
    ctx.beginPath()
    ctx.arc(cx, centerY, warpRadius, 0, Math.PI * 2)
    ctx.fill()

    // Warp number label
    ctx.fillStyle = '#64748B'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${c + 1}`, cx, centerY + warpRadius + 18)
  }

  // 2. Compute Weft Yarn Path (above or below warp ends)
  const weftColor = weftColors[row] ?? '#D92D20'
  const points: { x: number; y: number }[] = []

  // Left lead-in point
  const firstUp = weaveData[row]?.[0] === 1
  points.push({ x: margin * 0.4, y: centerY + (firstUp ? waveAmp : -waveAmp) })

  for (let c = 0; c < warpEnds; c++) {
    const cx = margin + (c + 0.5) * colSpacing
    // 1 = warp up (weft goes BELOW), 0 = weft up (weft goes ABOVE)
    const warpUp = weaveData[row]?.[c] === 1
    const y = centerY + (warpUp ? waveAmp + warpRadius * 0.4 : -(waveAmp + warpRadius * 0.4))
    points.push({ x: cx, y })
  }

  // Right lead-out point
  const lastUp = weaveData[row]?.[warpEnds - 1] === 1
  points.push({ x: width - margin * 0.4, y: centerY + (lastUp ? waveAmp : -waveAmp) })

  // 3. Draw smooth Bezier curve for the Weft Yarn
  ctx.strokeStyle = weftColor
  ctx.lineWidth = Math.max(4, warpRadius * 0.7)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const mx = (p0.x + p1.x) / 2
    ctx.quadraticCurveTo(p0.x, p0.y, mx, (p0.y + p1.y) / 2)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()

  // Weft centerline shine
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = Math.max(1.5, ctx.lineWidth * 0.3)
  ctx.stroke()
}

/**
 * Processes an uploaded image into a Jacquard pixel weave matrix.
 */
export async function processImageToJacquard(
  file: File,
  warpEnds: number,
  weftPicks: number,
): Promise<{ cellColors: (string | null)[][]; baseWeave: number[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to parse image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = warpEnds
        canvas.height = weftPicks
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context unavailable'))

        ctx.drawImage(img, 0, 0, warpEnds, weftPicks)
        const imgData = ctx.getImageData(0, 0, warpEnds, weftPicks).data

        const cellColors: (string | null)[][] = Array.from({ length: weftPicks }, () =>
          Array<string | null>(warpEnds).fill(null),
        )
        const baseWeave: number[][] = Array.from({ length: weftPicks }, () =>
          Array<number>(warpEnds).fill(0),
        )

        let ptr = 0
        for (let r = 0; r < weftPicks; r++) {
          // Bottom row 0
          const y = weftPicks - 1 - r
          for (let c = 0; c < warpEnds; c++) {
            const red = imgData[ptr]
            const green = imgData[ptr + 1]
            const blue = imgData[ptr + 2]
            const alpha = imgData[ptr + 3]

            if (alpha > 20) {
              const hex = `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1).toUpperCase()}`
              cellColors[y][c] = hex
              // Luminance for weave lift
              const lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
              baseWeave[y][c] = lum > 0.5 ? 1 : 0
            } else {
              cellColors[y][c] = null
              baseWeave[y][c] = (r + c) % 2 === 0 ? 1 : 0
            }
            ptr += 4
          }
        }

        resolve({ cellColors, baseWeave })
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
