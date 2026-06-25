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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search,
  TrendingUp,
  Users,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RiskAssessment {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  countryOfIncorporation: string;
  riskTier: string;
  overallScore: number;
  countryRiskScore: number | null;
  sourceRiskScore: number | null;
  pepRiskScore: number | null;
  volumeRiskScore: number | null;
  eddRequired: boolean;
  eddStatus: string | null;
  policyAcknowledged: boolean;
  assessedAt: string;
}

function getRiskBadgeVariant(tier: string): "default" | "secondary" | "destructive" | "outline" {
  switch (tier) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "default";
  }
}

function getRiskColor(tier: string): string {
  switch (tier) {
    case "critical": return "text-red-600";
    case "high": return "text-orange-500";
    case "medium": return "text-yellow-500";
    case "low": return "text-emerald-500";
    default: return "text-muted-foreground";
  }
}

export default function RiskManagementPage() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  
  const { data: assessmentsData, isLoading } = useSWR<RiskAssessment[]>("/api/risk-assessments", fetcher);
  const { data: counterparties = [] } = useSWR("/api/counterparties", fetcher);

  // Ensure assessments is always an array
  const assessments = Array.isArray(assessmentsData) ? assessmentsData : [];

  const filteredAssessments = assessments.filter((a) => {
    const matchesSearch = a.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === "all" || a.riskTier === riskFilter;
    return matchesSearch && matchesRisk;
  });

  // Calculate stats
  const stats = {
    total: assessments.length,
    critical: assessments.filter((a) => a.riskTier === "critical").length,
    high: assessments.filter((a) => a.riskTier === "high").length,
    medium: assessments.filter((a) => a.riskTier === "medium").length,
    low: assessments.filter((a) => a.riskTier === "low").length,
    pendingEdd: assessments.filter((a) => a.eddRequired && a.eddStatus === "pending").length,
  };

  // Get counterparties without assessment
  const assessedIds = new Set(assessments.map((a) => a.counterpartyId));
  const pendingAssessment = counterparties.filter((c: { id: string }) => !assessedIds.has(c.id));

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={language === "fr" ? "Gestion des Risques" : "Risk Management"}
            subtitle={language === "fr" ? "Évaluation et surveillance des risques de contrepartie" : "Counterparty risk assessment and monitoring"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Back Button */}
            <div className="mb-2">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Retour" : "Back"}
                </Button>
              </Link>
            </div>

            {/* Quick Navigation - US-02 Screens */}
            <div className="flex flex-wrap gap-3">
              <Link href="/risk-management/feeds">
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Flux de Risques" : "Risk Feeds"}
                </Button>
              </Link>
              <Link href="/risk-management/audit-log">
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Journal d'Audit" : "Audit Log"}
                </Button>
              </Link>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Total Evaluations" : "Total Assessments"}
                      </p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-3">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Critique / Elevé" : "Critical / High"}
                      </p>
                      <p className="text-2xl font-bold text-red-600">{stats.critical + stats.high}</p>
                    </div>
                    <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Moyen" : "Medium"}
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
                    </div>
                    <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/30">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Faible" : "Low"}
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">{stats.low}</p>
                    </div>
                    <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "EDD en Attente" : "Pending EDD"}
                      </p>
                      <p className="text-2xl font-bold text-orange-600">{stats.pendingEdd}</p>
                    </div>
                    <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
                      <FileText className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="assessments" className="space-y-4">
              <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                <TabsTrigger value="assessments" className="text-xs sm:text-sm">
                  {language === "fr" ? "Evaluations" : "Assessments"}
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs sm:text-sm">
                  {language === "fr" ? "En Attente" : "Pending"} ({pendingAssessment.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assessments" className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={language === "fr" ? "Rechercher une contrepartie..." : "Search counterparty..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={language === "fr" ? "Niveau de risque" : "Risk Level"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                      <SelectItem value="critical">{language === "fr" ? "Critique" : "Critical"}</SelectItem>
                      <SelectItem value="high">{language === "fr" ? "Elevé" : "High"}</SelectItem>
                      <SelectItem value="medium">{language === "fr" ? "Moyen" : "Medium"}</SelectItem>
                      <SelectItem value="low">{language === "fr" ? "Faible" : "Low"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assessment List */}
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAssessments.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Shield className="h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-4 text-lg font-medium">
                          {language === "fr" ? "Aucune évaluation trouvée" : "No assessments found"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" 
                            ? "Les évaluations de risque apparaîtront ici" 
                            : "Risk assessments will appear here"}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredAssessments.map((assessment) => (
                      <Card key={assessment.id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full ${
                                assessment.riskTier === "critical" || assessment.riskTier === "high" 
                                  ? "bg-red-100 dark:bg-red-900/30" 
                                  : assessment.riskTier === "medium"
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : "bg-emerald-100 dark:bg-emerald-900/30"
                              }`}>
                                <span className={`text-base sm:text-lg font-bold ${getRiskColor(assessment.riskTier)}`}>
                                  {assessment.overallScore}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                  <Link 
                                    href={`/counterparties/${assessment.counterpartyId}`}
                                    className="font-medium hover:underline text-sm sm:text-base truncate"
                                  >
                                    {assessment.counterpartyName}
                                  </Link>
                                  <Badge variant={getRiskBadgeVariant(assessment.riskTier)} className="text-xs">
                                    {assessment.riskTier.toUpperCase()}
                                  </Badge>
                                  {assessment.eddRequired && (
                                    <Badge variant="outline" className="border-orange-500 text-orange-500 text-xs hidden sm:inline-flex">
                                      EDD {assessment.eddStatus === "pending" ? (language === "fr" ? "En attente" : "Pending") : assessment.eddStatus}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {assessment.countryOfIncorporation}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                              <div className="hidden lg:flex flex-col gap-1 text-right">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">{language === "fr" ? "Pays" : "Country"}:</span>
                                  <Progress value={assessment.countryRiskScore || 0} className="w-20 h-2" />
                                  <span className="w-8 text-right">{assessment.countryRiskScore || 0}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">{language === "fr" ? "Source" : "Source"}:</span>
                                  <Progress value={assessment.sourceRiskScore || 0} className="w-20 h-2" />
                                  <span className="w-8 text-right">{assessment.sourceRiskScore || 0}</span>
                                </div>
                              </div>
                              <Link href={`/risk-management/${assessment.counterpartyId}`}>
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                                  <span className="hidden sm:inline">{language === "fr" ? "Voir / Approuver" : "View / Approve"}</span>
                                  <span className="sm:hidden">{language === "fr" ? "Voir" : "View"}</span>
                                  <ChevronRight className="ml-1 sm:ml-2 h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                {pendingAssessment.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                      <p className="mt-4 text-lg font-medium">
                        {language === "fr" ? "Toutes les contreparties ont été évaluées" : "All counterparties assessed"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr"
                          ? "Aucune action en attente n'est requise"
                          : "No pending action is needed"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {pendingAssessment.map((cp: { id: string; legalName: string; countryOfIncorporation: string; createdAt: string }) => (
                      <Card key={cp.id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm sm:text-base truncate">{cp.legalName}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground">{cp.countryOfIncorporation}</p>
                              </div>
                            </div>
                            <Link href={`/risk-management/${cp.id}/assess`} className="w-full sm:w-auto">
                              <Button className="w-full sm:w-auto">
                                {language === "fr" ? "Évaluer" : "Assess"}
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
