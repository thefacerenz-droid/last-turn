/** Distances are metres. Progress s increases towards world -Z. */
export type RouteId = 'pacific' | 'marina' | 'mesa'
export const LANE_WIDTH = 3.7
export const ROAD_SAMPLE = 8

export interface Route {
  id: RouteId
  name: string
  district: string
  description: string
  lanes: number
  shield: string
}

export const ROUTES: readonly Route[] = [
  { id: 'pacific', name: 'Pacific Coast', district: 'San Aurelio Coast', description: 'Ocean bluffs, wind-bent palms and sweeping coastal curves.', lanes: 3, shield: '01' },
  { id: 'marina', name: 'Marina Expressway', district: 'Port Alondra', description: 'Elevated waterfront lanes between hotels, cranes and the downtown skyline.', lanes: 4, shield: '27' },
  { id: 'mesa', name: 'Sierra Pass', district: 'Sierra Loma', description: 'Long straights and graded bends through a wide, sunbaked foothill basin.', lanes: 5, shield: '86' },
]

interface Alignment {
  lanes: number
  base: number
  bend: readonly [number, number, number][]
  rise: readonly [number, number, number][]
  rampPeriod: number
  rampStart: number
}

const alignments: Record<RouteId, Alignment> = {
  pacific: {
    lanes: 3, base: 11, bend: [[83, 478, 0.36], [57, 829, 2.1], [7.5, 181, 1.3]],
    rise: [[4.8, 392, 0.4], [2.7, 216, -0.23]], rampPeriod: 2880, rampStart: 856,
  },
  marina: {
    lanes: 4, base: 13.8, bend: [[68, 504, 2.2], [22, 239, -1.3], [28, 870, 0.2]],
    rise: [[3.4, 455, -0.8], [1.4, 196, 1.1]], rampPeriod: 2304, rampStart: 438,
  },
  mesa: {
    lanes: 5, base: 33, bend: [[127, 545, 1.2], [76, 749, 0.1], [23, 320, 2.5]],
    rise: [[13, 460, 0.6], [6.2, 252, -0.7]], rampPeriod: 3200, rampStart: 1138,
  },
}

export interface RoadSample {
  x: number
  y: number
  /** First derivatives with respect to s. */
  slope: number
  grade: number
  /** Vertical rise per horizontal metre toward the right shoulder. */
  bank: number
  lanes: number
  left: number
  right: number
}

export function roadAt(route: RouteId, s: number): RoadSample {
  const a = alignments[route]
  let x = 0, slope = 0, curvature = 0, y = a.base, grade = 0
  for (const [amplitude, radius, phase] of a.bend) {
    const angle = s / radius + phase
    x += amplitude * (Math.sin(angle) - Math.sin(phase))
    slope += amplitude / radius * Math.cos(angle)
    curvature -= amplitude / (radius * radius) * Math.sin(angle)
  }
  for (const [amplitude, radius, phase] of a.rise) {
    const angle = s / radius + phase
    y += amplitude * Math.sin(angle)
    grade += amplitude / radius * Math.cos(angle)
  }
  // Long, shallow pavement undulations. Both wheels and the visual ribbons sample this.
  y += 0.016 * Math.sin(s / 6.7) + 0.009 * Math.sin(s / 3.9 + 0.8)
  grade += 0.016 / 6.7 * Math.cos(s / 6.7) + 0.009 / 3.9 * Math.cos(s / 3.9 + 0.8)
  const widthScale = Math.hypot(1, slope)
  const half = a.lanes * LANE_WIDTH * 0.5
  return {
    x, y, slope, grade, lanes: a.lanes,
    bank: Math.max(-0.058, Math.min(0.058, -curvature * 85)) - 0.008,
    left: (-half - 1.55) * widthScale,
    right: (half + 2.35) * widthScale,
  }
}

export function laneOffset(route: RouteId, s: number, lane: number): number {
  const r = roadAt(route, s)
  return (lane - (r.lanes - 1) / 2) * LANE_WIDTH * Math.hypot(1, r.slope)
}

export interface RampSample {
  center: number
  left: number
  right: number
  rise: number
  t: number
}

export function rampAt(route: RouteId, s: number, r = roadAt(route, s)): RampSample | undefined {
  const a = alignments[route]
  const phase = ((s - a.rampStart) % a.rampPeriod + a.rampPeriod) % a.rampPeriod
  const length = 610
  if (phase >= length) return
  const t = phase / length
  const bow = Math.sin(Math.PI * t) ** 2
  const center = r.right - 2.9 + 38 * bow
  return { center, left: center - 3.2, right: center + 3.2, rise: 3.6 * bow * bow, t }
}

function rampBlend(offset: number, r: RoadSample, ramp: RampSample): number {
  if (offset <= r.right) return 0
  return Math.min(1, (offset - r.right) / Math.max(0.12, ramp.center - r.right))
}

export function roadHeight(route: RouteId, s: number, worldX: number): number {
  const r = roadAt(route, s)
  const offset = worldX - r.x
  const ramp = rampAt(route, s, r)
  const main = r.y + offset * r.bank
  return main + (ramp && offset <= ramp.right + 1.2 ? rampBlend(offset, r, ramp) * ramp.rise : 0)
}

export function isPaved(route: RouteId, s: number, worldX: number): boolean {
  const r = roadAt(route, s), offset = worldX - r.x
  if (offset >= r.left - 0.15 && offset <= r.right + 0.15) return true
  const ramp = rampAt(route, s, r)
  return !!ramp && offset >= ramp.left - 0.15 && offset <= ramp.right + 0.15
}

export type WallId = 'median' | 'outside' | 'rampIn' | 'rampOut'
export interface RoadWall { id: WallId; offset: number }

export function roadWalls(route: RouteId, s: number): RoadWall[] {
  const r = roadAt(route, s), ramp = rampAt(route, s, r)
  const walls: RoadWall[] = [{ id: 'median', offset: r.left }]
  if (!ramp || ramp.left > r.right + 1.3) walls.push({ id: 'outside', offset: r.right })
  if (ramp) {
    if (ramp.left > r.right + 1.3) walls.push({ id: 'rampIn', offset: ramp.left })
    walls.push({ id: 'rampOut', offset: Math.max(r.right, ramp.right) })
  }
  return walls
}

/** Deterministic 32-bit integer hash; stable across pooled chunks and route revisits. */
export function scatter(seed: number): number {
  let h = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function terrainHeight(route: RouteId, s: number, offset: number, r = roadAt(route, s)): number {
  const near = r.y + Math.max(r.left, Math.min(r.right, offset)) * r.bank - (route === 'marina' ? 6.5 : 0.65)
  const d = Math.max(0, Math.abs(offset) - (offset < 0 ? -r.left : r.right))
  if (route !== 'mesa' && offset < 0) {
    const shore = route === 'marina' ? 108 + 29 * Math.sin(s / 283) : 52 + 18 * Math.sin(s / 174 + 0.4)
    const u = Math.min(1, d / shore)
    return near * (1 - u * u * (3 - 2 * u)) + 0.27 * u - Math.max(0, d - shore) * 0.12
  }
  const apron = 0.18 * Math.sin(s / 23 + offset / 6) * Math.min(1, d / 10)
  const ridge = Math.max(0, d - (route === 'marina' ? 160 : 94))
  const altitude = (route === 'mesa' ? 1.4 : 0.92)
    * (0.30 + 0.12 * Math.sin(s / 178 + offset / 191) + 0.085 * Math.cos(s / 83 - offset / 111))
  return near + apron + ridge * altitude * (0.6 + 0.4 * Math.min(1, ridge / 190))
}
