"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Send,
  BarChart3,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

const LBMA_FLOOR = 995.0
const REFEREE_THRESHOLD = 1.0

type Outcome = "accepted" | "referee_hold" | "rejected" | ""

export default function BarVarianceReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string
  const barId = params.barId as string

  const [barSerial, setBarSerial] = useState(barId)
  const [grossWeightKg, setGrossWeightKg] = useState(12.441)
  const [vaultFineness, setVaultFineness] = useState(993.8)
  const [sgsFineness, setSgsFineness] = useState(996.2)
  const [outcomeOverride, setOutcomeOverride] = useState<Outcome>("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const divergence = Math.abs(vaultFineness - sgsFineness)
  const lbmaFloorPass = vaultFineness >= LBMA_FLOOR
  const lbmaFloorPassSgs = sgsFineness >= LBMA_FLOOR

  const OZ_TO_GRAM = 31.1035
  const vaultFineOz = Math.floor((grossWeightKg * vaultFineness) / OZ_TO_GRAM) / 1000
  const sgsFineOz = Math.floor((grossWeightKg * sgsFineness) / OZ_TO_GRAM) / 1000

  const autoOutcome: Outcome =
    !lbmaFloorPass ? "rejected" : divergence > REFEREE_THRESHOLD ? "referee_hold" : "accepted"

  const effectiveOutcome = outcomeOverride || autoOutcome

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bar_variance",
          barId,
          barSerial,
          vaultFineness,
          sgsFineness,
          divergence,
          lbmaFloorPass,
          vaultFineOz,
          sgsFineOz,
          outcome: effectiveOutcome,
          notes,
        }),
      })
      if (res.ok) setSubmitted(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader
              title={language === "fr" ? "Revue Finesse Barre" : "Bar Fineness Review"}
              subtitle={barSerial}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  {effectiveOutcome === "rejected" ? (
                    <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                  ) : effectiveOutcome === "referee_hold" ? (
                    <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
                  ) : (
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  )}
                  <h2 className="text-xl font-bold">
                    {effectiveOutcome === "rejected"
                      ? (language === "fr" ? "Barre Rejetée" : "Bar Rejected")
                      : effectiveOutcome === "referee_hold"
                      ? (language === "fr" ? "Renvoi Arbitre" : "Referee Hold")
                      : (language === "fr" ? "Barre Acceptée" : "Bar Accepted")}
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">{barSerial}</p>
                  <Button onClick={() => router.push(`/vault-intake/${shipmentId}/variance`)} className="w-full">
                    {language === "fr" ? "Retour Revue Écart" : "Back to Variance Review"}
                  </Button>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Revue Variance Essai — Finesse Barre" : "Assay Variance Review — Bar Fineness"}
            subtitle={`${shipmentId} / ${barId}`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* LBMA Floor Warning */}
              {!lbmaFloorPass && (
                <div className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4">
                  <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800">
                      {language === "fr"
                        ? `REJET AUTOMATIQUE — Finesse ${vaultFineness}‰ sous le plancher LBMA de ${LBMA_FLOOR}‰`
                        : `AUTOMATIC REJECTION — Fineness ${vaultFineness}‰ below LBMA floor of ${LBMA_FLOOR}‰`}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {language === "fr"
                        ? "Cette barre ne répond pas aux critères LBMA Good Delivery. Elle doit être rejetée."
                        : "This bar does not meet LBMA Good Delivery criteria. It must be rejected."}
                    </p>
                  </div>
                </div>
              )}

              {/* Referee Hold Warning */}
              {lbmaFloorPass && divergence > REFEREE_THRESHOLD && (
                <div className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800">
                      {language === "fr"
                        ? `RENVOI ARBITRE — Divergence ${divergence.toFixed(1)}‰ dépasse le seuil de ${REFEREE_THRESHOLD}‰`
                        : `REFEREE HOLD — Divergence ${divergence.toFixed(1)}‰ exceeds threshold of ${REFEREE_THRESHOLD}‰`}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {language === "fr"
                        ? "Un essai arbitre indépendant doit être commandé avant acceptation."
                        : "An independent referee assay must be ordered before acceptance."}
                    </p>
                  </div>
                </div>
              )}

              {/* Bar Identification */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    {language === "fr" ? "Identification de la Barre" : "Bar Identification"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "N° Série Barre" : "Bar Serial Number"}</Label>
                      <Input
                        value={barSerial}
                        onChange={(e) => setBarSerial(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Poids Brut (kg)" : "Gross Weight (kg)"}</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={grossWeightKg}
                        onChange={(e) => setGrossWeightKg(parseFloat(e.target.value) || 0)}
                        className="font-mono text-right"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fineness Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {language === "fr" ? "Comparaison Finesse (‰)" : "Fineness Comparison (‰)"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? `Plancher LBMA Good Delivery: ${LBMA_FLOOR}‰ — Seuil divergence: ${REFEREE_THRESHOLD}‰`
                      : `LBMA Good Delivery floor: ${LBMA_FLOOR}‰ — Divergence threshold: ${REFEREE_THRESHOLD}‰`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {language === "fr" ? "Finesse Coffre (mesuré)" : "Vault Fineness (measured)"}
                        {lbmaFloorPass
                          ? <Badge className="bg-emerald-500 text-xs">≥ {LBMA_FLOOR}‰</Badge>
                          : <Badge variant="destructive" className="text-xs">&lt; {LBMA_FLOOR}‰</Badge>}
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        max={1000}
                        value={vaultFineness}
                        onChange={(e) => setVaultFineness(parseFloat(e.target.value) || 0)}
                        className={`font-mono text-right text-lg font-bold ${!lbmaFloorPass ? "border-red-500 bg-red-50" : ""}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {language === "fr" ? "Finesse SGS (certificat)" : "SGS Fineness (certificate)"}
                        {lbmaFloorPassSgs
                          ? <Badge className="bg-emerald-500 text-xs">≥ {LBMA_FLOOR}‰</Badge>
                          : <Badge variant="destructive" className="text-xs">&lt; {LBMA_FLOOR}‰</Badge>}
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        max={1000}
                        value={sgsFineness}
                        onChange={(e) => setSgsFineness(parseFloat(e.target.value) || 0)}
                        className="font-mono text-right text-lg font-bold"
                      />
                    </div>
                  </div>

                  {/* Divergence summary */}
                  <div className={`grid grid-cols-3 gap-3 p-4 rounded-lg border-2 ${
                    !lbmaFloorPass ? "border-red-300 bg-red-50"
                    : divergence > REFEREE_THRESHOLD ? "border-amber-300 bg-amber-50"
                    : "border-emerald-300 bg-emerald-50"
                  }`}>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Divergence" : "Divergence"}</p>
                      <p className={`text-xl font-bold font-mono ${
                        divergence > REFEREE_THRESHOLD ? "text-amber-700" : "text-emerald-700"
                      }`}>{divergence.toFixed(1)}‰</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Oz Fin Coffre" : "Vault Fine Oz"}</p>
                      <p className="text-xl font-bold font-mono">{vaultFineOz.toFixed(3)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Oz Fin SGS" : "SGS Fine Oz"}</p>
                      <p className="text-xl font-bold font-mono">{sgsFineOz.toFixed(3)}</p>
                    </div>
                  </div>

                  {/* Automatic outcome */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground flex-1">
                      {language === "fr" ? "Issue automatique :" : "Automatic outcome:"}
                    </p>
                    <Badge variant={
                      autoOutcome === "rejected" ? "destructive"
                      : autoOutcome === "referee_hold" ? "secondary"
                      : "default"
                    } className={autoOutcome === "referee_hold" ? "bg-amber-500" : ""}>
                      {autoOutcome === "rejected"
                        ? (language === "fr" ? "Rejeté" : "Rejected")
                        : autoOutcome === "referee_hold"
                        ? (language === "fr" ? "Arbitre" : "Referee Hold")
                        : (language === "fr" ? "Accepté" : "Accepted")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Decision & Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{language === "fr" ? "Décision de l'Agent Essai" : "Assay Officer Decision"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={language === "fr"
                      ? "Observations, conditions d'essai, équipement utilisé..."
                      : "Observations, assay conditions, equipment used..."}
                    rows={3}
                  />

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`flex-1 ${effectiveOutcome === "rejected" ? "bg-red-600 hover:bg-red-700" : effectiveOutcome === "referee_hold" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? (language === "fr" ? "Enregistrement..." : "Saving...")
                        : effectiveOutcome === "rejected"
                        ? (language === "fr" ? "Confirmer Rejet" : "Confirm Rejection")
                        : effectiveOutcome === "referee_hold"
                        ? (language === "fr" ? "Demander Arbitre" : "Request Referee")
                        : (language === "fr" ? "Valider Barre" : "Accept Bar")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
