"use client";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { RefiningOrderDispatch } from "@/components/refining/refining-order-dispatch";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

export default function RefiningOrderDispatchPage() {
  const { language } = useLanguage();
  const fr = language === "fr";
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader title={fr ? "Expédition et chaîne de garde" : "Dispatch & Chain of Custody"} subtitle={fr ? "Enregistrer l’expédition sécurisée du doré vers la raffinerie affectée" : "Record secure dispatch of doré to the assigned refiner"} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-6xl"><RefiningOrderDispatch /></div></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
