"use client"

import { useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Camera,
  ArrowLeft,
  Send,
  Shield,
  Clock,
  Lock,
  Mail,
  MessageSquare,
  Bell,
  Phone,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

interface SealSnapshot {
  declared: string
  physical: string
  condition: string
  ok: boolean
}

const CHECKLIST_ITEMS = [
  { id: "tamper_evident", labelFr: "Signes évidents de falsification sur le conteneur", labelEn: "Visible tampering on outer container" },
  { id: "seal_type_match", labelFr: "Type de scellé correspond au manifeste", labelEn: "Seal type matches manifest specification" },
  { id: "carrier_cctv", labelFr: "Images CCTV du transporteur demandées", labelEn: "Carrier CCTV footage requested" },
  { id: "weight_intact", labelFr: "Poids du conteneur intact et conforme", labelEn: "Container weight intact and consistent" },
  { id: "docs_verified", labelFr: "Documents d'expédition vérifiés et authentiques", labelEn: "Shipping documents verified and authentic" },
  { id: "customs_clear", labelFr: "Autorisation douanière confirmée sans incident", labelEn: "Customs clearance confirmed incident-free" },
]

type Resolution = "cleared_admin" | "cleared_documented" | "breach_confirmed" | ""

export default function SecurityOfficerResolutionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const primarySeal: SealSnapshot = {
    declared: searchParams.get("primaryDeclared") || "",
    physical: searchParams.get("primaryPhysical") || "",
    condition: searchParams.get("primaryCondition") || "",
    ok: searchParams.get("primaryMatch") === "true" && searchParams.get("primaryCondition") !== "broken",
  }
  const secondarySeal: SealSnapshot = {
    declared: searchParams.get("secondaryDeclared") || "",
    physical: searchParams.get("secondaryPhysical") || "",
    condition: searchParams.get("secondaryCondition") || "",
    ok: searchParams.get("secondaryMatch") === "true" && searchParams.get("secondaryCondition") !== "broken",
  }
  const hasPrimarySealSnapshot = Boolean(primarySeal.declared || primarySeal.physical)
  const hasSecondarySealSnapshot = Boolean(secondarySeal.declared || secondarySeal.physical)
  const failingSeal = hasSecondarySealSnapshot && !secondarySeal.ok ? secondarySeal : hasPrimarySealSnapshot && !primarySeal.ok ? primarySeal : null

  const [reportedAt] = useState(() => new Date())
  const slaDeadline = new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000)

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [declaredSeal, setDeclaredSeal] = useState(failingSeal?.declared || "")
  const [physicalSeal, setPhysicalSeal] = useState(failingSeal?.physical || "")
  const [carrierStatement, setCarrierStatement] = useState("")
  const [officerObservations, setOfficerObservations] = useState("")
  const [resolution, setResolution] = useState<Resolution>("")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const allChecked = CHECKLIST_ITEMS.every((item) => checkedItems[item.id])
  const checkCount = Object.values(checkedItems).filter(Boolean).length

  const handleSubmit = async () => {
    if (!resolution) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/vault-intake/${shipmentId}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentType: "seal_mismatch",
          declaredSeal,
          physicalSeal,
          description: officerObservations,
          checklistItems: CHECKLIST_ITEMS.map((item) => ({
            id: item.id,
            label: language === "fr" ? item.labelFr : item.labelEn,
            checked: Boolean(checkedItems[item.id]),
          })),
          carrierStatement,
          officerObservations,
          resolution,
          resolutionNotes,
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
              title={language === "fr" ? "Résolution Incident Scellé" : "Seal Incident Resolution"}
              subtitle={`${shipmentId}`}
            />
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center space-y-4">
                  {resolution === "breach_confirmed" ? (
                    <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                  ) : (
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  )}
                  <h2 className="text-xl font-bold">
                    {resolution === "breach_confirmed"
                      ? (language === "fr" ? "Violation Confirmée" : "Breach Confirmed")
                      : (language === "fr" ? "Incident Résolu" : "Incident Resolved")}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {resolution === "cleared_admin"
                      ? (language === "fr" ? "Écart dû à une erreur administrative — expédition autorisée à continuer." : "Discrepancy due to admin error — shipment cleared to proceed.")
                      : resolution === "cleared_documented"
                      ? (language === "fr" ? "Écart documenté et résolu — expédition sous protocole étendu." : "Discrepancy documented and resolved — shipment under extended protocol.")
                      : (language === "fr" ? "Violation de sécurité confirmée — expédition bloquée et escaladée." : "Security breach confirmed — shipment blocked and escalated.")}
                  </p>
                  <Button onClick={() => router.push(`/vault-intake/${shipmentId}?sealsReset=1`)} className="w-full">
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
            title={language === "fr" ? "Résolution Incident Scellé" : "Seal Mismatch — Security Officer Resolution"}
            subtitle={`${shipmentId} · Escalation`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              <Button variant="outline" size="sm" onClick={() => router.push(`/vault-intake/${shipmentId}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "fr" ? "Retour à la réception" : "Back to intake"}
              </Button>

              {/* Incident Alert Banner */}
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">
                    {language === "fr" ? "Incident de sécurité actif — Discordance de scellé détectée" : "Active Security Incident — Seal Discrepancy Detected"}
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {language === "fr"
                      ? "L'expédition est placée en quarantaine. Complétez ce protocole avant de reprendre la réception."
                      : "Shipment is quarantined. Complete this protocol before resuming intake."}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-red-700 mt-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{language === "fr" ? "Signalé :" : "Reported:"} {reportedAt.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" />{language === "fr" ? "SLA : réponse Officier de Sécurité sous" : "SLA: Security Officer response within"} 2h ({language === "fr" ? "échéance" : "due"} {slaDeadline.toLocaleTimeString()})</span>
                  </div>
                </div>
              </div>

              {/* Seal verification detail */}
              {(hasPrimarySealSnapshot || hasSecondarySealSnapshot) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {language === "fr" ? "Détail de la vérification des scellés" : "Seal verification detail"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      ...(hasPrimarySealSnapshot ? [{ label: language === "fr" ? "Scellé primaire" : "Primary seal", seal: primarySeal }] : []),
                      ...(hasSecondarySealSnapshot ? [{ label: language === "fr" ? "Scellé secondaire" : "Secondary seal", seal: secondarySeal }] : []),
                    ].map(({ label, seal }) => (
                      <div key={label} className={`flex items-center justify-between p-3 rounded-lg border ${seal.ok ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
                        <div>
                          <div className={`text-sm font-medium flex items-center gap-1.5 ${seal.ok ? "text-emerald-700" : "text-red-700"}`}>
                            {seal.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {label} — {seal.ok ? (language === "fr" ? "vérifié" : "verified") : seal.condition === "broken" ? (language === "fr" ? "cassé" : "broken") : (language === "fr" ? "discordance" : "mismatch")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {language === "fr" ? "Manifeste" : "Manifest"}: {seal.declared || "—"} · {language === "fr" ? "Physique" : "Physical"}: {seal.physical || "—"}
                          </div>
                        </div>
                        <Badge className={seal.ok ? "bg-emerald-600 hover:bg-emerald-600" : ""} variant={seal.ok ? "default" : "destructive"}>
                          {seal.ok ? (language === "fr" ? "Vérifié" : "Verified") : (language === "fr" ? "Discordance" : "Mismatch")}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Notifications dispatched automatically */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{language === "fr" ? "Notifications envoyées automatiquement" : "Notifications dispatched automatically"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { name: language === "fr" ? "Officier de Sécurité" : "Security Officer", role: language === "fr" ? "Répondant principal — astreinte" : "On-call — primary responder", icons: [MessageSquare, Mail, Bell], sla: "2h SLA", slaClass: "bg-red-50 text-red-700" },
                    { name: language === "fr" ? "Gestionnaire Coffre" : "Vault Manager", role: language === "fr" ? "Supervision garde physique" : "Physical custody oversight", icons: [Mail, Bell], sla: "2h SLA", slaClass: "bg-red-50 text-red-700" },
                    { name: language === "fr" ? "Transporteur" : "Carrier", role: language === "fr" ? "Dernière garde avant coffre" : "Last custody before vault", icons: [Mail, Phone], sla: language === "fr" ? "Info" : "FYI", slaClass: "bg-muted text-muted-foreground" },
                  ].map((n) => (
                    <div key={n.name} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{n.name}</div>
                        <div className="text-xs text-muted-foreground">{n.role}</div>
                      </div>
                      <div className="flex gap-1.5 text-muted-foreground">
                        {n.icons.map((Icon, i) => <Icon key={i} className="h-3.5 w-3.5" />)}
                      </div>
                      <Badge variant="outline" className={`${n.slaClass} border-0 text-[11px]`}>{n.sla}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Block notice */}
              <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3.5 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {language === "fr"
                    ? "L'intake est totalement bloqué. L'officier coffre ne peut pas reprendre le transfert, la pesée ou toute autre étape tant que cet incident n'est pas résolu (Résolu ou Violation confirmée). Aucun rôle ne peut outrepasser ce blocage."
                    : "Intake is fully blocked. The vault officer cannot proceed to transfer, weighing, or any other step until this incident is resolved (Cleared or Breach confirmed). No role can bypass this block."}
                </span>
              </div>

              {/* Seal Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {language === "fr" ? "Comparaison des Scellés" : "Seal Comparison"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Scellé déclaré (manifeste)" : "Declared Seal (Manifest)"}</Label>
                      <Input
                        value={declaredSeal}
                        onChange={(e) => setDeclaredSeal(e.target.value)}
                        placeholder="Ex: SLF-2026-7714A"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "fr" ? "Scellé physique (reçu)" : "Physical Seal (Received)"}</Label>
                      <Input
                        value={physicalSeal}
                        onChange={(e) => setPhysicalSeal(e.target.value)}
                        placeholder="Ex: SLF-2026-7714B"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  {declaredSeal && physicalSeal && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      declaredSeal === physicalSeal ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {declaredSeal === physicalSeal
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <XCircle className="h-4 w-4" />}
                      <span className="text-sm font-medium">
                        {declaredSeal === physicalSeal
                          ? (language === "fr" ? "Scellés identiques" : "Seals match")
                          : (language === "fr" ? "Discordance confirmée" : "Mismatch confirmed")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5" />
                      {language === "fr" ? "Liste de Contrôle de Sécurité" : "Security Checklist"}
                    </span>
                    <Badge variant={allChecked ? "default" : "secondary"}>
                      {checkCount}/{CHECKLIST_ITEMS.length} {language === "fr" ? "complétés" : "completed"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Vérifiez chaque point avant de soumettre votre résolution."
                      : "Verify each point before submitting your resolution."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CHECKLIST_ITEMS.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <Checkbox
                        id={item.id}
                        checked={Boolean(checkedItems[item.id])}
                        onCheckedChange={(checked) =>
                          setCheckedItems((prev) => ({ ...prev, [item.id]: Boolean(checked) }))
                        }
                        className="mt-0.5"
                      />
                      <label htmlFor={item.id} className="text-sm cursor-pointer leading-relaxed">
                        {language === "fr" ? item.labelFr : item.labelEn}
                      </label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Carrier Interview & Observations */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {language === "fr" ? "Déclaration du Transporteur" : "Carrier Statement"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={carrierStatement}
                      onChange={(e) => setCarrierStatement(e.target.value)}
                      placeholder={language === "fr"
                        ? "Enregistrez la déclaration du représentant du transporteur concernant la discordance..."
                        : "Record the carrier representative's statement regarding the discrepancy..."}
                      rows={5}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      {language === "fr" ? "Observations de l'Officier" : "Officer Observations"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={officerObservations}
                      onChange={(e) => setOfficerObservations(e.target.value)}
                      placeholder={language === "fr"
                        ? "Documenter vos observations sur l'état physique du conteneur, du scellé et de l'expédition..."
                        : "Document your observations on the physical state of the container, seal, and shipment..."}
                      rows={5}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Resolution Decision */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Décision de Résolution" : "Resolution Decision"}</CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Sélectionnez l'issue appropriée basée sur votre enquête."
                      : "Select the appropriate outcome based on your investigation."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {[
                      {
                        value: "cleared_admin" as Resolution,
                        icon: CheckCircle2,
                        colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
                        selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500",
                        titleFr: "Résolu — Erreur Administrative",
                        titleEn: "Cleared — Administrative Error",
                        descFr: "L'écart résulte d'une erreur dans la documentation. L'expédition peut continuer.",
                        descEn: "Discrepancy results from documentation error. Shipment may proceed.",
                      },
                      {
                        value: "cleared_documented" as Resolution,
                        icon: FileText,
                        colorClass: "border-amber-200 bg-amber-50 hover:border-amber-400",
                        selectedClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-500",
                        titleFr: "Résolu — Protocole Étendu",
                        titleEn: "Cleared — Extended Protocol",
                        descFr: "Écart résolu et documenté. Expédition acceptée sous protocole de surveillance renforcé.",
                        descEn: "Discrepancy resolved and documented. Shipment accepted under enhanced monitoring protocol.",
                      },
                      {
                        value: "breach_confirmed" as Resolution,
                        icon: XCircle,
                        colorClass: "border-red-200 bg-red-50 hover:border-red-400",
                        selectedClass: "border-red-500 bg-red-100 ring-2 ring-red-500",
                        titleFr: "Violation Confirmée — Expédition Bloquée",
                        titleEn: "Breach Confirmed — Shipment Blocked",
                        descFr: "Violation de sécurité avérée. Expédition mise en quarantaine et escaladée à la direction.",
                        descEn: "Security breach confirmed. Shipment quarantined and escalated to management.",
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
                      <Label>{language === "fr" ? "Notes de Résolution" : "Resolution Notes"} <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder={language === "fr"
                          ? "Justifiez votre décision et documentez les mesures prises..."
                          : "Justify your decision and document the measures taken..."}
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => router.push(`/vault-intake/${shipmentId}`)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!resolution || !resolutionNotes || isSubmitting}
                      className={`flex-1 ${resolution === "breach_confirmed" ? "bg-red-600 hover:bg-red-700" : ""}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? (language === "fr" ? "Soumission..." : "Submitting...")
                        : (language === "fr" ? "Soumettre la Résolution" : "Submit Resolution")}
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
