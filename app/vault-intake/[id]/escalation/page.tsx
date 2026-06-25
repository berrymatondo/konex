"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  Shield,
  Package,
  ArrowRight,
  Phone,
  Mail,
  Clock,
  FileText,
  UserCheck,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import Link from "next/link"

const SEAL_ESCALATION_TIMELINE = [
  { step: 1, timeFr: "T+0", timeEn: "T+0", labelFr: "Discordance détectée", labelEn: "Discrepancy detected", done: true },
  { step: 2, timeFr: "T+15min", timeEn: "T+15min", labelFr: "Officier de sécurité alerté", labelEn: "Security officer alerted", done: true },
  { step: 3, timeFr: "T+30min", timeEn: "T+30min", labelFr: "Zone de quarantaine activée", labelEn: "Quarantine zone activated", done: true },
  { step: 4, timeFr: "T+2h", timeEn: "T+2h", labelFr: "Enquête officier de sécurité", labelEn: "Security officer investigation", done: false },
  { step: 5, timeFr: "T+4h", timeEn: "T+4h", labelFr: "Résolution / Escalade direction", labelEn: "Resolution / Management escalation", done: false },
]

const COUNT_ESCALATION_CONTACTS = [
  { role: "fr" as const, nameEn: "Vault Manager", nameFr: "Gestionnaire Coffre", name: "M. Laurent", ext: "112", email: "vault@bank.cd" },
  { role: "fr" as const, nameEn: "Trade Manager", nameFr: "Responsable Transactions", name: "Mme. Dubois", ext: "108", email: "trade@bank.cd" },
  { role: "fr" as const, nameEn: "Reserve Manager", nameFr: "Gestionnaire Réserves", name: "Dr. Kamau", ext: "205", email: "reserve@bank.cd" },
]

