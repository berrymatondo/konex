"use client";

import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, TrendingUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AllocTab  = "instruments" | "devises" | "tranches";
type AssetStatus = "excess" | "corridor" | "reinforce" | "calibrate" | "reduce";

// ─── Palette for each asset class (categorical — identity encoding) ─────────
// Assigned in a fixed order; not cycled. Two gold-adjacent hues kept distinct
// via saturation/lightness shift.
const ASSET_COLOR: Record<string, string> = {
  "Cash":              "#64748b",
  "BIS Deposit":       "#3b82f6",
  "UST":               "#f59e0b",
  "Repo / TRS":        "#8b5cf6",
  "Gold":              "#d97706",
  "Gold Deposit":      "#22c55e",
  "Covered Bonds USD": "#06b6d4",
};

const STATUS_CONFIG: Record<AssetStatus, { label: string; cls: string }> = {
  excess:    { label: "Excès",      cls: "border-destructive/60 text-destructive" },
  corridor:  { label: "Corridor",   cls: "border-success/60 text-success"         },
  reinforce: { label: "Renforcer",  cls: "border-blue-500/60 text-blue-400"       },
  calibrate: { label: "À calibrer", cls: "border-yellow-500/60 text-yellow-400"   },
  reduce:    { label: "Réduire",    cls: "border-orange-500/60 text-orange-400"   },
};

// ─── Static data ──────────────────────────────────────────────────────────────

interface AllocRow {
  asset: string; actual: number; target: number; gap: number;
  value: string; liqD1: string; yield: string; status: AssetStatus;
}

const INSTRUMENTS: AllocRow[] = [
  { asset: "Cash",              actual: 18, target: 15, gap: -3, value: "1,17 Md", liqD1: "100 %", yield: "4,90 %", status: "excess"    },
  { asset: "BIS Deposit",       actual: 16, target: 15, gap: -1, value: "1,04 Md", liqD1: "100 %", yield: "5,10 %", status: "corridor"   },
  { asset: "UST",               actual: 31, target: 35, gap: +4, value: "2,01 Md", liqD1:  "94 %", yield: "4,37 %", status: "reinforce"  },
  { asset: "Repo / TRS",        actual:  8, target: 10, gap: +2, value: "0,52 Md", liqD1:  "90 %", yield: "5,45 %", status: "reinforce"  },
  { asset: "Gold",              actual: 18, target: 17, gap: -1, value: "1,17 Md", liqD1:  "35 %", yield: "0,00 %", status: "calibrate"  },
  { asset: "Gold Deposit",      actual:  4, target:  5, gap: +1, value: "0,26 Md", liqD1:  "70 %", yield: "1,65 %", status: "reinforce"  },
  { asset: "Covered Bonds USD", actual:  5, target:  3, gap: -2, value: "0,32 Md", liqD1:  "78 %", yield: "5,20 %", status: "reduce"     },
];

const DEVISES = [
  { devise: "USD", pct: 74.0, value: "4,80 Md" },
  { devise: "XAU", pct: 22.0, value: "1,43 Md" },
  { devise: "EUR", pct:  2.0, value: "0,13 Md" },
  { devise: "GBP", pct:  1.0, value: "0,06 Md" },
  { devise: "CHF", pct:  0.5, value: "0,03 Md" },
  { devise: "JPY", pct:  0.5, value: "0,03 Md" },
];

const TRANCHES = [
  { tranche: "Opérationnelle", pct: 18, value: "1,17 Md", horizon: "D+0 à 1 mois", color: "#3b82f6" },
  { tranche: "Liquidité",      pct: 24, value: "1,56 Md", horizon: "1 à 12/18 mois", color: "#22c55e" },
  { tranche: "Investissement", pct: 36, value: "2,33 Md", horizon: "1 à 5 ans", color: "#f59e0b" },
  { tranche: "Or stratégique", pct: 22, value: "1,43 Md", horizon: "Long terme", color: "#d97706" },
];

