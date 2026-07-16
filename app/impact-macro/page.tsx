"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, ComposedChart,
} from "recharts"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarProvider } from "@/components/sidebar-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/language-context"
import {
  AlertTriangle, CheckCircle2, Save, Plus, Copy, RotateCcw,
  RefreshCw, BookOpen, ChevronRight, Trash2, BarChart2, Layers,
  History, FileText, FlaskConical, ArrowRight, X,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimInputs {
  goldTonnesPerYear: number
  finenessPct: number
  goldPriceUSD: number
  goldPriceDriftPctPerYear: number
  horizonYears: number
  exchangeRateInit: number
  m2Init: number
  reservesInit: number
  importsPerMonthUSD: number
  currencyInCirculationInit: number
  sterilizationPct: number
  sterilizationRatePct: number
  requiredReserveRatioPct: number
  moneyMultiplier: number
  currencyToDepositRatio: number
  excessReservePropensityPct: number
  baseInflationPct: number
  inflationSensitivity: number
  fxPassThroughCoeff: number
  liquidityLeakagePct: number
  fxPressureScaling: number
  reserveConfidenceOffset: number
  bccFXInterventionPct: number
  fxDepreciationBasePct: number
  inflationCeilingPct: number
  importCoverFloorMonths: number
  annualBudgetCDFbn: number
}

interface SimRow {
  year: number
  exchangeRate: number
  inflation: number
  m2GrowthFromGold: number
  m2Stock: number
  reserves: number
  importCover: number
  goldHoldingsUSD: number
  goldShareOfReserves: number
  sterilizedThisYearCDF: number
  sterilizationCostCDF: number
  cumSterilizationCostCDF: number
  netFXchangePct: number
  goldValueUSDthisYear: number
  baseInjectionCDF: number
  deltaM2: number
  additionalRequiredReservesCDF: number
  currencyInCirculationCDF: number
  freeLiquidityCDF: number
}

interface DecisionMetrics {
  peakInflationPct: number
  firstBreachYear: number | null
  reservesAddedUSDbn: number
  inflationUpliftPP: number
  fxDepreciationVsBaseline: number
  cumSterilCostCDFbn: number
  cumSterilCostPctBudgetHorizon: number
  finalImportCoverMonths: number
  sterilCostPerReserveUSDbn: number
  admissible: boolean
  violatedConstraints: string[]
}

interface Scenario {
  id: string
  name: string
  description: string
  tags: string[]
  status: "draft" | "active" | "archived"
  inputs: SimInputs
  createdAt: string
  updatedAt: string
}

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TROY_OZ_PER_TONNE = 32_150.7547

const DEFAULTS: SimInputs = {
  goldTonnesPerYear: 15,
  finenessPct: 99.50,
  goldPriceUSD: 5050,
  goldPriceDriftPctPerYear: 0,
  horizonYears: 5,
  exchangeRateInit: 2249,
  m2Init: 14800,
  reservesInit: 7.86,
  importsPerMonthUSD: 0.72,
  currencyInCirculationInit: 8200,
  sterilizationPct: 50,
  sterilizationRatePct: 13.5,
  requiredReserveRatioPct: 12,
  moneyMultiplier: 2.8,
  currencyToDepositRatio: 0.60,
  excessReservePropensityPct: 15,
  baseInflationPct: 2.5,
  inflationSensitivity: 0.35,
  fxPassThroughCoeff: 0.20,
  liquidityLeakagePct: 40,
  fxPressureScaling: 0.8,
  reserveConfidenceOffset: 1.2,
  bccFXInterventionPct: 30,
  fxDepreciationBasePct: 0,
  inflationCeilingPct: 7.0,
  importCoverFloorMonths: 3,
  annualBudgetCDFbn: 20962,
}

const LS_INDEX = "bccgold.v1.index"
const LS_PREFIX = "bccgold.v1.scenario."

// ─── Market reference (mid-2026 actuals) ─────────────────────────────────────

const MARKET_REF = {
  reservesUSDbn: 7.86,
  importCoverMonths: 3.0,
  inflationYoY: 2.5,
  inflationTarget: 7.0,
  policyRate: 13.5,
  gdpUSDbn: 123.4,
  gdpRealGrowthPct: 5.9,
  finePurity: 0.995,
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const I18N = {
  fr: {
    pageTitle: "Simulateur d'Impact Monétaire — Achat d'Or BCC",
    pageSub: "Modélisation des effets macroéconomiques du programme d'achat d'or artisanal",
    library: "Bibliothèque", compare: "Comparer",
    tabs: { overview: "Vue d'ensemble", simulator: "Simulateur", balance: "Bilan & Coûts", history: "Contexte Historique", methodology: "Méthodologie" },
    programmeCat: "PROGRAMME",
    programmeTitle: "De la mine artisanale à la réserve monétaire",
    programmePara: `Depuis février 2026, la Banque Centrale du Congo s'approvisionne en or auprès de DRC Gold Trading SA, agrégateur public de la production artisanale, qu'elle convertit en or monétaire inscrit aux réserves officielles. L'objectif 2026 est de 15,0 tonnes par an — soit environ six fois la production artisanale déclarée de 2025 (2,5 tonnes).`,
    flowCaption: "l'or circule vers la droite · la CDF nouvellement émise circule vers la gauche, vers les mineurs et les négociants",
    whyCat: "POURQUOI C'EST IMPORTANT",
    whyTitle: "Sept canaux de transmission modélisés",
    channels: [
      "Monnaie de base & monnaie de réserve créées pour payer l'or",
      "Croissance de la masse monétaire large (M2/M3) via le multiplicateur de dépôts",
      "Liquidité du système bancaire et nécessité de stérilisation",
      "Inflation : excès de création monétaire et pass-through de change",
      "Taux de change : pression à la dépréciation vs. soutien à la confiance",
      "Réserves brutes internationales et couverture des importations",
      "Risque au bilan de la banque centrale et coût quasi-fiscal de stérilisation",
    ],
    flowNodes: [
      { label: "Mineurs artisanaux", sub: "production artisanale" },
      { label: "DRC Gold Trading SA", sub: "agrégateur d'État, affinage" },
      { label: "BCC", sub: "achats en CDF" },
      { label: "Réserves + M0", sub: "or monétaire & monnaie de base" },
    ],
    officialRate: "Taux officiel (indicatif)", rateDate: "BCC, 9 juil. 2026",
    intlReserves: "Réserves internationales", importCover: (m: number) => `${m.toFixed(2)} mois de couverture import.`,
    inflLabel: "Inflation, g.a.", inflTarget: (t: number) => `vs. ${t.toFixed(1)} % cible moyen terme`,
    policyLabel: "Taux directeur", policyNote: "en baisse depuis 25 % fin 2024",
    gdpLabel: "PIB nominal (2026, FMI)", gdpNote: (g: number) => `${g.toFixed(1)} % de croissance réelle`,
    goldPriceLabel: "Prix de l'or retenu", goldPriceNote: "modifiable dans l'onglet Simulateur",
    year1Cat: "ORDRES DE GRANDEUR — ANNÉE 1",
    year1Title: "Ce que coûte l'achat du tonnage cible",
    year1Rows: (t: number, f: number, d: number, cdf: number, gdp: number, bud: number, cumCDF: number, cumSteril: number, s: number) => [
      { lbl: "Or acheté en année 1 (brut)", val: `${t.toFixed(1)} t`, cls: "" },
      { lbl: `Or fin équivalent (@ ${(MARKET_REF.finePurity * 100).toFixed(2)} %)`, val: `${f.toFixed(2)} t`, cls: "" },
      { lbl: "Coût en USD", val: `US$${d.toFixed(2)} Md`, cls: "" },
      { lbl: "Coût en CDF", val: `${cdf.toFixed(0)} Md CDF`, cls: "text-amber-400" },
      { lbl: "Part du PIB nominal 2026", val: `${gdp.toFixed(2)} %`, cls: "" },
      { lbl: "Part du budget illustratif 2026", val: `${bud.toFixed(1)} %`, cls: bud > 20 ? "text-amber-400" : "" },
      { lbl: `Décaissements cumulés or, ${s} ans`, val: `${cumCDF.toFixed(0)} Md CDF`, cls: "text-yellow-300" },
      { lbl: `Coût stérilisation cumulé, ${s} ans`, val: `${cumSteril.toFixed(0)} Md CDF`, cls: "text-yellow-300" },
    ],
    year1Note: "⊙ Les rapports publics évoquaient un coût annuel proche d'un tiers du budget 2026 à un taux de change supposé plus élevé ; recalculé en direct selon vos hypothèses.",
  },
  en: {
    pageTitle: "Monetary Impact Simulator — BCC Gold Purchase",
    pageSub: "Modelling macroeconomic effects of the artisanal gold purchase programme",
    library: "Library", compare: "Compare",
    tabs: { overview: "Overview", simulator: "Simulator", balance: "Balance Sheet & Costs", history: "Historical Context", methodology: "Methodology" },
    programmeCat: "PROGRAMME",
    programmeTitle: "From artisanal pit to monetary reserve",
    programmePara: `Since February 2026 the Banque Centrale du Congo has sourced gold from DRC Gold Trading SA, a state-owned aggregator of artisanal production, converting it into monetary gold held in official reserves. The stated 2026 target is 15.0 tonnes a year — roughly six times 2025's declared artisanal output of 2.5 tonnes.`,
    flowCaption: "gold flows right · newly issued CDF flows left, back to miners and traders",
    whyCat: "WHY IT MATTERS",
    whyTitle: "Seven transmission channels this tool models",
    channels: [
      "Base money & reserve money created to pay for gold",
      "Broad money growth (M2/M3) via the deposit multiplier",
      "Banking system liquidity and the need for sterilisation",
      "Inflation: excess money creation and exchange-rate pass-through",
      "Exchange rate: depreciation pressure vs. confidence support from reserves",
      "Gross international reserves and import cover",
      "Central bank balance-sheet risk and quasi-fiscal sterilisation cost",
    ],
    flowNodes: [
      { label: "Artisanal miners", sub: "artisanal production" },
      { label: "DRC Gold Trading SA", sub: "state aggregator, refining" },
      { label: "BCC", sub: "purchases in CDF" },
      { label: "Reserves + M0", sub: "monetary gold & base money" },
    ],
    officialRate: "Official rate (indicative)", rateDate: "BCC, 9 Jul 2026",
    intlReserves: "International reserves", importCover: (m: number) => `${m.toFixed(2)} months import cover`,
    inflLabel: "Inflation, y/y", inflTarget: (t: number) => `vs. ${t.toFixed(1)}% medium-term target`,
    policyLabel: "Policy rate", policyNote: "down from 25% end-2024",
    gdpLabel: "Nominal GDP (2026, IMF)", gdpNote: (g: number) => `${g.toFixed(1)}% real growth`,
    goldPriceLabel: "Gold price used", goldPriceNote: "adjustable in the Simulator tab",
    year1Cat: "ORDER OF MAGNITUDE — YEAR 1",
    year1Title: "What the target tonnage costs",
    year1Rows: (t: number, f: number, d: number, cdf: number, gdp: number, bud: number, cumCDF: number, cumSteril: number, s: number) => [
      { lbl: "Gold purchased year 1 (gross)", val: `${t.toFixed(1)} t`, cls: "" },
      { lbl: `Fine-gold equivalent (@ ${(MARKET_REF.finePurity * 100).toFixed(2)} %)`, val: `${f.toFixed(2)} t`, cls: "" },
      { lbl: "USD cost", val: `US$${d.toFixed(2)} bn`, cls: "" },
      { lbl: "CDF cost", val: `${cdf.toFixed(0)} bn CDF`, cls: "text-amber-400" },
      { lbl: "Share of 2026 nominal GDP", val: `${gdp.toFixed(2)} %`, cls: "" },
      { lbl: "Share of illustrative 2026 budget", val: `${bud.toFixed(1)} %`, cls: bud > 20 ? "text-amber-400" : "" },
      { lbl: `Cumulative gold outlays, ${s} yrs`, val: `${cumCDF.toFixed(0)} bn CDF`, cls: "text-yellow-300" },
      { lbl: `Cumulative sterilisation cost, ${s} yrs`, val: `${cumSteril.toFixed(0)} bn CDF`, cls: "text-yellow-300" },
    ],
    year1Note: "⊙ Public reports cited an annual cost near one-third of the 2026 budget at a higher assumed exchange rate; recalculated live against your assumptions.",
  },
} as const

// ─── Chart colours ────────────────────────────────────────────────────────────

const C = {
  amber:   "#f59e0b",
  gold:    "#eab308",
  emerald: "#10b981",
  blue:    "#3b82f6",
  red:     "#ef4444",
  slate:   "#64748b",
  violet:  "#a78bfa",
}

// ─── Simulation Engine ────────────────────────────────────────────────────────

function simulate(p: SimInputs): SimRow[] {
  const c = p.currencyToDepositRatio ?? 0.60
  const r = p.requiredReserveRatioPct / 100
  const e = (p.excessReservePropensityPct ?? 15) / 100
  const derivedMultiplier = (1 + c) / (c + r + e)

  const rows: SimRow[] = []
  let exchangeRate = p.exchangeRateInit
  let m2Stock = p.m2Init
  let reserves = p.reservesInit
  let goldHoldingsUSD = 0
  let cumSterilizationCostCDF = 0
  let currencyInCirculationCDF = p.currencyInCirculationInit

  for (let y = 1; y <= p.horizonYears; y++) {
    const goldPriceThisYear = p.goldPriceUSD * Math.pow(1 + (p.goldPriceDriftPctPerYear ?? 0) / 100, y - 1)
    const finenessFactor = (p.finenessPct ?? 99.5) / 100
    const goldValueUSDbn = p.goldTonnesPerYear * finenessFactor * TROY_OZ_PER_TONNE * goldPriceThisYear / 1e9

    const baseInjectionCDF = goldValueUSDbn * exchangeRate
    const sterilizedThisYearCDF = baseInjectionCDF * p.sterilizationPct / 100
    const netInjectionCDF = baseInjectionCDF - sterilizedThisYearCDF

    const leakageFraction = (p.liquidityLeakagePct ?? 40) / 100
    const domesticInjectionCDF = netInjectionCDF * (1 - leakageFraction)
    const fxLeakageCDF = netInjectionCDF * leakageFraction

    const prevM2 = m2Stock
    const deltaM2 = domesticInjectionCDF * (derivedMultiplier - 1)
    m2Stock = m2Stock + deltaM2
    const m2GrowthFromGold = (deltaM2 / prevM2) * 100

    const fxPressureRaw = (fxLeakageCDF / prevM2) * (p.fxPressureScaling ?? 0.8) * 100
    const reserveGainDampening = fxPressureRaw * (goldValueUSDbn / reserves) * (p.reserveConfidenceOffset ?? 1.2)
    const netFxBeforeIntervention = Math.max(0, fxPressureRaw - reserveGainDampening)
    const netFXchangePct = netFxBeforeIntervention * (1 - (p.bccFXInterventionPct ?? 30) / 100)

    const inflationFromM2 = m2GrowthFromGold * p.inflationSensitivity
    const inflationFromFX = netFXchangePct * p.fxPassThroughCoeff
    const inflation = p.baseInflationPct + inflationFromM2 + inflationFromFX

    exchangeRate = exchangeRate * (1 + (p.fxDepreciationBasePct + netFXchangePct) / 100)

    goldHoldingsUSD = goldHoldingsUSD + goldValueUSDbn
    reserves = p.reservesInit + goldHoldingsUSD
    const goldShareOfReserves = goldHoldingsUSD / reserves
    const importCover = reserves / p.importsPerMonthUSD

    const additionalRequiredReservesCDF = deltaM2 * p.requiredReserveRatioPct / 100
    currencyInCirculationCDF = currencyInCirculationCDF + netInjectionCDF
    const freeLiquidityCDF = currencyInCirculationCDF - additionalRequiredReservesCDF * y

    const sterilizationCostCDF = sterilizedThisYearCDF * p.sterilizationRatePct / 100
    cumSterilizationCostCDF = cumSterilizationCostCDF + sterilizationCostCDF

    rows.push({
      year: y,
      exchangeRate,
      inflation,
      m2GrowthFromGold,
      m2Stock,
      reserves,
      importCover,
      goldHoldingsUSD,
      goldShareOfReserves,
      sterilizedThisYearCDF,
      sterilizationCostCDF,
      cumSterilizationCostCDF,
      netFXchangePct,
      goldValueUSDthisYear: goldValueUSDbn,
      baseInjectionCDF,
      deltaM2,
      additionalRequiredReservesCDF,
      currencyInCirculationCDF,
      freeLiquidityCDF,
    })
  }
  return rows
}

function decisionMetrics(p: SimInputs): DecisionMetrics {
  const rows = simulate(p)
  const baseRows = simulate({ ...p, goldTonnesPerYear: 0 })
  const last = rows[rows.length - 1]
  const baseLast = baseRows[baseRows.length - 1]

  const peakInflationPct = Math.max(...rows.map(r => r.inflation))
  const firstBreachYear =
    rows.find(r => r.inflation > p.inflationCeilingPct || r.importCover < p.importCoverFloorMonths)?.year ?? null
  const reservesAddedUSDbn = last.goldHoldingsUSD
  const inflationUpliftPP = last.inflation - p.baseInflationPct
  const fxDepreciationVsBaseline =
    ((last.exchangeRate - baseLast.exchangeRate) / baseLast.exchangeRate) * 100
  const cumSterilCostCDFbn = last.cumSterilizationCostCDF
  const cumSterilCostPctBudgetHorizon =
    (cumSterilCostCDFbn / (p.annualBudgetCDFbn * p.horizonYears)) * 100
  const finalImportCoverMonths = last.importCover
  const sterilCostPerReserveUSDbn =
    cumSterilCostCDFbn / last.exchangeRate / reservesAddedUSDbn

  const violatedConstraints: string[] = []
  if (peakInflationPct > p.inflationCeilingPct)
    violatedConstraints.push(`Inflation pic ${peakInflationPct.toFixed(1)} % > cible ${p.inflationCeilingPct} %`)
  if (finalImportCoverMonths < p.importCoverFloorMonths)
    violatedConstraints.push(`Couverture ${finalImportCoverMonths.toFixed(1)} mois < plancher ${p.importCoverFloorMonths} mois`)

  return {
    peakInflationPct, firstBreachYear, reservesAddedUSDbn, inflationUpliftPP,
    fxDepreciationVsBaseline, cumSterilCostCDFbn, cumSterilCostPctBudgetHorizon,
    finalImportCoverMonths, sterilCostPerReserveUSDbn,
    admissible: violatedConstraints.length === 0, violatedConstraints,
  }
}

// ─── Scenario Storage ─────────────────────────────────────────────────────────

function lsGet<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fb } catch { return fb }
}
function lsSet(key: string, v: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(v))
}
function loadAllScenarios(): Scenario[] {
  return lsGet<string[]>(LS_INDEX, [])
    .map(id => lsGet<Scenario | null>(LS_PREFIX + id, null))
    .filter((s): s is Scenario => s !== null)
}
function persistScenario(s: Scenario) {
  lsSet(LS_PREFIX + s.id, s)
  const ids = lsGet<string[]>(LS_INDEX, [])
  if (!ids.includes(s.id)) lsSet(LS_INDEX, [...ids, s.id])
}
function removeScenario(id: string) {
  if (typeof window !== "undefined") localStorage.removeItem(LS_PREFIX + id)
  lsSet(LS_INDEX, lsGet<string[]>(LS_INDEX, []).filter(i => i !== id))
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

// ─── Historical Data ──────────────────────────────────────────────────────────

const HIST = [
  { date: "Jan 2024", cdfUsd: 2510, inflYoY: 23.8, policyRate: 25.0, reservesUSD: 4.6 },
  { date: "Q4 2024",  cdfUsd: 2790, inflYoY: 18.4, policyRate: 25.0, reservesUSD: 5.4 },
  { date: "Feb 2025", cdfUsd: 2830, inflYoY: 12.6, policyRate: 25.0, reservesUSD: 5.9 },
  { date: "Oct 2025", cdfUsd: 2100, inflYoY: 6.8,  policyRate: 17.5, reservesUSD: 6.7 },
  { date: "Jan 2026", cdfUsd: 2146, inflYoY: 3.4,  policyRate: 15.0, reservesUSD: 7.0 },
  { date: "Feb 2026", cdfUsd: 2282, inflYoY: 2.9,  policyRate: 15.0, reservesUSD: 7.3 },
  { date: "Apr 2026", cdfUsd: 2306, inflYoY: 2.2,  policyRate: 13.5, reservesUSD: 7.7 },
  { date: "Jun 2026", cdfUsd: 2270, inflYoY: 2.5,  policyRate: 13.5, reservesUSD: 7.9 },
  { date: "Jul 2026", cdfUsd: 2249, inflYoY: 2.5,  policyRate: 13.5, reservesUSD: 7.9 },
]

const MILESTONES = [
  {
    date: "20 Feb 2026",
    en: "BCC Governor André Wameso signs a strategic agreement with DRC Gold Trading SA to purchase domestically-sourced gold for monetary reserves.",
    fr: "Le gouverneur de la BCC André Wameso signe un accord stratégique avec DRC Gold Trading SA pour l'achat d'or produit localement en vue de constituer des réserves monétaires.",
  },
  {
    date: "Feb–Mar 2026",
    en: "DRC Gold Trading sets a 2026 collection target of 15 tonnes of artisanal gold, up sharply from 2.5 tonnes declared in 2025.",
    fr: "DRC Gold Trading fixe un objectif de collecte 2026 à 15 tonnes d'or artisanal, en forte hausse par rapport aux 2,5 tonnes déclarées en 2025.",
  },
  {
    date: "Apr 2026",
    en: "First refined gold ingots meeting LBMA 995-fineness standards are delivered into BCC reserves.",
    fr: "Les premiers lingots d'or affiné conformes aux normes LBMA de pureté 995 sont versés dans les réserves de la BCC.",
  },
  {
    date: "9 Apr 2026",
    en: "BCC lowers its policy rate to 13.5%, continuing an easing cycle from 25% in late 2024.",
    fr: "La BCC abaisse son taux directeur à 13,5 %, poursuivant le cycle d'assouplissement amorcé depuis 25 % fin 2024.",
  },
  {
    date: "Jun 2026",
    en: "Gross international reserves near US$7.9bn, close to three months of import cover.",
    fr: "Les réserves brutes internationales avoisinent 7,9 Md USD, soit environ trois mois de couverture des importations.",
  },
]

// ─── Sensitivity sweep config ─────────────────────────────────────────────────

const SWEEP_INPUTS_CFG: { key: keyof SimInputs; en: string; fr: string; min: number; max: number; steps: number }[] = [
  { key: "goldTonnesPerYear",     en: "Annual gold purchases (t/yr)",   fr: "Achats annuels d'or (t/an)",    min: 0,    max: 30,   steps: 31 },
  { key: "goldPriceUSD",          en: "Gold price ($/oz)",              fr: "Prix de l'or ($/oz)",            min: 1000, max: 10000, steps: 37 },
  { key: "sterilizationPct",      en: "Sterilization (%)",              fr: "Part stérilisée (%)",            min: 0,    max: 100,  steps: 21 },
  { key: "inflationSensitivity",  en: "Money-growth elasticity",        fr: "Élasticité M2→inflation",       min: 0,    max: 1,    steps: 21 },
  { key: "fxPassThroughCoeff",    en: "FX pass-through coeff.",         fr: "Coeff. pass-through FX",         min: 0,    max: 1,    steps: 21 },
  { key: "liquidityLeakagePct",   en: "Liquidity leakage (%)",          fr: "Fuite de liquidités (%)",        min: 0,    max: 80,   steps: 17 },
]

const SWEEP_OUTCOMES_CFG: { key: string; en: string; fr: string; get: (m: DecisionMetrics) => number }[] = [
  { key: "peakInflation",  en: "Peak inflation (%)",            fr: "Inflation pic (%)",                get: m => m.peakInflationPct },
  { key: "importCover",   en: "Import cover (months)",         fr: "Couverture imports (mois)",         get: m => m.finalImportCoverMonths },
  { key: "reservesAdded", en: "Reserves added (US$bn)",        fr: "Réserves ajoutées (Md USD)",        get: m => m.reservesAddedUSDbn },
  { key: "fxDeprec",      en: "FX depreciation vs. baseline (%)", fr: "Dépréciation FX vs. référence (%)", get: m => Math.max(0, m.fxDepreciationVsBaseline) },
  { key: "sterilCost",    en: "Sterilization cost (CDF bn)",   fr: "Coût stérilisation (CDF bn)",      get: m => m.cumSterilCostCDFbn },
]

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, warn, positive,
}: { label: string; value: string; sub?: string; warn?: boolean; positive?: boolean }) {
  return (
    <Card className={cn(warn && "border-amber-500/40", positive && "border-emerald-500/40")}>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1 leading-tight">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums", warn && "text-amber-400", positive && "text-emerald-400")}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SliderRow({
  label, value, displayValue, onChange, min, max, step = 1, hint,
}: {
  label: string; value: number; displayValue: string; onChange: (v: number) => void
  min: number; max: number; step?: number; hint?: string
}) {
  return (
    <div className="py-2.5 border-b border-zinc-800/60 last:border-0">
      <div className="flex justify-between items-baseline gap-1">
        <span className="text-xs text-zinc-300 leading-tight min-w-0">{label}</span>
        <span className="text-xs font-mono font-bold text-amber-400 shrink-0 ml-1">{displayValue}</span>
      </div>
      {hint && <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{hint}</p>}
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="mt-2" />
    </div>
  )
}

