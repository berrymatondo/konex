import { notFound } from "next/navigation"

import MarketOversightPage from "@/app/page"
import { BccPrototypePage, type BccPrototypeSection } from "@/components/bcc/bcc-prototype-page"
import { BccSectionPage } from "@/components/bcc/bcc-workspace"
import { BccReceiptAssaySummary } from "@/components/bcc/bcc-receipt-assay"

const SECTIONS = {
  dashboard: { screen: "dashboard", title: "Tableau de bord", subtitle: "Vue d’ensemble du portefeuille et du cycle de vie" },
  transactions: { screen: "transactions", title: "Transactions", subtitle: "Liste des ordres d’achat BCC" },
  "purchase-orders": { screen: "po", title: "Purchase Orders", subtitle: "Créer, valoriser et approuver un ordre d’achat d’or" },
  "receipt-assay": { screen: "storage", title: "Receipt & Assay", subtitle: "Confirmer la réception physique, le poids et la pureté finale" },
  receipts: { screen: "receipts", title: "Liste des réceptions", subtitle: "Sommaire des réceptions physiques" },
  "pricing-settlement": { screen: "settlement", title: "Pricing & Settlement", subtitle: "Confirmer le prix exécuté, le règlement et les coûts réels" },
  custody: { screen: "custody", title: "Custody Confirmation", subtitle: "Confirmer le dépositaire, le titre, l’allocation et l’éligibilité aux réserves" },
  valuation: { screen: "pnl", title: "Valuation & P&L", subtitle: "Analyser le coût comptable, la valorisation et la performance" },
  "monetary-impact": { screen: "monetary", title: "Impact monétaire", subtitle: "Simuler la transmission monétaire et l’adéquation des réserves" },
  reports: { screen: "reports", title: "Rapports", subtitle: "Produire les dossiers exécutifs et les rapports de service" },
  "refining-orders": { screen: "refining", title: "Refining Orders", subtitle: "Gérer les ordres de raffinage BCC" },
  audit: { screen: "audit", title: "Audit Log", subtitle: "Tracer toutes les écritures BCC" },
} as const

export function generateStaticParams() {
  return Object.keys(SECTIONS).map((section) => ({ section }))
}

export default async function CentralBankPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const config = SECTIONS[section as keyof typeof SECTIONS]
  if (!config) notFound()

  if (section === "dashboard") {
    return <MarketOversightPage />
  }
  if (section === "receipts") {
    return <BccReceiptAssaySummary />
  }
  if (section === "transactions" || section === "refining-orders" || section === "audit") {
    return <BccSectionPage section={section} />
  }
  return <BccPrototypePage section={section as BccPrototypeSection} />
}