const LIQUIDITY_DATA = [
  { horizon: "D+0",  liq: 1.17, besoin: 2.01 },
  { horizon: "D+1",  liq: 2.86, besoin: 2.01 },
  { horizon: "D+7",  liq: 3.62, besoin: 2.01 },
  { horizon: "D+30", liq: 4.25, besoin: 2.01 },
  { horizon: "D+90", liq: 5.10, besoin: 2.01 },
];

const STRESS_TESTS = [
  { label: "Fed +100 pb",           mUSD: -84.6,  pct: -1.30 },
  { label: "Or −15 %",              mUSD: -175.5, pct: -2.70 },
  { label: "Covered Bonds +100 pb", mUSD: -16.4,  pct: -0.25 },
  { label: "Choc combiné",          mUSD: -231.8, pct: -3.57 },
];

const REBALANCING = [
  { label: "Réduire le cash",       gap: -3 },
  { label: "Renforcer les UST",     gap: +4 },
  { label: "Augmenter Repo / TRS",  gap: +2 },
  { label: "Augmenter Gold Deposit",gap: +1 },
  { label: "Réduire Covered Bonds", gap: -2 },
  { label: "Ajuster l'or physique", gap: -1 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const BAR_MAX = 40; // % visual scale for allocation bars

function AllocationBar({ row }: { row: AllocRow }) {
  const color    = ASSET_COLOR[row.asset] ?? "#64748b";
  const actualW  = (row.actual  / BAR_MAX) * 100;
  const targetX  = (row.target  / BAR_MAX) * 100;
  return (
    <div className="relative h-4 rounded-sm bg-muted/20 overflow-hidden flex-1" style={{ minWidth: 140 }}>
      <div className="absolute inset-y-0 left-0 rounded-sm opacity-70" style={{ width: `${actualW}%`, background: color }} />
      <div className="absolute inset-y-0 w-0.5 bg-yellow-400" style={{ left: `${targetX}%` }} />
    </div>
  );
}

function ObjectiveBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-bold w-8 text-right">{pct} %</span>
    </div>
  );
}