export default function EscalationPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [activeTab, setActiveTab] = useState("seal")

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Écrans d'Escalade — US-05" : "Escalation Screens — US-05"}
            subtitle={`${shipmentId} · Escalation Protocol`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Global Alert */}
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">
                    {language === "fr" ? "Incident actif — Protocole d'escalade engagé" : "Active Incident — Escalation Protocol Engaged"}
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {language === "fr"
                      ? `Expédition ${shipmentId} en quarantaine. Toutes les opérations sont suspendues jusqu'à résolution.`
                      : `Shipment ${shipmentId} quarantined. All operations suspended pending resolution.`}
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  {language === "fr" ? "ACTIF" : "ACTIVE"}
                </Badge>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="seal" className="gap-2">
                    <Shield className="h-4 w-4" />
                    {language === "fr" ? "Échec Scellé" : "Seal Failure"}
                  </TabsTrigger>
                  <TabsTrigger value="count" className="gap-2">
                    <Package className="h-4 w-4" />
                    {language === "fr" ? "Discordance Barres" : "Bar Count Mismatch"}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — Seal Failure Escalation */}
                <TabsContent value="seal" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-red-500" />
                        {language === "fr" ? "Escalade — Échec de Vérification de Scellé" : "Escalation — Seal Verification Failure"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Le numéro de scellé physique ne correspond pas au manifeste d'expédition."
                          : "The physical seal number does not match the shipping manifest."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Incident Summary */}
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                          <p className="text-xs text-red-600 font-medium mb-1">{language === "fr" ? "Scellé Manifeste" : "Manifest Seal"}</p>
                          <p className="font-mono font-bold text-red-800">SLF-2026-7714A</p>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                          <p className="text-xs text-amber-600 font-medium mb-1">{language === "fr" ? "Scellé Physique" : "Physical Seal"}</p>
                          <p className="font-mono font-bold text-amber-800">SLF-2026-7714B</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted border text-center">
                          <p className="text-xs text-muted-foreground font-medium mb-1">{language === "fr" ? "Détecté le" : "Detected At"}</p>
                          <p className="font-mono font-bold text-sm">2026-06-25 09:42</p>
                        </div>
                      </div>

                      {/* Protocol Timeline */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {language === "fr" ? "Chronologie du Protocole de Sécurité" : "Security Protocol Timeline"}
                        </h3>
                        <div className="relative space-y-0">
                          {SEAL_ESCALATION_TIMELINE.map((step, idx) => (
                            <div key={step.step} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  step.done ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                                }`}>
                                  {step.step}
                                </div>
                                {idx < SEAL_ESCALATION_TIMELINE.length - 1 && (
                                  <div className={`w-0.5 h-6 ${step.done ? "bg-red-300" : "bg-muted"}`} />
                                )}
                              </div>
                              <div className="pb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {language === "fr" ? step.timeFr : step.timeEn}
                                  </span>
                                  <Badge variant={step.done ? "default" : "secondary"} className="text-xs">
                                    {step.done
                                      ? (language === "fr" ? "Complété" : "Completed")
                                      : (language === "fr" ? "En attente" : "Pending")}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium mt-1">
                                  {language === "fr" ? step.labelFr : step.labelEn}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <Button asChild className="w-full bg-red-600 hover:bg-red-700">
                          <Link href={`/vault-intake/${shipmentId}/security`}>
                            <Shield className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Démarrer Enquête Sécurité" : "Start Security Investigation"}
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full">
                          <FileText className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Télécharger Rapport d'Incident" : "Download Incident Report"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Regulatory Obligations */}
                  <Card className="border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-amber-800">
                        {language === "fr" ? "Obligations Réglementaires" : "Regulatory Obligations"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {[
                          { fr: "Notification LBMA requise dans les 24h si violation confirmée", en: "LBMA notification required within 24h if breach confirmed" },
                          { fr: "Documentation de la chaîne de garde obligatoire", en: "Chain of custody documentation mandatory" },
                          { fr: "Conservation des images CCTV pour 90 jours minimum", en: "CCTV footage retention for minimum 90 days" },
                        ].map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{language === "fr" ? item.fr : item.en}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2 — Bar Count Mismatch Escalation */}
                <TabsContent value="count" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-amber-500" />
                        {language === "fr" ? "Escalade — Discordance de Comptage Barres" : "Escalation — Bar Count Mismatch"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Le nombre de barres reçues diffère du nombre déclaré dans le manifeste."
                          : "The number of bars received differs from the number declared in the manifest."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Discrepancy Details */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Attendu" : "Expected"}</p>
                          <p className="text-2xl font-bold font-mono">100</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Reçu" : "Received"}</p>
                          <p className="text-2xl font-bold font-mono text-amber-600">97</p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                          <p className="text-xs text-red-600 mb-1">{language === "fr" ? "Manquant" : "Missing"}</p>
                          <p className="text-2xl font-bold font-mono text-red-700">3</p>
                        </div>
                      </div>

                      {/* Escalation Contact List */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {language === "fr" ? "Contacts d'Escalade" : "Escalation Contacts"}
                        </h3>
                        <div className="space-y-3">
                          {COUNT_ESCALATION_CONTACTS.map((contact) => (
                            <div key={contact.ext} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserCheck className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{contact.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? contact.nameFr : contact.nameEn}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Phone className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Mail className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Workflow Options */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" />
                          {language === "fr" ? "Actions Disponibles" : "Available Actions"}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-3">
                          <Button asChild className="w-full bg-amber-600 hover:bg-amber-700">
                            <Link href={`/vault-intake/${shipmentId}/count-discrepancy`}>
                              <Package className="mr-2 h-4 w-4" />
                              {language === "fr" ? "Résoudre Discordance" : "Resolve Discrepancy"}
                            </Link>
                          </Button>
                          <Button variant="outline" className="w-full">
                            <FileText className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Demande d'Enquête Formelle" : "Formal Investigation Request"}
                          </Button>
                          <Button variant="outline" className="w-full">
                            <Mail className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Notifier la Contrepartie" : "Notify Counterparty"}
                          </Button>
                          <Button variant="outline" className="w-full">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Alerter Conformité" : "Alert Compliance"}
                          </Button>
                        </div>
                      </div>

                      {/* SLA Warning */}
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          {language === "fr"
                            ? "SLA de résolution: 48 heures à compter de la détection. Délai expirant le 2026-06-27 09:42."
                            : "Resolution SLA: 48 hours from detection. Deadline: 2026-06-27 09:42."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Back Button */}
              <Button variant="outline" onClick={() => router.push(`/vault-intake/${shipmentId}`)}>
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                {language === "fr" ? "Retour à la réception" : "Back to Intake"}
              </Button>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
