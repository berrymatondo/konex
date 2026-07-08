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
import {
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle,
  RefreshCw, FileText, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartView = "avoirs" | "facteurs" | "prevision";

// ─── Static data ──────────────────────────────────────────────────────────────

const TRAJECTORY_DATA = [
  { month: "Jan",  prog: 460, pre: 462, post: 465 },
  { month: "Fév",  prog: 461, pre: 468, post: 466 },
  { month: "Mar",  prog: 462, pre: 474, post: 467 },
  { month: "Avr",  prog: 463, pre: 481, post: 468 },
  { month: "Mai",  prog: 464, pre: 489, post: 469 },
  { month: "Jun",  prog: 465, pre: 497, post: 470 },
  { month: "Jul",  prog: 466, pre: 502, post: 470 },
  { month: "Aoû",  prog: 467, pre: 506, post: 471 },
  { month: "Sep",  prog: 468, pre: 509, post: 471 },
  { month: "Oct",  prog: 469, pre: 511, post: 472 },
  { month: "Nov",  prog: 470, pre: 513, post: 471 },
  { month: "Déc",  prog: 471, pre: 514, post: 470 },
];

// Confidence band for "Prévision" view
const PREVISION_DATA = TRAJECTORY_DATA.map(d => ({
  ...d,
  lo: +(d.post - 8).toFixed(1),
  hi: +(d.post + 8).toFixed(1),
}));

const FACTORS = [
  { label: "Achats d'or",  value: 48.05, pos: true  },
  { label: "Trésor",       value: 18.20, pos: true  },
  { label: "Change",       value: -12.40, pos: false },
  { label: "Billets",      value: -8.60,  pos: false },
  { label: "Autres",       value: 3.75,  pos: true  },
  { label: "Bons BCC",     value: -44.00, pos: false },
];

const RO_ROWS = [
  { assiette: "Dépôts à vue CDF",     symbole: "DAV_CDF", encours: "1 820,00 Md", coef: "12,0 %", ro: "218,40 Md", varOr: "+4,85 Md", impactAL: "−4,85 Md", lecture: "Effet principal",   lectureTone: "warning"  as const },
  { assiette: "Comptes d'épargne CDF", symbole: "EP_CDF",  encours: "860,00 Md",  coef: "7,0 %",  ro: "60,20 Md",  varOr: "+0,94 Md", impactAL: "−0,94 Md", lecture: "Effet secondaire",  lectureTone: "warning"  as const },
  { assiette: "Dépôts à vue USD",     symbole: "DAV_USD", encours: "620,00 M USD", coef: "13,0 %", ro: "80,60 M USD", varOr: "—",    impactAL: "—",        lecture: "Sans effet",       lectureTone: "neutral"  as const },
  { assiette: "Comptes d'épargne USD", symbole: "EP_USD",  encours: "410,00 M USD", coef: "8,0 %",  ro: "32,80 M USD", varOr: "—",    impactAL: "—",        lecture: "Sans effet",       lectureTone: "neutral"  as const },
];

const PROJECTION_ROWS = [
  { periode: "J+1", prog: "464,00", or: "+0,80", tresor: "+0,60", fx: "−0,40", billets: "−0,30", dRO: "−0,10", bcc: "+0,00", pre: "465,20", action: "−0,80", post: "464,40" },
  { periode: "J+7", prog: "467,00", or: "+4,20", tresor: "+2,80", fx: "−1,90", billets: "−1,40", dRO: "−0,50", bcc: "−4,20", pre: "470,40", action: "−4,20", post: "466,20" },
  { periode: "M+1", prog: "471,00", or: "+48,05",tresor: "+18,20", fx: "−12,40",billets: "−8,60", dRO: "−5,79", bcc: "+0,00", pre: "514,00", action: "−44,00",post: "470,00" },
];

const CORRIDOR_MIN = 450;
const CORRIDOR_MAX = 490;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  strokeDasharray?: string;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.filter(p => !["lo","hi"].includes(p.name)).map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-semibold ml-auto pl-4">{p.value} Md</span>
        </div>
      ))}
    </div>
  );
}

