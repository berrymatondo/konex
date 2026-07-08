"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, Download, FileSpreadsheet,
  CheckCircle2, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CurveId = "xau-deposit" | "sofr-ois" | "xau-forward" | "us-treasury" | "copper" | "fx-forward" | "gold-vol";
type ViewMode = "individual" | "normalized";
type PriceMode = "bid" | "mid" | "ask";
type CompareRef = "j1" | "j7" | "month";

interface CurvePoint {
  label: string;
  short: string;
  bid: number;
  mid: number;
  ask: number;
  prev: number;
  varD1: number;
  varW: number;
}

interface CurveConfig {
  id: CurveId;
  tabLabel: string;
  pageTitle: string;
  unit: string;
  convention?: string;
  varUnit: string;
  decimals: number;
  summaryLabel: string;
  summaryValue: string;
  summaryChange: string;
  summaryPositive: boolean;
  points: CurvePoint[];
  spotLabel: string;
  spotValue: string;
  slopeLabel: string;
  slopeValue: string;
  slopePositive: boolean;
  highPoint: string;
  lowPoint: string;
  shape: string;
  comment: string;
  regime: string;
  regimeTone: "favorable" | "warning" | "unfavorable";
}

// ─── Palette (2-series: identity, not magnitude) ──────────────────────────────
// Amber (#f59e0b) for current — warm, ties to gold theme
// Blue  (#60a5fa) for comparison — cool, distinct under CVD (tritan + deutan safe)
const C_CURRENT = "#f59e0b";
const C_PREV    = "#60a5fa";

// ─── Static data ──────────────────────────────────────────────────────────────

