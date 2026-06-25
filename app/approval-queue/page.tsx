"use client";

import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { ApprovalQueue } from "@/components/approval/approval-queue";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Spinner } from "@/components/ui/spinner";
import type { Counterparty } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/language-context";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ApprovalQueuePage() {
  const { data: counterparties, isLoading } = useSWR<Counterparty[]>("/api/approval-queue", fetcher);
  const { t } = useLanguage();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={t.approvalQueue.title}
            subtitle={t.approvalQueue.subtitle}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : (
                <ApprovalQueue counterparties={counterparties || []} />
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
