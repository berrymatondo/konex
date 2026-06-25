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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  FlaskConical,
  Calendar,
  Send,
  ArrowLeft,
  Clock,
  FileText,
  Plus,
  X,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

const LBMA_REFEREE_LABS = [
  { id: "argor", name: "Argor-Heraeus SA", lbmaRef: "LBMA-0042", location: "Mendrisio, Switzerland" },
  { id: "metalor", name: "Metalor Technologies SA", lbmaRef: "LBMA-0017", location: "Marin, Switzerland" },
  { id: "umicore", name: "Umicore Precious Metals", lbmaRef: "LBMA-0061", location: "Hoboken, Belgium" },
  { id: "rand", name: "Rand Refinery (Pty) Ltd", lbmaRef: "LBMA-0033", location: "Germiston, South Africa" },
]

interface BarResult {
  barSerial: string
  fineOz: number
}

export default function RefereeAppointmentPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [activeTab, setActiveTab] = useState("appointment")

  // Appointment form state
  const [selectedLab, setSelectedLab] = useState("")
  const [accessDate, setAccessDate] = useState("")
  const [deadline, setDeadline] = useState("")
  const [costBorneBy, setCostBorneBy] = useState("counterparty")
  const [apptNotes, setApptNotes] = useState("")
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false)
  const [appointmentSent, setAppointmentSent] = useState(false)
  const [appointmentId, setAppointmentId] = useState("")

  // Result form state
  const [certNumber, setCertNumber] = useState("")
  const [certDate, setCertDate] = useState("")
  const [barResults, setBarResults] = useState<BarResult[]>([
    { barSerial: "BAR-2026-0001", fineOz: 387.42 },
    { barSerial: "BAR-2026-0002", fineOz: 391.18 },
  ])
  const [newBarSerial, setNewBarSerial] = useState("")
  const [newBarFineOz, setNewBarFineOz] = useState("")
  const [resultNotes, setResultNotes] = useState("")
  const [isSubmittingResult, setIsSubmittingResult] = useState(false)
  const [resultSaved, setResultSaved] = useState(false)

  const totalFineOz = barResults.reduce((s, r) => s + r.fineOz, 0)
  const vaultFineOz = 10387.32
  const declaredFineOz = 10450.75

  const selectedLabData = LBMA_REFEREE_LABS.find((l) => l.id === selectedLab)

  const handleSendAppointment = async () => {
    if (!selectedLab || !accessDate || !deadline) return
    setIsSubmittingAppt(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance/referee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refereeLab: selectedLabData?.name,
          lbmaRef: selectedLabData?.lbmaRef,
          accessDate,
          deadline,
          costBorneBy,
          notes: apptNotes,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAppointmentId(data.id)
        setAppointmentSent(true)
        setActiveTab("results")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingAppt(false)
    }
  }

  const addBarResult = () => {
    const serial = newBarSerial.trim().toUpperCase()
    const oz = parseFloat(newBarFineOz)
    if (serial && !isNaN(oz)) {
      setBarResults((prev) => [...prev, { barSerial: serial, fineOz: oz }])
      setNewBarSerial("")
      setNewBarFineOz("")
    }
  }

  const removeBarResult = (idx: number) => {
    setBarResults((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveResult = async () => {
    if (!certNumber || barResults.length === 0) return
    setIsSubmittingResult(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/variance/referee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_result",
          appointmentId: appointmentId || "pending",
          certNumber,
          certDate,
          fineOzPerBar: barResults,
          totalFineOz,
          vsVaultOz: totalFineOz - vaultFineOz,
          vsDeclaredOz: totalFineOz - declaredFineOz,
          notes: resultNotes,
        }),
      })
      if (res.ok) setResultSaved(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingResult(false)
    }
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Arbitre Indépendant — Nomination & Résultats" : "Independent Referee — Appointment & Results"}
            subtitle={`${shipmentId} · US-05`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="appointment" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {language === "fr" ? "Notification de Nomination" : "Appointment Notification"}
                  </TabsTrigger>
                  <TabsTrigger value="results" className="gap-2">
                    <FlaskConical className="h-4 w-4" />
                    {language === "fr" ? "Saisie des Résultats" : "Result Entry"}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — Appointment Notification */}
                <TabsContent value="appointment" className="space-y-6 mt-6">
                  {appointmentSent && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm text-emerald-800 font-medium">
                        {language === "fr"
                          ? `Notification envoyée au laboratoire ${selectedLabData?.name}. Réponse attendue sous 24h.`
                          : `Notification sent to ${selectedLabData?.name}. Response expected within 24h.`}
                      </p>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {language === "fr" ? "Nommer un Laboratoire Arbitre LBMA" : "Appoint LBMA Referee Laboratory"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Le laboratoire sera chargé d'effectuer un essai de finesse indépendant sur les barres contestées."
                          : "The laboratory will conduct an independent fineness assay on the disputed bars."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Laboratoire Arbitre LBMA" : "LBMA Referee Laboratory"} <span className="text-destructive">*</span></Label>
                        <Select value={selectedLab} onValueChange={setSelectedLab}>
                          <SelectTrigger>
                            <SelectValue placeholder={language === "fr" ? "Sélectionner un laboratoire accrédité LBMA..." : "Select LBMA accredited lab..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {LBMA_REFEREE_LABS.map((lab) => (
                              <SelectItem key={lab.id} value={lab.id}>
                                {lab.name} ({lab.lbmaRef}) — {lab.location}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Date d'Accès aux Barres" : "Bar Access Date"} <span className="text-destructive">*</span></Label>
                          <Input
                            type="date"
                            value={accessDate}
                            onChange={(e) => setAccessDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Délai de Résultats" : "Results Deadline"} <span className="text-destructive">*</span></Label>
                          <Input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Frais à la Charge de" : "Costs Borne By"}</Label>
                        <Select value={costBorneBy} onValueChange={setCostBorneBy}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="counterparty">{language === "fr" ? "Contrepartie" : "Counterparty"}</SelectItem>
                            <SelectItem value="bank">{language === "fr" ? "Banque Centrale" : "Central Bank"}</SelectItem>
                            <SelectItem value="shared">{language === "fr" ? "Partagé 50/50" : "Shared 50/50"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Instructions Supplémentaires" : "Additional Instructions"}</Label>
                        <Textarea
                          value={apptNotes}
                          onChange={(e) => setApptNotes(e.target.value)}
                          placeholder={language === "fr" ? "Instructions spéciales pour le laboratoire..." : "Special instructions for the laboratory..."}
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => router.back()}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <Button
                          onClick={handleSendAppointment}
                          disabled={!selectedLab || !accessDate || !deadline || isSubmittingAppt}
                          className="flex-1"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {isSubmittingAppt
                            ? (language === "fr" ? "Envoi..." : "Sending...")
                            : (language === "fr" ? "Envoyer Nomination" : "Send Appointment")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SLA Info */}
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 space-y-1">
                          <p className="font-medium">{language === "fr" ? "Protocole d'Arbitre LBMA" : "LBMA Referee Protocol"}</p>
                          <p>{language === "fr" ? "• Délai standard: 5 jours ouvrables pour essai feu" : "• Standard: 5 business days for fire assay"}</p>
                          <p>{language === "fr" ? "• Le rapport d'arbitre est contraignant pour les deux parties" : "• Referee report is binding on both parties"}</p>
                          <p>{language === "fr" ? "• Le PO est suspendu jusqu'à réception des résultats" : "• PO is suspended until results are received"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2 — Result Entry */}
                <TabsContent value="results" className="space-y-6 mt-6">
                  {resultSaved && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm text-emerald-800 font-medium">
                        {language === "fr"
                          ? "Résultats de l'arbitre enregistrés. Le processus de règlement peut reprendre."
                          : "Referee results recorded. Settlement process can resume."}
                      </p>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {language === "fr" ? "Saisie des Résultats Arbitre" : "Referee Result Entry"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "N° Certificat Arbitre" : "Referee Certificate Number"} <span className="text-destructive">*</span></Label>
                          <Input
                            value={certNumber}
                            onChange={(e) => setCertNumber(e.target.value)}
                            placeholder="LBMA-REF-2026-XXXX"
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Date du Certificat" : "Certificate Date"}</Label>
                          <Input
                            type="date"
                            value={certDate}
                            onChange={(e) => setCertDate(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Bar-level results */}
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Oz Fin par Barre" : "Fine Oz per Bar"}</Label>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "fr" ? "N° Série" : "Serial Number"}</TableHead>
                              <TableHead className="text-right">{language === "fr" ? "Oz Fin (arbitre)" : "Fine Oz (referee)"}</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {barResults.map((r, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{r.barSerial}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{r.fineOz.toFixed(3)}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBarResult(idx)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Add row */}
                            <TableRow>
                              <TableCell>
                                <Input
                                  value={newBarSerial}
                                  onChange={(e) => setNewBarSerial(e.target.value)}
                                  placeholder="BAR-2026-XXXX"
                                  className="font-mono h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={newBarFineOz}
                                  onChange={(e) => setNewBarFineOz(e.target.value)}
                                  placeholder="0.000"
                                  className="font-mono h-8 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addBarResult}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Totals comparison */}
                      {barResults.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Total Arbitre (oz)" : "Referee Total (oz)"}</p>
                            <p className="text-xl font-bold font-mono">{totalFineOz.toFixed(3)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "vs Coffre (oz)" : "vs Vault (oz)"}</p>
                            <p className={`text-xl font-bold font-mono ${(totalFineOz - vaultFineOz) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {(totalFineOz - vaultFineOz) > 0 ? "+" : ""}{(totalFineOz - vaultFineOz).toFixed(3)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "vs Déclaré (oz)" : "vs Declared (oz)"}</p>
                            <p className={`text-xl font-bold font-mono ${(totalFineOz - declaredFineOz) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {(totalFineOz - declaredFineOz) > 0 ? "+" : ""}{(totalFineOz - declaredFineOz).toFixed(3)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Notes de Résultat" : "Result Notes"}</Label>
                        <Textarea
                          value={resultNotes}
                          onChange={(e) => setResultNotes(e.target.value)}
                          placeholder={language === "fr" ? "Observations du laboratoire, conditions d'essai..." : "Lab observations, assay conditions..."}
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setActiveTab("appointment")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Nomination" : "Appointment"}
                        </Button>
                        <Button
                          onClick={handleSaveResult}
                          disabled={!certNumber || barResults.length === 0 || isSubmittingResult || resultSaved}
                          className="flex-1"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {isSubmittingResult
                            ? (language === "fr" ? "Enregistrement..." : "Saving...")
                            : resultSaved
                            ? (language === "fr" ? "Résultats enregistrés" : "Results Saved")
                            : (language === "fr" ? "Enregistrer Résultats" : "Save Results")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
