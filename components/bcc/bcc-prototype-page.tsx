"use client"

import { useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { useLanguage } from "@/lib/i18n/language-context"

const CONFIG = {
  dashboard: { screen: "dashboard", en: ["Dashboard", "Portfolio overview and lifecycle status"], fr: ["Tableau de bord", "Vue du portefeuille et état du cycle de vie"] },
  "purchase-orders": { screen: "po", en: ["Purchase Orders", "Create, price and approve a gold purchase order"], fr: ["Ordres d’achat", "Créer, valoriser et approuver un ordre d’achat d’or"] },
  "receipt-assay": { screen: "storage", en: ["Receipt & Assay", "Confirm physical intake, weight and final purity"], fr: ["Réception et essai", "Confirmer la réception physique, le poids et la pureté finale"] },
  "pricing-settlement": { screen: "settlement", en: ["Pricing & Settlement", "Confirm executed price, settlement terms and actual costs"], fr: ["Tarification et règlement", "Confirmer le prix exécuté, les conditions et les coûts réels"] },
  custody: { screen: "custody", en: ["Custody Confirmation", "Confirm depositary, title, allocation and reserve eligibility"], fr: ["Confirmation de conservation", "Confirmer le dépositaire, le titre, l’allocation et l’éligibilité"] },
  valuation: { screen: "pnl", en: ["Valuation & P&L", "Analyse book cost, valuation and performance attribution"], fr: ["Valorisation et résultat", "Analyser le coût comptable, la valorisation et la performance"] },
  "monetary-impact": { screen: "monetary", en: ["Monetary impact", "Model monetary transmission and reserve adequacy"], fr: ["Impact monétaire", "Modéliser la transmission monétaire et l’adéquation des réserves"] },
  reports: { screen: "reports", en: ["Reports", "Download executive and service-head reporting packs"], fr: ["Rapports", "Télécharger les dossiers exécutifs et les rapports de service"] },
} as const

export type BccPrototypeSection = keyof typeof CONFIG

export function BccPrototypePage({ section }: { section: BccPrototypeSection }) {
  const { language } = useLanguage()
  const searchParams = useSearchParams()
  const config = CONFIG[section]
  const copy = config[language]
  const recordId = section === "purchase-orders" ? searchParams.get("recordId") : null
  const viewOnly = Boolean(recordId && searchParams.get("view") === "1")
  const createNew = section === "purchase-orders" && !recordId
  return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={copy[0]} subtitle={copy[1]}/><main className="min-h-0 flex-1 bg-background"><iframe key={`${section}-${language}-${recordId||"new"}-${viewOnly}`} className="h-full w-full border-0 bg-background" src={`/bcc-reserve-management.html?embedded=1&screen=${config.screen}&lang=${language}${createNew?"&new=1":recordId?`&recordId=${encodeURIComponent(recordId)}${viewOnly?"&view=1":""}`:""}`} title={`${copy[0]} — Banque Centrale`}/></main></div></div></SidebarProvider>
}
