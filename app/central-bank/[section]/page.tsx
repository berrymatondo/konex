import { notFound } from "next/navigation"
import { Suspense } from "react"

import MarketOversightPage from "@/app/page"
import { BccPrototypePage, type BccPrototypeSection } from "@/components/bcc/bcc-prototype-page"
import { BccSectionPage } from "@/components/bcc/bcc-workspace"
import { BccReceiptAssaySummary } from "@/components/bcc/bcc-receipt-assay"
import { BccSettlementsSummary } from "@/components/bcc/bcc-settlements"
import { BccCustodyConfirmationsSummary } from "@/components/bcc/bcc-custody-confirmations"
import { BccValuationsSummary } from "@/components/bcc/bcc-valuations"

const SECTIONS = {
  dashboard: { screen: "dashboard", title: "Tableau de bord", subtitle: "Vue d’ensemble du portefeuille et du cycle de vie" },
  transactions: { screen: "transactions", title: "Transactions", subtitle: "Liste des ordres d’achat BCC" },
  receipts: { screen: "receipts", title: "Liste des réceptions", subtitle: "Sommaire des réceptions physiques" },
  settlements: { screen: "settlements", title: "Règlements", subtitle: "Liste des tarifications et règlements BCC" },
  confirmations: { screen: "confirmations", title: "Liste des confirmations", subtitle: "Liste des confirmations de conservation BCC" },
  valuations: { screen: "valuations", title: "Valorisations", subtitle: "Liste des valorisations BCC" },
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
  if (section === "settlements") {
    return <BccSettlementsSummary />
  }
  if (section === "confirmations") {
    return <BccCustodyConfirmationsSummary />
  }
  if (section === "valuations") {
    return <BccValuationsSummary />
  }
  if (section === "transactions" || section === "refining-orders" || section === "audit") {
    return <BccSectionPage section={section} />
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BccPrototypePage section={section as BccPrototypeSection} />
    </Suspense>
  )
}