function MetricRow({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone?: "positive" | "negative" | "warning" | "info" | "neutral";
}) {
  const valueClass =
    tone === "positive" ? "text-success" :
    tone === "negative" ? "text-destructive" :
    tone === "warning"  ? "text-yellow-400" :
    tone === "info"     ? "text-blue-400" :
    "text-foreground";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-xs">
      <span className="text-muted-foreground leading-snug">{label}</span>
      <div className="text-right">
        <span className={cn("font-bold", valueClass)}>{value}</span>
        {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalibrationPage() {
  const [chartView, setChartView] = useState<ChartView>("avoirs");

  const chartData = chartView === "prevision" ? PREVISION_DATA : TRAJECTORY_DATA;

  const impactNet = FACTORS.reduce((s, f) => s + f.value, 0);
  const maxBarAbs = Math.max(...FACTORS.map(f => Math.abs(f.value)));

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="H2. Calibration de la Liquidité Prévisionnelle"
            subtitle="Recalibrer les avoirs libres et calibrer les opérations de politique monétaire"
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px] space-y-4">

              {/* ── Header meta strip ── */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <div className="rounded-lg border border-border bg-card px-3 py-1.5">
                  <span className="text-muted-foreground">Période de calibration </span>
                  <span className="font-semibold">Juil. – Déc. 2026</span>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-1.5">
                  <span className="text-muted-foreground">Fréquence </span>
                  <span className="font-semibold">Hebdomadaire</span>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-1.5">
                  <span className="text-muted-foreground">Version </span>
                  <span className="font-semibold">Calibration révisée v2</span>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-1.5">
                  <span className="text-muted-foreground">Direction </span>
                  <span className="font-semibold">Analyses Économiques</span>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 border font-semibold">
                  Simulation
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                    Données monétaires synchronisées
                  </Badge>
                  <Badge variant="outline" className="border-success/40 text-success text-[10px]">
                    Programme d&apos;or intégré
                  </Badge>
                </div>
              </div>

              {/* ── Main layout ── */}
              <div className="flex gap-4 items-start">

                {/* LEFT column */}
                <div className="flex-1 min-w-0 space-y-4">

                  {/* Calibration parameters */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Paramètres de calibration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Row 1 */}
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Avoirs libres initiaux</p>
                          <p className="text-base font-bold">465,00 Md CDF</p>
                          <p className="text-[9px] text-muted-foreground">Position observée au départ</p>
                        </div>
                        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Paiements d&apos;or en CDF</p>
                          <p className="text-base font-bold text-yellow-400">63,34 Md CDF</p>
                          <p className="text-[9px] text-muted-foreground">Avant réserve obligatoire</p>
                        </div>
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Part scripturale</p>
                          <p className="text-base font-bold">85,0 %</p>
                          <p className="text-[9px] text-muted-foreground">Part créditée sur comptes bancaires</p>
                        </div>
                        <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Corridor cible</p>
                          <p className="text-base font-bold text-blue-400">450 – 490 Md</p>
                          <p className="text-[9px] text-muted-foreground">Cible centrale : 470 Md CDF</p>
                        </div>
                        {/* Row 2 — 4 coefficients RO */}
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">RO dépôts à vue CDF</p>
                          <p className="text-sm font-bold">12,0 %</p>
                          <p className="text-[9px] text-muted-foreground">ρ DAV_CDF</p>
                        </div>
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">RO comptes d&apos;épargne CDF</p>
                          <p className="text-sm font-bold">7,0 %</p>
                          <p className="text-[9px] text-muted-foreground">ρ EP_CDF</p>
                        </div>
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">RO dépôts à vue USD</p>
                          <p className="text-sm font-bold">13,0 %</p>
                          <p className="text-[9px] text-muted-foreground">ρ DAV_USD</p>
                        </div>
                        <div className="border border-border rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">RO comptes d&apos;épargne USD</p>
                          <p className="text-sm font-bold">8,0 %</p>
                          <p className="text-[9px] text-muted-foreground">ρ EP_USD</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-2 italic">
                        Valeurs illustratives — coefficients paramétrables selon la réglementation en vigueur
                      </p>
                    </CardContent>
                  </Card>

                  {/* Impact cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Avoirs libres pré-action</p>
                        <ArrowUpRight className="h-3.5 w-3.5 text-yellow-400" />
                      </div>
                      <p className="text-xl font-bold text-blue-400">514,00 Md CDF</p>
                      <p className="text-[10px] text-yellow-400 mt-0.5">+48,00 Md vs position initiale</p>
                      <p className="text-[9px] text-muted-foreground">Avant opérations de politique monétaire</p>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Impact net des achats d&apos;or</p>
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      </div>
                      <p className="text-xl font-bold text-success">+48,05 Md CDF</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Après RO additionnelle de 5,79 Md</p>
                      <p className="text-[9px] text-muted-foreground">Part scripturale nette</p>
                    </Card>
                    <Card className="p-3 border-yellow-500/30 bg-yellow-500/5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Stérilisation recommandée</p>
                        <TrendingDown className="h-3.5 w-3.5 text-yellow-400" />
                      </div>
                      <p className="text-xl font-bold text-yellow-400">44,00 Md CDF</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Maturité indicative : 91 jours</p>
                      <p className="text-[9px] text-muted-foreground">Retour vers la cible centrale</p>
                    </Card>
                    <Card className="p-3 border-success/30 bg-success/5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Avoirs libres post-action</p>
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      </div>
                      <p className="text-xl font-bold text-success">470,00 Md CDF</p>
                      <p className="text-[10px] text-success mt-0.5">Dans le corridor cible</p>
                      <p className="text-[9px] text-muted-foreground">Gap résiduel : 0,00 Md CDF</p>
                    </Card>
                  </div>

                  {/* Chart + facteur decomposition */}
                  <div className="flex gap-4">
                    {/* Chart */}
                    <Card className="flex-1 min-w-0">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-sm font-semibold">
                            Trajectoire des avoirs libres — 12 mois
                          </CardTitle>
                          <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
                            {(["avoirs", "facteurs", "prevision"] as const).map(v => (
                              <button
                                key={v}
                                onClick={() => setChartView(v)}
                                className={cn(
                                  "px-2.5 py-1 border-l first:border-l-0 border-border transition-colors capitalize",
                                  chartView === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                              >
                                {v === "avoirs" ? "Avoirs libres" : v === "facteurs" ? "Facteurs" : "Prévision"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 mt-1 text-[10px] flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-px w-6" style={{ background: "#94a3b8", borderTop: "1.5px dashed #94a3b8" }} />
                            <span className="text-muted-foreground">Programmation initiale</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-0.5 w-6 rounded-full bg-yellow-400" />
                            <span className="text-muted-foreground">Pré-action</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-0.5 w-6 rounded-full bg-green-400" />
                            <span className="text-muted-foreground">Post-action</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-3 w-4 rounded-sm bg-green-500/10 border border-green-500/30" />
                            <span className="text-muted-foreground">Corridor cible</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-2 pb-4">
                        <div className="h-60 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              {/* Corridor band */}
                              <ReferenceArea
                                y1={CORRIDOR_MIN} y2={CORRIDOR_MAX}
                                fill="#22c55e" fillOpacity={0.06}
                                stroke="#22c55e" strokeOpacity={0.25} strokeDasharray="4 2"
                              />
                              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                              <YAxis domain={[430, 535]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={44} />
                              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }} />
                              <Line type="monotone" dataKey="prog" name="Programmation initiale" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                              <Line type="monotone" dataKey="pre" name="Pré-action" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                              <Line type="monotone" dataKey="post" name="Post-action" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                              {chartView === "prevision" && (
                                <>
                                  <Line type="monotone" dataKey="lo" stroke="#22c55e" strokeWidth={0.5} strokeDasharray="2 2" dot={false} strokeOpacity={0.4} name="lo" />
                                  <Line type="monotone" dataKey="hi" stroke="#22c55e" strokeWidth={0.5} strokeDasharray="2 2" dot={false} strokeOpacity={0.4} name="hi" />
                                </>
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Facteur decomposition */}
                    <Card className="w-64 shrink-0">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                          Décomposition du gap — Déc.
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1.5">
                        {FACTORS.map(f => (
                          <div key={f.label}>
                            <div className="flex items-center justify-between text-[10px] mb-0.5">
                              <span className="text-muted-foreground">{f.label}</span>
                              <span className={cn("font-semibold tabular-nums", f.pos ? "text-success" : "text-destructive")}>
                                {f.value >= 0 ? "+" : ""}{f.value.toFixed(2)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", f.pos ? "bg-success" : "bg-destructive")}
                                style={{ width: `${Math.min(100, (Math.abs(f.value) / maxBarAbs) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                        <Separator className="my-1.5" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold">Impact net</span>
                          <span className={cn("font-bold tabular-nums", impactNet >= 0 ? "text-success" : "text-destructive")}>
                            {impactNet >= 0 ? "+" : ""}{impactNet.toFixed(2)} Md CDF
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Reserve obligatoire table */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Réserve obligatoire et impact sur les avoirs libres
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border text-[9px] uppercase tracking-wide">
                              <th className="text-left pb-2 font-medium pr-3">Assiette</th>
                              <th className="text-right pb-2 font-medium pr-3">Encours</th>
                              <th className="text-right pb-2 font-medium pr-3">Coefficient</th>
                              <th className="text-right pb-2 font-medium pr-3">RO calculée</th>
                              <th className="text-right pb-2 font-medium pr-3">Variation liée à l&apos;or</th>
                              <th className="text-right pb-2 font-medium pr-3">Impact sur AL</th>
                              <th className="text-left pb-2 font-medium">Lecture</th>
                            </tr>
                          </thead>
                          <tbody>
                            {RO_ROWS.map(r => (
                              <tr key={r.symbole} className="border-b border-border/40 last:border-0">
                                <td className="py-2 pr-3 font-medium">{r.assiette}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{r.encours}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{r.coef}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{r.ro}</td>
                                <td className={cn("text-right py-2 pr-3 tabular-nums font-medium", r.varOr.startsWith("+") ? "text-success" : "text-muted-foreground")}>
                                  {r.varOr}
                                </td>
                                <td className={cn("text-right py-2 pr-3 tabular-nums font-medium", r.impactAL.startsWith("−") ? "text-destructive" : "text-muted-foreground")}>
                                  {r.impactAL}
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                                      r.lectureTone === "warning" ? "bg-yellow-400" : "bg-muted-foreground/40"
                                    )} />
                                    <span className={cn(
                                      "text-[10px]",
                                      r.lectureTone === "warning" ? "text-yellow-400" : "text-muted-foreground"
                                    )}>
                                      {r.lecture}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border bg-muted/10">
                              <td colSpan={4} className="py-2 font-semibold text-[10px]">Réserve obligatoire additionnelle liée aux achats d&apos;or</td>
                              <td className="text-right py-2 pr-3 text-success font-bold tabular-nums">+5,79 Md CDF</td>
                              <td className="text-right py-2 pr-3 text-destructive font-bold tabular-nums">−5,79 Md CDF</td>
                              <td className="py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                                  <span className="text-[10px] text-success">Intégrée à la calibration</span>
                                </div>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Projection table */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Tableau de projection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] whitespace-nowrap">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground text-[9px] uppercase tracking-wide">
                              <th className="text-left pb-2 font-medium pr-3">Période</th>
                              <th className="text-right pb-2 font-medium pr-3">AL prog.</th>
                              <th className="text-right pb-2 font-medium pr-3">Or</th>
                              <th className="text-right pb-2 font-medium pr-3">Trésor</th>
                              <th className="text-right pb-2 font-medium pr-3">FX</th>
                              <th className="text-right pb-2 font-medium pr-3">Billets</th>
                              <th className="text-right pb-2 font-medium pr-3">ΔRO</th>
                              <th className="text-right pb-2 font-medium pr-3">BCC prog.</th>
                              <th className="text-right pb-2 font-medium pr-3">AL pré-action</th>
                              <th className="text-right pb-2 font-medium pr-3">Action</th>
                              <th className="text-right pb-2 font-medium">AL post-action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PROJECTION_ROWS.map(r => (
                              <tr key={r.periode} className="border-b border-border/40 last:border-0">
                                <td className="py-2 pr-3 font-semibold">{r.periode}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{r.prog}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-success">{r.or}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-success">{r.tresor}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-destructive">{r.fx}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-destructive">{r.billets}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-destructive">{r.dRO}</td>
                                <td className="text-right py-2 pr-3 tabular-nums">{r.bcc}</td>
                                <td className="text-right py-2 pr-3 tabular-nums font-semibold text-yellow-400">{r.pre}</td>
                                <td className="text-right py-2 pr-3 tabular-nums text-destructive">{r.action}</td>
                                <td className="text-right py-2 tabular-nums font-semibold text-success">{r.post}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-[9px] text-muted-foreground mt-2">Montants en Md CDF sauf mention contraire. Base de normalisation : avoirs libres programmés.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT — Synthèse de calibration */}
                <div className="w-72 shrink-0 space-y-3 sticky top-4">

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Synthèse de calibration</CardTitle>
                        <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">Simulation active</Badge>
                      </div>
                      <p className="text-[9px] text-muted-foreground">Diagnostic central — données illustratives</p>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold mb-0.5">Calibration révisée v2</p>
                        <p className="text-[9px] text-muted-foreground">Horizon : 12 mois</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Résultats principaux</p>
                        <MetricRow label="Avoirs libres pré-action" value="514,00 Md CDF" sub="Au-dessus du corridor" tone="warning" />
                        <MetricRow label="Gap vs cible centrale" value="+44,00 Md CDF" sub="Cible : 470,00 Md" tone="negative" />
                        <MetricRow label="RO additionnelle liée à l'or" value="5,79 Md CDF" sub="DAV et épargne CDF" tone="info" />
                        <MetricRow label="Stérilisation recommandée" value="44,00 Md CDF" sub="Bons BCC — 91 jours" tone="warning" />
                        <MetricRow label="Avoirs libres post-action" value="470,00 Md CDF" sub="Dans le corridor cible" tone="positive" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Qualité de la prévision */}
                  <Card>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Qualité de la prévision</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div>
                          <p className="text-2xl font-bold text-success">92 %</p>
                          <p className="text-[9px] text-muted-foreground">Score de fiabilité</p>
                        </div>
                        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: "92%" }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="border border-border rounded p-1.5">
                          <p className="text-muted-foreground">MAPE</p>
                          <p className="font-bold">4,8 %</p>
                        </div>
                        <div className="border border-border rounded p-1.5">
                          <p className="text-muted-foreground">Biais moyen</p>
                          <p className="font-bold">+1,20 Md CDF</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommandation */}
                  <Card className="border-yellow-500/20 bg-yellow-500/5">
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">Recommandation du moteur</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {[
                        "Émettre 44,00 Md CDF de Bons BCC afin de ramener les avoirs libres à la cible centrale.",
                        "Retenir une maturité indicative de 91 jours, sous réserve des conditions de marché.",
                        "Recalibrer la trajectoire chaque semaine et surveiller la concentration de liquidité par banque.",
                      ].map((rec, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                      <p className="text-[9px] text-muted-foreground italic mt-1">
                        Le moteur propose une action mais ne l&apos;exécute pas automatiquement.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Coût estimé */}
                  <Card>
                    <CardContent className="px-3 py-3 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Coût estimé de stérilisation</p>
                      <p className="text-2xl font-bold text-yellow-400">1,25 Md CDF</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Taux moyen simulé : 11,25 %</p>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full h-8 text-[11px] gap-2 bg-blue-600 hover:bg-blue-700">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Recalculer la calibration
                    </Button>
                    <Button className="w-full h-8 text-[11px] gap-2" variant="outline">
                      <FileText className="h-3.5 w-3.5" />
                      Générer la note CPM
                    </Button>
                  </div>

                  {/* Source */}
                  <p className="text-[9px] text-muted-foreground text-right">
                    Dernière mise à jour : 19/06/2026 — 15:40
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
