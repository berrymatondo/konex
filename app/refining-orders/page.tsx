"use client";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { RefiningOrderForm } from "@/components/refining/refining-order-form";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

export default function RefiningOrdersPage() {
  const { language } = useLanguage();
  const fr = language === "fr";
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader title={fr ? "Ordre de raffinage" : "Refining Order"} subtitle={fr ? "Créer et gérer le raffinage à façon des lots de doré" : "Create and manage toll-refining of doré lots"} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-6xl"><RefiningOrderForm /></div></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
