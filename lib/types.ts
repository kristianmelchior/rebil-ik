// Raw row from public.sales
export interface SaleRow {
  id: number
  hs_deal_id: string | null    // HubSpot deal ID → URL: https://app-eu1.hubspot.com/contacts/25445101/record/0-3/{hs_deal_id}/
  kategori: string
  salgstype: string
  bonustype: string
  rep_name: string
  navn?: string | null          // vehicle / deal label (billiste) — column sales.navn
  kode: string
  teamleder: string
  dato_kjopt: string           // date or ISO datetime — purchase date for display/filter
  created_at?: string | null    // optional — used for feed clock when dato_kjopt is date-only
  biler: number                // SUM this — not COUNT(rows)
  innkjopspris: number | null
  prisgruppe: string | null
  lq: boolean
  brutto: number
  prisgrense: string | null    // 'Pris' | 'Rabatt 1' | 'Rabatt 2' | 'Minstepris' | null
  bonussats?: number           // legacy column (not used in UI / bonus math)
  bonus: number | null         // bonus NOK per row — Bonusbidrag & base bonus sum
}

// Raw row from public.leads
export interface LeadRow {
  hs_object_id: string
  rep_name: string
  kode: string
  teamleder: string
  createdate: string           // 'YYYY-MM-DD'
  teller_lead: boolean         // filter true only
  dato_kontaktet: string | null
  lq: boolean | null
}

// Raw row from public.nps
export interface NpsRow {
  record_id: string
  survey: string
  nps: number
  nps_adj_score: number        // use this for all calculations
  submitted_at: string
  month: string                // 'YYYY-MM-DD' first of month
  rep_name: string
  kode: string | null          // filter out null and 'zz_unknown'
  teamleder: string
}

// Row from public.reps
export interface Rep {
  kode: string                 // PK — session cookie (httpOnly), set at login
  full_name: string
  email: string
  teamleder: string
  rolle: string
  hubspot_id: string | null
  tier: 'IK' | 'Senior' | 'Spesialist'  // derived from rolle
}

// Metrics for one time period
export interface PeriodMetrics {
  bilerKjopt: number
  leads: number
  konverteringsrate: number | null   // null if leads === 0
  npsScore: number | null            // null if no NPS rows
  npsCount: number
}

// Full bonus calculation result
export interface BonusResult {
  baseBonus: number
  carsThisMonth: number
  leadsThisMonth: number
  convRate: number
  convFactor: number
  bonusBiler: number              // = baseBonus (display line 1)
  konverteringsbonus: number      // = baseBonus * (convFactor - 1) (display line 2)
  bonusEtterKonvertering: number  // = baseBonus * convFactor
  npsScore: number | null
  npsBonus: number
  totalBonus: number
  projectedBonus: number
  perCarAvg: number | null        // null if carsThisMonth === 0
}

/** Present when logged in as admin — rep picker in header. */
export interface AdminDashboardMeta {
  reps: { kode: string; full_name: string }[]
}

/** Present when logged in as teamleder — team picker in header. */
export interface TeamlederDashboardMeta {
  reps: { kode: string; full_name: string }[]
}

// Full dashboard payload — returned by GET /api/data
export interface RepDashboard {
  rep: Rep
  currentMonth: PeriodMetrics
  last30Days: PeriodMetrics
  medianCurrentMonth: PeriodMetrics
  medianLast30Days: PeriodMetrics
  trend: (PeriodMetrics & { month: string })[]        // 'YYYY-MM', oldest first
  medianTrend: (PeriodMetrics & { month: string })[]
  bonus: BonusResult
  salesThisMonth: SaleRow[]
  salesByMonth: Record<string, SaleRow[]>             // key = 'YYYY-MM'
  lastUpdated: string
  admin?: AdminDashboardMeta
  teamView?: TeamlederDashboardMeta
}

// Boooom! feed — /api/feed/reactions
export interface FeedReactionGroup {
  emoji: string
  count: number
  repNames: string[]
}

export interface FeedSaleReactions {
  reactions: FeedReactionGroup[]
  myReactions: string[]
}

export type FeedReactionsMap = Record<string, FeedSaleReactions>

// Boooom! feed — /api/feed/comments (client payload)
export interface FeedCommentPublic {
  id: string
  sale_id: number
  rep_name: string
  body: string
  created_at: string
}

export type FeedCommentsMap = Record<string, FeedCommentPublic[]>
