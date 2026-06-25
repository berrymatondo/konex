"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  MessageSquare,
  Clock,
  FileText,
  ArrowLeft,
  Send,
  Scale,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

type ResponseType = "accept" | "referee" | "dispute" | ""

export default function CounterpartyVariancePortalPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [responseType, setResponseType] = useState<ResponseType>("")
  const [responseNotes, setResponseNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // These would come from the variance review created by RM
  const varianceDetails = {
    poFineOz: 10450.75,
    vaultFineOz: 10387.32,
    varianceOz: -63.43,
    variancePct: -0.607,
    lbmaFixingRef: "LBMA-AM-2026-06-25",
    lbmaFixingPrice: 2654.5,
    deadline: "2026-06-28 17:00",
  }

  const adjustedValue = varianceDetails.vaultFineOz * varianceDetails.lbmaFixingPrice
  const originalValue = varianceDetails.poFineOz * varianceDetails.lbmaFixingPrice
  const valueDiff = adjustedValue - originalValue

  const handleSubmit = async () => {
    if (!responseType) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance/counterparty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseType,
          responseNotes,
          varianceReviewId: shipmentId,
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
              title={language === "fr" ? "Portail Contrepartie — Écart de Poids" : "Counterparty Portal — Weight Variance"}
              subtitle={shipmentId}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  <h2 className="text-xl font-bold">
                    {language === "fr" ? "Réponse Soumise" : "Response Submitted"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {responseType === "accept"
                      ? (language === "fr" ? "Vous avez accepté le poids ajusté. Le processus de règlement va démarrer." : "You accepted the adjusted weight. Settlement process will begin.")
                      : responseType === "referee"
                      ? (language === "fr" ? "Demande d'arbitre envoyée. Un laboratoire indépendant sera nommé." : "Referee request sent. An independent lab will be appointed.")
                      : (language === "fr" ? "Contestation soumise. L'équipe de conformité va examiner votre dossier." : "Dispute submitted. The compliance team will review your case.")}
                  </p>
                  <Button onClick={() => router.back()} className="w-full">
                    {language === "fr" ? "Retour" : "Back"}
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
            title={language === "fr" ? "Portail Contrepartie — Mise en Attente Écart de Poids" : "Counterparty Portal — Weight Variance Hold"}
            subtitle={`${shipmentId} · US-05`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Hold Notification Banner */}
              <div className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-amber-800">
                    {language === "fr"
                      ? "Mise en attente pour écart de poids — Réponse requise"
                      : "Weight Variance Hold — Response Required"}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    {language === "fr"
                      ? `Un écart de poids a été détecté sur votre expédition ${shipmentId}. Veuillez sélectionner votre réponse avant le ${varianceDetails.deadline}.`
                      : `A weight variance has been detected on your shipment ${shipmentId}. Please select your response before ${varianceDetails.deadline}.`}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-amber-700 text-sm font-medium whitespace-nowrap">
                  <Clock className="h-4 w-4" />
                  {language === "fr" ? "Délai:" : "Deadline:"}
                </div>
              </div>

              {/* Variance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    {language === "fr" ? "Résumé de l'Écart Détecté" : "Detected Variance Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Quantité PO (oz)" : "PO Quantity (oz)"}</p>
                      <p className="font-bold font-mono">{varianceDetails.poFineOz.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Coffre Mesuré (oz)" : "Vault Measured (oz)"}</p>
                      <p className="font-bold font-mono">{varianceDetails.vaultFineOz.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                      <p className="text-xs text-red-600 mb-1">{language === "fr" ? "Écart (oz)" : "Variance (oz)"}</p>
                      <p className="font-bold font-mono text-red-700">{varianceDetails.varianceOz.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                      <p className="text-xs text-red-600 mb-1">{language === "fr" ? "Écart (%)" : "Variance (%)"}</p>
                      <p className="font-bold font-mono text-red-700">{varianceDetails.variancePct.toFixed(3)}%</p>
                    </div>
                  </div>

                  {/* Financial Impact */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">{language === "fr" ? "Impact Financier (Fixing LBMA)" : "Financial Impact (LBMA Fixing)"}</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">{language === "fr" ? "Valeur originale" : "Original value"}</p>
                        <p className="font-mono font-bold">${originalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{language === "fr" ? "Valeur ajustée" : "Adjusted value"}</p>
                        <p className="font-mono font-bold">${adjustedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-red-600">{language === "fr" ? "Différence" : "Difference"}</p>
                        <p className="font-mono font-bold text-red-700">${valueDiff.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{varianceDetails.lbmaFixingRef} @ ${varianceDetails.lbmaFixingPrice}/oz</p>
                  </div>
                </CardContent>
              </Card>

              {/* Response Options */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Choisissez Votre Réponse" : "Choose Your Response"}</CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Sélectionnez l'une des trois options ci-dessous. Votre réponse est définitive."
                      : "Select one of the three options below. Your response is final."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {[
                      {
                        value: "accept" as ResponseType,
                        icon: CheckCircle2,
                        colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
                        selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500",
                        titleFr: "Accepter le Poids Ajusté",
                        titleEn: "Accept Adjusted Weight",
                        descFr: `Accepter le règlement sur ${varianceDetails.vaultFineOz.toFixed(2)} oz fin. Le processus US-06 démarrera immédiatement.`,
                        descEn: `Accept settlement on ${varianceDetails.vaultFineOz.toFixed(2)} fine oz. US-06 process will start immediately.`,
                        badge: null,
                      },
                      {
                        value: "referee" as ResponseType,
                        icon: RefreshCcw,
                        colorClass: "border-amber-200 bg-amber-50 hover:border-amber-400",
                        selectedClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-500",
                        titleFr: "Demander un Arbitre Indépendant",
                        titleEn: "Request Independent Referee",
                        descFr: "Un laboratoire LBMA tiers effectuera un nouvel essai. Délai estimé: 5-10 jours ouvrables.",
                        descEn: "An LBMA-accredited third-party lab will conduct a new assay. Estimated: 5-10 business days.",
                        badge: language === "fr" ? "Coûts à votre charge" : "Costs at your expense",
                      },
                      {
                        value: "dispute" as ResponseType,
                        icon: MessageSquare,
                        colorClass: "border-red-200 bg-red-50 hover:border-red-400",
                        selectedClass: "border-red-500 bg-red-100 ring-2 ring-red-500",
                        titleFr: "Contester — Soumettre Preuves",
                        titleEn: "Dispute — Submit Evidence",
                        descFr: "Soumettre vos preuves pour examen par l'équipe de conformité. Peut inclure: SGS originaux, pesée indépendante.",
                        descEn: "Submit your evidence for review by the compliance team. May include: original SGS certs, independent weighing.",
                        badge: null,
                      },
                    ].map(({ value, icon: Icon, colorClass, selectedClass, titleFr, titleEn, descFr, descEn, badge }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setResponseType(value)}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          responseType === value ? selectedClass : colorClass
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{language === "fr" ? titleFr : titleEn}</p>
                              {badge && (
                                <Badge variant="outline" className="text-xs">{badge}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? descFr : descEn}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {responseType && (
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Notes / Justification" : "Notes / Justification"}</Label>
                      <Textarea
                        value={responseNotes}
                        onChange={(e) => setResponseNotes(e.target.value)}
                        placeholder={
                          responseType === "dispute"
                            ? (language === "fr" ? "Décrivez votre contestation et les preuves que vous souhaitez soumettre..." : "Describe your dispute and the evidence you wish to submit...")
                            : (language === "fr" ? "Notes supplémentaires (optionnel)..." : "Additional notes (optional)...")
                        }
                        rows={3}
                      />
                    </div>
                  )}

                  {/* SLA Notice */}
                  {responseType === "referee" && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <FileText className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        {language === "fr"
                          ? "En sélectionnant cette option, vous acceptez de supporter les coûts d'arbitre selon le contrat cadre. Une proposition de laboratoire vous sera soumise pour approbation."
                          : "By selecting this option, you agree to bear referee costs per the framework agreement. A lab proposal will be submitted for your approval."}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!responseType || isSubmitting}
                      className="flex-1"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? (language === "fr" ? "Soumission..." : "Submitting...")
                        : (language === "fr" ? "Confirmer ma Réponse" : "Confirm My Response")}
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
