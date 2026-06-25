"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Library, SlidersHorizontal, BarChart3, GitCompare, FileOutput, Check } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { ScenarioLibrary } from "@/components/monetary-policy/scenario-library"
import { SimulationConfig, type ValidationIssue } from "@/components/monetary-policy/simulation-config"
import { ProFormaBalanceSheet } from "@/components/monetary-policy/pro-forma-balance-sheet"
import { ScenarioComparison } from "@/components/monetary-policy/scenario-comparison"
import { ExportReview } from "@/components/monetary-policy/export-review"
import {
  BASELINE_BALANCE_SHEET,
  DEFAULT_POLICY_WEIGHTS,
  DEFAULT_PRICE_PER_OZ,
  defaultSettlementDate,
  simulateBalanceSheetImpact,
  templateToParams,
  type FundingSource,
  type PolicyWeights,
  type ScenarioTemplate,
  type SimulationParams,
} from "@/lib/monetary-policy"

const STEPS = [
  { key: "library", icon: Library, en: "Scenario Library", fr: "Bibliothèque" },
  { key: "config", icon: SlidersHorizontal, en: "Configuration", fr: "Configuration" },
  { key: "proforma", icon: BarChart3, en: "Pro-Forma", fr: "Pro-forma" },
  { key: "compare", icon: GitCompare, en: "Comparison", fr: "Comparaison" },
  { key: "export", icon: FileOutput, en: "Export & Review", fr: "Export & Revue" },
] as const

function validate(params: SimulationParams, language: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const reserves = BASELINE_BALANCE_SHEET.assets.goldReserves + BASELINE_BALANCE_SHEET.assets.foreignReserves
  const purchaseValueM = (params.purchaseAmountOz * params.pricePerOz) / 1_000_000

  if (params.purchaseAmountOz <= 0 || params.pricePerOz <= 0) {
    issues.push({
      level: "error",
      message:
        language === "fr"
          ? "La quantité et le prix doivent être supérieurs à zéro."
          : "Amount and price must be greater than zero.",
    })
  }
  if (purchaseValueM > 0.1 * reserves) {
    issues.push({
      level: "error",
      message:
        language === "fr"
          ? `L'achat (${purchaseValueM.toFixed(0)}M) dépasse 10% des réserves totales (${(0.1 * reserves).toFixed(0)}M) en une seule transaction.`
          : `Purchase (${purchaseValueM.toFixed(0)}M) exceeds 10% of total reserves (${(0.1 * reserves).toFixed(0)}M) in a single transaction.`,
    })
  }
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 2)
  if (params.settlementDate && new Date(params.settlementDate) < new Date(minDate.toISOString().slice(0, 10))) {
    issues.push({
      level: "warning",
      message:
        language === "fr"
          ? "La date de règlement doit être ≥ T+2 jours ouvrés."
          : "Settlement date should be ≥ T+2 business days.",
    })
  }
  if (params.fundingSource === "RESERVE_DRAWDOWN" && purchaseValueM > BASELINE_BALANCE_SHEET.assets.foreignReserves * 0.15) {
    issues.push({
      level: "warning",
      message:
        language === "fr"
          ? "Tirage important sur les réserves de change (>15%) : impact significatif sur la liquidité."
          : "Large foreign reserve drawdown (>15%): significant liquidity impact.",
    })
  }
  return issues
}

export default function MonetaryPolicyPage() {
  const { language } = useLanguage()
  const [step, setStep] = useState(0)
  const [params, setParams] = useState<SimulationParams>({
    purchaseAmountOz: 250000,
    pricePerOz: DEFAULT_PRICE_PER_OZ,
    fundingSource: "RESERVE_DRAWDOWN",
    settlementDate: defaultSettlementDate(),
  })
  const [weights, setWeights] = useState<PolicyWeights>(DEFAULT_POLICY_WEIGHTS)
  const [recommendedSource, setRecommendedSource] = useState<FundingSource | null>(null)

  const validation = useMemo(() => validate(params, language), [params, language])
  const hasError = validation.some((v) => v.level === "error")
  const result = useMemo(() => simulateBalanceSheetImpact(params), [params])

  const handleUseTemplate = (template: ScenarioTemplate) => {
    setParams(templateToParams(template, params.pricePerOz))
    setStep(1)
  }

  const canAdvance = step === 1 ? !hasError : true

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Politique Monétaire" : "Monetary Policy"}
            subtitle={
              language === "fr"
                ? "Simulateur d'impact bilanciel — Acquisition d'or (MP-01)"
                : "Balance Sheet Impact Simulator — Gold Acquisition (MP-01)"
            }
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex items-center justify-between gap-3">
                <Link href="/">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Retour" : "Back"}
                  </Button>
                </Link>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  {language === "fr" ? "SIMULATION - NON EXÉCUTÉE" : "SIMULATION - NOT EXECUTED"}
                </Badge>
              </div>

              {/* Stepper */}
              <nav aria-label={language === "fr" ? "Étapes de simulation" : "Simulation steps"}>
                <ol className="flex flex-wrap items-center gap-2">
                  {STEPS.map((s, i) => {
                    const Icon = s.icon
                    const active = i === step
                    const done = i < step
                    return (
                      <li key={s.key} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => (i < step || i === step ? setStep(i) : null)}
                          disabled={i > step}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            active && "border-primary bg-primary text-primary-foreground",
                            done && "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10",
                            !active && !done && "border-border text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                              active ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-muted",
                            )}
                          >
                            {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                          </span>
                          <span className="hidden sm:inline">{language === "fr" ? s.fr : s.en}</span>
                        </button>
                        {i < STEPS.length - 1 && <span className="hidden h-px w-4 bg-border sm:block" />}
                      </li>
                    )
                  })}
                </ol>
              </nav>

              {/* Step content */}
              <div>
                {step === 0 && (
                  <ScenarioLibrary onUseTemplate={handleUseTemplate} onCreateCustom={() => setStep(1)} />
                )}
                {step === 1 && (
                  <SimulationConfig params={params} onChange={setParams} validation={validation} />
                )}
                {step === 2 && <ProFormaBalanceSheet result={result} />}
                {step === 3 && (
                  <ScenarioComparison
                    purchaseAmountOz={params.purchaseAmountOz}
                    pricePerOz={params.pricePerOz}
                    weights={weights}
                    onWeightsChange={setWeights}
                    onRecommendation={setRecommendedSource}
                  />
                )}
                {step === 4 && (
                  <ExportReview params={params} result={result} recommendedSource={recommendedSource} />
                )}
              </div>

              {/* Footer navigation */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Précédent" : "Previous"}
                </Button>
                {step < STEPS.length - 1 && (
                  <Button onClick={() => canAdvance && setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance}>
                    {language === "fr" ? "Suivant" : "Next"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
