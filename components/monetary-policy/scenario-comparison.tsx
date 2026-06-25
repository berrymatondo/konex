"use client"

import { useEffect, useMemo } from "react"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  compareScenarios,
  recommendScenario,
  fundingLabel,
  FUNDING_SOURCES,
  type FundingSource,
  type PolicyWeights,
} from "@/lib/monetary-policy"
import { useLanguage } from "@/lib/i18n/language-context"

const ALL_SOURCES: FundingSource[] = FUNDING_SOURCES.map((f) => f.value)
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export function ScenarioComparison({
  purchaseAmountOz,
  pricePerOz,
  weights,
  onWeightsChange,
  onRecommendation,
}: {
  purchaseAmountOz: number
  pricePerOz: number
  weights: PolicyWeights
  onWeightsChange: (w: PolicyWeights) => void
  onRecommendation?: (source: FundingSource) => void
}) {
  const { language } = useLanguage()

  const metrics = useMemo(
    () => compareScenarios(purchaseAmountOz, pricePerOz, ALL_SOURCES, weights),
    [purchaseAmountOz, pricePerOz, weights],
  )
  const bestIdx = recommendScenario(metrics)
  const bestSource = metrics[bestIdx]?.fundingSource

  // Report the recommended scenario to the parent (used by the export step).
  useEffect(() => {
    if (bestSource && onRecommendation) onRecommendation(bestSource)
  }, [bestSource, onRecommendation])

  const objectiveLabels = {
    reserveAdequacy: language === "fr" ? "Adéquation réserves" : "Reserve adequacy",
    liquidityStability: language === "fr" ? "Stabilité liquidité" : "Liquidity stability",
    costEfficiency: language === "fr" ? "Efficience coût" : "Cost efficiency",
    marketSignaling: language === "fr" ? "Signal de marché" : "Market signaling",
  }

  const radarData = (Object.keys(objectiveLabels) as (keyof typeof objectiveLabels)[]).map((obj) => {
    const row: Record<string, string | number> = { objective: objectiveLabels[obj] }
    metrics.forEach((m) => {
      row[m.fundingSource] = Math.round(m.objectives[obj])
    })
    return row
  })

  const chartConfig: ChartConfig = metrics.reduce((acc, m, i) => {
    acc[m.fundingSource] = { label: fundingLabel(m.fundingSource, language), color: CHART_COLORS[i % CHART_COLORS.length] }
    return acc
  }, {} as ChartConfig)

  const weightFields: { key: keyof PolicyWeights; label: string }[] = [
    { key: "reserveAdequacy", label: objectiveLabels.reserveAdequacy },
    { key: "liquidityStability", label: objectiveLabels.liquidityStability },
    { key: "costEfficiency", label: objectiveLabels.costEfficiency },
    { key: "marketSignaling", label: objectiveLabels.marketSignaling },
  ]
  const weightSum = weightFields.reduce((s, f) => s + weights[f.key], 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === "fr" ? "Arbitrage des objectifs" : "Policy objective trade-offs"}
            </CardTitle>
            <CardDescription>
              {language === "fr"
                ? "Scores normalisés (0-100) par objectif et par scénario"
                : "Normalized scores (0-100) per objective and scenario"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[320px]">
              <RadarChart data={radarData}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarGrid />
                <PolarAngleAxis dataKey="objective" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                {metrics.map((m, i) => (
                  <Radar
                    key={m.fundingSource}
                    dataKey={m.fundingSource}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === "fr" ? "Pondération des objectifs" : "Policy objective weights"}
            </CardTitle>
            <CardDescription>
              {language === "fr"
                ? "Ajustez l'importance relative de chaque objectif"
                : "Adjust the relative importance of each objective"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {weightFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{f.label}</Label>
                  <span className="text-sm font-medium tabular-nums">{weights[f.key]}%</span>
                </div>
                <Slider
                  value={[weights[f.key]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => onWeightsChange({ ...weights, [f.key]: v })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "Somme des poids" : "Weights sum"}</span>
              <span className="font-medium tabular-nums">{weightSum}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "fr" ? "Comparaison des scénarios de financement" : "Funding scenario comparison"}
          </CardTitle>
          <CardDescription>
            {bestSource && (
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-yellow-500" />
                {language === "fr" ? "Recommandation : " : "Recommendation: "}
                <strong>{fundingLabel(bestSource, language)}</strong>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "fr" ? "Scénario" : "Scenario"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Or/Réserves" : "Gold/Reserves"}</TableHead>
                <TableHead className="text-right">LCR</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Coût" : "Cost"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Signal" : "Signaling"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Score composite" : "Composite score"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m, i) => (
                <TableRow key={m.fundingSource} className={cn(i === bestIdx && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {fundingLabel(m.fundingSource, language)}
                      {i === bestIdx && (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                          {language === "fr" ? "Optimal" : "Best"}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.goldToReservesPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{m.liquidityCoverage.toFixed(2)}×</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costOfFundingPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{m.marketSignaling}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{m.compositeScore.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