function SimMetricCard({
  label, value, sub, badgeText, ok, fail,
}: { label: string; value: string; sub?: string; badgeText?: string; ok?: boolean; fail?: boolean }) {
  return (
    <Card className={cn("border", ok && "border-emerald-500/40", fail && "border-red-500/40", !ok && !fail && "border-zinc-700/60")}>
      <CardContent className="pt-3 pb-3 px-4">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          {badgeText && (
            <Badge variant="outline" className="text-[9px] py-0 h-4 text-amber-400/80 border-amber-500/30 shrink-0 ml-1">
              {badgeText}
            </Badge>
          )}
        </div>
        <p className={cn("text-xl font-bold tabular-nums", ok && "text-emerald-400", fail && "text-red-400", !ok && !fail && "text-white")}>
          {value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function InputRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <Label className="text-sm leading-tight">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="w-40 shrink-0">{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min, max, step, unit }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number" value={value} min={min} max={max} step={step ?? 1}
        className="h-8 text-sm tabular-nums"
        onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n) }}
      />
      {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
    </div>
  )
}

const fmt = {
  pct: (v: number, d = 1) => `${v.toFixed(d)} %`,
  bnUSD: (v: number, d = 2) => `US$${v.toFixed(d)} bn`,
  bnCDF: (v: number, d = 0) => `${v.toFixed(d)} bn CDF`,
  months: (v: number, d = 1) => `${v.toFixed(d)} months`,
}

