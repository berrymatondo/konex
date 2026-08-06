"use client";

import { useState } from "react";
import { Calendar, DollarSign, Download, FileText, Loader2, Scale, Shield, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  generateAcquisitionSummaryReport, generateComplianceAuditReport, generateCounterpartyOverviewReport,
  generateGoldInventoryReport, generateRiskAssessmentReport, generateSettlementReport,
} from "@/lib/pdf-generator";

const reports = [
  { id: "acquisition-summary", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "counterparty-overview", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "gold-inventory", icon: Scale, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "settlement-report", icon: DollarSign, color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "compliance-audit", icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
  { id: "risk-assessment", icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10" },
] as const;

const copy = {
  en: {
    title: "Reports", subtitle: "Generate reports from live operational and compliance data", select: "Select period",
    periods: { week: "Last 7 days", month: "Last 30 days", quarter: "Last quarter", year: "Last year", custom: "Custom range" },
    generate: "Generate PDF", generating: "Generating…",
    names: {
      "acquisition-summary": ["Acquisition Summary", "Gold acquisitions, volumes, values, statuses and counterparties"],
      "counterparty-overview": ["Counterparty Overview", "Onboarding, activity, country and risk distribution"],
      "gold-inventory": ["Gold Inventory", "Verified holdings by vault, purity and source"],
      "settlement-report": ["Settlement Report", "Paid and pending settlements with reconciliation statuses"],
      "compliance-audit": ["Compliance Audit", "Sanctions and PEP screening results for the period"],
      "risk-assessment": ["Risk Assessment", "Latest risk tiers and enhanced due diligence status"],
    },
  },
  fr: {
    title: "Rapports", subtitle: "Générez des rapports à partir des données opérationnelles et de conformité réelles", select: "Sélectionner la période",
    periods: { week: "7 derniers jours", month: "30 derniers jours", quarter: "Dernier trimestre", year: "Dernière année", custom: "Période personnalisée" },
    generate: "Générer le PDF", generating: "Génération…",
    names: {
      "acquisition-summary": ["Résumé des acquisitions", "Acquisitions, volumes, valeurs, statuts et contreparties"],
      "counterparty-overview": ["Aperçu des contreparties", "Intégration, activité, pays et distribution des risques"],
      "gold-inventory": ["Inventaire d’or", "Avoirs vérifiés par coffre, pureté et source"],
      "settlement-report": ["Rapport de règlement", "Règlements payés et en attente avec leurs statuts"],
      "compliance-audit": ["Audit de conformité", "Résultats des contrôles sanctions et PPE sur la période"],
      "risk-assessment": ["Évaluation des risques", "Derniers niveaux de risque et diligence renforcée"],
    },
  },
};

export default function ReportsPage() {
  const { language } = useLanguage();
  const t = copy[language];
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [generating, setGenerating] = useState<string | null>(null);

  function dateRange() {
    if (period === "custom") return { start: customStart, end: customEnd };
    const end = new Date(); const start = new Date(end);
    if (period === "week") start.setDate(start.getDate() - 6);
    else if (period === "month") start.setDate(start.getDate() - 29);
    else if (period === "quarter") start.setMonth(start.getMonth() - 3);
    else start.setFullYear(start.getFullYear() - 1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  async function generate(reportId: string) {
    const range = dateRange();
    if (!range.start || !range.end || range.start > range.end) {
      toast.error(language === "fr" ? "La période sélectionnée est invalide." : "The selected date range is invalid."); return;
    }
    setGenerating(reportId);
    try {
      const response = await fetch(`/api/reports?type=${encodeURIComponent(reportId)}&start=${range.start}&end=${range.end}`);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const base = { period: `${range.start}-${range.end}`, periodLabel: period === "custom" ? `${range.start} — ${range.end}` : t.periods[period as keyof typeof t.periods], generatedAt: new Date().toLocaleString(language === "fr" ? "fr-FR" : "en-US"), language };
      if (reportId === "acquisition-summary") generateAcquisitionSummaryReport({ ...base, ...data });
      else if (reportId === "counterparty-overview") generateCounterpartyOverviewReport({ ...base, ...data });
      else if (reportId === "gold-inventory") generateGoldInventoryReport({ ...base, ...data });
      else if (reportId === "settlement-report") generateSettlementReport({ ...base, ...data });
      else if (reportId === "compliance-audit") generateComplianceAuditReport({ ...base, ...data });
      else generateRiskAssessmentReport({ ...base, ...data });
    } catch (error) {
      console.error(error); toast.error(language === "fr" ? "Impossible de générer le rapport." : "Unable to generate the report.");
    } finally { setGenerating(null); }
  }

  return <SidebarProvider><div className="flex h-screen"><AppSidebar /><div className="flex flex-1 flex-col overflow-hidden">
    <AppHeader title={t.title} subtitle={t.subtitle} />
    <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-6">
      <Card><CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">{t.select}</span></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-full sm:w-[210px]"><SelectValue /></SelectTrigger><SelectContent>
            {Object.entries(t.periods).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent></Select>
          {period === "custom" && <div className="flex items-center gap-2"><Input aria-label="Date de début" type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)} /><span>—</span><Input aria-label="Date de fin" type="date" value={customEnd} min={customStart} max={today} onChange={e => setCustomEnd(e.target.value)} /></div>}
        </div>
      </CardContent></Card>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{reports.map(report => { const Icon = report.icon; const info = t.names[report.id]; return <Card key={report.id} className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${report.bg}`}><Icon className={`h-5 w-5 ${report.color}`} /></div><CardTitle className="mt-3 text-lg">{info[0]}</CardTitle><CardDescription>{info[1]}</CardDescription></CardHeader>
        <CardContent><Button className="w-full" variant="outline" disabled={generating !== null} onClick={() => generate(report.id)}>{generating === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{generating === report.id ? t.generating : t.generate}</Button></CardContent>
      </Card>})}</div>
    </div></main>
  </div></div></SidebarProvider>;
}
