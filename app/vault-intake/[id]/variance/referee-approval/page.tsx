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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  ArrowLeft,
  Send,
  ExternalLink,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export default function RMRefereeApprovalPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [decision, setDecision] = useState<"approved" | "rejected" | "">("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // This data would come from the pending referee appointment
  const proposal = {
    appointmentId: `ra_${Date.now() - 10000}`,
    refereeLab: "Argor-Heraeus SA",
    lbmaRef: "LBMA-0042",
    location: "Mendrisio, Switzerland",
    accessDate: "2026-07-01",
    deadline: "2026-07-08",
    costBorneBy: "counterparty",
    estimatedCost: "$2,800 USD",
    requestedBy: "contrepartie",
    requestedAt: "2026-06-25 10:45",
    poExpiryDate: "2026-07-15",
  }

  const daysUntilPoExpiry = Math.floor(
    (new Date(proposal.poExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const poExpiryRisk = daysUntilPoExpiry < 14

  const handleSubmit = async () => {
    if (!decision) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance/referee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: proposal.appointmentId,
          status: decision,
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
              title={language === "fr" ? "Approbation Arbitre — RM" : "Referee Approval — RM"}
              subtitle={shipmentId}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  {decision === "approved"
                    ? <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                    : <XCircle className="h-16 w-16 text-red-500 mx-auto" />}
                  <h2 className="text-xl font-bold">
                    {decision === "approved"
                      ? (language === "fr" ? "Arbitre Approuvé" : "Referee Approved")
                      : (language === "fr" ? "Arbitre Rejeté" : "Referee Rejected")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {decision === "approved"
                      ? (language === "fr"
                          ? `${proposal.refereeLab} est autorisé à accéder aux barres le ${proposal.accessDate}.`
                          : `${proposal.refereeLab} is authorized to access bars on ${proposal.accessDate}.`)
                      : (language === "fr"
                          ? "La contrepartie sera informée de proposer un autre laboratoire."
                          : "The counterparty will be notified to propose an alternative laboratory.")}
                  </p>
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
            title={language === "fr" ? "Approbation Arbitre Proposé — Gestionnaire Réserves" : "Proposed Referee Approval — Reserve Manager"}
            subtitle={`${shipmentId} · US-05`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* PO Expiry Risk Warning */}
              {poExpiryRisk && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">
                      {language === "fr"
                        ? `Risque d'expiration PO — ${daysUntilPoExpiry} jours restants`
                        : `PO Expiry Risk — ${daysUntilPoExpiry} days remaining`}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {language === "fr"
                        ? `Le bon de commande expire le ${proposal.poExpiryDate}. Le délai d'arbitre doit être respecté.`
                        : `The purchase order expires on ${proposal.poExpiryDate}. Referee deadline must be respected.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Proposal Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {language === "fr" ? "Laboratoire Arbitre Proposé" : "Proposed Referee Laboratory"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? `Proposé par la contrepartie le ${proposal.requestedAt}`
                      : `Proposed by counterparty on ${proposal.requestedAt}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Laboratoire" : "Laboratory"}</p>
                        <p className="font-semibold">{proposal.refereeLab}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Référence LBMA" : "LBMA Reference"}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-semibold">{proposal.lbmaRef}</p>
                          <Badge className="bg-emerald-500 text-xs">LBMA Accredited</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Localisation" : "Location"}</p>
                        <p className="text-sm">{proposal.location}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Date d'Accès" : "Access Date"}</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{proposal.accessDate}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Délai Résultats" : "Results Deadline"}</p>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{proposal.deadline}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Frais Estimés" : "Estimated Cost"}</p>
                        <p className="font-medium">{proposal.estimatedCost}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? `À la charge de: ${proposal.costBorneBy}` : `Borne by: ${proposal.costBorneBy}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* LBMA Verification Link */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground flex-1">
                      {language === "fr"
                        ? "Vérifiez l'accréditation sur le registre officiel LBMA."
                        : "Verify accreditation on the official LBMA Good Delivery List."}
                    </p>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ExternalLink className="h-3 w-3" />
                      LBMA
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Decision */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Décision du Gestionnaire Réserves" : "Reserve Manager Decision"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {[
                      {
                        value: "approved" as const,
                        icon: CheckCircle2,
                        colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
                        selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500",
                        titleFr: "Approuver ce Laboratoire",
                        titleEn: "Approve this Laboratory",
                        descFr: `Autoriser ${proposal.refereeLab} à effectuer l'essai arbitre le ${proposal.accessDate}.`,
                        descEn: `Authorize ${proposal.refereeLab} to conduct the referee assay on ${proposal.accessDate}.`,
                      },
                      {
                        value: "rejected" as const,
                        icon: XCircle,
                        colorClass: "border-red-200 bg-red-50 hover:border-red-400",
                        selectedClass: "border-red-500 bg-red-100 ring-2 ring-red-500",
                        titleFr: "Rejeter — Demander Autre Laboratoire",
                        titleEn: "Reject — Request Alternative Lab",
                        descFr: "Informer la contrepartie de proposer un autre laboratoire accrédité.",
                        descEn: "Inform the counterparty to propose an alternative accredited lab.",
                      },
                    ].map(({ value, icon: Icon, colorClass, selectedClass, titleFr, titleEn, descFr, descEn }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDecision(value)}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          decision === value ? selectedClass : colorClass
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

                  {decision && (
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Notes" : "Notes"}</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={language === "fr" ? "Justification de votre décision..." : "Justification of your decision..."}
                        rows={2}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!decision || isSubmitting}
                      className={`flex-1 ${decision === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? (language === "fr" ? "Soumission..." : "Submitting...")
                        : (language === "fr" ? "Confirmer la Décision" : "Confirm Decision")}
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
