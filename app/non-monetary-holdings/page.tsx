"use client"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { NonMonetaryHoldings } from "@/components/refining/non-monetary-holdings"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useLanguage } from "@/lib/i18n/language-context"

export default function NonMonetaryHoldingsPage() {
  const { language } = useLanguage()
  const isFrench = language === "fr"

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader
            title={isFrench ? "Détention d’or non monétaire" : "Non-monetary Gold Holding"}
            subtitle={
              isFrench
                ? "Sous-livre US-R06, suivi et remédiation des avoirs non éligibles aux réserves"
                : "US-R06 sub-ledger, monitoring and remediation of reserve-ineligible holdings"
            }
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              <NonMonetaryHoldings />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