const CURVES: CurveConfig[] = [
  {
    id: "xau-deposit",
    tabLabel: "XAU Deposit",
    pageTitle: "XAU Deposit",
    unit: "% par an",
    convention: "Convention métal 360 jours",
    varUnit: "pb",
    decimals: 2,
    summaryLabel: "XAU Deposit 3M",
    summaryValue: "1,42 %",
    summaryChange: "+3 pb",
    summaryPositive: true,
    points: [
      { label: "Overnight",  short: "O/N", bid: 0.42, mid: 0.45, ask: 0.48, prev: 0.43, varD1: 1,  varW: 2  },
      { label: "1 semaine",  short: "1W",  bid: 0.54, mid: 0.58, ask: 0.62, prev: 0.55, varD1: 1,  varW: 3  },
      { label: "1 mois",     short: "1M",  bid: 0.78, mid: 0.82, ask: 0.86, prev: 0.77, varD1: 2,  varW: 5  },
      { label: "3 mois",     short: "3M",  bid: 1.38, mid: 1.42, ask: 1.46, prev: 1.35, varD1: 3,  varW: 7  },
      { label: "6 mois",     short: "6M",  bid: 1.66, mid: 1.71, ask: 1.76, prev: 1.62, varD1: 4,  varW: 9  },
      { label: "12 mois",    short: "12M", bid: 1.89, mid: 1.95, ask: 2.01, prev: 1.78, varD1: 5,  varW: 12 },
    ],
    spotLabel: "Taux 3M", spotValue: "1,42 %",
    slopeLabel: "Pente O/N–12M", slopeValue: "+150 pb", slopePositive: true,
    highPoint: "12M · 1,95 %", lowPoint: "O/N · 0,45 %",
    shape: "Ascendante",
    comment: "Le rendement offert augmente avec la maturité. La courbe indique une rémunération supérieure sur les placements d'or à 6–12 mois.",
    regime: "Contango modéré", regimeTone: "warning",
  },
  {
    id: "sofr-ois",
    tabLabel: "SOFR/OIS",
    pageTitle: "USD SOFR/OIS",
    unit: "% par an",
    varUnit: "pb",
    decimals: 2,
    summaryLabel: "USD SOFR/OIS 3M",
    summaryValue: "5,32 %",
    summaryChange: "-2 pb",
    summaryPositive: false,
    points: [
      { label: "Overnight", short: "O/N", bid: 5.30, mid: 5.32, ask: 5.34, prev: 5.35, varD1: -1, varW: -2 },
      { label: "1 mois",    short: "1M",  bid: 5.26, mid: 5.28, ask: 5.30, prev: 5.31, varD1: -1, varW: -3 },
      { label: "3 mois",    short: "3M",  bid: 5.20, mid: 5.22, ask: 5.24, prev: 5.25, varD1: -1, varW: -3 },
      { label: "6 mois",    short: "6M",  bid: 5.13, mid: 5.15, ask: 5.17, prev: 5.18, varD1: -2, varW: -3 },
      { label: "1 an",      short: "1Y",  bid: 4.93, mid: 4.95, ask: 4.97, prev: 4.98, varD1: -2, varW: -3 },
      { label: "2 ans",     short: "2Y",  bid: 4.69, mid: 4.71, ask: 4.73, prev: 4.75, varD1: -2, varW: -4 },
      { label: "5 ans",     short: "5Y",  bid: 4.50, mid: 4.52, ask: 4.54, prev: 4.55, varD1: -1, varW: -3 },
      { label: "10 ans",    short: "10Y", bid: 4.46, mid: 4.48, ask: 4.50, prev: 4.51, varD1: -1, varW: -3 },
    ],
    spotLabel: "Taux O/N", spotValue: "5,32 %",
    slopeLabel: "Pente O/N–10Y", slopeValue: "-84 pb", slopePositive: false,
    highPoint: "O/N · 5,32 %", lowPoint: "10Y · 4,48 %",
    shape: "Inversée",
    comment: "Taux courts supérieurs aux taux longs. L'inversion signale des anticipations de baisse des taux directeurs de la Fed.",
    regime: "Inversion 2Y–10Y", regimeTone: "unfavorable",
  },
  {
    id: "xau-forward",
    tabLabel: "XAU/USD Forward",
    pageTitle: "XAU/USD Forward",
    unit: "USD/oz",
    varUnit: "%",
    decimals: 2,
    summaryLabel: "XAU/USD Forward 3M",
    summaryValue: "2 384,70",
    summaryChange: "+0,18 %",
    summaryPositive: true,
    points: [
      { label: "Spot",    short: "Spot", bid: 2344.80, mid: 2345.60, ask: 2346.40, prev: 2327.20, varD1: 0.79, varW: 0.79 },
      { label: "1 mois",  short: "1M",   bid: 2353.40, mid: 2354.20, ask: 2355.00, prev: 2335.80, varD1: 0.19, varW: 0.79 },
      { label: "3 mois",  short: "3M",   bid: 2383.90, mid: 2384.70, ask: 2385.50, prev: 2365.40, varD1: 0.18, varW: 0.81 },
      { label: "6 mois",  short: "6M",   bid: 2417.50, mid: 2418.30, ask: 2419.10, prev: 2398.60, varD1: 0.17, varW: 0.82 },
      { label: "9 mois",  short: "9M",   bid: 2448.10, mid: 2448.90, ask: 2449.70, prev: 2428.80, varD1: 0.16, varW: 0.83 },
      { label: "12 mois", short: "12M",  bid: 2475.70, mid: 2476.50, ask: 2477.30, prev: 2456.10, varD1: 0.15, varW: 0.83 },
    ],
    spotLabel: "Prix Spot", spotValue: "2 345,60 USD/oz",
    slopeLabel: "Forward points 12M", slopeValue: "+130,9 USD", slopePositive: true,
    highPoint: "12M · 2 476,50", lowPoint: "Spot · 2 345,60",
    shape: "Contango",
    comment: "Le marché XAU/USD est en contango modéré. Le prix à terme excède le spot, reflétant le différentiel de taux USD/XAU.",
    regime: "Contango modéré", regimeTone: "warning",
  },
  {
    id: "us-treasury",
    tabLabel: "US Treasury",
    pageTitle: "US Treasury Yield Curve",
    unit: "Rendement annuel en %",
    varUnit: "pb",
    decimals: 2,
    summaryLabel: "US Treasury 2Y",
    summaryValue: "4,71 %",
    summaryChange: "-4 pb",
    summaryPositive: false,
    points: [
      { label: "1 mois",  short: "1M",  bid: 5.40, mid: 5.42, ask: 5.44, prev: 5.38, varD1: 1,  varW: 4  },
      { label: "3 mois",  short: "3M",  bid: 5.36, mid: 5.38, ask: 5.40, prev: 5.34, varD1: 1,  varW: 4  },
      { label: "6 mois",  short: "6M",  bid: 5.29, mid: 5.31, ask: 5.33, prev: 5.28, varD1: 1,  varW: 3  },
      { label: "1 an",    short: "1Y",  bid: 5.03, mid: 5.05, ask: 5.07, prev: 5.02, varD1: -1, varW: 3  },
      { label: "2 ans",   short: "2Y",  bid: 4.69, mid: 4.71, ask: 4.73, prev: 4.75, varD1: -4, varW: -4 },
      { label: "3 ans",   short: "3Y",  bid: 4.56, mid: 4.58, ask: 4.60, prev: 4.62, varD1: -2, varW: -4 },
      { label: "5 ans",   short: "5Y",  bid: 4.40, mid: 4.42, ask: 4.44, prev: 4.46, varD1: -2, varW: -4 },
      { label: "7 ans",   short: "7Y",  bid: 4.36, mid: 4.38, ask: 4.40, prev: 4.42, varD1: -2, varW: -4 },
      { label: "10 ans",  short: "10Y", bid: 4.26, mid: 4.28, ask: 4.30, prev: 4.35, varD1: -3, varW: -7 },
      { label: "20 ans",  short: "20Y", bid: 4.50, mid: 4.52, ask: 4.54, prev: 4.57, varD1: -1, varW: -5 },
      { label: "30 ans",  short: "30Y", bid: 4.43, mid: 4.45, ask: 4.47, prev: 4.49, varD1: -1, varW: -4 },
    ],
    spotLabel: "Pente 2Y–10Y", spotValue: "-43 pb",
    slopeLabel: "Pente 2Y–10Y", slopeValue: "-43 pb", slopePositive: false,
    highPoint: "1M · 5,42 %", lowPoint: "10Y · 4,28 %",
    shape: "Inversée (2Y–10Y)",
    comment: "Inversion 2Y–10Y confirmée. Les taux courts supérieurs aux taux longs signalent des anticipations de ralentissement et de baisse de la Fed.",
    regime: "Inversion 2Y–10Y", regimeTone: "unfavorable",
  },
  {
    id: "copper",
    tabLabel: "Copper",
    pageTitle: "Copper Forward Curve",
    unit: "USD/lb",
    varUnit: "%",
    decimals: 2,
    summaryLabel: "Copper 3M",
    summaryValue: "4,62 USD/lb",
    summaryChange: "+0,70 %",
    summaryPositive: true,
    points: [
      { label: "Spot",    short: "Spot", bid: 4.41, mid: 4.42, ask: 4.43, prev: 4.38, varD1: 0.70, varW: 0.92 },
      { label: "1 mois",  short: "1M",   bid: 4.45, mid: 4.46, ask: 4.47, prev: 4.42, varD1: 0.68, varW: 0.91 },
      { label: "2 mois",  short: "2M",   bid: 4.49, mid: 4.50, ask: 4.51, prev: 4.46, varD1: 0.67, varW: 0.90 },
      { label: "3 mois",  short: "3M",   bid: 4.61, mid: 4.62, ask: 4.63, prev: 4.58, varD1: 0.70, varW: 0.87 },
      { label: "6 mois",  short: "6M",   bid: 4.70, mid: 4.71, ask: 4.72, prev: 4.67, varD1: 0.64, varW: 0.86 },
      { label: "12 mois", short: "12M",  bid: 4.87, mid: 4.88, ask: 4.89, prev: 4.84, varD1: 0.62, varW: 0.83 },
      { label: "24 mois", short: "24M",  bid: 5.01, mid: 5.02, ask: 5.03, prev: 4.98, varD1: 0.60, varW: 0.80 },
    ],
    spotLabel: "Prix Spot", spotValue: "4,42 USD/lb",
    slopeLabel: "Pente Spot–12M", slopeValue: "+0,46 USD", slopePositive: true,
    highPoint: "24M · 5,02 USD/lb", lowPoint: "Spot · 4,42 USD/lb",
    shape: "Contango léger",
    comment: "Le cuivre est en contango modéré. Indicateur macro positif pour les recettes d'exportation de la RDC et les perspectives de réserves en devises.",
    regime: "Contango léger", regimeTone: "favorable",
  },
  {
    id: "fx-forward",
    tabLabel: "FX Forward",
    pageTitle: "FX Forward — EUR/USD",
    unit: "Taux de change",
    varUnit: "pts",
    decimals: 4,
    summaryLabel: "EUR/USD Forward 3M",
    summaryValue: "1,0874",
    summaryChange: "+12 pts",
    summaryPositive: true,
    points: [
      { label: "Spot",      short: "Spot", bid: 1.0761, mid: 1.0762, ask: 1.0763, prev: 1.0750, varD1: 12,  varW: 12  },
      { label: "1 semaine", short: "1W",   bid: 1.0767, mid: 1.0768, ask: 1.0769, prev: 1.0756, varD1: 2,   varW: 12  },
      { label: "1 mois",    short: "1M",   bid: 1.0787, mid: 1.0788, ask: 1.0789, prev: 1.0776, varD1: 4,   varW: 12  },
      { label: "3 mois",    short: "3M",   bid: 1.0873, mid: 1.0874, ask: 1.0875, prev: 1.0862, varD1: 12,  varW: 12  },
      { label: "6 mois",    short: "6M",   bid: 1.0951, mid: 1.0952, ask: 1.0953, prev: 1.0940, varD1: 8,   varW: 12  },
      { label: "12 mois",   short: "12M",  bid: 1.1084, mid: 1.1085, ask: 1.1086, prev: 1.1073, varD1: 10,  varW: 12  },
    ],
    spotLabel: "Taux Spot", spotValue: "1,0762",
    slopeLabel: "Points 12M", slopeValue: "+323 pts", slopePositive: true,
    highPoint: "12M · 1,1085", lowPoint: "Spot · 1,0762",
    shape: "Points positifs",
    comment: "L'EUR/USD affiche des forward points positifs sur toutes les échéances, reflétant un différentiel de taux favorable à l'EUR sur les maturités longues.",
    regime: "Points positifs", regimeTone: "favorable",
  },
  {
    id: "gold-vol",
    tabLabel: "Gold Implied Vol.",
    pageTitle: "Gold Implied Volatility",
    unit: "% annualisé",
    varUnit: "vol",
    decimals: 1,
    summaryLabel: "Gold Implied Vol. 3M",
    summaryValue: "16,8 %",
    summaryChange: "+0,6 vol",
    summaryPositive: false,
    points: [
      { label: "1 mois",  short: "1M",  bid: 16.6, mid: 16.8, ask: 17.0, prev: 16.2, varD1: 0.6, varW: 0.6 },
      { label: "3 mois",  short: "3M",  bid: 15.0, mid: 15.2, ask: 15.4, prev: 14.8, varD1: 0.4, varW: 0.4 },
      { label: "6 mois",  short: "6M",  bid: 14.6, mid: 14.8, ask: 15.0, prev: 14.5, varD1: 0.3, varW: 0.3 },
      { label: "12 mois", short: "12M", bid: 14.3, mid: 14.5, ask: 14.7, prev: 14.3, varD1: 0.2, varW: 0.2 },
    ],
    spotLabel: "Volatilité 1M", spotValue: "16,8 %",
    slopeLabel: "Pente 1M–12M", slopeValue: "-2,3 vol", slopePositive: false,
    highPoint: "1M · 16,8 %", lowPoint: "12M · 14,5 %",
    shape: "Hausse court terme",
    comment: "La volatilité implicite progresse sur les maturités courtes. Le marché anticipe des variations de prix plus importantes à court terme sur l'or.",
    regime: "Hausse court terme", regimeTone: "warning",
  },
];

