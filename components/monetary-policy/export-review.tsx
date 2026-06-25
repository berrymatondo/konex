"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileDown, FileSpreadsheet, Presentation, Braces, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import {
  computeAuditHash,
  fmtMillions,
  fmtPct,
  fundingLabel,
  type SimulationParams,
  type SimulationResult,
  type FundingSource,
} from "@/lib/monetary-policy"
import { useLanguage } from "@/lib/i18n/language-context"

type FormatKey = "pdf" | "excel" | "ppt" | "json"

const FORMATS: { key: FormatKey; labelEn: string; labelFr: string; icon: React.ElementType }[] = [
  { key: "pdf", labelEn: "PDF (print-ready)", labelFr: "PDF (prêt à imprimer)", icon: FileDown },
  { key: "excel", labelEn: "Excel (editable)", labelFr: "Excel (modifiable)", icon: FileSpreadsheet },
  { key: "ppt", labelEn: "PowerPoint", labelFr: "PowerPoint", icon: Presentation },
  { key: "json", labelEn: "JSON (API-ready)", labelFr: "JSON (API)", icon: Braces },
]

export function ExportReview({
  params,
  result,
  recommendedSource,
}: {
  params: SimulationParams
  result: SimulationResult
  recommendedSource: FundingSource | null
}) {
  const { language } = useLanguage()
  const [sections, setSections] = useState({
    summary: true,
    proForma: true,
    comparison: true,
    recommendation: true,
  })
  const [format, setFormat] = useState<FormatKey>("pdf")
  const [signature, setSignature] = useState(true)
  const [auditHash, setAuditHash] = useState<string>("")
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    computeAuditHash(params).then(setAuditHash)
  }, [params])

  const sectionFields: { key: keyof typeof sections; labelEn: string; labelFr: string }[] = [
    { key: "summary", labelEn: "Executive summary", labelFr: "Résumé exécutif" },
    { key: "proForma", labelEn: "Pro-forma balance sheet", labelFr: "Bilan pro-forma" },
    { key: "comparison", labelEn: "Scenario comparison", labelFr: "Comparaison des scénarios" },
    { key: "recommendation", labelEn: "Recommendation", labelFr: "Recommandation" },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Package builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "fr" ? "Constructeur de dossier" : "Package builder"}
          </CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Sélectionnez les sections à inclure dans le dossier comité"
              : "Select the sections to include in the committee package"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {sectionFields.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <Checkbox
                  id={s.key}
                  checked={sections[s.key]}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, [s.key]: Boolean(c) }))}
                />
                <Label htmlFor={s.key} className="font-normal">
                  {language === "fr" ? s.labelFr : s.labelEn}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>{language === "fr" ? "Format d'export" : "Export format"}</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon
                const active = format === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    className={
                      "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors " +
                      (active
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{language === "fr" ? f.labelFr : f.labelEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Checkbox id="signature" checked={signature} onCheckedChange={(c) => setSignature(Boolean(c))} />
            <Label htmlFor="signature" className="font-normal">
              {language === "fr"
                ? "Joindre la signature numérique CB (certificat d'authenticité)"
                : "Attach CB digital signature (authenticity certificate)"}
            </Label>
          </div>

          <Button
            className="w-full"
            onClick={() => setGenerated(true)}
            disabled={!Object.values(sections).some(Boolean)}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {language === "fr" ? "Générer le dossier" : "Generate package"}
          </Button>

          {generated && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{language === "fr" ? "Dossier généré" : "Package generated"}</AlertTitle>
              <AlertDescription>
                {language === "fr"
                  ? `Dossier ${format.toUpperCase()} prêt pour distribution sécurisée au comité de politique.`
                  : `${format.toUpperCase()} package ready for secure distribution to the policy committee.`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary + integrity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "fr" ? "Résumé exécutif" : "Executive summary"}</CardTitle>
          <CardDescription>
            {language === "fr" ? "Aperçu de la simulation à exporter" : "Preview of the simulation to export"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <Row
              label={language === "fr" ? "Quantité d'or" : "Gold amount"}
              value={`${params.purchaseAmountOz.toLocaleString("en-US")} oz`}
            />
            <Row label={language === "fr" ? "Valeur d'achat" : "Purchase value"} value={fmtMillions(result.goldIncrease)} />
            <Row
              label={language === "fr" ? "Financement retenu" : "Selected funding"}
              value={fundingLabel(params.fundingSource, language)}
            />
            {recommendedSource && (
              <Row
                label={language === "fr" ? "Financement recommandé" : "Recommended funding"}
                value={fundingLabel(recommendedSource, language)}
              />
            )}
            <Separator className="my-2" />
            <Row
              label={language === "fr" ? "Or/Réserves (pro-forma)" : "Gold/Reserves (pro-forma)"}
              value={fmtPct(result.proFormaRatios.goldToReserves)}
            />
            <Row
              label={language === "fr" ? "LCR (pro-forma)" : "LCR (pro-forma)"}
              value={`${result.proFormaRatios.liquidityCoverage.toFixed(2)}×`}
            />
          </dl>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {language === "fr" ? "Hachage d'intégrité SHA-256" : "SHA-256 integrity hash"}
            </div>
            {auditHash ? (
              <code className="block break-all text-xs text-muted-foreground">{auditHash}</code>
            ) : (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {language === "fr" ? "Calcul..." : "Computing..."}
              </span>
            )}
          </div>

          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            {language === "fr" ? "SIMULATION - NON EXÉCUTÉE" : "SIMULATION - NOT EXECUTED"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
