"use client";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ReserveEligibility } from "@/components/refining/reserve-eligibility";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

export default function ReserveEligibilityPage() {
  const { language } = useLanguage();
  const fr = language === "fr";
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader title={fr ? "Classification d’éligibilité aux réserves" : "Reserve Eligibility Classification"} subtitle={fr ? "Classifier l’outturn vérifié comme monétaire ou non monétaire" : "Classify the verified outturn as monetary or non-monetary"} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-6xl"><ReserveEligibility /></div></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
