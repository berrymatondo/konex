"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, TrendingUp, Check, Wallet, Building2, Rocket } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const EUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// ---- Tarification ---------------------------------------------------------
const TIERS = [
  {
    name: "Starter",
    icon: Wallet,
    price: 350,
    setup: 1000,
    target: "TPE / site unique",
    featured: false,
    features: [
      "Jusqu'à 5 utilisateurs",
      "Contreparties & onboarding KYC",
      "Gestion des risques de base",
      "Rapports standards",
      "Support par email",
    ],
  },
  {
    name: "Business",
    icon: Building2,
    price: 1000,
    setup: 3000,
    target: "PME multi-utilisateurs",
    featured: true,
    features: [
      "Jusqu'à 25 utilisateurs",
      "Profils & accès personnalisés",
      "Screening / sanctions avancé",
      "Workflows d'approbation",
      "Journal d'audit complet",
      "Support prioritaire",
    ],
  },
  {
    name: "Enterprise",
    icon: Rocket,
    price: 3000,
    setup: 5000,
    target: "Grands comptes, SLA",
    featured: false,
    features: [
      "Utilisateurs illimités",
      "SLA & disponibilité garantie",
      "Intégrations sur mesure",
      "Audit & conformité dédiés",
      "Accompagnement & formation",
      "Account manager dédié",
    ],
  },
];

// ---- Business plan (hypothèses) ------------------------------------------
const PRICE_YEAR = { starter: 350 * 12, business: 1000 * 12, enterprise: 3000 * 12 };

const PLAN = [
  { year: "Année 1", starter: 8, business: 3, enterprise: 1, opex: 74000, dev: 70000 },
  { year: "Année 2", starter: 18, business: 8, enterprise: 2, opex: 116000, dev: 0 },
  { year: "Année 3", starter: 35, business: 18, enterprise: 5, opex: 190000, dev: 0 },
];

const projection = (() => {
  let cumulative = 0;
  return PLAN.map((p) => {
    const arr =
      p.starter * PRICE_YEAR.starter + p.business * PRICE_YEAR.business + p.enterprise * PRICE_YEAR.enterprise;
    const costs = p.opex + p.dev;
    const result = arr - costs;
    cumulative += result;
    return {
      year: p.year,
      clients: p.starter + p.business + p.enterprise,
      arr,
      costs,
      result,
      cumulative,
    };
  });
})();

const COST_TABLE = [
  { label: "Développement initial (sans IA)", value: "50 000 – 120 000 €", note: "Capex one-shot, freelance senior → agence" },
  { label: "Infrastructure (Vercel, Neon, Blob)", value: "50 – 350 €/mois", note: "Faible volume, croît avec l'usage" },
  { label: "Maintenance & support (humain)", value: "15 – 25 % du dev / an", note: "Corrections, évolutions, support" },
];

const VALUATION = [
  { label: "Cession du code (sans clients)", value: "50 000 – 120 000 €", note: "≈ 1 à 1,5× le coût de développement" },
  { label: "Cession du produit (avec ARR)", value: "3 à 6× l'ARR", note: "Ex. 250 k€ d'ARR → 0,75 – 1,5 M€" },
];

