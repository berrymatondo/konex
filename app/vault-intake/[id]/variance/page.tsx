"use client"

import { useState, useEffect } from "react"
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
  Scale,
  CheckCircle2,
  RefreshCcw,
  XCircle,
  ArrowLeft,
  Send,
  TrendingDown,
  Info,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import Link from "next/link"

type Resolution = "accept" | "renegotiate" | "reject" | ""

const LBMA_FINE_OZ_FACTOR = 32.1507 // troy oz per kg

export default function VarianceReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [poFineOz, setPoFineOz] = useState(10450.75)
  const [vaultFineOz, setVaultFineOz] = useState(10387.32)
  const [lbmaFixingRef, setLbmaFixingRef] = useState("LBMA-AM-2026-06-25")
  const [lbmaFixingPrice, setLbmaFixingPrice] = useState(2654.5)
  const [notes, setNotes] = useState("")
  const [resolution, setResolution] = useState<Resolution>("")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const varianceOz = vaultFineOz - poFineOz
  const variancePct = poFineOz > 0 ? (varianceOz / poFineOz) * 100 : 0
  const adjustedValue = vaultFineOz * lbmaFixingPrice
  const originalValue = poFineOz * lbmaFixingPrice
  const valueDiff = adjustedValue - originalValue
  const isWithinTolerance = Math.abs(variancePct) <= 0.5

  const handleSubmit = async () => {
    if (!resolution) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poFineOz,
          vaultFineOz,
          varianceOz,
          lbmaFixingReference: lbmaFixingRef,
          adjustedSettlementValue: adjustedValue,
          notes,
          resolution,
          cptNotificationSent: true,
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
              title={language === "fr" ? "Revue Écart de Poids" : "Weight Variance Review"}
              subtitle={shipmentId}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  {resolution === "accept" ? (
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  ) : resolution === "renegotiate" ? (
                    <RefreshCcw className="h-16 w-16 text-amber-500 mx-auto" />
                  ) : (
                    <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                  )}
                  <h2 className="text-xl font-bold">
                    {resolution === "accept"
                      ? (language === "fr" ? "Écart Accepté" : "Variance Accepted")
                      : resolution === "renegotiate"
                      ? (language === "fr" ? "Renégociation Demandée" : "Renegotiation Requested")
                      : (language === "fr" ? "Commande Rejetée" : "Order Rejected")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? `Écart: ${varianceOz.toFixed(2)} oz (${variancePct.toFixed(3)}%)`
                      : `Variance: ${varianceOz.toFixed(2)} oz (${variancePct.toFixed(3)}%)`}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => router.push(`/vault-intake/${shipmentId}`)} className="flex-1">
                      {language === "fr" ? "Retour" : "Back to Intake"}
                    </Button>
                    {resolution === "accept" && (
                      <Button variant="outline" onClick={() => router.push("/settlements")} className="flex-1">
                        {language === "fr" ? "Voir Règlements" : "View Settlements"}
                      </Button>
                    )}
                  </div>
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
            title={language === "fr" ? "Revue Écart de Poids — Gestionnaire Réserves" : "Weight Variance Review — Reserve Manager"}
            subtitle={`${shipmentId} · US-05`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Variance Banner */}
              <div className={`flex items-start gap-3 rounded-lg border p-4 ${
                isWithinTolerance
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}>
                {isWithinTolerance
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
                <div>
                  <p className={`font-semibold ${isWithinTolerance ? "text-emerald-800" : "text-amber-800"}`}>
                    {isWithinTolerance
                      ? (language === "fr" ? "Écart dans la tolérance (±0.50%)" : "Variance within tolerance (±0.50%)")
                      : (language === "fr" ? "Écart hors tolérance — Revue requise" : "Variance out of tolerance — Review required")}
                  </p>
                  <p className={`text-sm mt-1 ${isWithinTolerance ? "text-emerald-700" : "text-amber-700"}`}>
                    {`${variancePct > 0 ? "+" : ""}${variancePct.toFixed(3)}% — ${varianceOz > 0 ? "+" : ""}${varianceOz.toFixed(2)} oz`}
                  </p>
                </div>
              </div>

              {/* Fine Weight Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    {language === "fr" ? "Comparaison Poids Fin" : "Fine Weight Comparison"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Poids fin calculé selon formule LBMA Annexe C"
                      : "Fine weight calculated per LBMA Annex C formula"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Quantité PO (oz fin)" : "PO Quantity (fine oz)"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={poFineOz}
                        onChange={(e) => setPoFineOz(parseFloat(e.target.value) || 0)}
                        className="font-mono text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Poids Coffre (oz fin)" : "Vault Weight (fine oz)"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={vaultFineOz}
                        onChange={(e) => setVaultFineOz(parseFloat(e.target.value) || 0)}
                        className="font-mono text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        {language === "fr" ? "Écart (oz)" : "Variance (oz)"}
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                          variancePct < -0.5 ? "bg-red-100 text-red-700" : variancePct > 0.5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {variancePct > 0 ? "+" : ""}{variancePct.toFixed(3)}%
                        </span>
                      </Label>
                      <div className="font-mono text-right p-2 rounded-lg bg-muted text-lg font-bold">
                        {varianceOz > 0 ? "+" : ""}{varianceOz.toFixed(2)} oz
                      </div>
                    </div>
                  </div>

                  {/* Visual variance bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>-2%</span>
                      <span className="font-medium text-foreground">Tolérance ±0.50%</span>
                      <span>+2%</span>
                    </div>
                    <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-[37.5%] right-[37.5%] bg-emerald-200" />
                      <div
                        className={`absolute top-0 h-full w-1 ${
                          Math.abs(variancePct) <= 0.5 ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        style={{ left: `${Math.min(95, Math.max(5, 50 + variancePct * 25))}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Impact */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    {language === "fr" ? "Impact Financier" : "Financial Impact"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Référence Fixing LBMA" : "LBMA Fixing Reference"}</Label>
                      <Input
                        value={lbmaFixingRef}
                        onChange={(e) => setLbmaFixingRef(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Prix Fixing (USD/oz)" : "Fixing Price (USD/oz)"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={lbmaFixingPrice}
                        onChange={(e) => setLbmaFixingPrice(parseFloat(e.target.value) || 0)}
                        className="font-mono text-right"
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Valeur PO" : "PO Value"}</p>
                      <p className="font-bold font-mono text-sm">${originalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Valeur Coffre" : "Vault Value"}</p>
                      <p className="font-bold font-mono text-sm">${adjustedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${valueDiff < 0 ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Différence" : "Difference"}</p>
                      <p className={`font-bold font-mono text-sm ${valueDiff < 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {valueDiff > 0 ? "+" : ""}${valueDiff.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Counterparty notification hint */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  {language === "fr"
                    ? "La contrepartie sera automatiquement notifiée de votre décision via le portail contrepartie."
                    : "The counterparty will be automatically notified of your decision via the counterparty portal."}
                </p>
              </div>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{language === "fr" ? "Notes du Gestionnaire Réserves" : "Reserve Manager Notes"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={language === "fr"
                      ? "Commentaires sur l'écart, analyse des causes possibles..."
                      : "Comments on the variance, analysis of possible causes..."}
                    rows={3}
                  />
                </CardContent>
              </Card>

              {/* Resolution Decision */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Décision de Résolution" : "Resolution Decision"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {[
                      {
                        value: "accept" as Resolution,
                        icon: CheckCircle2,
                        colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
                        selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500",
                        titleFr: "Accepter Poids Ajusté",
                        titleEn: "Accept Adjusted Weight",
                        descFr: `Régler sur ${vaultFineOz.toFixed(2)} oz fin au prix LBMA. Notification contrepartie automatique.`,
                        descEn: `Settle on ${vaultFineOz.toFixed(2)} fine oz at LBMA price. Automatic counterparty notification.`,
                      },
                      {
                        value: "renegotiate" as Resolution,
                        icon: RefreshCcw,
                        colorClass: "border-amber-200 bg-amber-50 hover:border-amber-400",
                        selectedClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-500",
                        titleFr: "Renégocier les Conditions",
                        titleEn: "Renegotiate Terms",
                        descFr: "Proposer une révision des conditions contractuelles à la contrepartie.",
                        descEn: "Propose a revision of contractual terms to the counterparty.",
                      },
                      {
                        value: "reject" as Resolution,
                        icon: XCircle,
                        colorClass: "border-red-200 bg-red-50 hover:border-red-400",
                        selectedClass: "border-red-500 bg-red-100 ring-2 ring-red-500",
                        titleFr: "Rejeter le Bon de Commande",
                        titleEn: "Reject the Purchase Order",
                        descFr: "Annuler le bon de commande. L'expédition est retournée à la contrepartie.",
                        descEn: "Cancel the purchase order. Shipment is returned to the counterparty.",
                      },
                    ].map(({ value, icon: Icon, colorClass, selectedClass, titleFr, titleEn, descFr, descEn }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setResolution(value)}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          resolution === value ? selectedClass : colorClass
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">{language === "fr" ? titleFr : titleEn}</p>
                            <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? descFr : descEn}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {resolution && (
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Notes de Décision" : "Decision Notes"} <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder={language === "fr" ? "Justifiez votre décision..." : "Justify your decision..."}
                        rows={2}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/vault-intake/${shipmentId}/variance/counterparty`}>
                        {language === "fr" ? "Portail Contrepartie" : "Counterparty Portal"}
                      </Link>
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!resolution || !resolutionNotes || isSubmitting}
                      className={`flex-1 ${resolution === "reject" ? "bg-red-600 hover:bg-red-700" : ""}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? (language === "fr" ? "Soumission..." : "Submitting...")
                        : (language === "fr" ? "Soumettre la Décision" : "Submit Decision")}
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
