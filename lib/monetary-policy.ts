/**
 * MP-01 — Balance Sheet Impact Simulator (Monetary Policy module).
 *
 * Pure, client-side simulation logic. This module is strictly READ-ONLY: it
 * never mutates real ledger data. It models the effect of a proposed gold
 * purchase on a central bank's pro-forma balance sheet under several funding
 * scenarios, and derives the key policy ratios used by the committee.
 *
 * All monetary values are expressed in USD millions unless noted otherwise.
 */

export type FundingSource =
  | "RESERVE_DRAWDOWN"
  | "BOND_ISSUANCE"
  | "FX_SWAP"
  | "EXTERNAL_BORROWING"

export type ScenarioCategory = "strategic" | "tactical" | "emergency" | "custom"

export interface BalanceSheet {
  assets: {
    goldReserves: number
    foreignReserves: number
    domesticSecurities: number
    otherAssets: number
  }
  liabilities: {
    currencyInCirculation: number
    reserveAccounts: number
    bondsOutstanding: number
    fxSwaps: number
    externalBorrowing: number
  }
}

export interface KeyRatios {
  /** Gold / (Gold + Foreign Reserves). */
  goldToReserves: number
  /** Total assets / equity. */
  leverage: number
  /** High-quality liquid assets / net 30-day cash outflows. */
  liquidityCoverage: number
  /** Equity / total assets. */
  capitalAdequacy: number
}

export interface SimulationParams {
  /** Purchase amount in troy ounces. */
  purchaseAmountOz: number
  /** Price per troy ounce in USD. */
  pricePerOz: number
  fundingSource: FundingSource
  settlementDate: string
}

export interface SimulationResult {
  baseline: BalanceSheet
  proForma: BalanceSheet
  baselineRatios: KeyRatios
  proFormaRatios: KeyRatios
  /** Purchase value in USD millions. */
  goldIncrease: number
}

export interface ScenarioTemplate {
  id: string
  name: string
  nameFr: string
  description: string
  descriptionFr: string
  category: ScenarioCategory
  /** Purchase size as a percentage of total reserves (gold + foreign). */
  purchaseSizePct: number
  fundingSource: FundingSource
  settlementTimeline: string
  usageCount: number
  lastUsed: string
}

export interface PolicyWeights {
  reserveAdequacy: number
  liquidityStability: number
  costEfficiency: number
  marketSignaling: number
}

/**
 * Baseline central-bank balance sheet (mock snapshot of the core ledger).
 * Total assets = total liabilities + equity = 12,000.
 */
export const BASELINE_BALANCE_SHEET: BalanceSheet = {
  assets: {
    goldReserves: 2400,
    foreignReserves: 5600,
    domesticSecurities: 3200,
    otherAssets: 800,
  },
  liabilities: {
    currencyInCirculation: 4500,
    reserveAccounts: 3000,
    bondsOutstanding: 2000,
    fxSwaps: 500,
    externalBorrowing: 0,
  },
}

export const BASELINE_TIMESTAMP = "2026-05-02T14:35:00Z"

export const FUNDING_SOURCES: { value: FundingSource; labelEn: string; labelFr: string; costPct: number }[] = [
  { value: "RESERVE_DRAWDOWN", labelEn: "Foreign Reserve Drawdown", labelFr: "Tirage sur réserves de change", costPct: 0.5 },
  { value: "BOND_ISSUANCE", labelEn: "Domestic Bond Issuance", labelFr: "Émission obligataire domestique", costPct: 3.2 },
  { value: "FX_SWAP", labelEn: "FX Swap Facility", labelFr: "Facilité de swap de change", costPct: 2.4 },
  { value: "EXTERNAL_BORROWING", labelEn: "External Borrowing", labelFr: "Emprunt externe", costPct: 4.5 },
]

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "reserve-diversification",
    name: "Reserve Diversification",
    nameFr: "Diversification des réserves",
    description: "Strategic rebalancing to increase gold allocation.",
    descriptionFr: "Rééquilibrage stratégique pour augmenter l'allocation en or.",
    category: "strategic",
    purchaseSizePct: 5,
    fundingSource: "RESERVE_DRAWDOWN",
    settlementTimeline: "T+5",
    usageCount: 47,
    lastUsed: "2026-04-18",
  },
  {
    id: "crisis-hedge",
    name: "Crisis Hedge",
    nameFr: "Couverture de crise",
    description: "Rapid gold acquisition during geopolitical or financial stress.",
    descriptionFr: "Acquisition rapide d'or en période de stress géopolitique ou financier.",
    category: "emergency",
    purchaseSizePct: 12.5,
    fundingSource: "FX_SWAP",
    settlementTimeline: "T+2",
    usageCount: 9,
    lastUsed: "2026-03-02",
  },
  {
    id: "inflation-protection",
    name: "Inflation Protection",
    nameFr: "Protection contre l'inflation",
    description: "Systematic gold accumulation to hedge inflation expectations.",
    descriptionFr: "Accumulation systématique d'or pour couvrir les anticipations d'inflation.",
    category: "strategic",
    purchaseSizePct: 3,
    fundingSource: "BOND_ISSUANCE",
    settlementTimeline: "T+5",
    usageCount: 23,
    lastUsed: "2026-04-30",
  },
  {
    id: "tactical-accumulation",
    name: "Tactical Accumulation",
    nameFr: "Accumulation tactique",
    description: "Opportunistic purchase to exploit favorable LBMA pricing windows.",
    descriptionFr: "Achat opportuniste pour exploiter des fenêtres de prix LBMA favorables.",
    category: "tactical",
    purchaseSizePct: 2,
    fundingSource: "RESERVE_DRAWDOWN",
    settlementTimeline: "T+3",
    usageCount: 14,
    lastUsed: "2026-04-22",
  },
]