function FlowDiagram({ lang }: { lang: "fr" | "en" }) {
  const clss = [
    "border-amber-500/50 bg-amber-950/20",
    "border-blue-500/50 bg-blue-950/20",
    "border-violet-500/50 bg-violet-950/20",
    "border-emerald-500/50 bg-emerald-950/20",
  ]
  const nodes = I18N[lang].flowNodes
  return (
    <div className="flex flex-nowrap items-center justify-between gap-0 py-1 w-full">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center min-w-0 flex-1">
          <div className={cn("border rounded-lg px-3 py-2 text-center flex-1 min-w-0", clss[i])}>
            <p className="text-xs font-bold leading-tight truncate">{n.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{n.sub}</p>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex items-center shrink-0 mx-1">
              <div className="w-4 h-px bg-amber-500/60" />
              <ArrowRight className="h-3 w-3 text-amber-500/60 -ml-0.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} className="flex gap-2" style={{ color: p.color }}>
          <span>{p.name}:</span>
          <span className="font-mono tabular-nums">{p.value.toFixed(2)}{unit ? ` ${unit}` : ""}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImpactMacroPage() {
  const [inputs, setInputs] = useState<SimInputs>(DEFAULTS)
  const [savedInputs, setSavedInputs] = useState<SimInputs>(DEFAULTS)
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [tab, setTab] = useState("overview")
  const [showLibrary, setShowLibrary] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState<"save" | "saveas" | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ msg: string; onOk: () => void } | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [analystName, setAnalystName] = useState("")
  const [libSearch, setLibSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [saveName, setSaveName] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [saveTags, setSaveTags] = useState("")
  const [m2View, setM2View] = useState<"pct" | "abs">("pct")
  const [bsStress, setBsStress] = useState({
    goldVolatilityPct: 16,
    maxInflPct: 10.0,
    importCoverFloor: 3.0,
    maxCostPctBudget: 5.0,
  })
  const [sweepInputKey, setSweepInputKey] = useState<keyof SimInputs>("goldTonnesPerYear")
  const [sweepOutcomeKey, setSweepOutcomeKey] = useState("peakInflation")
  const { language: lang } = useLanguage()

  const impliedMultiplier = useMemo(() => {
    const c = inputs.currencyToDepositRatio ?? 0.60
    const r = inputs.requiredReserveRatioPct / 100
    const e = (inputs.excessReservePropensityPct ?? 15) / 100
    return (1 + c) / (c + r + e)
  }, [inputs.currencyToDepositRatio, inputs.requiredReserveRatioPct, inputs.excessReservePropensityPct])

  useEffect(() => {
    setScenarios(loadAllScenarios())
    setAnalystName(lsGet("bccgold.analystName", ""))
  }, [])
  useEffect(() => { lsSet("bccgold.analystName", analystName) }, [analystName])

  const rows = useMemo(() => simulate(inputs), [inputs])
  const baseRows = useMemo(() => simulate({ ...inputs, goldTonnesPerYear: 0 }), [inputs])
  const metrics = useMemo(() => decisionMetrics(inputs), [inputs])
  const isDirty = useMemo(() => JSON.stringify(inputs) !== JSON.stringify(savedInputs), [inputs, savedInputs])

  const chartData = useMemo(() => rows.map((r, i) => ({
    year: `Y${r.year}`,
    fxOr: parseFloat(r.exchangeRate.toFixed(0)),
    fxBase: parseFloat(baseRows[i].exchangeRate.toFixed(0)),
    inflOr: parseFloat(r.inflation.toFixed(2)),
    inflBase: parseFloat(baseRows[i].inflation.toFixed(2)),
    resOr: parseFloat(r.reserves.toFixed(2)),
    resBase: parseFloat(baseRows[i].reserves.toFixed(2)),
    liqOr: parseFloat(r.freeLiquidityCDF.toFixed(0)),
    liqBase: parseFloat(baseRows[i].freeLiquidityCDF.toFixed(0)),
    sterilCum: parseFloat(r.cumSterilizationCostCDF.toFixed(1)),
    goldShare: parseFloat((r.goldShareOfReserves * 100).toFixed(1)),
    coverOr: parseFloat(r.importCover.toFixed(1)),
    coverBase: parseFloat(baseRows[i].importCover.toFixed(1)),
    m2GrowthPct: parseFloat(r.m2GrowthFromGold.toFixed(2)),
    m2GrowthAbs: parseFloat(r.deltaM2.toFixed(0)),
    sterilAnn: parseFloat(r.sterilizationCostCDF.toFixed(1)),
    goldHoldUSD: parseFloat(r.goldHoldingsUSD.toFixed(3)),
  })), [rows, baseRows])

  const compareScenario = useMemo(() => compareId ? scenarios.find(s => s.id === compareId) ?? null : null, [compareId, scenarios])
  const compareMetrics = useMemo(() => compareScenario ? decisionMetrics(compareScenario.inputs) : null, [compareScenario])

  const liqData = useMemo(() => {
    const c = inputs.currencyToDepositRatio ?? 0.60
    const r = inputs.requiredReserveRatioPct / 100
    const e = (inputs.excessReservePropensityPct ?? 15) / 100
    const denom = Math.max(c + r + e, 0.001)
    return rows.map(row => {
      const net = row.baseInjectionCDF - row.sterilizedThisYearCDF
      return {
        year: `Y${row.year}`,
        sterilized: Math.round(row.sterilizedThisYearCDF),
        addlReserves: Math.round(r / denom * net),
        freeLiquidity: Math.round(e / denom * net),
        currency: Math.round(c / denom * net),
        netInjection: Math.round(net),
        yearNum: row.year,
      }
    })
  }, [rows, inputs])

  const sweepChartData = useMemo(() => {
    const inputCfg = SWEEP_INPUTS_CFG.find(x => x.key === sweepInputKey)
    const outCfg = SWEEP_OUTCOMES_CFG.find(x => x.key === sweepOutcomeKey)
    if (!inputCfg || !outCfg) return []
    return Array.from({ length: inputCfg.steps }, (_, i) => {
      const val = inputCfg.min + i * (inputCfg.max - inputCfg.min) / Math.max(inputCfg.steps - 1, 1)
      const p = { ...inputs, [sweepInputKey]: val }
      const m = decisionMetrics(p)
      return { x: parseFloat(val.toFixed(2)), y: parseFloat(outCfg.get(m).toFixed(3)) }
    })
  }, [inputs, sweepInputKey, sweepOutcomeKey])

  function addToast(message: string, type: Toast["type"] = "success") {
    const id = uid()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  function update<K extends keyof SimInputs>(key: K, value: SimInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function handleNew() {
    const reset = () => { setInputs(DEFAULTS); setSavedInputs(DEFAULTS); setActiveScenario(null) }
    if (isDirty) {
      setShowConfirm({ msg: "Create new scenario? Unsaved changes will be lost.", onOk: reset })
    } else reset()
  }

  function doSave(name: string, desc: string, existingId?: string, tagsStr?: string) {
    const now = new Date().toISOString()
    const parsedTags = (tagsStr ?? "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
    const s: Scenario = {
      id: existingId ?? uid(),
      name: name.trim() || `Scenario ${new Date().toLocaleDateString()}`,
      description: desc,
      tags: parsedTags, status: "active", inputs,
      createdAt: existingId ? (activeScenario?.createdAt ?? now) : now,
      updatedAt: now,
    }
    persistScenario(s)
    setActiveScenario(s)
    setSavedInputs(inputs)
    setScenarios(loadAllScenarios())
    addToast(`"${s.name}" saved.`)
  }

  function handleSave() {
    if (activeScenario) {
      doSave(activeScenario.name, activeScenario.description, activeScenario.id)
    } else {
      setSaveName(""); setSaveDesc(""); setSaveTags(""); setShowSaveDialog("save")
    }
  }

  function handleLoad(s: Scenario) {
    setInputs(s.inputs); setSavedInputs(s.inputs); setActiveScenario(s)
    setShowLibrary(false); addToast(`"${s.name}" loaded.`)
  }

  function handleDelete(id: string) {
    setShowConfirm({
      msg: "Permanently delete this scenario?",
      onOk: () => {
        removeScenario(id)
        if (activeScenario?.id === id) { setActiveScenario(null); setSavedInputs(DEFAULTS) }
        setScenarios(loadAllScenarios())
        addToast("Scenario deleted.", "info")
      },
    })
  }

  function handleExport() {
    if (scenarios.length === 0) return
    const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bcc-gold-scenarios-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast(`${scenarios.length} scenario(s) exported.`)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const arr = JSON.parse(ev.target?.result as string) as Scenario[]
        if (!Array.isArray(arr)) throw new Error()
        arr.forEach(s => persistScenario(s))
        setScenarios(loadAllScenarios())
        addToast(`${arr.length} scenario(s) imported.`)
      } catch {
        addToast("Import failed: invalid file.", "error")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const filteredScenarios = scenarios.filter(s => {
    if (!showArchived && s.status === "archived") return false
    if (!libSearch.trim()) return true
    const q = libSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q))
  })

  const year1 = rows[0]
  const yearN = rows[rows.length - 1]
  const T = I18N[lang]

  const y1Tonnes = inputs.goldTonnesPerYear
  const y1FineGold = y1Tonnes * MARKET_REF.finePurity
  const y1USD = y1Tonnes * TROY_OZ_PER_TONNE * inputs.goldPriceUSD / 1e9
  const y1CDF = y1USD * inputs.exchangeRateInit
  const y1ShareGDP = (y1USD / MARKET_REF.gdpUSDbn) * 100
  const y1ShareBudget = (y1CDF / inputs.annualBudgetCDFbn) * 100
  const cumGoldOutlayCDF = rows.reduce((s, r) => s + r.baseInjectionCDF, 0)
  const cumSterilCost = yearN.cumSterilizationCostCDF

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AppHeader title={T.pageTitle} subtitle={T.pageSub} />
          <main className="flex-1 overflow-auto p-4">
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList className="h-9">
                <TabsTrigger value="overview"    className="text-xs"><BarChart2    className="h-3.5 w-3.5 mr-1" />{T.tabs.overview}</TabsTrigger>
                <TabsTrigger value="simulator"   className="text-xs"><FlaskConical className="h-3.5 w-3.5 mr-1" />{T.tabs.simulator}</TabsTrigger>
                <TabsTrigger value="balance"     className="text-xs"><Layers       className="h-3.5 w-3.5 mr-1" />{T.tabs.balance}</TabsTrigger>
                <TabsTrigger value="history"     className="text-xs"><History      className="h-3.5 w-3.5 mr-1" />{T.tabs.history}</TabsTrigger>
                <TabsTrigger value="methodology" className="text-xs"><FileText     className="h-3.5 w-3.5 mr-1" />{T.tabs.methodology}</TabsTrigger>
              </TabsList>

              {/* ── OVERVIEW ─────────────────────────────────────────────── */}
              <TabsContent value="overview">
                <div className="grid lg:grid-cols-2 gap-6 items-start">
                  {/* Left column */}
                  <div className="space-y-6">
                    {/* Programme card */}
                    <div className="rounded-xl border border-border bg-card px-6 py-6 space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{T.programmeCat}</span>
                        <h2 className="text-2xl font-bold mt-1">{T.programmeTitle}</h2>
                      </div>
                      <p className="text-base text-muted-foreground leading-relaxed">{T.programmePara}</p>
                      <div className="space-y-2">
                        <FlowDiagram lang={lang} />
                        <p className="text-xs text-muted-foreground/60 italic mt-2">{T.flowCaption}</p>
                      </div>
                    </div>

                    {/* Why it matters card */}
                    <div className="rounded-xl border border-border bg-card px-6 py-6 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{T.whyCat}</span>
                      <h3 className="text-xl font-semibold">{T.whyTitle}</h3>
                      <ul className="space-y-2">
                        {T.channels.map((ch, i) => (
                          <li key={i} className="flex items-start gap-3 text-base text-muted-foreground">
                            <span className="text-amber-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                            {ch}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-6">
                    {/* 6 market mini-cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { cat: T.officialRate, val: `${inputs.exchangeRateInit.toLocaleString()} CDF`, sub: T.rateDate, amber: true },
                        { cat: T.intlReserves, val: `US$${MARKET_REF.reservesUSDbn.toFixed(2)} bn`, sub: T.importCover(MARKET_REF.importCoverMonths) },
                        { cat: T.inflLabel, val: `${MARKET_REF.inflationYoY.toFixed(1)} %`, sub: T.inflTarget(MARKET_REF.inflationTarget) },
                        { cat: T.policyLabel, val: `${MARKET_REF.policyRate.toFixed(1)} %`, sub: T.policyNote },
                        { cat: T.gdpLabel, val: `US$${MARKET_REF.gdpUSDbn.toFixed(1)} bn`, sub: T.gdpNote(MARKET_REF.gdpRealGrowthPct) },
                        { cat: T.goldPriceLabel, val: `$${inputs.goldPriceUSD.toLocaleString()}/oz`, sub: T.goldPriceNote, amber: true },
                      ].map(card => (
                        <div key={card.cat} className="rounded-xl border border-border bg-card px-5 py-4">
                          <p className="text-xs text-muted-foreground/70 uppercase tracking-wide leading-tight mb-1">{card.cat}</p>
                          <p className={cn("text-3xl font-bold tabular-nums", card.amber ? "text-amber-400" : "text-foreground")}>{card.val}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-tight">{card.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Year-1 order of magnitude */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-4 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{T.year1Cat}</span>
                        <span className="text-sm font-semibold">{T.year1Title}</span>
                      </div>
                      <div className="px-5 py-4 space-y-2.5">
                        {T.year1Rows(
                          y1Tonnes, y1FineGold, y1USD, y1CDF, y1ShareGDP, y1ShareBudget,
                          cumGoldOutlayCDF, cumSterilCost, inputs.horizonYears,
                        ).map(r => (
                          <div key={r.lbl} className="flex items-baseline justify-between gap-4 text-sm">
                            <span className="text-muted-foreground">{r.lbl}</span>
                            <span className={cn("font-mono tabular-nums whitespace-nowrap font-semibold", r.cls || "text-foreground")}>{r.val}</span>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground/60 pt-3 border-t border-border/40 leading-relaxed">
                          {T.year1Note}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── SIMULATOR ────────────────────────────────────────────── */}
              <TabsContent value="simulator">
                {/* Status bar */}
                <div className="flex items-center justify-between gap-2 px-4 py-2 mb-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 flex-wrap">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", isDirty ? "bg-amber-500" : "bg-emerald-500")} />
                    {isDirty
                      ? (lang === "fr" ? "Configuration non sauvegardée — enregistrez pour enrichir votre bibliothèque" : "Unsaved configuration — save it to build your scenario library")
                      : (lang === "fr" ? "Scénario sauvegardé" : "Scenario saved")}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => setShowLibrary(true)}>
                      <Layers className="h-3 w-3" />{lang === "fr" ? "Scénarios" : "Scenarios"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={handleNew}>
                      <Plus className="h-3 w-3" />New
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => setInputs({ ...inputs })}>
                      <RefreshCw className="h-3 w-3" />Recalculate
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => { setInputs(savedInputs); addToast("Reverted.") }} disabled={!isDirty}>
                      <RotateCcw className="h-3 w-3" />{lang === "fr" ? "Rétablir" : "Revert to saved"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => {
                      const n = activeScenario ? `${activeScenario.name} (copy)` : `Scenario ${new Date().toLocaleDateString()}`
                      doSave(n, activeScenario?.description ?? "")
                    }}>
                      <Copy className="h-3 w-3" />{lang === "fr" ? "Dupliquer" : "Duplicate"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => { setSaveName(activeScenario ? `${activeScenario.name} (copy)` : ""); setSaveDesc(activeScenario?.description ?? ""); setSaveTags((activeScenario?.tags ?? []).join(", ")); setShowSaveDialog("saveas") }}>
                      <Save className="h-3 w-3" />{lang === "fr" ? "Enregistrer sous…" : "Save as new..."}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1 px-2 bg-amber-600 hover:bg-amber-700 text-black" onClick={handleSave}>
                      <Save className="h-3 w-3" />{lang === "fr" ? "Enregistrer" : "Save"}
                    </Button>
                  </div>
                </div>

                {/* Main 2-column layout */}
                <div className="flex gap-4 items-start">
                  {/* ── Left: Inputs panel ── */}
                  <div className="w-64 shrink-0 border border-zinc-700/60 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-700/60 bg-zinc-900/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                        {lang === "fr" ? "PARAMÈTRES" : "INPUTS"}
                      </p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {lang === "fr" ? "Paramètres du scénario" : "Scenario parameters"}
                      </p>
                    </div>
                    <ScrollArea className="h-[calc(100vh-320px)]">
                      <div className="px-4 pb-4">
                        {/* Section 1 */}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mt-4 mb-1">
                          {lang === "fr" ? "Programme d'achat" : "Purchase Programme"}
                        </p>
                        <SliderRow label={lang === "fr" ? "Achats annuels d'or" : "Annual gold purchases"} displayValue={`${inputs.goldTonnesPerYear.toFixed(1)} t/yr`} value={inputs.goldTonnesPerYear} onChange={v => update("goldTonnesPerYear", v)} min={1} max={100} step={0.5} />
                        <SliderRow label={lang === "fr" ? "Titre de l'or livré" : "Fineness of tonnage entered"} displayValue={`${inputs.finenessPct.toFixed(2)}% fine`} value={inputs.finenessPct} onChange={v => update("finenessPct", v)} min={90} max={100} step={0.01} hint={lang === "fr" ? "Part d'or pur dans le poids brut" : "Proportion of gross weight that is pure gold"} />
                        <SliderRow label={lang === "fr" ? "Prix de l'or" : "Gold price"} displayValue={`${inputs.goldPriceUSD.toLocaleString()} $/oz`} value={inputs.goldPriceUSD} onChange={v => update("goldPriceUSD", v)} min={1000} max={10000} step={50} />
                        <SliderRow label={lang === "fr" ? "Dérive prix annuelle" : "Annual gold-price drift"} displayValue={`${inputs.goldPriceDriftPctPerYear.toFixed(1)}%/yr`} value={inputs.goldPriceDriftPctPerYear} onChange={v => update("goldPriceDriftPctPerYear", v)} min={-10} max={20} step={0.5} />
                        <SliderRow label={lang === "fr" ? "Horizon de simulation" : "Simulation horizon"} displayValue={`${inputs.horizonYears} yrs`} value={inputs.horizonYears} onChange={v => update("horizonYears", Math.round(v))} min={1} max={10} step={1} />

                        {/* Section 2 */}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mt-4 mb-1">
                          {lang === "fr" ? "Financement & Liquidité" : "Financing & Liquidity Management"}
                        </p>
                        <SliderRow label={lang === "fr" ? "Part stérilisée" : "Share sterilized (bonds/reserve reqs.)"} displayValue={`${inputs.sterilizationPct.toFixed(0)}%`} value={inputs.sterilizationPct} onChange={v => update("sterilizationPct", v)} min={0} max={100} step={5} />
                        <SliderRow label={lang === "fr" ? "Taux de stérilisation" : "Sterilization instrument rate"} displayValue={`${inputs.sterilizationRatePct.toFixed(1)}%`} value={inputs.sterilizationRatePct} onChange={v => update("sterilizationRatePct", v)} min={0} max={30} step={0.5} />
                        <SliderRow label={lang === "fr" ? "Réserves obligatoires" : "Reserve requirement ratio"} displayValue={`${inputs.requiredReserveRatioPct.toFixed(0)}%`} value={inputs.requiredReserveRatioPct} onChange={v => update("requiredReserveRatioPct", v)} min={0} max={25} step={1} />
                        <SliderRow label={lang === "fr" ? "Ratio billets/dépôts" : "Currency-to-deposit ratio"} displayValue={`${(inputs.currencyToDepositRatio ?? 0.60).toFixed(2)}`} value={inputs.currencyToDepositRatio ?? 0.60} onChange={v => update("currencyToDepositRatio", v)} min={0.1} max={1.5} step={0.05} />
                        <p className="text-[10px] text-zinc-500 -mt-1 mb-1.5">{lang === "fr" ? "Multiplicateur implicite" : "Implied money multiplier"}: {impliedMultiplier.toFixed(2)}×</p>
                        <SliderRow label={lang === "fr" ? "Propension réserves excéd." : "Bank excess-reserve propensity"} displayValue={`${(inputs.excessReservePropensityPct ?? 15).toFixed(0)}%`} value={inputs.excessReservePropensityPct ?? 15} onChange={v => update("excessReservePropensityPct", v)} min={0} max={30} step={1} hint={lang === "fr" ? "Réserves supplémentaires au-delà du minimum" : "Extra reserves banks hold above the requirement"} />

                        {/* Section 3 */}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mt-4 mb-1">
                          {lang === "fr" ? "Inflation & Pass-through FX" : "Inflation & FX Pass-Through"}
                        </p>
                        <SliderRow label={lang === "fr" ? "Élasticité M2 → inflation" : "Money-growth → inflation elasticity"} displayValue={`${inputs.inflationSensitivity.toFixed(2)}`} value={inputs.inflationSensitivity} onChange={v => update("inflationSensitivity", v)} min={0} max={1} step={0.05} />
                        <SliderRow label={lang === "fr" ? "Cible inflation moyen terme" : "Medium-term inflation target"} displayValue={`${inputs.inflationCeilingPct.toFixed(1)}%`} value={inputs.inflationCeilingPct} onChange={v => update("inflationCeilingPct", v)} min={3} max={20} step={0.5} />
                        <SliderRow label={lang === "fr" ? "Fuite liquidité → FX" : "Liquidity leakage into FX demand"} displayValue={`${(inputs.liquidityLeakagePct ?? 40).toFixed(0)}%`} value={inputs.liquidityLeakagePct ?? 40} onChange={v => update("liquidityLeakagePct", v)} min={0} max={80} step={5} />
                        <SliderRow label={lang === "fr" ? "Amplificateur pression FX" : "FX-pressure scaling"} displayValue={`${(inputs.fxPressureScaling ?? 0.8).toFixed(1)}×`} value={inputs.fxPressureScaling ?? 0.8} onChange={v => update("fxPressureScaling", v)} min={0.1} max={2} step={0.1} />
                        <SliderRow label={lang === "fr" ? "Offset confiance réserves" : "Reserve-confidence offset"} displayValue={`${(inputs.reserveConfidenceOffset ?? 1.2).toFixed(1)}×`} value={inputs.reserveConfidenceOffset ?? 1.2} onChange={v => update("reserveConfidenceOffset", v)} min={0.1} max={2} step={0.1} />
                        <SliderRow label={lang === "fr" ? "Dépréciation FX → inflation" : "FX depreciation → inflation pass-through"} displayValue={`${inputs.fxPassThroughCoeff.toFixed(2)}`} value={inputs.fxPassThroughCoeff} onChange={v => update("fxPassThroughCoeff", v)} min={0} max={1} step={0.05} />
                        <SliderRow label={lang === "fr" ? "Offset intervention BCC FX" : "BCC FX intervention offset"} displayValue={`${(inputs.bccFXInterventionPct ?? 30).toFixed(0)}%`} value={inputs.bccFXInterventionPct ?? 30} onChange={v => update("bccFXInterventionPct", v)} min={0} max={50} step={5} />
                      </div>
                    </ScrollArea>
                  </div>

                  {/* ── Right: Metrics + Charts ── */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* 6 metric cards */}
                    {(() => {
                      const budgetOutlayCostPct = rows.length > 0 ? rows[0].baseInjectionCDF / inputs.annualBudgetCDFbn * 100 : 0
                      const isInflOk = metrics.peakInflationPct <= inputs.inflationCeilingPct
                      const isCoverOk = metrics.finalImportCoverMonths >= inputs.importCoverFloorMonths
                      const isBudgetOk = budgetOutlayCostPct <= 25.0
                      const isAdmissible = isInflOk && isCoverOk && isBudgetOk
                      const admissReason = !isInflOk
                        ? `peak inflation ${metrics.peakInflationPct.toFixed(1)}% > ${inputs.inflationCeilingPct.toFixed(1)}% target`
                        : !isCoverOk
                          ? `cover ${metrics.finalImportCoverMonths.toFixed(1)} mth < ${inputs.importCoverFloorMonths.toFixed(1)} mth floor`
                          : !isBudgetOk
                            ? `outlay ${budgetOutlayCostPct.toFixed(1)}% > 25.0% of budget`
                            : (lang === "fr" ? "Toutes les contraintes sont respectées" : "All constraints met")
                      return (
                        <div className="grid grid-cols-3 gap-3">
                          <SimMetricCard
                            label={`Peak inflation · ${metrics.peakInflationPct <= inputs.inflationCeilingPct ? (lang === "fr" ? "dans la cible" : "within target") : (lang === "fr" ? "hors cible" : "above target")}`}
                            value={`${metrics.peakInflationPct.toFixed(1)} %`}
                            sub={`${(inputs.inflationCeilingPct - metrics.peakInflationPct).toFixed(1)} pp headroom to target`}
                            badgeText="MODEL-DEPENDENT" ok={isInflOk} fail={!isInflOk}
                          />
                          <SimMetricCard
                            label={`Inflation, year ${inputs.horizonYears}`}
                            value={`${yearN.inflation.toFixed(2)} %`}
                            sub={`Scenario ${yearN.inflation.toFixed(2)}% vs. baseline ${inputs.baseInflationPct.toFixed(2)}% → +${Math.max(0, metrics.inflationUpliftPP).toFixed(2)} pp`}
                            badgeText="MODEL-DEPENDENT"
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Réserves ajoutées vs. sans achat" : "Reserves added vs. no-purchase"}
                            value={`+US$${metrics.reservesAddedUSDbn.toFixed(2)}bn`}
                            sub={`Scenario US$${yearN.reserves.toFixed(2)}bn vs. baseline US$${inputs.reservesInit.toFixed(2)}bn`}
                            ok
                          />
                          <SimMetricCard
                            label={`Import cover, year ${inputs.horizonYears}`}
                            value={`${metrics.finalImportCoverMonths.toFixed(2)} months`}
                            sub={`${isCoverOk ? "✓" : "✗"} at/above ${inputs.importCoverFloorMonths.toFixed(1)}-month floor`}
                            ok={isCoverOk} fail={!isCoverOk}
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Taux de change vs. référence" : "Exchange rate vs. baseline"}
                            value={`+${Math.max(0, metrics.fxDepreciationVsBaseline).toFixed(2)} %`}
                            sub={`${yearN.exchangeRate.toFixed(0)} vs. ${inputs.exchangeRateInit} CDF/USD`}
                            badgeText="MODEL-DEPENDENT"
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Admissibilité" : "Admissibility"}
                            value={isAdmissible ? "Admissible" : "Inadmissible"}
                            sub={admissReason}
                            ok={isAdmissible} fail={!isAdmissible}
                          />
                        </div>
                      )
                    })()}

                    {/* Chart 1: FX */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                          {lang === "fr" ? "Taux de change : avec vs. sans achats d'or" : "Exchange rate: gold purchases vs. no-purchase counterfactual"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={52} tickFormatter={v => v.toLocaleString()} />
                            <Tooltip content={<ChartTip unit="CDF/USD" />} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                            <Line type="monotone" dataKey="fxOr" name={lang === "fr" ? "Scénario" : "Scenario"} stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                            <Line type="monotone" dataKey="fxBase" name={lang === "fr" ? "Sans achats" : "No purchases"} stroke={C.slate} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Chart 2: Inflation path */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                          {lang === "fr" ? "Trajectoire d'inflation" : "Inflation path"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={36} tickFormatter={v => `${v}%`} />
                            <Tooltip content={<ChartTip unit="%" />} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                            <ReferenceLine y={inputs.inflationCeilingPct} stroke="#22d3ee" strokeDasharray="4 2"
                              label={{ value: `${inputs.inflationCeilingPct.toFixed(1)}% target`, fontSize: 9, fill: "#22d3ee", position: "insideTopRight" }} />
                            <Line type="monotone" dataKey="inflOr" name={lang === "fr" ? "Scénario" : "Scenario"} stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                            <Line type="monotone" dataKey="inflBase" name={lang === "fr" ? "Sans achats" : "No purchases"} stroke={C.slate} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Chart 3: Reserves + M2 combo */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                            {lang === "fr" ? "Réserves et croissance M2 attribuables aux achats d'or" : "Reserves and M2 growth attributable to gold purchases"}
                          </CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant={m2View === "pct" ? "secondary" : "ghost"} className="h-6 text-[10px] px-2" onClick={() => setM2View("pct")}>% of M2 stock</Button>
                            <Button size="sm" variant={m2View === "abs" ? "secondary" : "ghost"} className="h-6 text-[10px] px-2" onClick={() => setM2View("abs")}>Absolute (CDF bn)</Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <ResponsiveContainer width="100%" height={160}>
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} tickFormatter={v => m2View === "pct" ? `${v.toFixed(1)}%` : v.toLocaleString()} />
                            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} tickFormatter={v => `$${v.toFixed(0)}bn`} />
                            <Tooltip />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                            <Bar yAxisId="l" dataKey={m2View === "pct" ? "m2GrowthPct" : "m2GrowthAbs"} name={m2View === "pct" ? "M2 growth %" : "ΔM2 (CDF bn)"} fill={C.blue} radius={[3, 3, 0, 0]} opacity={0.8} />
                            <Line yAxisId="r" type="monotone" dataKey="resOr" name="Reserves (US$bn)" stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                        {m2View === "pct" && <p className="text-[10px] text-zinc-500 mt-1">{lang === "fr" ? "Pourcentage : croissance M2 attribuable aux achats d'or uniquement" : "Percentage shows M2 growth attributable to gold purchases only"}</p>}
                      </CardContent>
                    </Card>

                    {/* Chart 4: Banking-system liquidity */}
                    <div className="rounded-xl border border-zinc-700/60 overflow-hidden">
                      <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mt-0.5 leading-tight">
                          {lang === "fr" ? "LIQUIDITÉ BANCAIRE / RÉSERVE OBLIGATOIRE ADDITIONNELLE" : "BANKING-SYSTEM LIQUIDITY / ADDITIONAL REQUIRED RESERVE"}
                        </span>
                        <h3 className="text-sm font-bold text-right leading-tight shrink-0 ml-2">
                          {lang === "fr" ? "Où finit la CDF injectée" : "Banking-system liquidity: where the injected CDF ends up"}
                        </h3>
                      </div>
                      <div className="px-3 pb-1">
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={liqData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} tickFormatter={v => (v / 1000).toFixed(1)} />
                            <Tooltip formatter={(v: number) => v.toLocaleString()} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="sterilized"   name={lang === "fr" ? "Délibérément stérilisé" : "Deliberately sterilized"} stackId="a" fill="#c2612a" />
                            <Bar dataKey="addlReserves" name={lang === "fr" ? "Réserves oblig. addl." : "Add'l required reserves"}   stackId="a" fill="#5eead4" />
                            <Bar dataKey="freeLiquidity" name={lang === "fr" ? "Liquidité bancaire libre" : "Free bank liquidity"}    stackId="a" fill="#4ade80" />
                            <Bar dataKey="currency"      name={lang === "fr" ? "Billets en circulation" : "Currency in circulation"}  stackId="a" fill="#67e8f9" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Data table */}
                      <div className="px-4 pb-3">
                        <div className="rounded-lg overflow-x-auto border border-zinc-800/60">
                          <table className="w-full text-xs font-mono whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-zinc-700/60 bg-zinc-900/60">
                                {[
                                  lang === "fr" ? "ANNÉE" : "YEAR",
                                  lang === "fr" ? "INJECTION BRUTE" : "BASE INJECTION",
                                  lang === "fr" ? "STÉRILISÉ" : "STERILIZED",
                                  lang === "fr" ? "RÉSERVES ADDL." : "ADD'L RESERVES",
                                  lang === "fr" ? "LIQUIDITÉ LIBRE" : "FREE LIQUIDITY",
                                  lang === "fr" ? "BILLETS EN CIRC." : "CURRENCY",
                                ].map(h => (
                                  <th key={h} className="text-left text-[10px] uppercase tracking-wide text-zinc-500 px-3 py-1.5 font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {liqData.map((r, i) => (
                                <tr key={r.year} className={cn("border-b border-zinc-800/40 last:border-0", i % 2 === 1 ? "bg-zinc-900/20" : "")}>
                                  <td className="px-3 py-1.5 text-zinc-300">{lang === "fr" ? `Année ${r.yearNum}` : `Year ${r.yearNum}`}</td>
                                  <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.netInjection.toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.sterilized.toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.addlReserves.toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-amber-400 tabular-nums font-semibold">{r.freeLiquidity.toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.currency.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                          {lang === "fr"
                            ? <><strong className="text-zinc-400">La liquidité bancaire libre</strong> correspond aux dépôts que les banques conservent volontairement au-delà du minimum légal — e/(r+e+c) × injection monnaie de base, où e est le curseur « propension aux réserves excédentaires ». Mettez e à 0 % et elle disparaît. <strong className="text-zinc-400">Les réserves obligatoires additionnelles</strong> correspondent à r/(r+e+c) × injection monnaie de base — la tranche réglementaire automatique. Les trois composantes plus les billets en circulation totalisent exactement l'injection de base de l'année.</>
                            : <><strong className="text-zinc-400">Free bank liquidity</strong> is deposits banks voluntarily hold idle beyond the legal minimum — e/(r+e+c) × base-money injection, where e is the &quot;bank excess-reserve propensity&quot; slider. Set e to 0% and this disappears entirely. <strong className="text-zinc-400">Additional required reserves</strong> is r/(r+e+c) × base-money injection — the automatic, regulatory slice. All three pieces plus currency in circulation sum exactly to that year&apos;s base injection.</>}
                        </p>
                      </div>
                    </div>

                    {/* Chart 5: Sensitivity sweep */}
                    {(() => {
                      const inputCfg  = SWEEP_INPUTS_CFG.find(x => x.key === sweepInputKey)!
                      const outCfg    = SWEEP_OUTCOMES_CFG.find(x => x.key === sweepOutcomeKey)!
                      const curX      = (inputs[sweepInputKey] as number) ?? 0
                      const curY      = outCfg ? outCfg.get(metrics) : 0
                      const showTarget  = sweepOutcomeKey === "peakInflation"
                      const showCeiling = sweepOutcomeKey === "peakInflation"
                      const showFloor   = sweepOutcomeKey === "importCover"

                      return (
                        <div className="rounded-xl border border-zinc-700/60 overflow-hidden">
                          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mt-0.5">
                              {lang === "fr" ? "SENSIBILITÉ" : "SENSITIVITY"}
                            </span>
                            <h3 className="text-base font-bold">{lang === "fr" ? "Balayage mono-paramètre" : "Single-input sweep"}</h3>
                          </div>
                          <div className="px-5 pb-2 flex items-end gap-6 flex-wrap">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{lang === "fr" ? "PARAMÈTRE À BALAYER" : "SWEEP THIS INPUT"}</p>
                              <select
                                value={sweepInputKey}
                                onChange={e => setSweepInputKey(e.target.value as keyof SimInputs)}
                                className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500 min-w-48"
                              >
                                {SWEEP_INPUTS_CFG.map(opt => (
                                  <option key={opt.key} value={opt.key}>{lang === "fr" ? opt.fr : opt.en}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{lang === "fr" ? "RÉSULTAT CIBLE" : "AGAINST THIS OUTCOME"}</p>
                              <select
                                value={sweepOutcomeKey}
                                onChange={e => setSweepOutcomeKey(e.target.value)}
                                className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500 min-w-40"
                              >
                                {SWEEP_OUTCOMES_CFG.map(opt => (
                                  <option key={opt.key} value={opt.key}>{lang === "fr" ? opt.fr : opt.en}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="px-3 pb-1">
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={sweepChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="x" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={v => String(v)} />
                                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} width={40} tickFormatter={v => v.toFixed(1)} />
                                <Tooltip formatter={(v: number) => v.toFixed(2)} labelFormatter={v => `${inputCfg ? (lang === "fr" ? inputCfg.fr : inputCfg.en) : ""} = ${v}`} />
                                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                                <Line type="monotone" dataKey="y" name={lang === "fr" ? (outCfg?.fr ?? "") : (outCfg?.en ?? "")} stroke={C.amber} strokeWidth={2} dot={false} />
                                {showTarget && (
                                  <ReferenceLine y={inputs.baseInflationPct} stroke="#22d3ee" strokeDasharray="4 3"
                                    label={{ value: lang === "fr" ? "cible" : "target", fontSize: 9, fill: "#22d3ee", position: "insideTopRight" }} />
                                )}
                                {showCeiling && (
                                  <ReferenceLine y={inputs.inflationCeilingPct} stroke="#f97316" strokeDasharray="4 3"
                                    label={{ value: lang === "fr" ? "plafond" : "ceiling", fontSize: 9, fill: "#f97316", position: "insideTopRight" }} />
                                )}
                                {showFloor && (
                                  <ReferenceLine y={inputs.importCoverFloorMonths} stroke="#f97316" strokeDasharray="4 3"
                                    label={{ value: lang === "fr" ? "plancher" : "floor", fontSize: 9, fill: "#f97316", position: "insideTopRight" }} />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="px-5 pb-4">
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              {lang === "fr"
                                ? <>⊙ Balayage de <strong className="text-zinc-400">{inputCfg?.fr}</strong> contre <strong className="text-zinc-400">{outCfg?.fr}</strong>, tous les autres paramètres étant maintenus fixes. À votre valeur actuelle ({curX.toFixed(curX % 1 === 0 ? 0 : 2)}), {outCfg?.fr} = <strong className="text-amber-400">{curY.toFixed(2)}</strong>. Les tirets indiquent la cible / le seuil d'adéquation le cas échéant.</>
                                : <>⊙ Sweeping <strong className="text-zinc-400">{inputCfg?.en}</strong> against <strong className="text-zinc-400">{outCfg?.en}</strong>, holding every other input fixed. At your current value ({curX.toFixed(curX % 1 === 0 ? 0 : 2)}), {outCfg?.en} = <strong className="text-amber-400">{curY.toFixed(2)}</strong>. Dashed lines mark the target/adequacy threshold where one applies.</>}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </TabsContent>

              {/* ── BALANCE SHEET & FISCAL COST ──────────────────────────── */}
              <TabsContent value="balance">
                {(() => {
                  // Derived balance-sheet metrics
                  const goldHoldUSD = yearN.goldHoldingsUSD
                  const goldSharePct = yearN.goldShareOfReserves * 100
                  const var95 = goldHoldUSD * bsStress.goldVolatilityPct / 100 * 1.645
                  const cumSterilCDF = yearN.cumSterilizationCostCDF
                  const cumSterilUSD = cumSterilCDF / yearN.exchangeRate
                  const budgetHorizon = inputs.annualBudgetCDFbn * inputs.horizonYears
                  const affordabilityPct = (cumSterilCDF / budgetHorizon) * 100
                  const costEffectiveness = goldHoldUSD > 0 ? cumSterilCDF / goldHoldUSD : 0
                  const isAffordable = affordabilityPct <= bsStress.maxCostPctBudget
                  const stressMtm = [
                    { shock: -30, label: "-30% gold price" },
                    { shock: -20, label: "-20% gold price" },
                    { shock: -10, label: "-10% gold price" },
                  ].map(s => ({
                    ...s,
                    lossUSD: goldHoldUSD * Math.abs(s.shock) / 100,
                    lossPctReserves: (goldHoldUSD * Math.abs(s.shock) / 100) / yearN.reserves * 100,
                  }))

                  return (
                    <div className="flex gap-4 items-start">
                      {/* ── Left: Stress Parameters panel ── */}
                      <div className="w-64 shrink-0 border border-zinc-700/60 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-700/60 bg-zinc-900/60">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                            {lang === "fr" ? "PARAMÈTRES DE STRESS" : "STRESS PARAMETERS"}
                          </p>
                          <p className="text-sm font-semibold text-white mt-0.5">
                            {lang === "fr" ? "Risque bilan — paramètres" : "Balance-sheet risk inputs"}
                          </p>
                        </div>
                        <div className="px-4 pb-4">
                          <SliderRow
                            label={lang === "fr" ? "Volatilité annuelle du prix de l'or" : "Assumed annualized gold-price volatility"}
                            displayValue={`${bsStress.goldVolatilityPct.toFixed(0)}%`}
                            value={bsStress.goldVolatilityPct}
                            onChange={v => setBsStress(s => ({ ...s, goldVolatilityPct: v }))}
                            min={5} max={40} step={1}
                          />
                          <SliderRow
                            label={lang === "fr" ? "Budget national illustratif" : "Illustrative national budget"}
                            displayValue={`${inputs.annualBudgetCDFbn.toLocaleString()} bn CDF`}
                            value={inputs.annualBudgetCDFbn}
                            onChange={v => update("annualBudgetCDFbn", v)}
                            min={5000} max={50000} step={500}
                          />
                          <div className="mt-4 mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                              {lang === "fr" ? "CONTRAINTES D'ADMISSIBILITÉ" : "POLICY CONSTRAINTS (ADMISSIBILITY)"}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                              {lang === "fr"
                                ? "Seuils indicatifs — non officiels. Appliqués uniformément à chaque scénario pour signaler les cas admissibles."
                                : "Illustrative placeholders — not official BCC thresholds. Applied uniformly to every scenario to flag which are admissible."}
                            </p>
                          </div>
                          <SliderRow
                            label={lang === "fr" ? "Inflation pic max acceptable" : "Max acceptable peak inflation"}
                            displayValue={`${bsStress.maxInflPct.toFixed(1)}%`}
                            value={bsStress.maxInflPct}
                            onChange={v => setBsStress(s => ({ ...s, maxInflPct: v }))}
                            min={3} max={30} step={0.5}
                          />
                          <SliderRow
                            label={lang === "fr" ? "Plancher adéquation réserves" : "Reserve-adequacy floor"}
                            displayValue={`${bsStress.importCoverFloor.toFixed(1)} months`}
                            value={bsStress.importCoverFloor}
                            onChange={v => setBsStress(s => ({ ...s, importCoverFloor: v }))}
                            min={1} max={6} step={0.5}
                          />
                          <SliderRow
                            label={lang === "fr" ? "Coût cumulé max (% budget)" : "Max cumulative cost (% of budget)"}
                            displayValue={`${bsStress.maxCostPctBudget.toFixed(1)}%`}
                            value={bsStress.maxCostPctBudget}
                            onChange={v => setBsStress(s => ({ ...s, maxCostPctBudget: v }))}
                            min={1} max={20} step={0.5}
                          />
                        </div>
                      </div>

                      {/* ── Right: Metrics + Stress test + Charts ── */}
                      <div className="flex-1 min-w-0 space-y-4">
                        {/* 6 metric cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <SimMetricCard
                            label={lang === "fr" ? `Avoirs en or cumulés, an ${inputs.horizonYears}` : `Cumulative gold holdings, year ${inputs.horizonYears}`}
                            value={`US$${goldHoldUSD.toFixed(2)}bn`}
                            ok
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Part de l'or dans les réserves" : "Gold as share of reserves"}
                            value={`${goldSharePct.toFixed(1)}%`}
                            sub={lang === "fr" ? "10–15 % est une fourchette usuelle pour les pays émergents" : "10–15% is a common EM policy band"}
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "VaR 95 % à 1 an sur le stock d'or" : "1-yr 95% Value-at-Risk on gold stock"}
                            value={`US$${var95.toFixed(2)}bn`}
                            badgeText="MODEL-DEPENDENT"
                            fail={var95 > goldHoldUSD * 0.35}
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Coût de stérilisation cumulé" : "Cumulative sterilization cost"}
                            value={`${Math.round(cumSterilCDF).toLocaleString()} bn CDF`}
                            sub={`US$${cumSterilUSD.toFixed(2)}bn equivalent`}
                            fail={!isAffordable}
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Abordabilité : coût vs. budget" : "Affordability: cost vs. budget"}
                            value={`${affordabilityPct.toFixed(1)}%`}
                            sub={lang === "fr"
                              ? `Coût stéril. cumulé sur ${inputs.horizonYears} an${inputs.horizonYears > 1 ? "s" : ""}, en % de budget × ${inputs.horizonYears} · ${isAffordable ? "dans" : "au-dessus du"} plafond de ${bsStress.maxCostPctBudget.toFixed(1)}%`
                              : `Cumulative sterilization cost over ${inputs.horizonYears} yr, as % of budget × ${inputs.horizonYears} · ${isAffordable ? "within" : "over"} ${bsStress.maxCostPctBudget.toFixed(1)}% ceiling`}
                            ok={isAffordable} fail={!isAffordable}
                          />
                          <SimMetricCard
                            label={lang === "fr" ? "Efficacité-coût" : "Cost-effectiveness"}
                            value={`${Math.round(costEffectiveness).toLocaleString()} bn CDF`}
                            sub={lang === "fr" ? "Coût stéril. par Md USD de réserves ajoutées" : "Sterilization cost per US$bn of reserves added"}
                            badgeText="MODEL-DEPENDENT"
                          />
                        </div>

                        {/* Mark-to-market stress test */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">
                            {lang === "fr" ? "Test de résistance mark-to-market sur les avoirs en or cumulés" : "Mark-to-market stress test on cumulative gold holdings"}
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            {stressMtm.map(s => (
                              <Card key={s.shock} className="border-zinc-700/60">
                                <CardContent className="pt-4 pb-4 px-4">
                                  <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                                  <p className="text-xl font-bold text-amber-400 tabular-nums">
                                    −US${s.lossUSD.toFixed(2)}bn
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {s.lossPctReserves.toFixed(1)}% {lang === "fr" ? "des réserves brutes" : "of gross reserves"}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>

                        {/* Chart 1: Quasi-fiscal cost by year */}
                        <Card>
                          <CardHeader className="pb-0 pt-4">
                            <CardTitle className="text-sm font-semibold">
                              {lang === "fr" ? "Coût quasi-fiscal de stérilisation, par année" : "Quasi-fiscal cost of sterilization, by year"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <ResponsiveContainer width="100%" height={220}>
                              <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} width={46} />
                                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} width={46} />
                                <Tooltip />
                                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                <Bar yAxisId="l" dataKey="sterilAnn" name={lang === "fr" ? "Coût stéril. (CDF bn)" : "Sterilization cost (CDF bn)"} fill="#c2612a" radius={[3, 3, 0, 0]} />
                                <Line yAxisId="r" type="monotone" dataKey="sterilCum" name={lang === "fr" ? "Coût cumulé (CDF bn)" : "Cumulative cost (CDF bn)"} stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                            <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                              {lang === "fr"
                                ? "⊙ Le coût de stérilisation est l'intérêt que la BCC verse sur les bons/obligations pour absorber la CDF émise pour les achats d'or."
                                : "⊙ Sterilization cost is the interest the BCC pays on bills/bonds to absorb the CDF issued for gold purchases."}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Chart 2: Gold holdings vs. reserve composition */}
                        <Card>
                          <CardHeader className="pb-0 pt-4">
                            <CardTitle className="text-sm font-semibold">
                              {lang === "fr" ? "Avoirs en or vs. composition des réserves" : "Gold holdings vs. reserve composition"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <ResponsiveContainer width="100%" height={220}>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={46} tickFormatter={v => `${v}`} />
                                <Tooltip />
                                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                <Line type="monotone" dataKey="goldHoldUSD" name={lang === "fr" ? "Avoirs en or (US$bn)" : "Gold holdings (US$bn)"} stroke={C.amber} strokeWidth={2} dot={{ r: 4, fill: C.amber }} />
                                <Line type="monotone" dataKey="resOr" name={lang === "fr" ? "Réserves (US$bn)" : "Reserves (US$bn)"} stroke="#22d3ee" strokeWidth={2} dot={{ r: 4, fill: "#22d3ee" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )
                })()}
              </TabsContent>

              {/* ── HISTORICAL CONTEXT ────────────────────────────────────── */}
              <TabsContent value="history" className="space-y-4">
                {/* Top row: two charts */}
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  {/* Left: CDF/USD and Inflation dual-axis */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mt-0.5 shrink-0">
                        {lang === "fr" ? "RECONSTRUIT, ILLUSTRATIF" : "RECONSTRUCTED, ILLUSTRATIVE"}
                      </span>
                      <h3 className="text-base font-bold text-right leading-tight">
                        {lang === "fr" ? "CDF/USD et inflation, 2024–2026" : "CDF/USD and inflation, 2024–2026"}
                      </h3>
                    </div>
                    <div className="px-3 pb-2">
                      <ResponsiveContainer width="100%" height={230}>
                        <ComposedChart data={HIST} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} angle={-20} textAnchor="end" height={36} />
                          <YAxis yAxisId="l" tick={{ fontSize: 9, fill: "#94a3b8" }} width={42} tickFormatter={v => v.toLocaleString()} />
                          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: "#94a3b8" }} width={32} tickFormatter={v => `${v}`} />
                          <Tooltip />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          <Line yAxisId="l" type="monotone" dataKey="cdfUsd" name={lang === "fr" ? "CDF par USD" : "CDF per USD"} stroke={C.amber} strokeWidth={2} dot={{ r: 4, fill: C.amber }} />
                          <Line yAxisId="r" type="monotone" dataKey="inflYoY" name={lang === "fr" ? "Inflation a/a %" : "Inflation y/y %"} stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: "#f97316" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-5 pb-4">
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        {lang === "fr"
                          ? "⊙ Les points sont reconstitués à partir de communiqués datés de la BCC et de la couverture presse, et ne constituent pas une série officielle continue."
                          : "⊙ Points are reconstructed from dated BCC communiqués and press coverage, not a continuous official series."}
                      </p>
                    </div>
                  </div>

                  {/* Right: Reserves + Policy rate + data table */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mt-0.5 shrink-0">
                        {lang === "fr" ? "RECONSTRUIT, ILLUSTRATIF" : "RECONSTRUCTED, ILLUSTRATIVE"}
                      </span>
                      <h3 className="text-base font-bold text-right leading-tight">
                        {lang === "fr" ? "Taux directeur et réserves, 2024–2026" : "Policy rate and reserves, 2024–2026"}
                      </h3>
                    </div>
                    <div className="px-3 pb-2">
                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={HIST} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} angle={-20} textAnchor="end" height={36} />
                          <YAxis yAxisId="l" tick={{ fontSize: 9, fill: "#94a3b8" }} width={36} tickFormatter={v => `${v}`} />
                          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: "#94a3b8" }} width={34} tickFormatter={v => `${v}`} />
                          <Tooltip />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          <Bar yAxisId="r" dataKey="reservesUSD" name={lang === "fr" ? "Réserves (Md USD)" : "Reserves (US$bn)"} fill="#5eead4" opacity={0.85} radius={[2, 2, 0, 0]} />
                          <Line yAxisId="l" type="monotone" dataKey="policyRate" name={lang === "fr" ? "Taux directeur %" : "Policy rate %"} stroke="#ffffff" strokeWidth={2} dot={{ r: 4, fill: "#ffffff" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Data table */}
                    <div className="px-4 pb-4">
                      <div className="rounded-lg overflow-hidden border border-zinc-800/60">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-b border-zinc-700/60 bg-zinc-900/60">
                              {["DATE", "CDF/USD", lang === "fr" ? "INFL. A/A" : "INFLATION Y/Y", lang === "fr" ? "TAUX DIR." : "POLICY RATE", lang === "fr" ? "RÉSERVES" : "RESERVES"].map(h => (
                                <th key={h} className="text-left text-[10px] uppercase tracking-wide text-zinc-500 px-3 py-2 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {HIST.map((r, i) => (
                              <tr key={r.date} className={cn("border-b border-zinc-800/40 last:border-0", i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20")}>
                                <td className="px-3 py-1.5 text-zinc-300 whitespace-nowrap">{r.date}</td>
                                <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.cdfUsd.toLocaleString()}</td>
                                <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.inflYoY.toFixed(1)}%</td>
                                <td className="px-3 py-1.5 text-zinc-200 tabular-nums">{r.policyRate.toFixed(1)}%</td>
                                <td className="px-3 py-1.5 text-zinc-200 tabular-nums">${r.reservesUSD.toFixed(1)}bn</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Timeline */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-0.5">
                      {lang === "fr" ? "CHRONOLOGIE" : "TIMELINE"}
                    </span>
                    <h3 className="text-xl font-bold text-right">
                      {lang === "fr" ? "Jalons du programme d'or monétaire" : "Gold-reserve programme milestones"}
                    </h3>
                  </div>
                  <div className="px-6 pb-6 space-y-4">
                    {MILESTONES.map(m => (
                      <div key={m.date} className="flex items-start gap-4">
                        <span className="text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap mt-0.5 min-w-[90px]">{m.date}</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {lang === "fr" ? m.fr : m.en}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── METHODOLOGY ──────────────────────────────────────────── */}
              <TabsContent value="methodology" className="space-y-4">
                {/* Top row: Model identities + Channel interpretation */}
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  {/* Left: Core identities */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-1">
                        {lang === "fr" ? "MODÈLE" : "MODEL"}
                      </span>
                      <h2 className="text-xl font-bold text-right">{lang === "fr" ? "Identités du modèle" : "Core identities"}</h2>
                    </div>
                    <div className="mx-5 mb-5 rounded-lg border border-zinc-700/60 bg-zinc-950/60 px-5 py-4">
                      <pre className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">{lang === "fr" ? `Valeur or (US$) = tonnes × 32 150,7466 oz/t × prix par oz
Valeur or (CDF) = Valeur or (US$) × taux de change

Injection monnaie de base = Valeur or (CDF) × (1 − part stérilisée)
Multiplicateur m           = (1 + ratio billets) / (rés. obl. + rés. excéd.
                             + ratio billets)
ΔM2 (achat)               = Injection monnaie de base × m

Impact inflation  = élasticité croissance M2 × (ΔM2 / stock M2)
                  + pass-through FX × max(0, variation nette FX)

Variation nette FX (%) = pression dépréciation (fuite liquidités)
                       − offset confiance réserves

ΔRéserves brutes   = Valeur or (US$) − offset intervention BCC

Coût stérilisation = stock stérilisé cumulé (CDF) × taux stéril.
VaR 95 % 1 an      = avoirs or cumulés × volatilité prix × 1,645` : `Gold value (US$) = tonnes × 32,150.7466 oz/t × price per oz
Gold value (CDF) = Gold value (US$) × exchange rate

Base-money injection = Gold value (CDF) × (1 − sterilized share)
Money multiplier m   = (1 + currency ratio) / (reserve req. + excess-reserve
                       propensity + currency ratio)
ΔM2 (from purchase)  = Base-money injection × m

Inflation impact    = money-growth elasticity × (ΔM2 / M2 stock)
                    + FX pass-through × max(0, net FX change)

Net FX change (%)   = leakage-driven depreciation pressure
                    − reserve-confidence appreciation offset

ΔGross reserves     = Gold value (US$) − BCC FX intervention offset

Sterilization cost  = cumulative sterilized stock (CDF) × sterilization rate
1yr 95% VaR (gold)  = cumulative gold holdings × price volatility × 1.645`}</pre>
                    </div>
                  </div>

                  {/* Right: Channel interpretation */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-1">
                        {lang === "fr" ? "INTERPRÉTATION" : "INTERPRETATION"}
                      </span>
                      <h2 className="text-xl font-bold text-right">{lang === "fr" ? "Ce que représente chaque canal" : "What each channel represents"}</h2>
                    </div>
                    <div className="px-6 pb-6 space-y-4 text-sm text-muted-foreground">
                      {(lang === "fr" ? [
                        { bold: "Agrégats monétaires & liquidité.", rest: " Payer les mineurs artisanaux en CDF nouvellement émise élargit directement la monnaie de base, et la monnaie large via le multiplicateur de dépôts, sauf si compensé par la stérilisation." },
                        { bold: "Pureté de l'or.", rest: " Le tonnage entré est converti en équivalent or fin via le curseur de finesse avant la valorisation — l'or artisanal/doré dépasse rarement 99,9 % de pureté, donc si les tonnages reportés correspondent à un poids brut (avant affinage) plutôt qu'au contenu fin, cette correction est significative pour le coût en dollars." },
                        { bold: "Inflation.", rest: " Un pass-through en forme réduite depuis la croissance monétaire excédentaire et la dépréciation du change — des points de départ illustratifs, pas des coefficients estimés." },
                        { bold: "Taux de change.", rest: " Deux forces antagonistes : la fuite de liquidités vers la demande de devises pousse la CDF à la baisse ; le bénéfice lié à l'adéquation des réserves la pousse à la hausse. Le signe net est genuinement ambigu." },
                        { bold: "Réserves.", rest: " Comme l'or est acheté avec de la CDF créée en interne, les réserves brutes augmentent essentiellement « gratuitement » en termes de devises — sauf si la BCC vend des dollars pour défendre la monnaie." },
                        { bold: "Risque au bilan.", rest: " L'or est un actif évalué en mark-to-market ; une correction de prix se traduit par une perte de valorisation." },
                        { bold: "Coût quasi-fiscal.", rest: " Les intérêts versés sur les instruments de stérilisation constituent un véritable coût de portage du programme." },
                      ] : [
                        { bold: "Monetary aggregates & liquidity.", rest: " Paying artisanal miners in newly issued CDF expands the monetary base directly, and broad money via the deposit multiplier, unless offset by sterilization." },
                        { bold: "Gold purity.", rest: " Tonnage entered is converted to fine-gold-equivalent via the fineness slider before pricing — artisanal/doré gold is rarely 99.9% pure, so if reported tonnages are gross (pre-refining) weight rather than fine content, this correction matters materially to the dollar cost." },
                        { bold: "Inflation.", rest: " A reduced-form pass-through from excess money growth and exchange-rate depreciation — illustrative starting points, not estimated coefficients." },
                        { bold: "Exchange rate.", rest: " Two offsetting forces: liquidity leakage into FX demand pushes the CDF down; the reserve-adequacy benefit pushes it up. The net sign is genuinely ambiguous." },
                        { bold: "Reserves.", rest: ` Because gold is bought with domestically created CDF, gross reserves rise essentially "for free" in FX terms — unless the BCC sells dollars to defend the currency.` },
                        { bold: "Balance-sheet risk.", rest: " Gold is a mark-to-market asset; a price correction shows up as a valuation loss." },
                        { bold: "Quasi-fiscal cost.", rest: " The interest paid on sterilization instruments is a real carrying cost of the programme." },
                      ]).map(item => (
                        <p key={item.bold} className="leading-relaxed">
                          <strong className="font-semibold text-foreground">{item.bold}</strong>
                          {item.rest}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom: Data sources */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-1">
                      {lang === "fr" ? "SOURCES DE DONNÉES" : "DATA SOURCES"}
                    </span>
                    <h2 className="text-xl font-bold text-right">{lang === "fr" ? "Références de calibration" : "Calibration references"}</h2>
                  </div>
                  <div className="px-6 pb-5">
                    <div className="grid md:grid-cols-2 gap-x-10 gap-y-1.5">
                      {(lang === "fr" ? [
                        "BCC, taux de change indicatif et publications sur les taux directeurs (bcc.cd), janv.–juil. 2026.",
                        "Reuters / Bloomberg, couverture de l'accord BCC–DRC Gold Trading SA, 19–20 fév. 2026.",
                        "Agence Ecofin, volumes d'achat d'or, production artisanale et coût estimé du programme, 2026.",
                        "Zoom Eco, bulletins hebdomadaires sur les réserves internationales de la BCC, fév.–juin 2026.",
                        "FMI, Perspectives de l'économie mondiale (avril 2026) et rapports du personnel sur la RDC.",
                        "Actualite.cd / Radio Okapi / MediaCongo, communiqués du Comité de Politique Monétaire, 2026.",
                      ] : [
                        "BCC, indicative exchange rate and policy-rate publications (bcc.cd), Jan–Jul 2026.",
                        "Reuters / Bloomberg, coverage of the BCC–DRC Gold Trading SA agreement, 19–20 Feb 2026.",
                        "Agence Ecofin, on gold-purchase volumes, artisanal production and estimated programme cost, 2026.",
                        "Zoom Eco, weekly BCC international-reserves bulletins, Feb–Jun 2026.",
                        "IMF, World Economic Outlook (April 2026) and staff reporting on the DRC.",
                        "Actualite.cd / Radio Okapi / MediaCongo, Comité de Politique Monétaire communiqués, 2026.",
                      ]).map(src => (
                        <div key={src} className="flex items-start gap-2 text-sm text-muted-foreground py-0.5">
                          <span className="text-amber-500/60 shrink-0 mt-0.5">•</span>
                          <span className="leading-relaxed">{src}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-4" />
                    <p className="text-xs text-muted-foreground/50 leading-relaxed">
                      {lang === "fr"
                        ? "⊙ Les chiffres non publiés directement (ratio M2/PIB, ratio billets/dépôts, toutes les élasticités de pass-through) sont des hypothèses transparentes et modifiables dans l'onglet Simulateur."
                        : "⊙ Figures not directly published (M2/GDP ratio, currency-to-deposit ratio, every pass-through elasticity) are transparent, editable assumptions in the Simulator tab."}
                    </p>
                  </div>
                </div>
              </TabsContent>

            </Tabs>
          </main>
        </div>
      </div>

      {/* ── Scenario Library Dialog ──────────────────────────────────────── */}
      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

      <Dialog open={showLibrary} onOpenChange={open => { setShowLibrary(open); if (!open) setLibSearch("") }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1">
              {lang === "fr" ? "BIBLIOTHÈQUE DE SCÉNARIOS" : "SCENARIO LIBRARY"}
            </p>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">{lang === "fr" ? "Scénarios sauvegardés" : "Saved scenarios"}</h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setShowLibrary(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2.5 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-4 py-3 text-sm text-muted-foreground">
              <span className="text-amber-400/70 shrink-0 mt-px">⊙</span>
              <p className="leading-relaxed text-xs">
                {lang === "fr"
                  ? <>Les scénarios sont enregistrés dans ce navigateur uniquement (pas sur un serveur) et sont partagés entre les onglets de ce navigateur. Effacer les données du navigateur les supprime. Utilisez <strong className="text-foreground">Exporter</strong> pour les sauvegarder ou les transférer vers un autre appareil.</>
                  : <>Scenarios are saved in this browser only (not on a server), and are shared across tabs of this browser. Clearing browser data deletes them. Use <strong className="text-foreground">Export</strong> to back them up or move them to another device.</>}
              </p>
            </div>

            {/* Analyst name */}
            <div className="flex items-center gap-3">
              <Label className="text-sm text-amber-400 shrink-0">{lang === "fr" ? "Analyste" : "Analyst"}</Label>
              <Input
                value={analystName}
                onChange={e => setAnalystName(e.target.value)}
                placeholder={lang === "fr" ? "Votre nom (horodaté sur la piste d'audit)" : "Your name (stamped on the audit trail)"}
                className="h-8 text-sm flex-1"
              />
            </div>

            {/* Search + Export/Import */}
            <div className="flex items-center gap-2">
              <Input
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                placeholder={lang === "fr" ? "Rechercher par nom, description ou tag…" : "Search by name, description, or tag..."}
                className="h-9 text-sm flex-1"
              />
              <Button variant="outline" size="sm" className="h-9 px-4 shrink-0 font-semibold" onClick={handleExport} disabled={scenarios.length === 0}>
                {lang === "fr" ? "Exporter" : "Export"}
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-4 shrink-0 font-semibold" onClick={() => importFileRef.current?.click()}>
                {lang === "fr" ? "Importer" : "Import"}
              </Button>
            </div>

            {/* Show archived checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="lib-archived"
                type="checkbox"
                checked={showArchived}
                onChange={e => setShowArchived(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-amber-500"
              />
              <Label htmlFor="lib-archived" className="text-sm cursor-pointer">
                {lang === "fr" ? "Afficher les scénarios archivés" : "Show archived scenarios"}
              </Label>
            </div>

            {/* Scenario list or empty state */}
            {filteredScenarios.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {libSearch
                    ? (lang === "fr" ? "Aucun scénario ne correspond à votre recherche." : "No scenarios match your search.")
                    : (lang === "fr" ? "Aucun scénario sauvegardé pour l'instant." : "No saved scenarios yet.")}
                </p>
                {!libSearch && (
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {lang === "fr"
                      ? <>Configurez les paramètres dans l'onglet Simulateur et cliquez <strong>Enregistrer</strong>, ou <strong>Importez</strong> un fichier de bibliothèque ci-dessus.</>
                      : <>Configure inputs in the Scenario Simulator tab and click <strong>Save</strong>, or <strong>Import</strong> a library file above.</>}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredScenarios.map(s => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/20",
                      activeScenario?.id === s.id ? "border-amber-500/50 bg-amber-950/10" : "border-border"
                    )}
                    onClick={() => handleLoad(s)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        {s.status === "archived" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-zinc-500 border-zinc-600">{lang === "fr" ? "archivé" : "archived"}</Badge>
                        )}
                        {activeScenario?.id === s.id && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-400 border-amber-500/40">{lang === "fr" ? "actif" : "active"}</Badge>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>}
                      <p className="text-xs text-muted-foreground/50 mt-0.5">
                        {lang === "fr" ? "Modifié" : "Updated"}: {new Date(s.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs px-2 text-zinc-400 hover:text-zinc-200"
                        onClick={() => {
                          const n = `${s.name} (copy)`
                          doSave(n, s.description, undefined)
                          addToast(`"${n}" duplicated.`)
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/60 shrink-0 flex justify-end">
            <Button variant="outline" className="px-6 font-semibold" onClick={() => setShowLibrary(false)}>
              {lang === "fr" ? "Fermer" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!showSaveDialog} onOpenChange={() => setShowSaveDialog(null)}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle className="text-lg font-bold">
              {showSaveDialog === "saveas"
                ? (lang === "fr" ? "Enregistrer sous un nouveau scénario" : "Save as new scenario")
                : (lang === "fr" ? "Enregistrer le scénario" : "Save scenario")}
            </DialogTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setShowSaveDialog(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{lang === "fr" ? "Nom" : "Name"}</Label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder={lang === "fr" ? "ex. 50 % stérilisé — scénario de base juil. 2026" : "e.g. 50% sterilized — Jul 2026 base case"}
                className="h-10 text-sm focus-visible:ring-amber-500 focus-visible:border-amber-500"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    doSave(saveName, saveDesc, showSaveDialog === "save" ? activeScenario?.id : undefined, saveTags)
                    setShowSaveDialog(null)
                  }
                }}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {lang === "fr" ? "Description" : "Description"}
                <span className="text-muted-foreground font-normal ml-1">({lang === "fr" ? "optionnel" : "optional"})</span>
              </Label>
              <Textarea
                value={saveDesc}
                onChange={e => setSaveDesc(e.target.value)}
                placeholder={lang === "fr" ? "Une brève note sur ce que représente ce scénario" : "A short note on what this scenario represents"}
                className="text-sm resize-none focus-visible:ring-amber-500 focus-visible:border-amber-500"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {lang === "fr" ? "Tags" : "Tags"}
                <span className="text-muted-foreground font-normal ml-1">({lang === "fr" ? "optionnel, séparés par des virgules" : "optional, comma-separated"})</span>
              </Label>
              <Input
                value={saveTags}
                onChange={e => setSaveTags(e.target.value)}
                placeholder={lang === "fr" ? "cas de base, 50pct-sterilise" : "base case, 50pct-sterilized"}
                className="h-10 text-sm focus-visible:ring-amber-500 focus-visible:border-amber-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60">
            <Button variant="outline" className="px-5 font-semibold" onClick={() => setShowSaveDialog(null)}>
              {lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              className="px-5 font-semibold bg-amber-600 hover:bg-amber-700 text-black"
              onClick={() => {
                doSave(saveName, saveDesc, showSaveDialog === "save" ? activeScenario?.id : undefined, saveTags)
                setShowSaveDialog(null)
              }}
            >
              {lang === "fr" ? "Enregistrer" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!showConfirm} onOpenChange={() => setShowConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{lang === "fr" ? "Confirmer" : "Confirm"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{showConfirm?.msg}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(null)}>{lang === "fr" ? "Annuler" : "Cancel"}</Button>
            <Button variant="destructive" onClick={() => { showConfirm?.onOk(); setShowConfirm(null) }}>
              {lang === "fr" ? "Confirmer" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast notifications ──────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm border pointer-events-auto",
            t.type === "success" && "bg-emerald-950 border-emerald-800 text-emerald-200",
            t.type === "error"   && "bg-red-950 border-red-800 text-red-200",
            t.type === "info"    && "bg-zinc-900 border-zinc-700 text-zinc-200",
          )}>
            {t.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {t.type === "error"   && <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Suppress unused var warnings */}
      {compareMetrics && showCompare && compareId && <span className="hidden" />}
    </SidebarProvider>
  )
}
