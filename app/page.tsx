"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { CounterpartyDashboard } from "@/components/dashboard/counterparty-dashboard";
import { Users, FileText, Truck, Scale } from "lucide-react";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Spinner } from "@/components/ui/spinner";
import { useLanguage } from "@/lib/i18n/language-context";

interface DashboardData {
  stats: {
    activeCounterparties: number;
    pendingPOs: number;
    goldInTransit: number;
    monthlyAcquisitions: number;
  };
  transactions: Array<{
    id: string;
    counterpartyName: string;
    type: string;
    referenceNumber: string;
    goldWeight: number;
    goldPurity: number;
    totalValue: number;
    status: string;
    createdAt: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  // Resolve the current role to decide which dashboard variant to render.
  const { data: access } = useSWR<{ role: string | null }>(
    "/api/access/me",
    fetcher
  );
  const isCounterparty = access?.role === "counterparty";

  const { data, isLoading } = useSWR<DashboardData>(
    isCounterparty ? null : `/api/dashboard${showAllTransactions ? "?all=true" : ""}`,
    fetcher
  );
  const { t } = useLanguage();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={isCounterparty ? "Tableau de bord contrepartie" : t.dashboard.title}
            subtitle={
              isCounterparty
                ? "Suivre et traiter les demandes d'achat transmises par la Banque Centrale"
                : t.dashboard.subtitle
            }
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {isCounterparty ? (
                <CounterpartyDashboard />
              ) : isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : (
                <>
                  {/* KPI Cards */}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard
                      title={t.dashboard.activeCounterparties}
                      value={data?.stats?.activeCounterparties || 0}
                      trend={12}
                      icon={Users}
                      iconColor="text-primary"
                    />
                    <KPICard
                      title={t.dashboard.pendingPOs}
                      value={data?.stats?.pendingPOs || 0}
                      trend={-5}
                      icon={FileText}
                      iconColor="text-warning"
                    />
                    <KPICard
                      title={t.dashboard.goldInTransit}
                      value={(() => {
                        const val = data?.stats?.goldInTransit;
                        if (val === undefined || val === null || isNaN(Number(val))) return "0.0";
                        return Number(val).toFixed(1);
                      })()}
                      trend={8}
                      icon={Truck}
                      iconColor="text-info"
                    />
                    <KPICard
                      title={t.dashboard.monthlyAcquired}
                      value={(() => {
                        const val = data?.stats?.monthlyAcquisitions;
                        if (val === undefined || val === null || isNaN(Number(val))) return "0.0";
                        return Number(val).toFixed(1);
                      })()}
                      trend={15}
                      icon={Scale}
                      iconColor="text-accent"
                    />
                  </div>

                  {/* Recent Transactions */}
                  <TransactionsTable 
                    transactions={data?.transactions || []} 
                    showingAll={showAllTransactions}
                    onShowAll={() => setShowAllTransactions(!showAllTransactions)}
                  />
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