export const DEFAULT_POLICY_WEIGHTS: PolicyWeights = {
  reserveAdequacy: 40,
  liquidityStability: 30,
  costEfficiency: 20,
  marketSignaling: 10,
}

export const DEFAULT_PRICE_PER_OZ = 2400

export function totalAssets(bs: BalanceSheet): number {
  return bs.assets.goldReserves + bs.assets.foreignReserves + bs.assets.domesticSecurities + bs.assets.otherAssets
}

export function totalLiabilities(bs: BalanceSheet): number {
  return (
    bs.liabilities.currencyInCirculation +
    bs.liabilities.reserveAccounts +
    bs.liabilities.bondsOutstanding +
    bs.liabilities.fxSwaps +
    bs.liabilities.externalBorrowing
  )
}

export function equity(bs: BalanceSheet): number {
  return totalAssets(bs) - totalLiabilities(bs)
}

export function computeRatios(bs: BalanceSheet): KeyRatios {
  const ta = totalAssets(bs)
  const eq = equity(bs)
  const hqla = bs.assets.foreignReserves + 0.85 * bs.assets.domesticSecurities + 0.5 * bs.assets.goldReserves
  const netCashOutflows =
    0.25 * bs.liabilities.reserveAccounts + bs.liabilities.fxSwaps + 0.1 * bs.liabilities.currencyInCirculation
  return {
    goldToReserves: bs.assets.goldReserves / (bs.assets.goldReserves + bs.assets.foreignReserves),
    leverage: eq !== 0 ? ta / eq : 0,
    liquidityCoverage: netCashOutflows !== 0 ? hqla / netCashOutflows : 0,
    capitalAdequacy: ta !== 0 ? eq / ta : 0,
  }
}

/** Core simulation: applies a gold purchase to the baseline under a funding source. */
export function simulateBalanceSheetImpact(
  params: SimulationParams,
  baseline: BalanceSheet = BASELINE_BALANCE_SHEET,
): SimulationResult {
  // Purchase value in USD millions (price/oz is in USD, amount in oz).
  const goldIncrease = (params.purchaseAmountOz * params.pricePerOz) / 1_000_000

  const proForma: BalanceSheet = {
    assets: { ...baseline.assets },
    liabilities: { ...baseline.liabilities },
  }

  proForma.assets.goldReserves = baseline.assets.goldReserves + goldIncrease

  switch (params.fundingSource) {
    case "RESERVE_DRAWDOWN":
      proForma.assets.foreignReserves = baseline.assets.foreignReserves - goldIncrease
      break
    case "BOND_ISSUANCE":
      proForma.liabilities.bondsOutstanding = baseline.liabilities.bondsOutstanding + goldIncrease
      break
    case "FX_SWAP":
      proForma.liabilities.fxSwaps = baseline.liabilities.fxSwaps + goldIncrease
      break
    case "EXTERNAL_BORROWING":
      proForma.liabilities.externalBorrowing = baseline.liabilities.externalBorrowing + goldIncrease
      break
  }

  return {
    baseline,
    proForma,
    baselineRatios: computeRatios(baseline),
    proFormaRatios: computeRatios(proForma),
    goldIncrease,
  }
}

/** Translates a template's % purchase size into an ounce amount at a given price. */
export function templateToParams(
  template: ScenarioTemplate,
  pricePerOz: number,
  baseline: BalanceSheet = BASELINE_BALANCE_SHEET,
): SimulationParams {
  const reservesBase = baseline.assets.goldReserves + baseline.assets.foreignReserves
  const purchaseValueM = (template.purchaseSizePct / 100) * reservesBase // USD millions
  const purchaseAmountOz = Math.round((purchaseValueM * 1_000_000) / pricePerOz)
  return {
    purchaseAmountOz,
    pricePerOz,
    fundingSource: template.fundingSource,
    settlementDate: defaultSettlementDate(),
  }
}

export function defaultSettlementDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 5)
  return d.toISOString().slice(0, 10)
}

