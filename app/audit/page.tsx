"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search,
  Filter,
  Shield,
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  Cpu,
  HardDrive,
  Wifi,
  MemoryStick,
  Play,
  Archive,
  CalendarDays,
  Bell,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  FileCode,
  ArrowRight,
  Lock,
  Eye,
  Signature,
  Send,
  History,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

// Mock audit trail data
const mockAuditTrail = [
  {
    id: "evt_001",
    event: "Feed Sync",
    eventType: "SYNC",
    actor: "SYSTEM",
    actorType: "system",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "z9y8x7w6v5u4321...",
    timestamp: "2026-05-14T08:00:00Z",
    status: "verified",
    details: "LBMA price feed synchronized",
  },
  {
    id: "evt_002",
    event: "Calculation Triggered",
    eventType: "CALCULATION",
    actor: "AUTO_ENGINE",
    actorType: "system",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "a1b2c3d4e5f6789...",
    timestamp: "2026-05-14T08:01:00Z",
    status: "verified",
    details: "Settlement valuation triggered",
  },
  {
    id: "evt_003",
    event: "SYSTEM",
    eventType: "RISK_ASSESSMENT",
    actor: "RISK_ENGINE",
    actorType: "system",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "a1b2c3d4e5f6789...",
    timestamp: "2026-05-14T08:02:00Z",
    status: "alert",
    details: "Score 72 - HIGH",
    score: 72,
  },
  {
    id: "evt_004",
    event: "ASM Flag",
    eventType: "AML_FLAG",
    actor: "RISK_ENGINE",
    actorType: "system",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "a1b2c3d4e5f6789...",
    timestamp: "2026-05-14T08:03:00Z",
    status: "alert",
    details: "Artisanal mining source flagged",
  },
  {
    id: "evt_005",
    event: "Acknowledged",
    eventType: "USER_ACTION",
    actor: "sarah.johnson",
    actorType: "user",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "a1b2c3d4e5f6789...",
    timestamp: "2026-05-14T09:15:00Z",
    status: "verified",
    details: "Risk flag acknowledged by compliance officer",
  },
  {
    id: "evt_006",
    event: "APPROVED",
    eventType: "APPROVAL",
    actor: "SYSTEM",
    actorType: "system",
    hash: "a1b2c3d4e5f6789...",
    previousHash: "a1b2c3d4e5f6789...",
    timestamp: "2026-05-14T10:00:00Z",
    status: "verified",
    details: "Transaction approved after review",
  },
];

// Mock scheduled reports
const mockScheduledReports = [
  { id: 1, name: "Q3 Risk Report", date: "2026-05-08", type: "risk" },
  { id: 2, name: "Monthly Audit Log", date: "2026-05-12", type: "audit" },
  { id: 3, name: "Year-End Summary", date: "2026-05-12", type: "summary" },
];

// Mock alert log
const mockAlertLog = [
  { id: 1, message: "Policy config mismatch", time: "2h ago", type: "warning" },
  { id: 2, message: "Backup completed", time: "4h ago", type: "success" },
  { id: 3, message: "Storage threshold exceeded", time: "1d ago", type: "warning" },
  { id: 4, message: "Integrity check passed", time: "3d ago", type: "success" },
  { id: 5, message: "Expired records detected", time: "5d ago", type: "warning" },
];

// Mock export queue
const mockExportQueue = [
  { id: 1, name: "Settlement Export Q1", status: "completed", format: "JSON" },
  { id: 2, name: "KYC Batch Export", status: "processing", format: "CSV" },
  { id: 3, name: "Audit Trail May", status: "pending", format: "XML" },
];

// Field mappings for export
const fieldMappings = [
  { source: "transaction_id", target: "TransactionID" },
  { source: "counterparty_name", target: "CounterpartyName" },
  { source: "gold_weight_kg", target: "GoldWeightKg" },
  { source: "settlement_amount", target: "SettlementAmount" },
];

