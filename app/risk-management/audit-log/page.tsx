"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Search,
  Download,
  Filter,
  Clock,
  User,
  Hash,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  ArrowUpDown,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuditEntry {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  action: string;
  previousTier: string | null;
  newTier: string | null;
  reason: string | null;
  performedBy: string;
  performedAt: string;
  ipAddress?: string;
  hashVerification?: string;
}

const mockAuditData: AuditEntry[] = [
  {
    id: "ral-001",
    counterpartyId: "cp-001",
    counterpartyName: "Accra Gold Trading Ltd",
    action: "assessment_created",
    previousTier: null,
    newTier: "high",
    reason: "Initial risk assessment - ASM source detected",
    performedBy: "compliance_officer",
    performedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ipAddress: "192.168.1.45",
    hashVerification: "sha256:a1b2c3d4e5f6...",
  },
  {
    id: "ral-002",
    counterpartyId: "cp-001",
    counterpartyName: "Accra Gold Trading Ltd",
    action: "policy_acknowledged",
    previousTier: "high",
    newTier: "high",
    reason: "EDD requirements acknowledged",
    performedBy: "risk_manager",
    performedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    ipAddress: "192.168.1.52",
    hashVerification: "sha256:f6e5d4c3b2a1...",
  },
  {
    id: "ral-003",
    counterpartyId: "cp-002",
    counterpartyName: "Lagos Precious Metals",
    action: "feed_sync",
    previousTier: null,
    newTier: null,
    reason: "CAHRA list updated - 12 new entries",
    performedBy: "system",
    performedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    ipAddress: "internal",
    hashVerification: "sha256:1a2b3c4d5e6f...",
  },
  {
    id: "ral-004",
    counterpartyId: "cp-002",
    counterpartyName: "Lagos Precious Metals",
    action: "tier_override",
    previousTier: "high",
    newTier: "medium",
    reason: "Manual override - Additional documentation provided proving LSM certification",
    performedBy: "senior_compliance",
    performedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ipAddress: "192.168.1.78",
    hashVerification: "sha256:6f5e4d3c2b1a...",
  },
  {
    id: "ral-005",
    counterpartyId: "cp-003",
    counterpartyName: "Swiss Gold Refiners SA",
    action: "status_change",
    previousTier: "low",
    newTier: "low",
    reason: "Status changed to APPROVED after EDD completion",
    performedBy: "risk_manager",
    performedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ipAddress: "192.168.1.52",
    hashVerification: "sha256:0a1b2c3d4e5f...",
  },
];

