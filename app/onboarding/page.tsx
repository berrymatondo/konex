"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

export default function OnboardingPage() {
  const { t } = useLanguage();
  
  return (
    <SidebarProvider>
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader 
          title={t.onboarding.title}
          subtitle={t.onboarding.subtitle}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            <OnboardingForm />
          </div>
        </main>
      </div>
    </div>
    </SidebarProvider>
  );
}