// Cross-curve market regimes (right panel, static)
const ALL_REGIMES = [
  { label: "XAU/USD Forward",   regime: "Contango modéré",    tone: "warning"      as const },
  { label: "US Treasury",       regime: "Inversion 2Y–10Y",   tone: "unfavorable"  as const },
  { label: "Cuivre",            regime: "Contango léger",      tone: "favorable"    as const },
  { label: "Gold Implied Vol.", regime: "Hausse court terme",  tone: "warning"      as const },
  { label: "EUR/USD Forward",   regime: "Points positifs",     tone: "favorable"    as const },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPrice(p: CurvePoint, mode: PriceMode): number {
  return mode === "bid" ? p.bid : mode === "ask" ? p.ask : p.mid;
}

function fmtVal(v: number, decimals: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVar(v: number, unit: string): string {
  const sign = v >= 0 ? "+" : "";
  if (unit === "pb" || unit === "pts" || unit === "vol") {
    return `${sign}${v} ${unit}`;
  }
  return `${sign}${v.toFixed(2)} %`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ curve }: { curve: CurveConfig }) {
  const pos = curve.summaryPositive;
  return (
    <Card className="p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold text-muted-foreground truncate">{curve.summaryLabel}</p>
        <Badge variant="outline" className="text-[9px] h-4 px-1 border-success/60 text-success shrink-0">LIVE</Badge>
      </div>
      <p className="text-base font-bold tabular-nums leading-tight">{curve.summaryValue}</p>
      <p className={cn("text-[11px] font-medium", pos ? "text-success" : "text-destructive")}>
        {curve.summaryChange}
      </p>
    </Card>
  );
}

function RegimeDot({ tone }: { tone: "favorable" | "warning" | "unfavorable" }) {
  return (
    <span className={cn(
      "inline-block h-2 w-2 rounded-full shrink-0",
      tone === "favorable" ? "bg-success" : tone === "warning" ? "bg-yellow-400" : "bg-destructive"
    )} />
  );
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({ active, payload, label, curve, viewMode }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  curve: CurveConfig;
  viewMode: ViewMode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1.5 text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-semibold ml-auto pl-4">
            {viewMode === "normalized"
              ? `${p.value.toFixed(1)}`
              : fmtVal(p.value, curve.decimals)}
            {viewMode === "normalized" ? "" : curve.unit === "% par an" || curve.unit === "% annualisé" || curve.unit === "Rendement annuel en %" ? " %" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PrevisionsPage() {
  const [selectedId, setSelectedId] = useState<CurveId>("xau-deposit");
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [priceMode, setPriceMode] = useState<PriceMode>("mid");
  const [compareRef, setCompareRef] = useState<CompareRef>("j7");

  const curve = CURVES.find(c => c.id === selectedId)!;

  const compareLabel = compareRef === "j1" ? "Courbe J–1" : compareRef === "month" ? "Fin mois préc." : "Courbe J–7";

  const chartData = useMemo(() => {
    const pts = curve.points;
    if (viewMode === "normalized") {
      const baseC = getPrice(pts[0], priceMode);
      const baseP = pts[0].prev;
      return pts.map(p => ({
        label: p.short,
        current: +((getPrice(p, priceMode) / baseC) * 100).toFixed(2),
        prev: +((p.prev / baseP) * 100).toFixed(2),
      }));
    }
    return pts.map(p => ({
      label: p.short,
      current: getPrice(p, priceMode),
      prev: p.prev,
    }));
  }, [curve, viewMode, priceMode]);

  const yUnit = viewMode === "normalized" ? "" : (
    curve.unit === "% par an" || curve.unit === "% annualisé" || curve.unit === "Rendement annuel en %" ? " %" : ""
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="Courbes & Perspectives de marché"
            subtitle="Vue prospective des courbes Bloomberg pour la gestion des réserves"
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px] space-y-4">

              {/* ── Source disclaimer ── */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Bloomberg — 19/06/2026 · 15:40 Londres</span>
                <span className="text-[10px] italic">
                  Les courbes forward ne sont pas des prévisions KONEX. Elles représentent les prix ou taux implicites observés sur le marché.
                </span>
              </div>

              {/* ── Synthèse du marché (7 cards + status) ── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Synthèse des marchés</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
                  {CURVES.map(c => <SummaryCard key={c.id} curve={c} />)}
                  {/* Status card */}
                  <Card className="p-3 flex flex-col gap-1 min-w-0 border-success/40">
                    <p className="text-[10px] font-semibold text-muted-foreground">Statut des données</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="text-[10px] text-success font-medium">OK</span>
                    </div>
                    <p className="text-sm font-bold">7 courbes actives</p>
                    <p className="text-[10px] text-muted-foreground">Bloomberg connecté</p>
                  </Card>
                </div>
              </div>

              {/* ── Main layout: chart area + right panel ── */}
              <div className="flex gap-4 items-start">

                {/* LEFT — chart + table */}
                <div className="flex-1 min-w-0 space-y-4">

                  {/* Chart card */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="text-sm font-semibold">
                          Courbe sélectionnée — {curve.pageTitle}
                        </CardTitle>
                        {/* Controls */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
                            <button
                              onClick={() => setViewMode("individual")}
                              className={cn("px-2.5 py-1 transition-colors", viewMode === "individual" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                            >
                              Courbe individuelle
                            </button>
                            <button
                              onClick={() => setViewMode("normalized")}
                              className={cn("px-2.5 py-1 border-l border-border transition-colors", viewMode === "normalized" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                            >
                              Comparaison normalisée
                            </button>
                          </div>
                          <Select value={priceMode} onValueChange={(v) => setPriceMode(v as PriceMode)}>
                            <SelectTrigger className="h-7 text-[11px] w-[72px] px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bid" className="text-xs">Bid</SelectItem>
                              <SelectItem value="mid" className="text-xs">Mid</SelectItem>
                              <SelectItem value="ask" className="text-xs">Ask</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={compareRef} onValueChange={(v) => setCompareRef(v as CompareRef)}>
                            <SelectTrigger className="h-7 text-[11px] w-[88px] px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="j1" className="text-xs">J–1</SelectItem>
                              <SelectItem value="j7" className="text-xs">J–7</SelectItem>
                              <SelectItem value="month" className="text-xs">Fin mois</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Curve tabs */}
                      <div className="flex gap-1 flex-wrap mt-2">
                        {CURVES.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={cn(
                              "px-3 py-1 rounded-md text-[11px] font-medium transition-colors border",
                              selectedId === c.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {c.tabLabel}
                          </button>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-0.5 w-6 rounded-full" style={{ background: C_CURRENT }} />
                          <span className="text-muted-foreground">Courbe actuelle</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-0.5 w-6 rounded-full" style={{ background: C_PREV }} />
                          <span className="text-muted-foreground">{compareLabel}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-2 pb-4">
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 4, left: 8 }}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.06)"
                              horizontal={true}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 11, fill: "#6b7280" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#6b7280" }}
                              axisLine={false}
                              tickLine={false}
                              width={48}
                              tickFormatter={(v: number) => {
                                if (viewMode === "normalized") return v.toFixed(0);
                                return fmtVal(v, curve.decimals);
                              }}
                            />
                            <Tooltip
                              content={
                                <ChartTooltip
                                  curve={curve}
                                  viewMode={viewMode}
                                />
                              }
                              cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                            />
                            {/* Comparison line first (background) */}
                            <Line
                              type="monotone"
                              dataKey="prev"
                              name={compareLabel}
                              stroke={C_PREV}
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                              dot={{ fill: C_PREV, r: 3, strokeWidth: 0 }}
                              activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                            {/* Current line on top */}
                            <Line
                              type="monotone"
                              dataKey="current"
                              name="Courbe actuelle"
                              stroke={C_CURRENT}
                              strokeWidth={2}
                              dot={{ fill: C_CURRENT, r: 4, strokeWidth: 0 }}
                              activeDot={{ r: 6, stroke: C_CURRENT, strokeWidth: 2, fill: "white" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Data table */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                          Données de la courbe sélectionnée
                        </CardTitle>
                        <span className="text-[9px] text-muted-foreground">
                          Unité : {curve.unit}{curve.convention ? ` · ${curve.convention}` : ""}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left pb-1.5 font-medium pr-4">Échéance</th>
                              <th className="text-right pb-1.5 font-medium pr-3">Bid</th>
                              <th className="text-right pb-1.5 font-medium pr-3">Mid</th>
                              <th className="text-right pb-1.5 font-medium pr-3">Ask</th>
                              <th className="text-right pb-1.5 font-medium pr-3">Var. J–1</th>
                              <th className="text-right pb-1.5 font-medium pr-3">Var. 1 semaine</th>
                              <th className="text-right pb-1.5 font-medium">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {curve.points.map((pt) => {
                              const posD1 = pt.varD1 >= 0;
                              const posW  = pt.varW  >= 0;
                              return (
                                <tr key={pt.label} className="border-b border-border/40 last:border-0">
                                  <td className="py-1.5 pr-4 font-medium">{pt.label}</td>
                                  <td className="text-right py-1.5 pr-3 tabular-nums">{fmtVal(pt.bid, curve.decimals)}</td>
                                  <td className="text-right py-1.5 pr-3 tabular-nums font-semibold">{fmtVal(pt.mid, curve.decimals)}</td>
                                  <td className="text-right py-1.5 pr-3 tabular-nums">{fmtVal(pt.ask, curve.decimals)}</td>
                                  <td className={cn("text-right py-1.5 pr-3 font-medium", posD1 ? "text-success" : "text-destructive")}>
                                    {fmtVar(pt.varD1, curve.varUnit)}
                                  </td>
                                  <td className={cn("text-right py-1.5 pr-3 font-medium", posW ? "text-success" : "text-destructive")}>
                                    {fmtVar(pt.varW, curve.varUnit)}
                                  </td>
                                  <td className="text-right py-1.5">
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-success/60 text-success">
                                      Live
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT — Lecture + Régimes + Sources + Actions */}
                <div className="w-72 shrink-0 space-y-3 sticky top-4">

                  {/* Lecture de la courbe */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Lecture de la courbe</CardTitle>
                      <p className="text-[10px] text-muted-foreground">{curve.pageTitle} — analyse automatique</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {/* Key stats */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{curve.spotLabel}</span>
                          <span className="font-bold" style={{ color: C_CURRENT }}>{curve.spotValue}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{curve.slopeLabel}</span>
                          <span className={cn("font-semibold", curve.slopePositive ? "text-success" : "text-destructive")}>
                            {curve.slopeValue}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Point le plus haut</span>
                          <span className="font-medium text-foreground">{curve.highPoint}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Point le plus bas</span>
                          <span className="font-medium text-foreground">{curve.lowPoint}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Forme de la courbe</span>
                          <Badge variant="outline" className={cn(
                            "text-[9px] h-4 px-1.5",
                            curve.shape.includes("Ascendante") || curve.shape.includes("positifs") || curve.shape.includes("léger") ? "border-success/60 text-success" :
                            curve.shape.includes("Inversée") ? "border-destructive/60 text-destructive" :
                            "border-yellow-500/60 text-yellow-400"
                          )}>
                            {curve.shape}
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-md bg-muted/30 border border-border p-2 text-[10px] text-muted-foreground leading-snug">
                        {curve.comment}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Régimes de marché */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Régimes de marché</CardTitle>
                      <p className="text-[9px] text-muted-foreground">Lecture transversale des sept courbes</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {ALL_REGIMES.map((r) => (
                        <div key={r.label} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{r.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "font-medium",
                              r.tone === "favorable" ? "text-success" :
                              r.tone === "warning"   ? "text-yellow-400" : "text-destructive"
                            )}>{r.regime}</span>
                            <RegimeDot tone={r.tone} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Sources & qualité */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Sources &amp; qualité</CardTitle>
                      <p className="text-[9px] text-muted-foreground">Traçabilité des données de marché</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Bloomberg Terminal</span>
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-success inline-block animate-pulse" />
                          <span className="text-success text-[10px]">Connecté</span>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Dernière mise à jour</span>
                        <span>15:40:12</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Type de donnée</span>
                        <span>Bid / Mid / Ask</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Courbes actives</span>
                        <span>7 / 7</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Statut</span>
                        <span className="text-success">Qualité conforme</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Actions</CardTitle>
                      <p className="text-[9px] text-muted-foreground">Exporter ou prolonger l&apos;analyse</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      <Button className="w-full h-8 text-[11px] justify-start gap-2" variant="default">
                        <Download className="h-3.5 w-3.5" />
                        Exporter la vue en PDF
                      </Button>
                      <Button className="w-full h-8 text-[11px] justify-start gap-2" variant="outline">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Exporter les données Excel
                      </Button>
                    </CardContent>
                  </Card>

                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