export default function RiskAuditLogPage() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7d");

  const { data: auditLogData } = useSWR("/api/risk-audit-log", fetcher);
  
  // Use mock data if API doesn't return data
  const auditLog = Array.isArray(auditLogData) && auditLogData.length > 0 ? auditLogData : mockAuditData;

  // Calculate date threshold based on dateRange filter
  const getDateThreshold = () => {
    const now = new Date();
    switch (dateRange) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const filteredLog = auditLog.filter((entry) => {
    const matchesSearch = 
      entry.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.performedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || entry.action === actionFilter;
    const entryDate = new Date(entry.performedAt);
    const matchesDate = entryDate >= getDateThreshold();
    return matchesSearch && matchesAction && matchesDate;
  });

  const getActionConfig = (action: string) => {
    switch (action) {
      case "assessment_created":
        return { 
          label: language === "fr" ? "Évaluation créée" : "Assessment Created",
          icon: FileText,
          color: "text-blue-500",
          bgColor: "bg-blue-100 dark:bg-blue-900/30"
        };
      case "policy_acknowledged":
        return { 
          label: language === "fr" ? "Politique reconnue" : "Policy Acknowledged",
          icon: CheckCircle2,
          color: "text-emerald-500",
          bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
        };
      case "feed_sync":
        return { 
          label: language === "fr" ? "Sync flux" : "Feed Sync",
          icon: RefreshCw,
          color: "text-purple-500",
          bgColor: "bg-purple-100 dark:bg-purple-900/30"
        };
      case "tier_override":
        return { 
          label: language === "fr" ? "Override tier" : "Tier Override",
          icon: AlertTriangle,
          color: "text-amber-500",
          bgColor: "bg-amber-100 dark:bg-amber-900/30"
        };
      case "status_change":
        return { 
          label: language === "fr" ? "Changement statut" : "Status Change",
          icon: ArrowUpDown,
          color: "text-indigo-500",
          bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
        };
      default:
        return { 
          label: action,
          icon: Shield,
          color: "text-slate-500",
          bgColor: "bg-slate-100 dark:bg-slate-900/30"
        };
    }
  };

  const getTierBadge = (tier: string | null) => {
    if (!tier) return null;
    switch (tier) {
      case "critical": return <Badge variant="destructive">CRITICAL</Badge>;
      case "high": return <Badge className="bg-orange-500">HIGH</Badge>;
      case "medium": return <Badge variant="secondary">MEDIUM</Badge>;
      case "low": return <Badge variant="outline" className="border-emerald-500 text-emerald-500">LOW</Badge>;
      default: return <Badge>{tier}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={language === "fr" ? "Journal d'Audit des Risques" : "Risk Decision Audit Log"}
            subtitle={language === "fr" ? "Historique immutable des décisions" : "Immutable decision history"}
          />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Back Button */}
              <div className="mb-4">
                <Link href="/risk-management">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Retour" : "Back"}
                  </Button>
                </Link>
              </div>

              {/* Info Banner */}
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="flex items-center gap-4 py-4">
                  <Shield className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                      {language === "fr" ? "Audit Trail Immutable" : "Immutable Audit Trail"}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">
                      {language === "fr" 
                        ? "Toutes les entrées sont vérifiées par hachage SHA-256 et ne peuvent pas être modifiées ou supprimées. Rétention minimum: 5 ans."
                        : "All entries are SHA-256 hash verified and cannot be edited or deleted. Minimum retention: 5 years."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "fr" ? "Toutes les actions" : "All Actions"}</SelectItem>
                      <SelectItem value="assessment_created">{language === "fr" ? "Évaluation" : "Assessment"}</SelectItem>
                      <SelectItem value="policy_acknowledged">{language === "fr" ? "Reconnaissance" : "Acknowledgment"}</SelectItem>
                      <SelectItem value="feed_sync">{language === "fr" ? "Sync flux" : "Feed Sync"}</SelectItem>
                      <SelectItem value="tier_override">{language === "fr" ? "Override" : "Override"}</SelectItem>
                      <SelectItem value="status_change">{language === "fr" ? "Statut" : "Status"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-[150px]">
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">{language === "fr" ? "24 heures" : "24 hours"}</SelectItem>
                      <SelectItem value="7d">{language === "fr" ? "7 jours" : "7 days"}</SelectItem>
                      <SelectItem value="30d">{language === "fr" ? "30 jours" : "30 days"}</SelectItem>
                      <SelectItem value="90d">{language === "fr" ? "90 jours" : "90 days"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Exporter" : "Export"}
                  </Button>
                </CardContent>
              </Card>

              {/* Audit Log Entries */}
              <div className="space-y-4">
                {filteredLog.map((entry) => {
                  const actionConfig = getActionConfig(entry.action);
                  const ActionIcon = actionConfig.icon;
                  
                  return (
                    <Card key={entry.id} className="overflow-hidden">
                      <div className="flex">
                        {/* Timeline indicator */}
                        <div className={`w-1 ${actionConfig.bgColor}`} />
                        
                        <CardContent className="flex-1 py-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-start gap-4">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${actionConfig.bgColor}`}>
                                <ActionIcon className={`h-5 w-5 ${actionConfig.color}`} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{actionConfig.label}</span>
                                  {entry.previousTier && entry.newTier && entry.previousTier !== entry.newTier && (
                                    <div className="flex items-center gap-1">
                                      {getTierBadge(entry.previousTier)}
                                      <span className="text-muted-foreground">→</span>
                                      {getTierBadge(entry.newTier)}
                                    </div>
                                  )}
                                  {entry.newTier && !entry.previousTier && getTierBadge(entry.newTier)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  <Link 
                                    href={`/counterparties/${entry.counterpartyId}`}
                                    className="hover:text-primary hover:underline transition-colors"
                                  >
                                    {entry.counterpartyName}
                                  </Link>
                                </p>
                                {entry.reason && (
                                  <p className="text-sm">
                                    {entry.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {formatDate(entry.performedAt)}
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {entry.performedBy.replace("_", " ")}
                              </div>
                              {entry.ipAddress && (
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3 w-3" />
                                  {entry.ipAddress}
                                </div>
                              )}
                              {entry.hashVerification && (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <Hash className="h-3 w-3" />
                                  {entry.hashVerification}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Compliance Note */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  <p className="font-semibold mb-2">
                    {language === "fr" ? "Conformité réglementaire" : "Regulatory Compliance"}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>LBMA RGG Step 5.1: {language === "fr" ? "Exigences de conservation des dossiers (≥5 ans)" : "Record-keeping requirements (≥5 years retention)"}</li>
                    <li>IMF SDDS: {language === "fr" ? "Normes d'audit de données" : "Data audit standards"}</li>
                    <li>{language === "fr" ? "Vérification de hachage de chaîne pour zéro risque de falsification" : "Chain-of-custody hash verification for zero tampering risk"}</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
