"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react"
import {
  BASELINE_BALANCE_SHEET,
  FUNDING_SOURCES,
  fmtMillions,
  totalAssets,
  type FundingSource,
  type SimulationParams,
} from "@/lib/monetary-policy"
import { useLanguage } from "@/lib/i18n/language-context"

export interface ValidationIssue {
  level: "error" | "warning"
  message: string
}

export function SimulationConfig({
  params,
  onChange,
  validation,
}: {
  params: SimulationParams
  onChange: (next: SimulationParams) => void
  validation: ValidationIssue[]
}) {
  const { language } = useLanguage()
  const baseline = BASELINE_BALANCE_SHEET
  const purchaseValueM = (params.purchaseAmountOz * params.pricePerOz) / 1_000_000

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Baseline (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "fr" ? "Bilan de référence" : "Baseline balance sheet"}
          </CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Positions actuelles issues du grand livre (lecture seule)"
              : "Current positions from the core ledger (read-only)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <Row label={language === "fr" ? "Réserves d'or" : "Gold reserves"} value={fmtMillions(baseline.assets.goldReserves)} />
            <Row label={language === "fr" ? "Réserves de change" : "Foreign reserves"} value={fmtMillions(baseline.assets.foreignReserves)} />
            <Row label={language === "fr" ? "Titres domestiques" : "Domestic securities"} value={fmtMillions(baseline.assets.domesticSecurities)} />
            <Row label={language === "fr" ? "Autres actifs" : "Other assets"} value={fmtMillions(baseline.assets.otherAssets)} />
            <Separator className="my-2" />
            <Row label={language === "fr" ? "Total actifs" : "Total assets"} value={fmtMillions(totalAssets(baseline))} bold />
          </dl>
        </CardContent>
      </Card>

      {/* Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "fr" ? "Paramètres d'achat" : "Purchase parameters"}
          </CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Configurez la simulation d'acquisition d'or"
              : "Configure the gold acquisition simulation"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">{language === "fr" ? "Quantité (oz)" : "Amount (oz)"}</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                value={params.purchaseAmountOz}
                onChange={(e) => onChange({ ...params, purchaseAmountOz: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">{language === "fr" ? "Prix / oz (USD)" : "Price / oz (USD)"}</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={params.pricePerOz}
                onChange={(e) => onChange({ ...params, pricePerOz: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {language === "fr" ? "Valeur totale de l'achat" : "Total purchase value"}
              </span>
              <span className="text-lg font-bold">{fmtMillions(purchaseValueM)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="funding">{language === "fr" ? "Source de financement" : "Funding source"}</Label>
            <Select
              value={params.fundingSource}
              onValueChange={(v) => onChange({ ...params, fundingSource: v as FundingSource })}
            >
              <SelectTrigger id="funding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNDING_SOURCES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {language === "fr" ? f.labelFr : f.labelEn} ({f.costPct}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="settlement">{language === "fr" ? "Date de règlement" : "Settlement date"}</Label>
            <Input
              id="settlement"
              type="date"
              value={params.settlementDate}
              onChange={(e) => onChange({ ...params, settlementDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Validation */}
      <div className="lg:col-span-2 space-y-3">
        {validation.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{language === "fr" ? "Contraintes respectées" : "Constraints satisfied"}</AlertTitle>
            <AlertDescription>
              {language === "fr"
                ? "Tous les paramètres respectent les limites de politique en vigueur."
                : "All parameters comply with the active policy constraints."}
            </AlertDescription>
          </Alert>
        ) : (
          validation.map((issue, i) => (
            <Alert key={i} variant={issue.level === "error" ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {issue.level === "error"
                  ? language === "fr"
                    ? "Contrainte non respectée"
                    : "Constraint violated"
                  : language === "fr"
                    ? "Avertissement"
                    : "Warning"}
              </AlertTitle>
              <AlertDescription>{issue.message}</AlertDescription>
            </Alert>
          ))
        )}

        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>{language === "fr" ? "Garantie lecture seule" : "Read-only guarantee"}</AlertTitle>
          <AlertDescription>
            {language === "fr"
              ? "Ce module ne peut pas modifier les données réelles du bilan. Toutes les sorties sont marquées « SIMULATION - NON EXÉCUTÉE »."
              : 'This module cannot modify actual balance sheet data. All outputs are labeled "SIMULATION - NOT EXECUTED".'}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  )
}