interface LiqPayload { name: string; value: number; color: string; }
function LiqTooltip({ active, payload, label }: {
  active?: boolean; payload?: LiqPayload[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground text-[10px]">{p.name}</span>
          <span className="font-mono font-semibold ml-auto pl-3">{p.value.toFixed(2)} Md</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function GestionReservesPage() {
  const [allocTab, setAllocTab] = useState<AllocTab>("instruments");

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="R1. Allocation et Gestion Intégrée des Réserves"
            subtitle="Arbitrer sécurité, liquidité et rendement des réserves internationales"
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px] space-y-4">

              {/* ── Meta strip ── */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {[
                  ["Portefeuille", "Réserves officielles"],
                  ["Date de valorisation", "19/06/2026"],
                  ["Devise de reporting", "USD"],
                  ["Version", "Allocation cible v4"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-card px-3 py-1.5">
                    <span className="text-muted-foreground">{k} </span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 border font-semibold">
                  Simulation
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                    Marchés Bloomberg synchronisés
                  </Badge>
                  <Badge variant="outline" className="border-success/40 text-success text-[10px]">
                    Positions validées
                  </Badge>
                </div>
              </div>

              {/* ── Main layout: left content + right sticky panel ── */}
              <div className="flex gap-4 items-start">

                {/* ── LEFT ── */}
                <div className="flex-1 min-w-0 space-y-4">

                  {/* 6-card portfolio summary */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Synthèse du portefeuille</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Réserves totales</p>
                          <p className="text-base font-bold text-blue-400">6,49 Md USD</p>
                          <p className="text-[9px] text-muted-foreground">Valeur de marché consolidée</p>
                        </div>
                        <div className="border border-success/30 bg-success/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Rendement attendu</p>
                          <p className="text-base font-bold text-success">4,12 %</p>
                          <p className="text-[9px] text-muted-foreground">Horizon 12 mois</p>
                        </div>
                        <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Liquidité D+1</p>
                          <p className="text-base font-bold text-blue-400">2,86 Md USD</p>
                          <p className="text-[9px] text-muted-foreground">44,1 % du portefeuille</p>
                        </div>
                        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">VaR 10j (95 %)</p>
                          <p className="text-base font-bold text-yellow-400">118,4 M USD</p>
                          <p className="text-[9px] text-muted-foreground">1,82 % des réserves</p>
                        </div>
                        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Or total</p>
                          <p className="text-base font-bold text-yellow-400">1,43 Md USD</p>
                          <p className="text-[9px] text-muted-foreground">22,0 % physique + placé</p>
                        </div>
                        <div className="border border-success/30 bg-success/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Actifs non grevés</p>
                          <p className="text-base font-bold text-success">92,6 %</p>
                          <p className="text-[9px] text-muted-foreground">Après repo et collatéral</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Allocation actuelle vs cible */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm font-semibold">Allocation actuelle vs cible</CardTitle>
                        <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
                          {(["instruments", "devises", "tranches"] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setAllocTab(t)}
                              className={cn(
                                "px-3 py-1 border-l first:border-l-0 border-border transition-colors",
                                allocTab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                              )}
                            >
                              {t === "instruments" ? "Instruments" : t === "devises" ? "Devises" : "Tranches"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">

                      {allocTab === "instruments" && (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] whitespace-nowrap">
                              <thead>
                                <tr className="text-muted-foreground border-b border-border text-[9px] uppercase tracking-wide">
                                  <th className="text-left pb-2 font-medium pr-4">Classe d&apos;actifs</th>
                                  <th className="text-right pb-2 font-medium pr-3">Actuelle</th>
                                  <th className="text-right pb-2 font-medium pr-3">Cible</th>
                                  <th className="text-left pb-2 font-medium pr-6 w-full">Écart vs cible</th>
                                  <th className="text-right pb-2 font-medium">Valeur</th>
                                </tr>
                              </thead>
                              <tbody>
                                {INSTRUMENTS.map(row => (
                                  <tr key={row.asset} className="border-b border-border/40 last:border-0">
                                    <td className="py-2 pr-4 font-medium">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                                          style={{ background: ASSET_COLOR[row.asset] }}
                                        />
                                        {row.asset}
                                      </div>
                                    </td>
                                    <td className="text-right py-2 pr-3 tabular-nums">{row.actual},0 %</td>
                                    <td className="text-right py-2 pr-3 tabular-nums">{row.target},0 %</td>
                                    <td className="py-2 pr-6">
                                      <div className="flex items-center gap-2">
                                        <AllocationBar row={row} />
                                        <span className={cn(
                                          "font-semibold tabular-nums w-14 text-right shrink-0 text-[10px]",
                                          row.gap > 0 ? "text-success" : row.gap < 0 ? "text-destructive" : "text-muted-foreground"
                                        )}>
                                          {row.gap > 0 ? "+" : ""}{row.gap},0 pt
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-right py-2 tabular-nums font-semibold">{row.value}</td>
                                  </tr>
                                ))}
                                <tr className="border-t border-border bg-muted/10">
                                  <td colSpan={2} className="py-2 pr-3 font-bold text-[10px] text-muted-foreground"></td>
                                  <td className="text-right py-2 pr-3 font-bold">100,0 %</td>
                                  <td className="py-2 pr-6" />
                                  <td className="text-right py-2 font-bold">6,49 Md USD</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[9px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-3 w-6 rounded-sm bg-muted/40" />
                              <span>Allocation actuelle</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-4 w-0.5 bg-yellow-400" />
                              <span>Marqueur cible</span>
                            </div>
                          </div>
                        </>
                      )}

                      {allocTab === "devises" && (
                        <div className="space-y-2">
                          {DEVISES.map(d => (
                            <div key={d.devise} className="flex items-center gap-3 text-[11px]">
                              <span className="w-8 font-semibold">{d.devise}</span>
                              <div className="flex-1 h-4 rounded-sm bg-muted/20 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-blue-500/60"
                                  style={{ width: `${(d.pct / 80) * 100}%` }}
                                />
                              </div>
                              <span className="tabular-nums w-10 text-right font-semibold">{d.pct} %</span>
                              <span className="tabular-nums w-16 text-right text-muted-foreground">{d.value}</span>
                            </div>
                          ))}
                          <p className="text-[9px] text-muted-foreground mt-2 italic">
                            XAU = or physique et or placé convertis en USD au cours du 19/06/2026.
                          </p>
                        </div>
                      )}

                      {allocTab === "tranches" && (
                        <div className="space-y-2.5">
                          {TRANCHES.map(tr => (
                            <div key={tr.tranche} className="flex items-center gap-3 text-[11px]">
                              <span className="w-28 font-medium">{tr.tranche}</span>
                              <div className="flex-1 h-4 rounded-sm bg-muted/20 overflow-hidden">
                                <div
                                  className="h-full rounded-sm opacity-70"
                                  style={{ width: `${tr.pct * 2.5}%`, background: tr.color }}
                                />
                              </div>
                              <span className="tabular-nums w-10 text-right font-semibold">{tr.pct} %</span>
                              <span className="tabular-nums w-16 text-right text-muted-foreground">{tr.value}</span>
                              <span className="text-muted-foreground text-[9px] w-24 shrink-0">{tr.horizon}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Liquidité + Stress tests (2 cols) */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                          Liquidité mobilisable par horizon
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-1 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-3 w-3 rounded-sm bg-success/70" />
                            <span className="text-muted-foreground">Disponible</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-0.5 w-5 rounded-full bg-yellow-400" />
                            <span className="text-muted-foreground">Besoin sous scénario</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-2 pb-3">
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={LIQUIDITY_DATA} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="horizon" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => v.toFixed(1)} />
                              <Tooltip content={<LiqTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                              <Bar dataKey="liq" name="Liquidité (Md USD)" fill="#22c55e" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                              <Line
                                type="monotone"
                                dataKey="besoin"
                                name="Besoin sous scénario"
                                stroke="#f59e0b"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                                dot={{ fill: "#f59e0b", r: 3.5, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] px-2">
                          <span className="text-muted-foreground">Couverture D+1</span>
                          <span className="font-bold text-success">1,42×</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                          Stress tests principaux
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1.5">
                        {STRESS_TESTS.map(s => (
                          <div key={s.label} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/40 last:border-0">
                            <span className="text-muted-foreground">{s.label}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="tabular-nums text-destructive font-semibold">
                                {s.mUSD.toFixed(1)} M USD
                              </span>
                              <span className="tabular-nums text-destructive font-bold w-12 text-right">
                                {s.pct.toFixed(2)} %
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-md bg-success/10 border border-success/30 p-2 mt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Liquidité après choc combiné</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-success">1,17×</span>
                              <CheckCircle2 className="h-3 w-3 text-success" />
                              <span className="text-success font-medium">Couvert</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Positions & decisions table */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Positions et décisions par classe d&apos;actifs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border text-[9px] uppercase tracking-wide">
                              <th className="text-left pb-2 font-medium pr-4">Actif</th>
                              <th className="text-right pb-2 font-medium pr-3">Valeur</th>
                              <th className="text-right pb-2 font-medium pr-3">Actuelle</th>
                              <th className="text-right pb-2 font-medium pr-3">Cible</th>
                              <th className="text-right pb-2 font-medium pr-3">Rendement</th>
                              <th className="text-right pb-2 font-medium pr-3">Liquidité D+1</th>
                              <th className="text-right pb-2 font-medium pr-3">Décision</th>
                              <th className="text-right pb-2 font-medium">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {INSTRUMENTS.map(row => {
                              const cfg = STATUS_CONFIG[row.status];
                              const yieldPct = parseFloat(row.yield);
                              return (
                                <tr key={row.asset} className="border-b border-border/40 last:border-0">
                                  <td className="py-2 pr-4 font-medium">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="inline-block h-2 w-2 rounded-full shrink-0"
                                        style={{ background: ASSET_COLOR[row.asset] }}
                                      />
                                      {row.asset}
                                    </div>
                                  </td>
                                  <td className="text-right py-2 pr-3 tabular-nums">{row.value}</td>
                                  <td className="text-right py-2 pr-3 tabular-nums">{row.actual},0 %</td>
                                  <td className="text-right py-2 pr-3 tabular-nums">{row.target},0 %</td>
                                  <td className={cn(
                                    "text-right py-2 pr-3 tabular-nums font-semibold",
                                    yieldPct === 0 ? "text-muted-foreground" : "text-success"
                                  )}>
                                    {row.yield}
                                  </td>
                                  <td className="text-right py-2 pr-3 tabular-nums">{row.liqD1}</td>
                                  <td className={cn(
                                    "text-right py-2 pr-3 tabular-nums font-semibold",
                                    row.gap > 0 ? "text-success" : row.gap < 0 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {row.gap > 0 ? "+" : ""}{row.gap},0 pt
                                  </td>
                                  <td className="text-right py-2">
                                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", cfg.cls)}>
                                      {cfg.label}
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

                {/* ── RIGHT PANEL ── */}
                <div className="w-72 shrink-0 space-y-3 sticky top-4">

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Synthèse d&apos;allocation</CardTitle>
                        <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">Simulation active</Badge>
                      </div>
                      <p className="text-[9px] text-muted-foreground">Diagnostic central — données illustratives</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold">Allocation cible v4</p>
                        <p className="text-[9px] text-muted-foreground">Horizon : 12 mois</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Résultats principaux</p>
                        {[
                          { label: "Rendement attendu",  value: "4,12 %",    sub: "Après coûts et financement", tone: "success" },
                          { label: "Liquidité D+1",      value: "2,86 Md USD", sub: "Ratio de couverture : 1,42×", tone: "blue"    },
                          { label: "Duration pondérée",  value: "2,84 ans",  sub: "Sous la limite de 3,25 ans", tone: "default"  },
                          { label: "VaR 10j (95 %)",     value: "118,4 M USD", sub: "1,82 % du portefeuille", tone: "warning"  },
                          { label: "Actifs non grevés",  value: "92,6 %",    sub: "Limite interne respectée",  tone: "success"  },
                        ].map(r => (
                          <div key={r.label} className="flex items-start justify-between text-[11px] py-1.5 border-b border-border/40 last:border-0">
                            <span className="text-muted-foreground leading-snug">{r.label}</span>
                            <div className="text-right">
                              <span className={cn(
                                "font-bold",
                                r.tone === "success" ? "text-success" :
                                r.tone === "blue"    ? "text-blue-400" :
                                r.tone === "warning" ? "text-yellow-400" :
                                "text-foreground"
                              )}>
                                {r.value}
                              </span>
                              <p className="text-[9px] text-muted-foreground">{r.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Équilibre des objectifs */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Équilibre des objectifs</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <ObjectiveBar label="Sécurité"  pct={96} color="#22c55e" />
                      <ObjectiveBar label="Liquidité" pct={92} color="#22c55e" />
                      <ObjectiveBar label="Rendement" pct={78} color="#f59e0b" />
                    </CardContent>
                  </Card>

                  {/* Plan de rééquilibrage */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Plan de rééquilibrage</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1">
                      {REBALANCING.map(item => (
                        <div key={item.label} className="flex items-center justify-between text-[10px] py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              item.gap > 0 ? "bg-success" : "bg-destructive"
                            )} />
                            <span className="text-muted-foreground">{item.label}</span>
                          </div>
                          <span className={cn("font-bold tabular-nums", item.gap > 0 ? "text-success" : "text-destructive")}>
                            {item.gap > 0 ? "+" : ""}{item.gap},0 pt
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Gain de rendement */}
                  <Card>
                    <CardContent className="px-3 py-3 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Gain de rendement estimé</p>
                      <p className="text-2xl font-bold text-success">+24,8 M USD / an</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Sans dépassement des limites du scénario</p>
                    </CardContent>
                  </Card>

                  {/* Contrôles */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Contrôles et limites</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-success">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span>Limites dures respectées</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-success">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span>Aucun double comptage détecté</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full h-8 text-[11px] gap-2 bg-blue-600 hover:bg-blue-700">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Optimiser l&apos;allocation
                    </Button>
                    <Button className="w-full h-8 text-[11px] gap-2 bg-blue-600 hover:bg-blue-700">
                      <FileText className="h-3.5 w-3.5" />
                      Générer la note du comité
                    </Button>
                  </div>

                  <p className="text-[9px] text-muted-foreground text-right">
                    Dernière mise à jour : 19/06/2026 — 16:10
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
