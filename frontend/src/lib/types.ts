export type Locale = 'ar' | 'en'

export interface User {
  id: string
  email: string
  fullName: string
  role: 'user' | 'admin'
  plan: 'free' | 'pro'
  locale: Locale
  emailVerified: boolean
  createdAt: string
}

export interface Settings {
  locale: Locale
  theme: 'light' | 'dark'
  currency: 'EGP' | 'USD'
  notifications: Record<string, unknown>
}

export interface DesignSummary {
  id: string
  name: string
  warpEnds: number
  weftPicks: number
  thumbnail?: string
  version: number
  updatedAt: string
  createdAt: string
}

export interface Design {
  id: string
  name: string
  description: string
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
  settings: Record<string, unknown>
  thumbnail?: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface Yarn {
  id: string
  name: string
  system: 'ne' | 'tex' | 'denier'
  count: number
  material: string
  priceEgp: number
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

export interface Rate {
  key: string
  value: number
  unit: string
  source: string
  fetchedAt: string
}

export interface ActivityPoint {
  day: string
  count: number
}

export interface DashboardData {
  counts: { designs: number; yarns: number; quotes: number }
  recent: DesignSummary[]
  activity: ActivityPoint[]
  plan: { tier: 'free' | 'pro'; pro: boolean; gridLimit: number; designLimit: number }
}

export interface AuthPayload {
  user: User
  accessToken: string
  expiresIn: number
}

export interface MeResponse {
  user: User
  settings: Settings
}

export interface SharePayload {
  name: string
  description: string
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
  settings: Record<string, unknown>
  version: number
  createdAt: string
}

export interface ColorShare {
  code: string
  hex: string
  threads: number
  percentage: number
  kg: number
}

export interface ConsumptionResult {
  totalWarpEnds: number
  coverFactor: number
  coverPercent: number
  coverStatus: 'balanced' | 'light' | 'dense'
  warpWeightSqM: number
  weftWeightSqM: number
  totalWeightSqM: number
  warpWeightLinearM: number
  weftWeightLinearM: number
  totalWeightLinearM: number
  warpCost: number
  weftCost: number
  yarnCost: number
  manufacturingCost: number
  profitValue: number
  sellingPrice: number
}

export interface ERPResult {
  totalWarpEnds: number
  totalWarpKg: number
  totalWeftKg: number
  totalYarnKg: number
  warpBreakdown: ColorShare[]
  weftBreakdown: ColorShare[]
  totalPicks: number
  totalHours: number
  days: number
  remainingHours: number
  metersPerHour: number
  yarnCost: number
  operatingCost: number
  grandTotalCost: number
  netProfit: number
  finalOrderValue: number
}

export interface SampleResult {
  gsm: number
  weightPerMeter150: number
  warpNe: number
  weftNe: number
  warpTex: number
  weftTex: number
  warpDenier: number
  weftDenier: number
  warpClosest: string
  weftClosest: string
}

export interface Shaft {
  index: number
  heddles: number
  inRepeat: number
}

export interface LoomResult {
  reedWidthCm: number
  dentsPerCm: number
  metricReed: number
  englishReed: number
  totalGroundEnds: number
  selvedgeEnds: number
  totalEnds: number
  totalDents: number
  shafts: Shaft[]
  shaftCount: number
}

export interface DensityResult {
  warpDensity: number
  weftDensity: number
  warpCrimp: number
  weftCrimp: number
  warpNe: number
  weftNe: number
  warpTex: number
  weftTex: number
}
