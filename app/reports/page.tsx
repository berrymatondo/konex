"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  Users,
  Scale,
  DollarSign,
  Shield,
  Loader2
} from "lucide-react";
import { useState } from "react";
import {
  generateAcquisitionSummaryReport,
  generateCounterpartyOverviewReport,
  generateGoldInventoryReport,
  generateSettlementReport,
  generateComplianceAuditReport,
  generateRiskAssessmentReport,
} from "@/lib/pdf-generator";

const reportTypes = [
  {
    id: "acquisition-summary",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "counterparty-overview",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "gold-inventory",
    icon: Scale,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "settlement-report",
    icon: DollarSign,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "compliance-audit",
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "risk-assessment",
    icon: FileText,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
];

export default function ReportsPage() {
  const { language } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const getPeriodLabel = () => {
    const labels: Record<string, Record<string, string>> = {
      en: { week: "Last 7 Days", month: "Last 30 Days", quarter: "Last Quarter", year: "Last Year", custom: "Custom Range" },
      fr: { week: "7 derniers jours", month: "30 derniers jours", quarter: "Dernier trimestre", year: "Dernière année", custom: "Période personnalisée" },
    };
    return labels[language][selectedPeriod] || labels[language].month;
  };

  const translations = {
    en: {
      title: "Reports",
      subtitle: "Generate and download compliance and operational reports",
      selectPeriod: "Select Period",
      lastWeek: "Last 7 Days",
      lastMonth: "Last 30 Days",
      lastQuarter: "Last Quarter",
      lastYear: "Last Year",
      custom: "Custom Range",
      generate: "Generate",
      reports: {
        "acquisition-summary": {
          title: "Acquisition Summary",
          description: "Overview of gold acquisitions, volumes, and values",
        },
        "counterparty-overview": {
          title: "Counterparty Overview",
          description: "Active counterparties, onboarding status, and KYC compliance",
        },
        "gold-inventory": {
          title: "Gold Inventory",
          description: "Current gold holdings by vault, purity, and source",
        },
        "settlement-report": {
          title: "Settlement Report",
          description: "Payment settlements, pending amounts, and reconciliation",
        },
        "compliance-audit": {
          title: "Compliance Audit",
          description: "Sanctions screening, PEP checks, and regulatory compliance",
        },
        "risk-assessment": {
          title: "Risk Assessment",
          description: "Risk tier distribution and enhanced due diligence status",
        },
      },
    },
    fr: {
      title: "Rapports",
      subtitle: "Générer et télécharger des rapports de conformité et opérationnels",
      selectPeriod: "Sélectionner la période",
      lastWeek: "7 derniers jours",
      lastMonth: "30 derniers jours",
      lastQuarter: "Dernier trimestre",
      lastYear: "Dernière année",
      custom: "Période personnalisée",
      generate: "Générer",
      reports: {
        "acquisition-summary": {
          title: "Résumé des acquisitions",
          description: "Aperçu des acquisitions d'or, volumes et valeurs",
        },
        "counterparty-overview": {
          title: "Aperçu des contreparties",
          description: "Contreparties actives, statut d'intégration et conformité KYC",
        },
        "gold-inventory": {
          title: "Inventaire d'or",
          description: "Holdings d'or actuels par coffre, pureté et source",
        },
        "settlement-report": {
          title: "Rapport de règlement",
          description: "Règlements de paiement, montants en attente et rapprochement",
        },
        "compliance-audit": {
          title: "Audit de conformité",
          description: "Vérification des sanctions, contrôles PPE et conformité réglementaire",
        },
        "risk-assessment": {
          title: "Évaluation des risques",
          description: "Distribution des niveaux de risque et statut de diligence renforcée",
        },
      },
    },
  };

  const t = translations[language];

  const handleGenerateReport = async (reportId: string) => {
    setGeneratingReport(reportId);
    
    const baseData = {
      period: selectedPeriod,
      periodLabel: getPeriodLabel(),
      generatedAt: new Date().toLocaleString(language === "fr" ? "fr-FR" : "en-US"),
      language: language as "en" | "fr",
    };

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      switch (reportId) {
        case "acquisition-summary":
          generateAcquisitionSummaryReport({
            ...baseData,
            totalPurchaseOrders: 47,
            totalWeightKg: 2845.6,
            totalValue: 215680000,
            currency: "USD",
            byStatus: [
              { status: "Pending", count: 8, weight: 425.2, value: 32200000 },
              { status: "Approved", count: 12, weight: 680.5, value: 51500000 },
              { status: "In Transit", count: 15, weight: 892.4, value: 67600000 },
              { status: "Delivered", count: 7, weight: 512.8, value: 38850000 },
              { status: "Settled", count: 5, weight: 334.7, value: 25530000 },
            ],
            byCounterparty: [
              { name: "GoldStar Refineries Ltd", count: 12, weight: 720.5, value: 54600000 },
              { name: "African Gold Mining Corp", count: 9, weight: 580.2, value: 43950000 },
              { name: "Swiss Precious Metals AG", count: 8, weight: 485.6, value: 36800000 },
              { name: "Kibali Gold Mines", count: 6, weight: 412.8, value: 31270000 },
              { name: "Barrick Lumwana", count: 5, weight: 325.4, value: 24650000 },
              { name: "AngloGold Ashanti", count: 4, weight: 198.6, value: 15050000 },
              { name: "Geita Gold Mine", count: 3, weight: 122.5, value: 9360000 },
            ],
          });
          break;

        case "counterparty-overview":
          generateCounterpartyOverviewReport({
            ...baseData,
            totalCounterparties: 34,
            activeCounterparties: 28,
            pendingOnboarding: 6,
            byRiskTier: [
              { tier: "Tier 1 - Low Risk", count: 12, color: "green" },
              { tier: "Tier 2 - Standard", count: 15, color: "blue" },
              { tier: "Tier 3 - Enhanced Due Diligence", count: 5, color: "orange" },
              { tier: "Tier 4 - High Risk", count: 2, color: "red" },
            ],
            byCountry: [
              { country: "South Africa", count: 8 },
              { country: "Ghana", count: 6 },
              { country: "Tanzania", count: 5 },
              { country: "DRC", count: 4 },
              { country: "Mali", count: 4 },
              { country: "Burkina Faso", count: 3 },
              { country: "Switzerland", count: 2 },
              { country: "United Kingdom", count: 2 },
            ],
            recentOnboarded: [
              { name: "New Gold Corp", country: "Ghana", status: "Active", date: "2026-05-10" },
              { name: "Atlas Mining Ltd", country: "Tanzania", status: "Pending KYC", date: "2026-05-08" },
            ],
          });
          break;

        case "gold-inventory":
          generateGoldInventoryReport({
            ...baseData,
            totalWeightKg: 1842.5,
            totalValue: 139650000,
            currency: "USD",
            byVault: [
              { vault: "London - Brinks RB", weightKg: 680.2, value: 51550000 },
              { vault: "Zurich - UBS Vault", weightKg: 524.8, value: 39780000 },
              { vault: "Singapore - Certis", weightKg: 412.5, value: 31270000 },
              { vault: "Dubai - Emirates Gold", weightKg: 225.0, value: 17050000 },
            ],
            byPurity: [
              { purity: "99.99% (4 Nines)", weightKg: 1245.8, percentage: 67.6 },
              { purity: "99.95%", weightKg: 425.2, percentage: 23.1 },
              { purity: "99.90%", weightKg: 145.5, percentage: 7.9 },
              { purity: "99.50%", weightKg: 26.0, percentage: 1.4 },
            ],
            bySource: [
              { source: "Large Scale Mining", weightKg: 1125.4, value: 85280000 },
              { source: "Artisanal Mining (Certified)", weightKg: 485.6, value: 36800000 },
              { source: "Recycled/Refined", weightKg: 231.5, value: 17570000 },
            ],
          });
          break;

        case "settlement-report":
          generateSettlementReport({
            ...baseData,
            totalSettlements: 23,
            totalPaid: 89500000,
            totalPending: 34200000,
            currency: "USD",
            byStatus: [
              { status: "Allocated", count: 15, amount: 89500000 },
              { status: "Pending Approval", count: 5, amount: 24800000 },
              { status: "Pending Valuation", count: 3, amount: 9400000 },
            ],
            recentSettlements: [
              { id: "SETT-2026-4521", counterparty: "GoldStar Refineries", amount: 12450000, status: "Allocated", date: "2026-05-14" },
              { id: "SETT-2026-4520", counterparty: "African Gold Mining", amount: 8920000, status: "Allocated", date: "2026-05-13" },
              { id: "SETT-2026-4519", counterparty: "Swiss Precious Metals", amount: 15680000, status: "Pending", date: "2026-05-12" },
              { id: "SETT-2026-4518", counterparty: "Kibali Gold Mines", amount: 6540000, status: "Allocated", date: "2026-05-11" },
              { id: "SETT-2026-4517", counterparty: "Barrick Lumwana", amount: 9870000, status: "Pending", date: "2026-05-10" },
              { id: "SETT-2026-4516", counterparty: "AngloGold Ashanti", amount: 11230000, status: "Allocated", date: "2026-05-09" },
            ],
          });
          break;

        case "compliance-audit":
          generateComplianceAuditReport({
            ...baseData,
            totalScreenings: 156,
            sanctionsHits: 3,
            pepHits: 7,
            clearedCounterparties: 142,
            pendingReview: 4,
            screeningResults: [
              { counterparty: "GoldStar Refineries Ltd", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "African Gold Mining Corp", sanctions: "Clear", pep: "Review", status: "Pending" },
              { counterparty: "Swiss Precious Metals AG", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "Kibali Gold Mines", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "Unknown Trader LLC", sanctions: "Hit", pep: "N/A", status: "Rejected" },
              { counterparty: "Barrick Lumwana", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "AngloGold Ashanti", sanctions: "Clear", pep: "Review", status: "Pending" },
              { counterparty: "Geita Gold Mine", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "Gold Coast Mining", sanctions: "Clear", pep: "Clear", status: "Approved" },
              { counterparty: "Sahara Resources", sanctions: "Review", pep: "Clear", status: "Pending" },
            ],
          });
          break;

        case "risk-assessment":
          generateRiskAssessmentReport({
            ...baseData,
            totalAssessed: 34,
            highRisk: 2,
            mediumRisk: 12,
            lowRisk: 15,
            pendingEDD: 5,
            riskDistribution: [
              { tier: language === "fr" ? "Faible Risque (Tier 1)" : "Low Risk (Tier 1)", count: 15, percentage: 44.1, color: "green" },
              { tier: language === "fr" ? "Risque Moyen (Tier 2)" : "Medium Risk (Tier 2)", count: 12, percentage: 35.3, color: "yellow" },
              { tier: language === "fr" ? "Risque Élevé (Tier 3-4)" : "High Risk (Tier 3-4)", count: 7, percentage: 20.6, color: "red" },
            ],
            eddStatus: [
              { counterparty: "Unknown Trader LLC", riskTier: "Tier 4", eddStatus: "In Progress", dueDate: "2026-05-20" },
              { counterparty: "Sahara Resources", riskTier: "Tier 3", eddStatus: "Pending", dueDate: "2026-05-25" },
              { counterparty: "Gold Coast Mining", riskTier: "Tier 3", eddStatus: "Completed", dueDate: "2026-05-15" },
              { counterparty: "Atlas Mining Ltd", riskTier: "Tier 3", eddStatus: "In Progress", dueDate: "2026-05-22" },
              { counterparty: "New Gold Corp", riskTier: "Tier 2", eddStatus: "Pending", dueDate: "2026-05-30" },
            ],
          });
          break;
      }
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={t.title}
            subtitle={t.subtitle}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Period Selector */}
              <Card>
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{t.selectPeriod}</span>
                  </div>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">{t.lastWeek}</SelectItem>
                      <SelectItem value="month">{t.lastMonth}</SelectItem>
                      <SelectItem value="quarter">{t.lastQuarter}</SelectItem>
                      <SelectItem value="year">{t.lastYear}</SelectItem>
                      <SelectItem value="custom">{t.custom}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Report Cards Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const reportInfo = t.reports[report.id as keyof typeof t.reports];
                  
                  return (
                    <Card key={report.id} className="group transition-shadow hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${report.bgColor}`}>
                            <Icon className={`h-5 w-5 ${report.color}`} />
                          </div>
                        </div>
                        <CardTitle className="mt-3 text-lg">{reportInfo.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {reportInfo.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => handleGenerateReport(report.id)}
                          disabled={generatingReport !== null}
                        >
                          {generatingReport === report.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {language === "fr" ? "Génération..." : "Generating..."}
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              {t.generate}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