export interface ScenarioMetrics {
  fundingSource: FundingSource
  goldToReservesPct: number
  liquidityCoverage: number
  liquidityDeltaPct: number
  costOfFundingPct: number
  marketSignaling: number
  /** Composite weighted score 0-100. */
  compositeScore: number
  /** Normalized objective scores 0-100 for the radar chart. */
  objectives: {
    reserveAdequacy: number
    liquidityStability: number
    costEfficiency: number
    marketSignaling: number
  }
}

/** Qualitative market-signaling score per funding source (0-100, higher = stronger positive signal). */
const MARKET_SIGNALING: Record<FundingSource, number> = {
  RESERVE_DRAWDOWN: 55,
  BOND_ISSUANCE: 70,
  FX_SWAP: 40,
  EXTERNAL_BORROWING: 30,
}

/**
 * Computes comparison metrics for a set of funding sources given a fixed
 * purchase size. Objective scores are min-max normalized across the scenarios.
 */
export function compareScenarios(
  purchaseAmountOz: number,
  pricePerOz: number,
  fundingSources: FundingSource[],
  weights: PolicyWeights,
  baseline: BalanceSheet = BASELINE_BALANCE_SHEET,
): ScenarioMetrics[] {
  const baselineLcr = computeRatios(baseline).liquidityCoverage

  const raw = fundingSources.map((fundingSource) => {
    const result = simulateBalanceSheetImpact(
      { purchaseAmountOz, pricePerOz, fundingSource, settlementDate: defaultSettlementDate() },
      baseline,
    )
    const cost = FUNDING_SOURCES.find((f) => f.value === fundingSource)?.costPct ?? 0
    return {
      fundingSource,
      goldToReservesPct: result.proFormaRatios.goldToReserves * 100,
      liquidityCoverage: result.proFormaRatios.liquidityCoverage,
      liquidityDeltaPct: ((result.proFormaRatios.liquidityCoverage - baselineLcr) / baselineLcr) * 100,
      costOfFundingPct: cost,
      marketSignaling: MARKET_SIGNALING[fundingSource],
    }
  })

  // Min-max helpers for normalization (guard against divide-by-zero).
  const norm = (val: number, min: number, max: number, invert = false) => {
    if (max === min) return 100
    const n = ((val - min) / (max - min)) * 100
    return invert ? 100 - n : n
  }
  const goldVals = raw.map((r) => r.goldToReservesPct)
  const lcrVals = raw.map((r) => r.liquidityCoverage)
  const costVals = raw.map((r) => r.costOfFundingPct)
  const signalVals = raw.map((r) => r.marketSignaling)

  const totalWeight =
    weights.reserveAdequacy + weights.liquidityStability + weights.costEfficiency + weights.marketSignaling || 1

  return raw.map((r) => {
    const objectives = {
      // Higher gold ratio = stronger reserve adequacy.
      reserveAdequacy: norm(r.goldToReservesPct, Math.min(...goldVals), Math.max(...goldVals)),
      // Higher LCR = more liquidity stability.
      liquidityStability: norm(r.liquidityCoverage, Math.min(...lcrVals), Math.max(...lcrVals)),
      // Lower cost = higher efficiency (inverted).
      costEfficiency: norm(r.costOfFundingPct, Math.min(...costVals), Math.max(...costVals), true),
      marketSignaling: norm(r.marketSignaling, Math.min(...signalVals), Math.max(...signalVals)),
    }
    const compositeScore =
      (objectives.reserveAdequacy * weights.reserveAdequacy +
        objectives.liquidityStability * weights.liquidityStability +
        objectives.costEfficiency * weights.costEfficiency +
        objectives.marketSignaling * weights.marketSignaling) /
      totalWeight
    return { ...r, compositeScore, objectives }
  })
}

/** Best scenario index by composite score. */
export function recommendScenario(metrics: ScenarioMetrics[]): number {
  let best = 0
  for (let i = 1; i < metrics.length; i++) {
    if (metrics[i].compositeScore > metrics[best].compositeScore) best = i
  }
  return best
}

/** Real SHA-256 of the parameters + baseline timestamp, for the audit trail. */
export async function computeAuditHash(params: SimulationParams): Promise<string> {
  const payload = JSON.stringify(params) + BASELINE_TIMESTAMP
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function fundingLabel(source: FundingSource, language: string): string {
  const f = FUNDING_SOURCES.find((x) => x.value === source)
  if (!f) return source
  return language === "fr" ? f.labelFr : f.labelEn
}

/** Formats a USD-millions value, e.g. 12000 -> "$12,000.0M". */
export function fmtMillions(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
}

/** Formats a ratio as a percentage, e.g. 0.3 -> "30.0%". */
export function fmtPct(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

/** Variance severity band for change highlighting (per wireframe: ≤2% green, 2-5% yellow, >5% red). */
export function varianceBand(pctChange: number): "low" | "medium" | "high" {
  const abs = Math.abs(pctChange)
  if (abs <= 2) return "low"
  if (abs <= 5) return "medium"
  return "high"
}
