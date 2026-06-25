"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { ScreeningResults } from "@/components/screening/screening-results";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Counterparty } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/language-context";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Validate counterparty has all required fields before approval (Issue #7)
const validateCounterpartyForApproval = (counterparty: Counterparty | undefined) => {
  if (!counterparty) return { isValid: false, missingFields: ["counterparty"] };
  
  const required: Record<string, string | undefined> = {
    legalName: counterparty.legalName?.trim(),
    registrationNumber: counterparty.registrationNumber?.trim(),
    countryOfIncorporation: counterparty.countryOfIncorporation?.trim(),
    registeredAddress: counterparty.registeredAddress?.trim(),
    primaryContact: counterparty.primaryContact?.trim(),
    primaryEmail: counterparty.primaryEmail?.trim(),
  };
  
  const missingFields = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  
  // Check if at least one UBO exists
  const hasUbo = counterparty.ubos && counterparty.ubos.length > 0 && 
    counterparty.ubos.some((ubo) => 
      ubo.fullName?.trim() && ubo.nationality?.trim() && (ubo.ownershipPercent || 0) > 0
    );
  
  if (!hasUbo) {
    missingFields.push("UBO (beneficiary owner)");
  }
  
  // Check if at least one document is uploaded
  const documentCount = counterparty.documents?.length || 0;
  if (documentCount === 0) {
    missingFields.push("Documents (at least one required)");
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

export default function ScreeningPage() {
  const params = useParams();
  const router = useRouter();
  const counterpartyId = params.id as string;
  const { t, language } = useLanguage();

  const { data: counterparty, isLoading, error } = useSWR<Counterparty>(
    `/api/counterparties/${counterpartyId}`,
    fetcher
  );

  const validation = validateCounterpartyForApproval(counterparty);

  const handleApprove = async () => {
    // Validate before approval (Issue #7)
    if (!validation.isValid) {
      alert(language === "fr" 
        ? `Impossible d'approuver. Champs manquants: ${validation.missingFields.join(", ")}`
        : `Cannot approve. Missing fields: ${validation.missingFields.join(", ")}`
      );
      return;
    }
    
    // US-01: On approval, transition to PENDING_RISK_REVIEW for US-02 risk tier assignment
    await fetch(`/api/counterparties/${counterpartyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...counterparty, status: "pending_risk_review" }),
    });
    // Route to US-02 Risk Management for comprehensive risk tier assignment
    router.push("/risk-management?new=" + counterpartyId);
  };

  const handleReject = async () => {
    await fetch(`/api/counterparties/${counterpartyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...counterparty, status: "blocked" }),
    });
    router.push("/approval-queue?rejected=" + counterpartyId);
  };

  const handleRequestInfo = () => {
    alert("Request for additional information sent to counterparty.");
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={t.screening.title} />
            <main className="flex flex-1 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (error || !counterparty) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={t.screening.title} />
            <main className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold">{t.counterparties.noCounterparties}</h2>
                <p className="mt-2 text-muted-foreground">
                  {t.counterparties.noCounterpartiesDesc}
                </p>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={t.screening.title}
            subtitle={`${t.screening.subtitle} ${counterparty.legalName}`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl">
              <div className="mb-6">
                <Link href={`/counterparties/${counterparty.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t.common.back}
                  </Button>
                </Link>
              </div>
              <ScreeningResults
                counterparty={counterparty}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestInfo={handleRequestInfo}
                validationErrors={validation.missingFields}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
