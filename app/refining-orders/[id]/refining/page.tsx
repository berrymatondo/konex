"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Factory } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { InfoCell, RefiningPanel, StatusPill, WorkflowStepper } from "@/components/refining/refining-shared";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";

interface RefiningOrder {
  reference: string;
  status: string;
  purchaseOrderReference: string | null;
  lotReference: string | null;
  refineryName: string | null;
  inputGrossWeightKg: number;
  inputFineGoldKg: number;
  expectedOutturnKg: number;
  turnaroundDays: number;
}

export default function RefiningInProgressPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { language } = useLanguage();
  const fr = language === "fr";
  const { data: order, error, isLoading } = useSWR<RefiningOrder>(
    id ? `/api/refining-orders/${encodeURIComponent(id)}` : null,
    async (url: string) => {
      const response = await fetch(url);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load refining order");
      return result;
    },
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader title={fr ? "Raffinage en cours" : "Refining in progress"} subtitle={fr ? "Suivre le traitement auprès de la raffinerie affectée" : "Track processing at the assigned refinery"} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl space-y-5">
              {isLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">{fr ? "Chargement…" : "Loading…"}</div>}
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{fr ? "Impossible de charger cet ordre." : "Unable to load this order."}</div>}
              {order && <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h1 className="font-mono text-xl font-semibold">{order.reference}</h1><StatusPill tone="info">{fr ? "En raffinage" : "In refining"}</StatusPill></div><p className="mt-1 text-sm text-muted-foreground">{order.purchaseOrderReference ? `PO ${order.purchaseOrderReference}` : ""}{order.lotReference ? ` · Lot ${order.lotReference}` : ""}</p></div>
                  <Button variant="outline" asChild><Link href="/refining-orders">{fr ? "Retour à la liste" : "Back to list"}</Link></Button>
                </div>
                <WorkflowStepper active={3} hrefs={["/refining-orders", `/refining-orders/${id}/approval`, `/refining-orders/${id}/dispatch`, `/refining-orders/${id}/refining`, undefined, undefined, `/refining-orders/${id}/reserve-eligibility`]} labels={fr ? ["Brouillon", "Approuvé", "Expédition", "En raffinage", "Outturn reçu", "Rapproché", "Classification"] : ["Draft", "Approved", "Dispatch", "In refining", "Outturn received", "Reconciled", "Classification"]} />
                <RefiningPanel icon={Factory} title={fr ? "Traitement à la raffinerie" : "Refinery processing"}>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoCell label={fr ? "Raffinerie affectée" : "Assigned refinery"}>{order.refineryName || "—"}</InfoCell>
                    <InfoCell label={fr ? "Poids brut expédié" : "Dispatched gross weight"}>{order.inputGrossWeightKg.toFixed(3)} kg</InfoCell>
                    <InfoCell label={fr ? "Or fin entrant" : "Incoming fine gold"}>{order.inputFineGoldKg.toFixed(3)} kg</InfoCell>
                    <InfoCell label={fr ? "Sortie attendue" : "Expected outturn"}>{order.expectedOutturnKg.toFixed(3)} kg</InfoCell>
                    <InfoCell label={fr ? "Délai contractuel" : "Contractual lead time"}>{order.turnaroundDays} {fr ? "jours ouvrés" : "business days"}</InfoCell>
                  </div>
                </RefiningPanel>
              </>}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
