"use client";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { RefiningSettlement } from "@/components/refining/refining-settlement";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

export default function RefiningSettlementPage() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader title={fr ? "Règlement du raffinage" : "Refining Settlement"} subtitle={fr ? "Saisir les frais de raffinage et transmettre l’instruction de règlement" : "Capture refining charges and instruct settlement"} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl"><RefiningSettlement /></div></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
