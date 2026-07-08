"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, RefreshCw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartTabKey = "liq" | "bm" | "rin";

interface ChartRow { m: string; prog: number; rev: number; post: number; }
interface ChartConfig {
  data: ChartRow[];
  label: string;
  unit: string;
  yDomain: [number, number];
  corridorLo: number | null;
  corridorHi: number | null;
  yTick: (v: number) => string;
  tip:   (v: number) => string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const LIQ_DATA: ChartRow[] = [
  { m: "Jan",  prog: 432, rev: 437, post: 435 },
  { m: "Fév",  prog: 436, rev: 444, post: 439 },
  { m: "Mar",  prog: 440, rev: 452, post: 443 },
  { m: "Avr",  prog: 443, rev: 459, post: 447 },
  { m: "Mai",  prog: 446, rev: 466, post: 451 },
  { m: "Juin", prog: 449, rev: 472, post: 454 },
  { m: "Juil", prog: 452, rev: 479, post: 458 },
  { m: "Août", prog: 455, rev: 484, post: 461 },
  { m: "Sep",  prog: 458, rev: 489, post: 463 },
  { m: "Oct",  prog: 460, rev: 493, post: 465 },
  { m: "Nov",  prog: 462, rev: 499, post: 467 },
  { m: "Déc",  prog: 465, rev: 506, post: 468 },
];

const BM_DATA: ChartRow[] = [
  { m: "Jan",  prog: 7772, rev: 7774, post: 7773 },
  { m: "Fév",  prog: 7775, rev: 7778, post: 7776 },
  { m: "Mar",  prog: 7778, rev: 7783, post: 7780 },
  { m: "Avr",  prog: 7781, rev: 7788, post: 7783 },
  { m: "Mai",  prog: 7784, rev: 7794, post: 7786 },
  { m: "Juin", prog: 7787, rev: 7800, post: 7789 },
  { m: "Juil", prog: 7790, rev: 7806, post: 7792 },
  { m: "Août", prog: 7793, rev: 7812, post: 7795 },
  { m: "Sep",  prog: 7796, rev: 7816, post: 7798 },
  { m: "Oct",  prog: 7798, rev: 7819, post: 7800 },
  { m: "Nov",  prog: 7799, rev: 7821, post: 7801 },
  { m: "Déc",  prog: 7800, rev: 7823, post: 7803 },
];

const RIN_DATA: ChartRow[] = [
  { m: "Jan",  prog: 6.42, rev: 6.42, post: 6.42 },
  { m: "Fév",  prog: 6.42, rev: 6.43, post: 6.43 },
  { m: "Mar",  prog: 6.43, rev: 6.44, post: 6.44 },
  { m: "Avr",  prog: 6.43, rev: 6.44, post: 6.44 },
  { m: "Mai",  prog: 6.44, rev: 6.45, post: 6.45 },
  { m: "Juin", prog: 6.44, rev: 6.46, post: 6.46 },
  { m: "Juil", prog: 6.45, rev: 6.47, post: 6.47 },
  { m: "Août", prog: 6.46, rev: 6.48, post: 6.48 },
  { m: "Sep",  prog: 6.47, rev: 6.48, post: 6.48 },
  { m: "Oct",  prog: 6.47, rev: 6.49, post: 6.49 },
  { m: "Nov",  prog: 6.48, rev: 6.49, post: 6.49 },
  { m: "Déc",  prog: 6.48, rev: 6.49, post: 6.49 },
];

const CHART_CONFIGS: Record<ChartTabKey, ChartConfig> = {
  liq: {
    data: LIQ_DATA, label: "Liquidité bancaire", unit: "Md CDF",
    yDomain: [400, 520], corridorLo: 450, corridorHi: 490,
    yTick: (v) => `${v}`,
    tip:   (v) => `${v} Md`,
  },
  bm: {
    data: BM_DATA, label: "Base monétaire", unit: "Md CDF",
    yDomain: [7760, 7840], corridorLo: null, corridorHi: null,
    yTick: (v) => `${v}`,
    tip:   (v) => `${v} Md`,
  },
  rin: {
    data: RIN_DATA, label: "RIN", unit: "Md USD",
    yDomain: [6.38, 6.52], corridorLo: 6.45, corridorHi: 6.50,
    yTick: (v) => v.toFixed(2),
    tip:   (v) => `${v.toFixed(2)} Md`,
  },
};

const DECOMP = [
  { label: "Achats d'or",  value: +63.34, color: "#f59e0b" },
  { label: "Trésor",       value: +18.20, color: "#60a5fa" },
  { label: "Change",       value: -12.40, color: "#f87171" },
  { label: "Billets",      value: -8.60,  color: "#f87171" },
  { label: "Bons BCC",     value: -40.00, color: "#2dd4bf" },
];
const DECOMP_NET = +20.54;
const DECOMP_MAX = 66;

const SYNTH_ROWS = [
  { ind: "Base monétaire",          unit: "Md CDF", init: "7 800,00", rev: "7 823,34", ecart: "+23,34",   dot: "amber",  lecture: "Après stérilisation"    },
  { ind: "Liquidité bancaire",      unit: "Md CDF", init: "465,00",   rev: "485,54",   ecart: "+20,54",   dot: "amber",  lecture: "Au-dessus de la cible"   },
  { ind: "Réserves internationales",unit: "Md USD", init: "6,42",     rev: "6,49",     ecart: "+70,80 M", dot: "blue",   lecture: "Effet à M+2"             },
  { ind: "Objectif RIN",            unit: "Md USD", init: "6,48",     rev: "6,49",     ecart: "+12,00 M", dot: "green",  lecture: "Objectif atteint"         },
  { ind: "Position extérieure nette",unit:"Md USD", init: "5,92",     rev: "5,98",     ecart: "+60,10 M", dot: "gray",   lecture: "Amélioration différée"    },
];

const DOT_CLS: Record<string, string> = {
  amber: "bg-yellow-400",
  blue:  "bg-blue-400",
  green: "bg-success",
  gray:  "bg-muted-foreground",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SERIES: Record<string, string> = {
  prog: "Prog. initiale",
  rev:  "Révisée avec or",
  post: "Après stérilisation",
};

interface TipPayload { name: string; value: number; color: string; }
function MacroTooltip({
  active, payload, label, tipFmt,
}: { active?: boolean; payload?: TipPayload[]; label?: string; tipFmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground text-[10px]">{SERIES[p.name] ?? p.name}</span>
          <span className="font-mono font-semibold ml-auto pl-3">{tipFmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DecompBar({ value, color }: { value: number; color: string }) {
  const pct = (Math.abs(value) / DECOMP_MAX) * 45;
  const isNeg = value < 0;
  return (
    <div className="relative h-3 rounded-sm bg-muted/10 overflow-hidden flex-1">
      <div className="absolute inset-y-0 w-px bg-border/50" style={{ left: "50%" }} />
      <div
        className="absolute inset-y-[1px] rounded-sm"
        style={{
          background: color,
          opacity: 0.85,
          left:  isNeg ? `${50 - pct}%` : "50%",
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImpactMacroPage() {
  const [chartTab, setChartTab] = useState<ChartTabKey>("liq");
  const cfg = CHART_CONFIGS[chartTab];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="H1. Impact Macro des Achats d'Or"
            subtitle="Mesurer les effets sur la politique monétaire et de change"
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px] space-y-4">

              {/* ── Meta strip ── */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {[
                  ["Programme",           "OR-2026-T3"],
                  ["Période d'analyse",   "Juil. – Déc. 2026"],
                  ["Version",             "Programmation révisée v3"],
                  ["Direction initiatrice","Analyses Économiques"],
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
                  <Badge variant="outline" className="border-success/40 text-success text-[10px]">
                    24 commandes intégrées
                  </Badge>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                    Données synchronisées
                  </Badge>
                </div>
              </div>

              {/* ── Main layout ── */}
              <div className="flex gap-4 items-start">

                {/* ── LEFT ── */}
                <div className="flex-1 min-w-0 space-y-4">

                  {/* Programme d'achat d'or — 2×4 mini cards */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Programme d&apos;achat d&apos;or
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { k: "Volume prévu",          v: "1 200,00 kg",     s: "Quantité agrégée du programme" },
                          { k: "Pureté centrale",        v: "88,50 %",          s: "Hypothèse de valorisation"    },
                          { k: "Valeur estimée",         v: "80,28 M USD",      s: "Hors premium final et logistique" },
                          { k: "Fixing de référence",    v: "2 351,20 USD/oz",  s: "LBMA Gold PM Fixing"          },
                        ].map(item => (
                          <div key={item.k} className="border border-border rounded-lg p-2.5">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{item.k}</p>
                            <p className="text-sm font-bold text-yellow-400 tabular-nums">{item.v}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{item.s}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { k: "Répartition du paiement", v: "70 % USD / 30 % CDF", s: "Conditions agrégées des commandes" },
                          { k: "Injection brute en CDF",   v: "63,34 Md CDF",        s: "Avant réserve obligatoire"        },
                          { k: "Part scripturale",          v: "85,0 %",              s: "Part bancaire estimée"            },
                          { k: "Délai moyen de monétisation", v: "M+2",              s: "Raffinage et reclassement inclus" },
                        ].map(item => (
                          <div key={item.k} className="border border-border rounded-lg p-2.5">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{item.k}</p>
                            <p className="text-sm font-bold tabular-nums">{item.v}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{item.s}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4 large impact KPI cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="border-yellow-500/30 bg-yellow-500/5">
                      <CardContent className="px-4 py-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Injection monétaire brute</p>
                        <p className="text-2xl font-bold text-yellow-400 tabular-nums">63,34 Md CDF</p>
                        <p className="text-[10px] text-success mt-0.5">+0,81 % de la base monétaire initiale</p>
                      </CardContent>
                    </Card>
                    <Card className="border-success/30 bg-success/5">
                      <CardContent className="px-4 py-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Liquidité bancaire libre</p>
                        <p className="text-2xl font-bold text-success tabular-nums">+48,20 Md CDF</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Après réserve obligatoire additionnelle</p>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-500/30 bg-blue-500/5">
                      <CardContent className="px-4 py-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Impact RIN à M+2</p>
                        <p className="text-2xl font-bold text-blue-400 tabular-nums">+70,80 M USD</p>
                        <p className="text-[10px] text-success mt-0.5">101,1 % de l&apos;objectif projeté</p>
                      </CardContent>
                    </Card>
                    <Card className="border-destructive/30 bg-destructive/5">
                      <CardContent className="px-4 py-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Stérilisation recommandée</p>
                        <p className="text-2xl font-bold text-destructive tabular-nums">40,00 Md CDF</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Coût estimé : 1,13 Md CDF</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chart + Decomposition */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm font-semibold">
                          Programmation initiale vs révisée — 12 mois
                        </CardTitle>
                        <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
                          {(["bm", "liq", "rin"] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setChartTab(t)}
                              className={cn(
                                "px-3 py-1 border-l first:border-l-0 border-border transition-colors",
                                chartTab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                              )}
                            >
                              {CHART_CONFIGS[t].label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-5 mt-1 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-6 border-t border-dashed border-[#94a3b8]" />
                          <span className="text-muted-foreground">Programmation initiale</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-6 border-t-2 border-[#f59e0b]" />
                          <span className="text-muted-foreground">Révisée avec achats d&apos;or</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-6 border-t-2 border-[#22c55e]" />
                          <span className="text-muted-foreground">Après stérilisation</span>
                        </div>
                        {cfg.corridorLo !== null && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-3 rounded-sm bg-blue-400/15 border border-blue-400/30" />
                            <span className="text-muted-foreground">Corridor cible</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex gap-4">
                        {/* Chart */}
                        <div className="flex-[3] h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={cfg.data} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              {cfg.corridorLo !== null && cfg.corridorHi !== null && (
                                <ReferenceArea y1={cfg.corridorLo} y2={cfg.corridorHi} fill="#60a5fa" fillOpacity={0.08} />
                              )}
                              <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false} tickLine={false}
                                domain={cfg.yDomain}
                                width={40}
                                tickFormatter={cfg.yTick}
                              />
                              <Tooltip
                                content={({ active, payload, label }) => (
                                  <MacroTooltip active={active} payload={payload as TipPayload[]} label={label} tipFmt={cfg.tip} />
                                )}
                                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                              />
                              <Line type="monotone" dataKey="prog" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                              <Line type="monotone" dataKey="rev"  stroke="#f59e0b" strokeWidth={2}   dot={false} />
                              <Line type="monotone" dataKey="post" stroke="#22c55e" strokeWidth={2}   dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Decomposition */}
                        <div className="flex-[2] border-l border-border/50 pl-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Décomposition de l&apos;écart — Décembre
                          </p>
                          <div className="space-y-2">
                            {DECOMP.map(d => (
                              <div key={d.label} className="flex items-center gap-2 text-[11px]">
                                <span className="w-20 shrink-0 text-muted-foreground text-[10px] truncate">{d.label}</span>
                                <DecompBar value={d.value} color={d.color} />
                                <span
                                  className="w-14 text-right tabular-nums font-semibold shrink-0 text-[10px]"
                                  style={{ color: d.value > 0 ? "#f59e0b" : "#f87171" }}
                                >
                                  {d.value > 0 ? "+" : ""}{d.value.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-2.5" />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold">Impact net</span>
                            <span className="font-bold text-yellow-400 tabular-nums">+{DECOMP_NET.toFixed(2)} Md CDF</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Synthèse de la programmation monétaire */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Synthèse de la programmation monétaire
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border text-[9px] uppercase tracking-wide">
                              <th className="text-left pb-2 font-medium pr-4">Indicateur</th>
                              <th className="text-left pb-2 font-medium pr-3">Unité</th>
                              <th className="text-right pb-2 font-medium pr-3">Programmation initiale</th>
                              <th className="text-right pb-2 font-medium pr-3">Révisée avec or</th>
                              <th className="text-right pb-2 font-medium pr-3">Écart</th>
                              <th className="text-left pb-2 font-medium">Lecture</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SYNTH_ROWS.map(row => (
                              <tr key={row.ind} className="border-b border-border/40 last:border-0">
                                <td className="py-2 pr-4 font-medium">{row.ind}</td>
                                <td className="py-2 pr-3 text-muted-foreground">{row.unit}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{row.init}</td>
                                <td className="text-right py-2 pr-3 tabular-nums font-semibold">{row.rev}</td>
                                <td className="text-right py-2 pr-3 tabular-nums font-bold text-success">{row.ecart}</td>
                                <td className="py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_CLS[row.dot])} />
                                    <span className="text-muted-foreground text-[10px]">{row.lecture}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ── RIGHT PANEL — Synthèse CPM restreint ── */}
                <div className="w-72 shrink-0 space-y-3 sticky top-4">

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Synthèse CPM restreint</CardTitle>
                        <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">Simulation active</Badge>
                      </div>
                      <p className="text-[9px] text-muted-foreground">Scénario central — données illustratives</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold">Programmation révisée v3</p>
                        <p className="text-[9px] text-muted-foreground">Horizon : 12 mois</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Impacts principaux</p>
                        {[
                          { label: "Base monétaire",           val: "+63,34 Md CDF", sub: "Avant stérilisation",      tone: "yellow" },
                          { label: "Liquidité bancaire libre", val: "+48,20 Md CDF", sub: "Après réserve obligatoire", tone: "green"  },
                          { label: "Réserves internationales", val: "+70,80 M USD",  sub: "Reconnaissance à M+2",      tone: "blue"   },
                          { label: "Taux d'atteinte objectif RIN", val: "101,1 %",  sub: "Objectif projeté",           tone: "green"  },
                        ].map(r => (
                          <div key={r.label} className="flex items-start justify-between text-[11px] py-1.5 border-b border-border/40 last:border-0">
                            <span className="text-muted-foreground text-[10px] leading-snug pr-2">{r.label}</span>
                            <div className="text-right shrink-0">
                              <span className={cn(
                                "font-bold tabular-nums",
                                r.tone === "yellow" ? "text-yellow-400" :
                                r.tone === "green"  ? "text-success" :
                                r.tone === "blue"   ? "text-blue-400" : "text-foreground"
                              )}>
                                {r.val}
                              </span>
                              <p className="text-[9px] text-muted-foreground">{r.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pression potentielle sur le change */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Pression sur le change</CardTitle>
                        <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">Modérée</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { k: "Demande USD potentielle", v: "3,30 M USD" },
                          { k: "Volume moyen du marché",  v: "55,00 M USD" },
                          { k: "Indice de pression FX",   v: "6,0 %" },
                          { k: "Coefficient de conversion", v: "18,0 %" },
                        ].map(r => (
                          <div key={r.k} className="py-1 border-b border-border/40">
                            <p className="text-[9px] text-muted-foreground">{r.k}</p>
                            <p className="text-[11px] font-semibold tabular-nums">{r.v}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommandation du moteur */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Recommandation du moteur</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {[
                        "Absorber 40,00 Md CDF par émission de Bons BCC.",
                        "Maturité indicative : 91 jours, sous réserve des conditions de marché.",
                        "Maintenir un suivi mensuel jusqu'à la monétisation des lots.",
                      ].map((txt, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                          <span className="text-muted-foreground leading-snug">{txt}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Coût estimé de stérilisation */}
                  <Card>
                    <CardContent className="px-3 py-3 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Coût estimé de stérilisation</p>
                      <p className="text-2xl font-bold text-destructive tabular-nums">1,13 Md CDF</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Taux moyen simulé : 11,25 %</p>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full h-8 text-[11px] gap-2">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Recalculer le scénario
                    </Button>
                    <Button className="w-full h-8 text-[11px] gap-2 bg-blue-600 hover:bg-blue-700">
                      <FileText className="h-3.5 w-3.5" />
                      Générer la note CPM
                    </Button>
                  </div>

                  <p className="text-[9px] text-muted-foreground text-right">
                    Dernière mise à jour : 19/06/2026 — 15:20
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