export default function BusinessPlanPage() {
  const finalYear = projection[projection.length - 1];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title="Business Plan & Tarification" subtitle="Estimation des coûts, valorisation et modèle de revenus" />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl">
              <Tabs defaultValue="pricing" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="pricing" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tarification
                  </TabsTrigger>
                  <TabsTrigger value="plan" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Business plan
                  </TabsTrigger>
                </TabsList>

                {/* ---- Tarification ---- */}
                <TabsContent value="pricing" className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    {TIERS.map((tier) => {
                      const Icon = tier.icon;
                      return (
                        <Card
                          key={tier.name}
                          className={tier.featured ? "border-primary shadow-md ring-1 ring-primary/30" : ""}
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                                  <Icon className="h-5 w-5 text-primary" />
                                </span>
                                <CardTitle>{tier.name}</CardTitle>
                              </div>
                              {tier.featured && <Badge>Recommandé</Badge>}
                            </div>
                            <CardDescription>{tier.target}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold">{EUR(tier.price)}</span>
                                <span className="text-sm text-muted-foreground">/ mois</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                + {EUR(tier.setup)} de frais d'onboarding (one-shot)
                              </p>
                            </div>
                            <Separator />
                            <ul className="space-y-2">
                              {tier.features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-sm">
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                            <Button className="w-full" variant={tier.featured ? "default" : "outline"}>
                              Choisir {tier.name}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Tarifs par entreprise (B2B). Positionnement marché niche réglementé (conformité / négoce de métaux précieux).
                  </p>
                </TabsContent>

                {/* ---- Business plan ---- */}
                <TabsContent value="plan" className="space-y-6">
                  {/* KPIs */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>ARR — Année 3</CardDescription>
                        <CardTitle className="text-2xl">{EUR(finalYear.arr)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Clients — Année 3</CardDescription>
                        <CardTitle className="text-2xl">{finalYear.clients}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Résultat cumulé (3 ans)</CardDescription>
                        <CardTitle className="text-2xl">{EUR(finalYear.cumulative)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Point mort</CardDescription>
                        <CardTitle className="text-2xl">Année 2</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  {/* Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Projection sur 3 ans</CardTitle>
                      <CardDescription>Revenus annuels (ARR), coûts et résultat cumulé</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={projection} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={12} />
                            <YAxis
                              stroke="var(--color-muted-foreground)"
                              fontSize={12}
                              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                            />
                            <Tooltip
                              formatter={(v: number) => EUR(v)}
                              contentStyle={{
                                background: "var(--color-popover)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                color: "var(--color-popover-foreground)",
                              }}
                            />
                            <Legend />
                            <Bar dataKey="arr" name="Revenus (ARR)" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="costs" name="Coûts" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                            <Line
                              type="monotone"
                              dataKey="cumulative"
                              name="Résultat cumulé"
                              stroke="var(--color-chart-2)"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Projection table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Détail de la projection</CardTitle>
                      <CardDescription>Hypothèses indicatives — marché européen B2B</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="px-3 py-2 font-medium">Année</th>
                              <th className="px-3 py-2 text-center font-medium">Clients</th>
                              <th className="px-3 py-2 text-right font-medium">Revenus (ARR)</th>
                              <th className="px-3 py-2 text-right font-medium">Coûts</th>
                              <th className="px-3 py-2 text-right font-medium">Résultat</th>
                              <th className="px-3 py-2 text-right font-medium">Cumulé</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projection.map((p) => (
                              <tr key={p.year} className="border-b last:border-0">
                                <td className="px-3 py-2 font-medium">{p.year}</td>
                                <td className="px-3 py-2 text-center">{p.clients}</td>
                                <td className="px-3 py-2 text-right">{EUR(p.arr)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{EUR(p.costs)}</td>
                                <td
                                  className={`px-3 py-2 text-right font-medium ${
                                    p.result >= 0 ? "text-success" : "text-destructive"
                                  }`}
                                >
                                  {EUR(p.result)}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-medium ${
                                    p.cumulative >= 0 ? "text-success" : "text-destructive"
                                  }`}
                                >
                                  {EUR(p.cumulative)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Costs & valuation */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Coûts</CardTitle>
                        <CardDescription>Développement & fonctionnement</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {COST_TABLE.map((c) => (
                          <div key={c.label} className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium">{c.label}</p>
                              <p className="text-xs text-muted-foreground">{c.note}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold">{c.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Valorisation à la vente</CardTitle>
                        <CardDescription>Selon présence de clients & revenus</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {VALUATION.map((v) => (
                          <div key={v.label} className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium">{v.label}</p>
                              <p className="text-xs text-muted-foreground">{v.note}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold">{v.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Note : ces chiffres sont des estimations indicatives basées sur des hypothèses de marché (Europe, B2B
                    de niche). Les résultats réels dépendent du périmètre exact, du taux d'acquisition, du churn et du pays.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