export default function AuditPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("audit-trail");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState("PO-2026-0891");
  
  // Retention countdown timer
  const [retentionTime, setRetentionTime] = useState({ days: 0, hours: 14, minutes: 22, seconds: 0 });
  
  // Report generator state
  const [reportType, setReportType] = useState("fiu");
  const [transactionId, setTransactionId] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [goldVolume, setGoldVolume] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  
  // Export config state
  const [exportFormat, setExportFormat] = useState("json");
  const [includeSignature, setIncludeSignature] = useState(true);
  
  // Audit readiness score animation
  const [auditScore, setAuditScore] = useState(0);
  
  useEffect(() => {
    // Animate audit score on mount
    const timer = setTimeout(() => setAuditScore(87), 500);
    return () => clearTimeout(timer);
  }, []);
  
  // Retention countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setRetentionTime(prev => {
        let { days, hours, minutes, seconds } = prev;
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
        }
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
        if (hours < 0) {
          hours = 23;
          days--;
        }
        return { days, hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const t = language === "fr" ? {
    title: "Audit & Conformité",
    subtitle: "Piste d'audit immuable et exports réglementaires (US-07)",
    tabs: {
      auditTrail: "Piste d'Audit",
      reports: "Rapports Réglementaires",
      export: "Configuration Export",
      compliance: "Tableau de Conformité",
    },
    chainVerified: "Chaîne Vérifiée",
    events: "Événements",
    retention: "Rétention",
    exportJson: "Exporter JSON",
    exportCsv: "Exporter CSV",
    exportXml: "Exporter XML",
  } : {
    title: "Audit & Compliance",
    subtitle: "Immutable audit trail and regulatory exports (US-07)",
    tabs: {
      auditTrail: "Audit Trail",
      reports: "Regulatory Reports",
      export: "Export Config",
      compliance: "Compliance Dashboard",
    },
    chainVerified: "Chain Verified",
    events: "Events",
    retention: "Retention",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    exportXml: "Export XML",
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case "verified": return "bg-emerald-500";
      case "alert": return "bg-red-500";
      default: return "bg-blue-500";
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
              
              {/* US-07 Workflow Header */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <Badge variant="outline" className="border-primary text-primary">US-07</Badge>
                    <span className="text-sm text-muted-foreground">
                      {language === "fr" 
                        ? "Moteur d'Audit Immuable & Export Réglementaire" 
                        : "Immutable Audit & Regulatory Export Engine"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {language === "fr" ? "Lecture seule après SETTLED" : "Read-only after SETTLED"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Main Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="audit-trail" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.auditTrail}</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.reports}</span>
                  </TabsTrigger>
                  <TabsTrigger value="export" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.export}</span>
                  </TabsTrigger>
                  <TabsTrigger value="compliance" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.compliance}</span>
                  </TabsTrigger>
                </TabsList>

                {/* Screen 1: Immutable Audit Trail Viewer */}
                <TabsContent value="audit-trail" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            {language === "fr" ? "Visualiseur de Piste d'Audit Immuable" : "Immutable Audit Trail Viewer"}
                          </CardTitle>
                          <CardDescription>
                            {language === "fr" 
                              ? "Historique chronologique des transactions avec vérification de chaîne" 
                              : "Chronological transaction history with chain verification"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input 
                              placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                              className="w-48 pl-9"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 lg:grid-cols-3">
                        {/* Timeline View */}
                        <div className="lg:col-span-2">
                          <div className="relative space-y-0">
                            {mockAuditTrail.map((event, index) => (
                              <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
                                {/* Vertical line */}
                                {index < mockAuditTrail.length - 1 && (
                                  <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
                                )}
                                {/* Event dot */}
                                <div className={`relative z-10 mt-1.5 h-6 w-6 shrink-0 rounded-full ${getEventStatusColor(event.status)} flex items-center justify-center`}>
                                  <div className="h-2 w-2 rounded-full bg-white" />
                                </div>
                                {/* Event content */}
                                <div className="flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{event.event}</span>
                                    {event.score && (
                                      <Badge variant="destructive" className="text-xs">
                                        Score {event.score} - HIGH
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span>{event.actor}</span>
                                    <span className="font-mono text-xs">{event.hash}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{event.details}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Chain Status Panel */}
                        <div className="space-y-4">
                          <Card className="border-2">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{t.events}:</span>
                                <span className="text-2xl font-bold">6</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Chain:</span>
                                <Badge className="bg-emerald-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  VERIFIED
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{t.retention}:</span>
                                <span className="font-mono">2031-05-02</span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Export Buttons */}
                          <div className="grid gap-2">
                            <Button variant="outline" className="justify-start gap-2">
                              <FileJson className="h-4 w-4" />
                              {t.exportJson}
                            </Button>
                            <Button variant="outline" className="justify-start gap-2">
                              <FileSpreadsheet className="h-4 w-4" />
                              {t.exportCsv}
                            </Button>
                            <Button variant="outline" className="justify-start gap-2">
                              <FileCode className="h-4 w-4" />
                              {t.exportXml}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 2: Regulatory Report Generator */}
                <TabsContent value="reports" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {language === "fr" ? "Générateur de Rapports Réglementaires" : "Regulatory Report Generator"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Génération automatique de rapports FIU, IMF SDDS et LBMA" 
                          : "Auto-generate FIU, IMF SDDS, and LBMA compliance reports"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 lg:grid-cols-3">
                        {/* Report Type Selector */}
                        <div className="space-y-4">
                          <Label>{language === "fr" ? "Type de Rapport" : "Report Type"}</Label>
                          <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fiu">FIU STR/SAR</SelectItem>
                              <SelectItem value="imf">IMF SDDS</SelectItem>
                              <SelectItem value="lbma">LBMA Disclosure</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <div className="rounded-lg border p-3 space-y-2">
                            <div className="text-sm font-medium">
                              {language === "fr" ? "Types disponibles:" : "Available types:"}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3" />
                                FIU STR/SAR
                              </div>
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3" />
                                IMF SDDS
                              </div>
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3" />
                                LBMA Disclosure
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Report Fields */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Transaction ID</Label>
                            <Input 
                              placeholder="PO-2026-XXXX"
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Date Range</Label>
                            <div className="flex gap-2">
                              <Input type="date" placeholder="From" />
                              <Input type="date" placeholder="To" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{language === "fr" ? "Volume d'Or Total (troy oz)" : "Total Gold Volume (troy oz)"}</Label>
                            <Input 
                              placeholder="0.00"
                              value={goldVolume}
                              onChange={(e) => setGoldVolume(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{language === "fr" ? "Nom de la Contrepartie" : "Counterparty Name"}</Label>
                            <Input 
                              placeholder={language === "fr" ? "Entrer le nom..." : "Enter name..."}
                              value={counterpartyName}
                              onChange={(e) => setCounterpartyName(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Validation Checklist & Preview */}
                        <div className="space-y-4">
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="text-sm font-medium">
                              {language === "fr" ? "Liste de Validation" : "Validation Checklist"}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
                                {language === "fr" ? "Données complètes vérifiées" : "Data completeness verified"}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
                                {language === "fr" ? "Flags AML validés" : "AML flags cleared"}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
                                {language === "fr" ? "Conversion devise appliquée" : "Currency conversion applied"}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
                                {language === "fr" ? "Bloc signature auto-inclus" : "Signature block auto-included"}
                              </div>
                            </div>
                          </div>

                          {/* PDF Preview placeholder */}
                          <div className="rounded-lg border-2 border-dashed p-6 text-center">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm font-medium">PDF</p>
                            <p className="text-xs text-muted-foreground">
                              DRAFT - FOR INTERNAL REVIEW ONLY
                            </p>
                          </div>

                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                            <span className="font-medium">Submission Status:</span> Draft - Last saved 2 min ago
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button className="gap-2">
                          <FileText className="h-4 w-4" />
                          {language === "fr" ? "Générer Rapport" : "Generate Report"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <Calendar className="h-4 w-4" />
                          {language === "fr" ? "Planifier Récurrent" : "Schedule Recurring"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <Archive className="h-4 w-4" />
                          {language === "fr" ? "Archiver Brouillon" : "Archive Draft"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <History className="h-4 w-4" />
                          {language === "fr" ? "Historique Soumissions" : "View Submission History"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 3: Export Configuration & Format Mapping */}
                <TabsContent value="export" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        {language === "fr" ? "Configuration d'Export & Mapping de Format" : "Export Configuration & Format Mapping"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Export multi-format avec signature digitale" 
                          : "Multi-format export with digital signature attachment"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Format Selector Tabs */}
                      <div className="flex gap-2">
                        <Button 
                          variant={exportFormat === "json" ? "default" : "outline"}
                          onClick={() => setExportFormat("json")}
                          className="gap-2"
                        >
                          <FileJson className="h-4 w-4" />
                          JSON
                        </Button>
                        <Button 
                          variant={exportFormat === "csv" ? "default" : "outline"}
                          onClick={() => setExportFormat("csv")}
                          className="gap-2"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV
                        </Button>
                        <Button 
                          variant={exportFormat === "xml" ? "default" : "outline"}
                          onClick={() => setExportFormat("xml")}
                          className="gap-2"
                        >
                          <FileCode className="h-4 w-4" />
                          XML
                        </Button>
                      </div>

                      {/* Field Mapping Table */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {language === "fr" ? "Mapping des Champs" : "Field Mapping"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{language === "fr" ? "Champ Source" : "Source Field"}</TableHead>
                                <TableHead></TableHead>
                                <TableHead>{language === "fr" ? "Champ Cible" : "Target Field"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fieldMappings.map((mapping, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Input 
                                      value={mapping.source} 
                                      className="font-mono text-sm"
                                      readOnly
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      value={mapping.target} 
                                      className="font-mono text-sm"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      {/* Date Range & Filters */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="whitespace-nowrap">
                            {language === "fr" ? "Filtres Date & Scope" : "Date Range & Scope Filters"}
                          </Label>
                          <Input type="date" className="w-36" />
                          <span className="text-muted-foreground">→</span>
                          <Input type="date" className="w-36" />
                        </div>
                        <Select defaultValue="all">
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Scope" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === "fr" ? "Toutes les transactions" : "All Transactions"}</SelectItem>
                            <SelectItem value="settled">Settled Only</SelectItem>
                            <SelectItem value="pending">Pending Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Digital Signature Checkbox */}
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="signature" 
                          checked={includeSignature}
                          onCheckedChange={(checked) => setIncludeSignature(checked as boolean)}
                        />
                        <Label htmlFor="signature" className="flex items-center gap-2">
                          <Signature className="h-4 w-4" />
                          {language === "fr" ? "Joindre Signature Digitale" : "Digital Signature Attachment"}
                        </Label>
                      </div>

                      {/* Export Queue */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {language === "fr" ? "File d'Export" : "Export Queue"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Pending</div>
                              {mockExportQueue.filter(e => e.status === "pending").map(exp => (
                                <div key={exp.id} className="rounded border p-2 text-sm">
                                  {exp.name}
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Processing</div>
                              {mockExportQueue.filter(e => e.status === "processing").map(exp => (
                                <div key={exp.id} className="rounded border border-blue-200 bg-blue-50 p-2 text-sm">
                                  {exp.name}
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Completed</div>
                              {mockExportQueue.filter(e => e.status === "completed").map(exp => (
                                <div key={exp.id} className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm">
                                  {exp.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3">
                        <Button className="gap-2">
                          <Download className="h-4 w-4" />
                          {language === "fr" ? "Générer Export" : "Generate Export"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <FileText className="h-4 w-4" />
                          {language === "fr" ? "Sauver Template" : "Save Template"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <Calendar className="h-4 w-4" />
                          {language === "fr" ? "Planifier Batch" : "Schedule Batch"}
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          {language === "fr" ? "Télécharger Package" : "Download Package"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 4: Compliance Dashboard & Retention Management */}
                <TabsContent value="compliance" className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column: Retention Timer & Audit Score */}
                    <div className="space-y-6">
                      {/* Retention Countdown Timer */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {language === "fr" ? "Timer Compte à Rebours Rétention" : "Retention Countdown Timer"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-mono font-bold tracking-wider">
                            {String(retentionTime.days).padStart(2, '0')}:
                            {String(retentionTime.hours).padStart(2, '0')}:
                            {String(retentionTime.minutes).padStart(2, '0')}
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all" 
                                style={{ width: "15%" }}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {language === "fr" ? "Jours jusqu'au prochain cycle de rétention" : "Days until next retention cycle"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Audit Readiness Score Gauge */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {language === "fr" ? "Score de Préparation Audit" : "Audit Readiness Score Gauge"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="relative mx-auto w-48 h-28">
                            {/* Semi-circle gauge SVG */}
                            <svg viewBox="0 0 200 100" className="w-full h-full">
                              {/* Background arc */}
                              <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="12"
                                className="text-muted"
                              />
                              {/* Score arc */}
                              <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="12"
                                strokeDasharray={`${(auditScore / 100) * 251.2} 251.2`}
                                className="text-emerald-500 transition-all duration-1000"
                              />
                              {/* Tick marks */}
                              <text x="10" y="95" className="text-xs fill-muted-foreground">0</text>
                              <text x="55" y="40" className="text-xs fill-muted-foreground">40</text>
                              <text x="95" y="25" className="text-xs fill-muted-foreground">60</text>
                              <text x="135" y="40" className="text-xs fill-muted-foreground">80</text>
                              <text x="180" y="95" className="text-xs fill-muted-foreground">100</text>
                              {/* Score value */}
                              <text x="100" y="85" textAnchor="middle" className="text-3xl font-bold fill-foreground">
                                {auditScore}
                              </text>
                            </svg>
                          </div>
                          <p className="text-center text-sm text-muted-foreground mt-2">
                            Current score: {auditScore}/100
                          </p>
                        </CardContent>
                      </Card>

                      {/* System Health Indicators */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {language === "fr" ? "Indicateurs Santé Système" : "System Health Indicators"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-3 text-center">
                            <div className="space-y-1">
                              <div className="mx-auto h-4 w-4 rounded-full bg-emerald-500" />
                              <div className="text-xs text-muted-foreground">CPU: 62%</div>
                            </div>
                            <div className="space-y-1">
                              <div className="mx-auto h-4 w-4 rounded-full bg-amber-500" />
                              <div className="text-xs text-muted-foreground">Memory</div>
                            </div>
                            <div className="space-y-1">
                              <div className="mx-auto h-4 w-4 rounded-full bg-red-500" />
                              <div className="text-xs text-muted-foreground">Storage</div>
                            </div>
                            <div className="space-y-1">
                              <div className="mx-auto h-4 w-4 rounded-full bg-emerald-500" />
                              <div className="text-xs text-muted-foreground">Network</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Middle Column: Alert Log */}
                    <div className="space-y-6">
                      {/* Alert Log Panel */}
                      <Card className="h-full">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            {language === "fr" ? "Panneau Journal d'Alertes" : "Alert Log Panel"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {mockAlertLog.map((alert) => (
                              <div 
                                key={alert.id} 
                                className="flex items-start gap-2 text-sm border-b pb-2 last:border-0"
                              >
                                {alert.type === "warning" ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <span>{alert.message}</span>
                                  <span className="text-muted-foreground ml-2">({alert.time})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column: Archival Status & Calendar */}
                    <div className="space-y-6">
                      {/* Archival Status Indicators */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {language === "fr" ? "Indicateurs Statut Archivage" : "Archival Status Indicators"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-3">
                            <Badge variant="outline" className="gap-1">
                              <div className="h-2 w-2 rounded-full bg-emerald-500" />
                              Active
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              Pending Archive
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <div className="h-2 w-2 rounded-full bg-gray-400" />
                              Archived
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Scheduled Reports Calendar View */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            {language === "fr" ? "Vue Calendrier Rapports Planifiés" : "Scheduled Reports Calendar View"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Mini calendar grid */}
                          <div className="text-center mb-3">
                            <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
                              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-xs">
                              {[...Array(31)].map((_, i) => {
                                const day = i + 1;
                                const hasReport = [8, 12].includes(day);
                                return (
                                  <div 
                                    key={i} 
                                    className={`p-1 rounded ${hasReport ? 'bg-amber-100 text-amber-800 font-medium' : ''}`}
                                  >
                                    {day}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Scheduled reports list */}
                          <div className="space-y-2 mt-4">
                            {mockScheduledReports.map((report) => (
                              <div key={report.id} className="flex items-center gap-2 text-sm">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span>{report.name}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="gap-2">
                      <Play className="h-4 w-4" />
                      {language === "fr" ? "Exécuter Vérification Intégrité" : "Run Integrity Check"}
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Archive className="h-4 w-4" />
                      {language === "fr" ? "Archiver Enregistrements Expirés" : "Archive Expired Records"}
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      {language === "fr" ? "Planifier Audit" : "Schedule Audit"}
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Eye className="h-4 w-4" />
                      {language === "fr" ? "Voir Journal d'Alertes" : "View Alert Log"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
