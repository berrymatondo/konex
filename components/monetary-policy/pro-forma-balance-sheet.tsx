"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  fmtMillions,
  fmtPct,
  totalAssets,
  totalLiabilities,
  equity,
  varianceBand,
  type BalanceSheet,
  type KeyRatios,
  type SimulationResult,
} from "@/lib/monetary-policy"
import { useLanguage } from "@/lib/i18n/language-context"

function bandClass(band: "low" | "medium" | "high"): string {
  switch (band) {
    case "low":
      return "text-emerald-600 dark:text-emerald-400"
    case "medium":
      return "text-yellow-600 dark:text-yellow-400"
    case "high":
      return "text-red-600 dark:text-red-400"
  }
}

function VarianceCell({ current, proForma }: { current: number; proForma: number }) {
  const delta = proForma - current
  const pct = current !== 0 ? (delta / current) * 100 : 0
  const band = varianceBand(pct)
  const Icon = delta > 0.001 ? TrendingUp : delta < -0.001 ? TrendingDown : Minus
  if (Math.abs(delta) < 0.001) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", bandClass(band))}>
      <Icon className="h-3.5 w-3.5" />
      {delta > 0 ? "+" : ""}
      {fmtMillions(delta)} ({pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </span>
  )
}

export function ProFormaBalanceSheet({ result }: { result: SimulationResult }) {
  const { language } = useLanguage()
  const { baseline, proForma, baselineRatios, proFormaRatios } = result

  const assetRows: { key: string; label: string; pick: (b: BalanceSheet) => number }[] = [
    { key: "gold", label: language === "fr" ? "Réserves d'or" : "Gold reserves", pick: (b) => b.assets.goldReserves },
    { key: "foreign", label: language === "fr" ? "Réserves de change" : "Foreign reserves", pick: (b) => b.assets.foreignReserves },
    { key: "dom", label: language === "fr" ? "Titres domestiques" : "Domestic securities", pick: (b) => b.assets.domesticSecurities },
    { key: "other", label: language === "fr" ? "Autres actifs" : "Other assets", pick: (b) => b.assets.otherAssets },
  ]
  const liabilityRows: { key: string; label: string; pick: (b: BalanceSheet) => number }[] = [
    { key: "cic", label: language === "fr" ? "Monnaie en circulation" : "Currency in circulation", pick: (b) => b.liabilities.currencyInCirculation },
    { key: "res", label: language === "fr" ? "Comptes de réserve" : "Reserve accounts", pick: (b) => b.liabilities.reserveAccounts },
    { key: "bonds", label: language === "fr" ? "Obligations émises" : "Bonds outstanding", pick: (b) => b.liabilities.bondsOutstanding },
    { key: "fx", label: language === "fr" ? "Swaps de change" : "FX swaps", pick: (b) => b.liabilities.fxSwaps },
    { key: "ext", label: language === "fr" ? "Emprunts externes" : "External borrowing", pick: (b) => b.liabilities.externalBorrowing },
  ]

  return (
    <div className="space-y-6">
      <KeyRatioDashboard baseline={baselineRatios} proForma={proFormaRatios} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "fr" ? "Bilan pro-forma" : "Pro-forma balance sheet"}
          </CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Comparaison actuel vs. post-acquisition avec variances"
              : "Current vs. post-acquisition comparison with variances"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BalanceSection
            title={language === "fr" ? "Actifs" : "Assets"}
            rows={assetRows}
            baseline={baseline}
            proForma={proForma}
            totalLabel={language === "fr" ? "Total actifs" : "Total assets"}
            totalCurrent={totalAssets(baseline)}
            totalProForma={totalAssets(proForma)}
            language={language}
          />
          <BalanceSection
            title={language === "fr" ? "Passifs" : "Liabilities"}
            rows={liabilityRows}
            baseline={baseline}
            proForma={proForma}
            totalLabel={language === "fr" ? "Total passifs" : "Total liabilities"}
            totalCurrent={totalLiabilities(baseline)}
            totalProForma={totalLiabilities(proForma)}
            language={language}
          />
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <span className="font-semibold">{language === "fr" ? "Capitaux propres" : "Equity"}</span>
            <div className="flex items-center gap-4">
              <span className="font-medium">{fmtMillions(equity(proForma))}</span>
              <VarianceCell current={equity(baseline)} proForma={equity(proForma)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceSection({
  title,
  rows,
  baseline,
  proForma,
  totalLabel,
  totalCurrent,
  totalProForma,
  language,
}: {
  title: string
  rows: { key: string; label: string; pick: (b: BalanceSheet) => number }[]
  baseline: BalanceSheet
  proForma: BalanceSheet
  totalLabel: string
  totalCurrent: number
  totalProForma: number
  language: string
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{language === "fr" ? "Poste" : "Line item"}</TableHead>
            <TableHead className="text-right">{language === "fr" ? "Actuel" : "Current"}</TableHead>
            <TableHead className="text-right">Pro-forma</TableHead>
            <TableHead className="text-right">{language === "fr" ? "Variance" : "Variance"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMillions(r.pick(baseline))}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{fmtMillions(r.pick(proForma))}</TableCell>
              <TableCell className="text-right tabular-nums">
                <VarianceCell current={r.pick(baseline)} proForma={r.pick(proForma)} />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2">
            <TableCell className="font-bold">{totalLabel}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmtMillions(totalCurrent)}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmtMillions(totalProForma)}</TableCell>
            <TableCell className="text-right tabular-nums">
              <VarianceCell current={totalCurrent} proForma={totalProForma} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function KeyRatioDashboard({ baseline, proForma }: { baseline: KeyRatios; proForma: KeyRatios }) {
  const { language } = useLanguage()
  const ratios: {
    key: keyof KeyRatios
    label: string
    format: (v: number) => string
    /** A material change threshold in percentage points / percent for highlighting. */
  }[] = [
    { key: "goldToReserves", label: language === "fr" ? "Or / Réserves" : "Gold / Reserves", format: (v) => fmtPct(v) },
    { key: "liquidityCoverage", label: language === "fr" ? "Couverture liquidité (LCR)" : "Liquidity coverage (LCR)", format: (v) => v.toFixed(2) + "×" },
    { key: "leverage", label: language === "fr" ? "Levier" : "Leverage", format: (v) => v.toFixed(2) + "×" },
    { key: "capitalAdequacy", label: language === "fr" ? "Adéquation des fonds propres" : "Capital adequacy", format: (v) => fmtPct(v) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ratios.map((r) => {
        const cur = baseline[r.key]
        const post = proForma[r.key]
        const pct = cur !== 0 ? ((post - cur) / cur) * 100 : 0
        const band = varianceBand(pct)
        const delta = post - cur
        return (
          <Card key={r.key}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{r.format(post)}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    band === "low" && "border-emerald-500 text-emerald-600",
                    band === "medium" && "border-yellow-500 text-yellow-600",
                    band === "high" && "border-red-500 text-red-600",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {pct.toFixed(1)}%
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {language === "fr" ? "réf." : "base"} {r.format(cur)}
                </span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
