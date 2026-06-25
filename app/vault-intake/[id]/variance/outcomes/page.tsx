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
  CheckCircle2,
  RefreshCcw,
  MessageSquare,
  ArrowRight,
  Clock,
  FileText,
  Scale,
  Wallet,
  AlertTriangle,
  FlaskConical,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import Link from "next/link"

export default function VarianceOutcomesPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const shipmentId = params.id as string

  const [activeTab, setActiveTab] = useState("accept")

  const outcomeData = {
    poFineOz: 10450.75,
    vaultFineOz: 10387.32,
    varianceOz: -63.43,
    variancePct: -0.607,
    lbmaPrice: 2654.5,
    adjustedValue: 10387.32 * 2654.5,
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Résultats Réponse Écart de Poids" : "Weight Variance Response Outcomes"}
            subtitle={`${shipmentId} · US-05`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Summary Banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Écart Détecté" : "Detected Variance"}</p>
                  <p className="font-bold font-mono text-red-600">{outcomeData.varianceOz.toFixed(2)} oz</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Pourcentage" : "Percentage"}</p>
                  <p className="font-bold font-mono text-red-600">{outcomeData.variancePct.toFixed(3)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Statut" : "Status"}</p>
                  <Badge variant="secondary">{language === "fr" ? "En cours de résolution" : "Resolution in Progress"}</Badge>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="accept" className="gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {language === "fr" ? "Acceptation" : "Acceptance"}
                  </TabsTrigger>
                  <TabsTrigger value="referee" className="gap-2">
                    <RefreshCcw className="h-4 w-4 text-amber-500" />
                    {language === "fr" ? "Arbitre" : "Referee"}
                  </TabsTrigger>
                  <TabsTrigger value="dispute" className="gap-2">
                    <MessageSquare className="h-4 w-4 text-red-500" />
                    {language === "fr" ? "Contestation" : "Dispute"}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — Counterparty Accepts → US-06 */}
                <TabsContent value="accept" className="space-y-4 mt-6">
                  <Card className="border-emerald-200">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <CardTitle>{language === "fr" ? "Contrepartie a Accepté le Poids Ajusté" : "Counterparty Accepted Adjusted Weight"}</CardTitle>
                          <CardDescription>
                            {language === "fr" ? "Transition vers US-06 — Valorisation & Règlement" : "Transition to US-06 — Valuation & Settlement"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Settlement Summary */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                          <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            {language === "fr" ? "Base de Règlement" : "Settlement Basis"}
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{language === "fr" ? "Poids Coffre (oz fin)" : "Vault Weight (fine oz)"}</span>
                              <span className="font-mono font-bold">{outcomeData.vaultFineOz.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{language === "fr" ? "Prix LBMA AM" : "LBMA AM Fix"}</span>
                              <span className="font-mono font-bold">${outcomeData.lbmaPrice}/oz</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-bold">
                              <span>{language === "fr" ? "Valeur Règlement" : "Settlement Value"}</span>
                              <span className="font-mono text-emerald-700">${outcomeData.adjustedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted space-y-2">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            {language === "fr" ? "Prochaines Étapes" : "Next Steps"}
                          </h3>
                          <div className="space-y-2">
                            {[
                              { icon: CheckCircle2, text: language === "fr" ? "Inventaire coffre mis à jour" : "Vault inventory updated", done: true },
                              { icon: CheckCircle2, text: language === "fr" ? "Contrat de règlement généré" : "Settlement contract generated", done: true },
                              { icon: ArrowRight, text: language === "fr" ? "Approbation fixation LBMA en attente" : "LBMA fixing approval pending", done: false },
                              { icon: ArrowRight, text: language === "fr" ? "Paiement virement SWIFT" : "SWIFT wire payment", done: false },
                            ].map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <step.icon className={`h-4 w-4 shrink-0 ${step.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                                <span className={step.done ? "" : "text-muted-foreground"}>{step.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button asChild className="w-full">
                        <Link href="/settlements">
                          <Wallet className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Procéder au Règlement (US-06)" : "Proceed to Settlement (US-06)"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2 — Referee Hold Path */}
                <TabsContent value="referee" className="space-y-4 mt-6">
                  <Card className="border-amber-200">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <FlaskConical className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle>{language === "fr" ? "Voie Mise en Attente Arbitre" : "Referee Hold Path"}</CardTitle>
                          <CardDescription>
                            {language === "fr"
                              ? "La contrepartie a demandé un essai arbitre indépendant."
                              : "The counterparty has requested an independent referee assay."}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Referee workflow steps */}
                      <div className="space-y-3">
                        {[
                          {
                            step: 1,
                            labelFr: "Sélection Laboratoire Arbitre",
                            labelEn: "Referee Lab Selection",
                            descFr: "La contrepartie propose un laboratoire LBMA. Le Gestionnaire Réserves approuve.",
                            descEn: "Counterparty proposes LBMA lab. Reserve Manager approves.",
                            href: `referee-approval`,
                            status: "active",
                          },
                          {
                            step: 2,
                            labelFr: "Nomination & Accès",
                            labelEn: "Appointment & Access",
                            descFr: "Notification de nomination envoyée. Le laboratoire accède aux barres à la date prévue.",
                            descEn: "Appointment notification sent. Lab accesses bars on scheduled date.",
                            href: `referee`,
                            status: "pending",
                          },
                          {
                            step: 3,
                            labelFr: "Résultats de l'Arbitre",
                            labelEn: "Referee Results",
                            descFr: "Le certificat d'essai est reçu et enregistré dans le système.",
                            descEn: "Assay certificate received and recorded in the system.",
                            href: `referee`,
                            status: "pending",
                          },
                          {
                            step: 4,
                            labelFr: "Règlement Ajusté",
                            labelEn: "Adjusted Settlement",
                            descFr: "Règlement sur la base du résultat arbitre, contraignant pour les deux parties.",
                            descEn: "Settlement based on referee result, binding on both parties.",
                            href: null,
                            status: "pending",
                          },
                        ].map(({ step, labelFr, labelEn, descFr, descEn, href, status }) => (
                          <div key={step} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                status === "active" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                              }`}>
                                {step}
                              </div>
                              {step < 4 && <div className="w-0.5 h-6 bg-muted" />}
                            </div>
                            <div className="pb-4 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{language === "fr" ? labelFr : labelEn}</p>
                                {status === "active" && (
                                  <Badge className="bg-amber-500 text-xs">{language === "fr" ? "Actif" : "Active"}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? descFr : descEn}</p>
                              {href && status === "active" && (
                                <Button asChild variant="outline" size="sm" className="mt-2">
                                  <Link href={`/vault-intake/${shipmentId}/variance/${href}`}>
                                    <ArrowRight className="mr-1 h-3 w-3" />
                                    {language === "fr" ? "Ouvrir" : "Open"}
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SLA tracker */}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          {language === "fr"
                            ? "SLA Arbitre: 10 jours ouvrables. Expiration prévue le 2026-07-09. Le PO est suspendu pendant cette période."
                            : "Referee SLA: 10 business days. Expected expiry 2026-07-09. PO is suspended during this period."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 3 — Dispute Review Path */}
                <TabsContent value="dispute" className="space-y-4 mt-6">
                  <Card className="border-red-200">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <CardTitle>{language === "fr" ? "Voie de Contestation" : "Dispute Review Path"}</CardTitle>
                          <CardDescription>
                            {language === "fr"
                              ? "La contrepartie conteste l'écart et a soumis des preuves."
                              : "The counterparty disputes the variance and has submitted evidence."}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Evidence submitted */}
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {language === "fr" ? "Preuves Soumises par la Contrepartie" : "Evidence Submitted by Counterparty"}
                        </h3>
                        <ul className="space-y-1 text-sm text-red-700">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            {language === "fr" ? "Certificats SGS originaux (lot 2026-445)" : "Original SGS certificates (batch 2026-445)"}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            {language === "fr" ? "Rapport de pesée indépendante — Metalor SA" : "Independent weighing report — Metalor SA"}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            {language === "fr" ? "Vidéo surveillance entrepôt expéditeur" : "Shipper warehouse surveillance video"}
                          </li>
                        </ul>
                      </div>

                      {/* Review outcomes */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">{language === "fr" ? "Issues Possibles" : "Possible Outcomes"}</h3>
                        <div className="space-y-3">
                          {[
                            {
                              icon: CheckCircle2,
                              color: "text-emerald-600",
                              bg: "bg-emerald-50",
                              titleFr: "Preuves Acceptées",
                              titleEn: "Evidence Accepted",
                              descFr: "La contestation est validée. Règlement sur la base des données contrepartie.",
                              descEn: "Dispute validated. Settlement based on counterparty data.",
                            },
                            {
                              icon: AlertTriangle,
                              color: "text-amber-600",
                              bg: "bg-amber-50",
                              titleFr: "Arbitre Recommandé",
                              titleEn: "Referee Recommended",
                              descFr: "Preuves insuffisantes. Un essai arbitre est recommandé pour trancher.",
                              descEn: "Insufficient evidence. Referee assay recommended to settle the dispute.",
                            },
                            {
                              icon: RefreshCcw,
                              color: "text-red-600",
                              bg: "bg-red-50",
                              titleFr: "Preuves Rejetées",
                              titleEn: "Evidence Rejected",
                              descFr: "Preuves non concluantes. Règlement sur la base des données coffre.",
                              descEn: "Evidence inconclusive. Settlement based on vault measurements.",
                            },
                          ].map(({ icon: Icon, color, bg, titleFr, titleEn, descFr, descEn }) => (
                            <div key={titleFr} className={`flex items-start gap-3 p-3 rounded-lg ${bg}`}>
                              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
                              <div>
                                <p className="font-medium text-sm">{language === "fr" ? titleFr : titleEn}</p>
                                <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? descFr : descEn}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          {language === "fr"
                            ? "L'équipe de conformité examine les preuves soumises. Délai de réponse: 72 heures ouvrables."
                            : "The compliance team is reviewing the submitted evidence. Response deadline: 72 business hours."}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => router.push(`/vault-intake/${shipmentId}/variance`)}
                        className="w-full"
                      >
                        <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                        {language === "fr" ? "Retour Revue Écart" : "Back to Variance Review"}
                      </Button>
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
