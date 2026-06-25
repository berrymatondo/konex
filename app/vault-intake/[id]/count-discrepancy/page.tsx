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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Plus,
  X,
  Send,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

type Resolution = "partial_accepted" | "hold" | "rejected" | ""

export default function CountDiscrepancyPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [expectedCount, setExpectedCount] = useState<number>(100)
  const [receivedCount, setReceivedCount] = useState<number>(97)
  const [missingSerials, setMissingSerials] = useState<string[]>(["BAR-2026-0341", "BAR-2026-0342", "BAR-2026-0343"])
  const [newSerial, setNewSerial] = useState("")
  const [notes, setNotes] = useState("")
  const [resolution, setResolution] = useState<Resolution>("")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [holdDurationHours, setHoldDurationHours] = useState(48)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedData, setSubmittedData] = useState<{ resolution: Resolution; holdExpiresAt?: string } | null>(null)

  const discrepancy = expectedCount - receivedCount
  const discrepancyPct = expectedCount > 0 ? (discrepancy / expectedCount) * 100 : 0

  const addSerial = () => {
    const s = newSerial.trim().toUpperCase()
    if (s && !missingSerials.includes(s)) {
      setMissingSerials((prev) => [...prev, s])
      setNewSerial("")
    }
  }

  const removeSerial = (serial: string) => {
    setMissingSerials((prev) => prev.filter((s) => s !== serial))
  }

  const handleSubmit = async () => {
    if (!resolution) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/count-discrepancy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCount,
          receivedCount,
          missingSerials,
          notes,
          resolution,
          holdDurationHours: resolution === "hold" ? holdDurationHours : undefined,
          resolutionNotes,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubmittedData({ resolution, holdExpiresAt: data.holdExpiresAt })
        setSubmitted(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted && submittedData) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader
              title={language === "fr" ? "Résolution Discordance Barres" : "Bar Count Discrepancy Resolution"}
              subtitle={shipmentId}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  {submittedData.resolution === "rejected" ? (
                    <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                  ) : submittedData.resolution === "hold" ? (
                    <Clock className="h-16 w-16 text-amber-500 mx-auto" />
                  ) : (
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  )}
                  <h2 className="text-xl font-bold">
                    {submittedData.resolution === "partial_accepted"
                      ? (language === "fr" ? "Acceptation Partielle" : "Partial Acceptance")
                      : submittedData.resolution === "hold"
                      ? (language === "fr" ? "Mise en Attente" : "Hold Placed")
                      : (language === "fr" ? "Expédition Rejetée" : "Shipment Rejected")}
                  </h2>
                  {submittedData.resolution === "hold" && submittedData.holdExpiresAt && (
                    <p className="text-sm text-muted-foreground">
                      {language === "fr" ? "Expire le : " : "Expires: "}
                      {new Date(submittedData.holdExpiresAt).toLocaleString()}
                    </p>
                  )}
                  <Button onClick={() => router.push(`/vault-intake/${shipmentId}`)} className="w-full">
                    {language === "fr" ? "Retour à la réception" : "Back to Intake"}
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
            title={language === "fr" ? "Discordance Comptage Barres — Gestionnaire Coffre" : "Bar Count Discrepancy — Vault Manager"}
            subtitle={`${shipmentId} · US-05 Escalation`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Alert Banner */}
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">
                    {language === "fr" ? "Discordance de comptage détectée" : "Bar Count Discrepancy Detected"}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    {language === "fr"
                      ? `${discrepancy} barre(s) manquante(s) sur ${expectedCount} attendues (${discrepancyPct.toFixed(2)}%).`
                      : `${discrepancy} bar(s) missing out of ${expectedCount} expected (${discrepancyPct.toFixed(2)}%).`}
                  </p>
                </div>
              </div>

              {/* Count Summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: language === "fr" ? "Attendu" : "Expected",
                    value: expectedCount,
                    color: "text-foreground",
                    setter: (v: number) => setExpectedCount(v),
                  },
                  {
                    label: language === "fr" ? "Reçu" : "Received",
                    value: receivedCount,
                    color: "text-foreground",
                    setter: (v: number) => setReceivedCount(v),
                  },
                  {
                    label: language === "fr" ? "Discordance" : "Discrepancy",
                    value: discrepancy,
                    color: discrepancy > 0 ? "text-red-600" : "text-emerald-600",
                    setter: null,
                  },
                ].map(({ label, value, color, setter }) => (
                  <Card key={label}>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-2">{label}</p>
                      {setter ? (
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => setter(parseInt(e.target.value, 10) || 0)}
                          className={`text-center text-2xl font-bold font-mono h-12 ${color}`}
                          min={0}
                        />
                      ) : (
                        <p className={`text-2xl font-bold font-mono ${color}`}>
                          {value > 0 ? `-${value}` : value === 0 ? "0" : `+${Math.abs(value)}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Missing Serial Numbers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {language === "fr" ? "Numéros de Série Manquants" : "Missing Serial Numbers"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSerial()}
                      placeholder="Ex: BAR-2026-0344"
                      className="font-mono"
                    />
                    <Button onClick={addSerial} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {missingSerials.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>{language === "fr" ? "N° Série" : "Serial Number"}</TableHead>
                          <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingSerials.map((serial, idx) => (
                          <TableRow key={serial}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono font-medium">{serial}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">
                                {language === "fr" ? "Manquant" : "Missing"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeSerial(serial)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {language === "fr" ? "Aucun numéro de série manquant enregistré" : "No missing serial numbers recorded"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{language === "fr" ? "Notes Supplémentaires" : "Additional Notes"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={language === "fr"
                      ? "Documentez les circonstances de la discordance, les investigations menées..."
                      : "Document the circumstances of the discrepancy, investigations conducted..."}
                    rows={3}
                  />
                </CardContent>
              </Card>

              {/* Resolution Decision */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Décision du Gestionnaire Coffre" : "Vault Manager Resolution"}</CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Choisissez la résolution appropriée pour cette discordance."
                      : "Choose the appropriate resolution for this discrepancy."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {[
                      {
                        value: "partial_accepted" as Resolution,
                        icon: CheckCircle2,
                        colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
                        selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500",
                        titleFr: "Acceptation Partielle",
                        titleEn: "Partial Acceptance",
                        descFr: `Accepter les ${receivedCount} barres reçues et régler sur la quantité réelle. Ajustement de la valeur nécessaire.`,
                        descEn: `Accept the ${receivedCount} bars received and settle on actual quantity. Value adjustment required.`,
                      },
                      {
                        value: "hold" as Resolution,
                        icon: Clock,
                        colorClass: "border-amber-200 bg-amber-50 hover:border-amber-400",
                        selectedClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-500",
                        titleFr: "Mise en Attente",
                        titleEn: "Place on Hold",
                        descFr: "Mettre l'expédition en attente et demander une enquête complète à la contrepartie.",
                        descEn: "Place shipment on hold and request full investigation from counterparty.",
                      },
                      {
                        value: "rejected" as Resolution,
                        icon: XCircle,
                        colorClass: "border-red-200 bg-red-50 hover:border-red-400",
                        selectedClass: "border-red-500 bg-red-100 ring-2 ring-red-500",
                        titleFr: "Rejet Total",
                        titleEn: "Full Rejection",
                        descFr: "Rejeter toute l'expédition. Retour à la contrepartie exigé.",
                        descEn: "Reject the entire shipment. Return to counterparty required.",
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

                  {resolution === "hold" && (
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Durée d'attente (heures)" : "Hold Duration (hours)"}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={holdDurationHours}
                        onChange={(e) => setHoldDurationHours(parseInt(e.target.value, 10) || 48)}
                        className="max-w-xs font-mono"
                      />
                    </div>
                  )}

                  {resolution && (
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Notes de Résolution" : "Resolution Notes"} <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder={language === "fr"
                          ? "Justifiez votre décision..."
                          : "Justify your decision..."}
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!resolution || !resolutionNotes || isSubmitting}
                      className={`flex-1 ${resolution === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}`}
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
