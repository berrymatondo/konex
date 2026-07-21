"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/lib/i18n/language-context";
import { translations } from "@/lib/i18n/translations";
import { generateAllocationCertificatePDF } from "@/lib/pdf-generator";
import {
  ArrowLeft,
  Wallet,
  DollarSign,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingUp,
  Building2,
  FileText,
  Lock,
  Copy,
  Download,
  ExternalLink,
  AlertTriangle,
  XCircle,
  Banknote,
  Save,
} from "lucide-react";

// Mock LBMA rates
const LBMA_RATES = {
  AM: { rate: 2348.60, timestamp: "2026-05-14T10:30:00Z" },
  PM: { rate: 2351.20, timestamp: "2026-05-14T15:00:00Z" },
};

// Mock settlement data
const mockSettlements: Record<string, {
  id: string;
  poReference: string;
  counterparty: { name: string; iban: string; swift: string; jurisdiction: string };
  netWeightKg: number;
  purity: number;
  pureAuWeightKg: number;
  fixingType: "AM" | "PM";
  premiumPerOz: number;
  logisticsCost: number;
  insuranceCost: number;
  assayFees: number;
  withholdingTax: number;
  currency: string;
  status: "pending_valuation" | "pending_review" | "pending_approval" | "executed" | "allocated";
  approver1: { name: string; role: string; approved: boolean; timestamp?: string };
  approver2: { name: string; role: string; approved: boolean; timestamp?: string };
  settlementId?: string;
  reserveAccountId?: string;
  auditHash?: string;
  valuationDate?: string;
}> = {
  sett_001: {
    id: "sett_001",
    poReference: "PO-2026-0891",
    counterparty: {
      name: "GoldStar Refineries Ltd",
      iban: "GB82 WEST 1234 5698 7654 32",
      swift: "WESTGB2L",
      jurisdiction: "United Kingdom",
    },
    netWeightKg: 320.85,
    purity: 99.99,
    pureAuWeightKg: 320.692,
    fixingType: "PM",
    premiumPerOz: 12.50,
    logisticsCost: 2450.00,
    insuranceCost: 1200.00,
    assayFees: 850.00,
    withholdingTax: 3500.00,
    currency: "USD",
    status: "pending_valuation",
    approver1: { name: "Marie Dubois", role: "Finance Officer", approved: false },
    approver2: { name: "Jean-Pierre Martin", role: "Treasury Director", approved: false },
  },
  sett_002: {
    id: "sett_002",
    poReference: "PO-2026-0745",
    counterparty: {
      name: "African Gold Corp",
      iban: "ZA82 ABSA 0000 0123 4567 89",
      swift: "ABSAZAJJ",
      jurisdiction: "South Africa",
    },
    netWeightKg: 185.20,
    purity: 99.95,
    pureAuWeightKg: 185.107,
    fixingType: "AM",
    premiumPerOz: 8.75,
    logisticsCost: 1850.00,
    insuranceCost: 950.00,
    assayFees: 650.00,
    withholdingTax: 2100.00,
    currency: "USD",
    status: "pending_approval",
    approver1: { name: "Marie Dubois", role: "Finance Officer", approved: true, timestamp: "2026-05-14T14:22:00Z" },
    approver2: { name: "Jean-Pierre Martin", role: "Treasury Director", approved: false },
  },
  sett_003: {
    id: "sett_003",
    poReference: "PO-2026-0623",
    counterparty: {
      name: "Swiss Gold Trading AG",
      iban: "CH93 0076 2011 6238 5295 7",
      swift: "UBSWCHZH80A",
      jurisdiction: "Switzerland",
    },
    netWeightKg: 425.60,
    purity: 99.99,
    pureAuWeightKg: 425.557,
    fixingType: "PM",
    premiumPerOz: 15.00,
    logisticsCost: 3200.00,
    insuranceCost: 1800.00,
    assayFees: 1100.00,
    withholdingTax: 4500.00,
    currency: "USD",
    status: "allocated",
    approver1: { name: "Marie Dubois", role: "Finance Officer", approved: true, timestamp: "2026-05-12T10:15:00Z" },
    approver2: { name: "Jean-Pierre Martin", role: "Treasury Director", approved: true, timestamp: "2026-05-12T11:30:00Z" },
    settlementId: "SETT-2026-4482",
    reserveAccountId: "CB-RESERVE-001",
    auditHash: "a3b2c0d4e5f67890bcda15b8a3d4e5f6...7890abcd",
    valuationDate: "2026-05-12",
  },
};

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { language } = useLanguage();
  const t = translations[language];
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("valuation");
  const [settlement, setSettlement] = useState(mockSettlements[resolvedParams.id] || mockSettlements.sett_001);
  
  // Valuation state
  const [selectedFixing, setSelectedFixing] = useState<"AM" | "PM">(settlement.fixingType);
  const [selectedCurrency, setSelectedCurrency] = useState(settlement.currency);
  const [priceLockTimer, setPriceLockTimer] = useState(15 * 60); // 15 minutes in seconds
  const [isPriceLocked, setIsPriceLocked] = useState(false);

  // Review checklist
  const [reviewChecks, setReviewChecks] = useState({
    feesMatchPO: false,
    deductionsAuthorized: false,
    bankingVerified: false,
  });

  // Approval state
  const [otp1, setOtp1] = useState("");
  const [otp2, setOtp2] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "processing" | "executed">("pending");

  // Audit trail state
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    previous_status: string | null;
    new_status: string | null;
    details: Record<string, unknown> | null;
    performed_by: string;
    performed_at: string;
  }>>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Temporary save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/settlements/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: settlement.status }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving draft:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Price lock countdown
  useEffect(() => {
    if (isPriceLocked && priceLockTimer > 0) {
      const timer = setInterval(() => {
        setPriceLockTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (priceLockTimer === 0) {
      setIsPriceLocked(false);
      setPriceLockTimer(15 * 60);
    }
  }, [isPriceLocked, priceLockTimer]);

  // Calculate values
  const lbmaRate = LBMA_RATES[selectedFixing].rate;
  const pureAuWeightOz = settlement.pureAuWeightKg * 32.1507; // kg to troy oz
  const purityFactor = settlement.purity / 100;
  const grossValue = pureAuWeightOz * (lbmaRate + settlement.premiumPerOz);
  const totalDeductions = settlement.logisticsCost + settlement.insuranceCost + settlement.assayFees + settlement.withholdingTax;
  const netPayable = grossValue - totalDeductions;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleApplyPricing = () => {
    setIsPriceLocked(true);
    setActiveTab("review");
  };

  const handleProceedToApproval = () => {
    if (reviewChecks.feesMatchPO && reviewChecks.deductionsAuthorized && reviewChecks.bankingVerified) {
      setActiveTab("approval");
    }
  };

  const handleApproveExecute = async () => {
    if (otp1.length === 6 && otp2.length === 6) {
      setApprovalStatus("processing");
      
      const newSettlementId = `SETT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newAuditHash = `a3b2c0d4e5f6...${Math.random().toString(36).substring(7)}`;
      
      try {
        // Update PO status to "settled" to prevent double settlements
        const poId = settlement.purchaseOrderId || resolvedParams.id;
        await fetch(`/api/purchase-orders/${poId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "settled" }),
        });

        // Update settlement status to "allocated" in the database
        await fetch(`/api/settlements/${resolvedParams.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            status: "allocated",
            paymentReference: `PAY-${Date.now()}`,
            notes: `Settlement executed. Audit hash: ${newAuditHash}`,
          }),
        });

        // Create audit log for settlement execution
        await fetch("/api/audit-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "settlement",
            entityId: newSettlementId,
            action: "settlement_executed",
            previousStatus: "pending_approval",
            newStatus: "allocated",
            details: {
              poReference: settlement.poReference,
              netPayable,
              currency: settlement.currency,
              auditHash: newAuditHash,
            },
            performedBy: settlement.approver1.name,
          }),
        });
      } catch (error) {
        console.error("Error updating settlement status:", error);
      }
      
      // Simulate execution delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setApprovalStatus("executed");
      setSettlement({
        ...settlement,
        status: "allocated",
        settlementId: newSettlementId,
        reserveAccountId: "CB-RESERVE-001",
        auditHash: newAuditHash,
        valuationDate: new Date().toISOString().split("T")[0],
        approver1: { ...settlement.approver1, approved: true, timestamp: new Date().toISOString() },
        approver2: { ...settlement.approver2, approved: true, timestamp: new Date().toISOString() },
      });
      setActiveTab("allocation");
    }
  };

  const handleViewAuditTrail = async () => {
    setShowAuditDialog(true);
    setLoadingAudit(true);
    try {
      // Fetch audit logs for this PO and settlement
      const poId = settlement.purchaseOrderId || resolvedParams.id;
      const response = await fetch(`/api/audit-log?entity_id=${poId}`);
      if (response.ok) {
        const logs = await response.json();
        setAuditLogs(logs);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoadingAudit(false);
    }
  };

  const getStatusFromTab = () => {
    switch (activeTab) {
      case "valuation": return "pending_valuation";
      case "review": return "pending_review";
      case "approval": return "pending_approval";
      case "allocation": return "allocated";
      default: return settlement.status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_valuation":
        return <Badge variant="outline" className="border-amber-500 text-amber-500"><Clock className="mr-1 h-3 w-3" />{language === "fr" ? "Valorisation" : "Valuation"}</Badge>;
      case "pending_review":
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Calculator className="mr-1 h-3 w-3" />{language === "fr" ? "Révision" : "Review"}</Badge>;
      case "pending_approval":
        return <Badge variant="outline" className="border-purple-500 text-purple-500"><ShieldCheck className="mr-1 h-3 w-3" />{language === "fr" ? "Approbation" : "Approval"}</Badge>;
      case "executed":
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />{language === "fr" ? "Exécuté" : "Executed"}</Badge>;
      case "allocated":
        return <Badge className="bg-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />{language === "fr" ? "Alloué" : "Allocated"}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={`${language === "fr" ? "Règlement" : "Settlement"} - ${settlement.poReference}`}
            subtitle={language === "fr" ? "Valorisation, règlement et allocation US-06" : "Valuation, Settlement & Allocation US-06"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Back button and status */}
              <div className="flex items-center justify-between">
              <Button variant="ghost" asChild>
                <Link href="/settlements">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Retour aux règlements" : "Back to Settlements"}
                </Link>
              </Button>
                {getStatusBadge(getStatusFromTab())}
              </div>

              {/* Workflow Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="valuation" className="text-xs sm:text-sm">
                    <DollarSign className="mr-1 h-4 w-4 hidden sm:inline" />
                    1. {language === "fr" ? "Valorisation" : "Valuation"}
                  </TabsTrigger>
                  <TabsTrigger value="review" className="text-xs sm:text-sm">
                    <Calculator className="mr-1 h-4 w-4 hidden sm:inline" />
                    2. {language === "fr" ? "Révision" : "Review"}
                  </TabsTrigger>
                  <TabsTrigger value="approval" className="text-xs sm:text-sm">
                    <ShieldCheck className="mr-1 h-4 w-4 hidden sm:inline" />
                    3. {language === "fr" ? "Approbation" : "Approval"}
                  </TabsTrigger>
                  <TabsTrigger value="allocation" className="text-xs sm:text-sm">
                    <CheckCircle2 className="mr-1 h-4 w-4 hidden sm:inline" />
                    4. {language === "fr" ? "Allocation" : "Allocation"}
                  </TabsTrigger>
                </TabsList>

                {/* Screen 1: Pricing & Valuation Engine */}
                <TabsContent value="valuation" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {language === "fr" ? "Moteur de Tarification & Valorisation" : "Pricing & Valuation Engine"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Intégration LBMA Gold Price et calcul de valorisation de l'or pur"
                          : "LBMA Gold Price integration and pure gold valuation calculation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* LBMA Fixing Cards */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card 
                          className={`cursor-pointer transition-all ${selectedFixing === "AM" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
                          onClick={() => setSelectedFixing("AM")}
                        >
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">LBMA Gold Price (AM Fixing)</div>
                            <div className="text-2xl font-bold">${LBMA_RATES.AM.rate.toLocaleString()}/oz</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(LBMA_RATES.AM.timestamp).toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                        <Card 
                          className={`cursor-pointer transition-all ${selectedFixing === "PM" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
                          onClick={() => setSelectedFixing("PM")}
                        >
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">LBMA Gold Price (PM Fixing)</div>
                            <div className="text-2xl font-bold">${LBMA_RATES.PM.rate.toLocaleString()}/oz</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(LBMA_RATES.PM.timestamp).toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">
                              {language === "fr" ? "Sélecteur de Devise" : "Currency Selector"}
                            </div>
                            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Valuation Parameters */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {language === "fr" ? "Facteur d'ajustement de pureté" : "Purity Adjustment Factor"}
                          </Label>
                          <div className="text-2xl font-mono">{purityFactor.toFixed(4)}</div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {language === "fr" ? "Prime/Discount par oz" : "Premium/Discount per oz"}
                          </Label>
                          <div className="text-2xl font-mono text-emerald-500">+${settlement.premiumPerOz.toFixed(2)}</div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {language === "fr" ? "Déduction coûts logistiques" : "Logistics Cost Deduction"}
                          </Label>
                          <div className="text-2xl font-mono text-red-500">-${settlement.logisticsCost.toFixed(2)}</div>
                        </div>
                      </div>

                      <Separator />

                      {/* Total Estimated Value */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="text-center md:text-left">
                          <div className="text-4xl md:text-5xl font-bold">
                            {selectedCurrency} ${grossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {language === "fr" ? "Valeur Estimée Totale" : "Total Estimated Value"}
                          </div>
                        </div>
                        <Card className="bg-muted/50">
                          <CardContent className="p-4 text-center">
                            <div className="text-sm text-muted-foreground mb-1">
                              {language === "fr" ? "Minuteur de verrouillage du prix" : "Price Lock Timer"}
                            </div>
                            <div className={`text-3xl font-mono ${isPriceLocked ? (priceLockTimer < 60 ? "text-red-500" : "text-primary") : "text-muted-foreground"}`}>
                              {isPriceLocked ? formatTime(priceLockTimer) : "15:00"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {language === "fr" ? "Validité 15 min" : "15 min validity"}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                          variant="outline"
                          onClick={handleSaveDraft}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button onClick={handleApplyPricing} className="min-w-[200px]">
                          <Lock className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Appliquer Tarification" : "Apply Pricing"}
                        </Button>
                        <Button variant="outline" onClick={() => setPriceLockTimer(15 * 60)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Actualiser Taux" : "Refresh Rates"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 2: Settlement Calculation & Review */}
                <TabsContent value="review" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        {language === "fr" ? "Calcul & Révision du Règlement" : "Settlement Calculation & Review"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? `Référence PO: ${settlement.poReference}`
                          : `PO Reference: ${settlement.poReference}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Gross Value */}
                      <Card className="bg-muted/30">
                        <CardContent className="p-6 text-center">
                          <div className="text-sm text-muted-foreground mb-2">
                            {language === "fr" ? "Valeur Brute" : "Gross Value"}
                          </div>
                          <div className="text-4xl font-bold">
                            ${grossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedCurrency}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Deductions Table */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                              {language === "fr" ? "Tableau des Déductions" : "Deductions Table"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell>{language === "fr" ? "Coûts Logistiques" : "Logistics Costs"}</TableCell>
                                  <TableCell className="text-right font-mono">${settlement.logisticsCost.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>{language === "fr" ? "Prime d'Assurance" : "Insurance Premium"}</TableCell>
                                  <TableCell className="text-right font-mono">${settlement.insuranceCost.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>{language === "fr" ? "Frais d'Essai" : "Assay Fees"}</TableCell>
                                  <TableCell className="text-right font-mono">${settlement.assayFees.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>{language === "fr" ? "Retenue à la Source" : "Withholding Tax"}</TableCell>
                                  <TableCell className="text-right font-mono">${settlement.withholdingTax.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="border-t-2">
                                  <TableCell className="font-semibold">
                                    {language === "fr" ? "Total Déductions" : "Total Deductions"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-semibold text-red-500">
                                    -${totalDeductions.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>

                        {/* Counterparty Banking & Review */}
                        <div className="space-y-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {language === "fr" ? "Coordonnées Bancaires Contrepartie" : "Counterparty Banking Details"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">IBAN</Label>
                                <div className="font-mono text-sm bg-muted p-2 rounded">{settlement.counterparty.iban}</div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">SWIFT</Label>
                                <div className="font-mono text-sm bg-muted p-2 rounded">{settlement.counterparty.swift}</div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">
                                {language === "fr" ? "Liste de Vérification" : "Review Checklist"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="feesMatch" 
                                  checked={reviewChecks.feesMatchPO}
                                  onCheckedChange={(checked) => setReviewChecks({ ...reviewChecks, feesMatchPO: !!checked })}
                                />
                                <label htmlFor="feesMatch" className="text-sm cursor-pointer">
                                  {language === "fr" ? "Frais correspondent aux termes du PO" : "Fees match PO terms"}
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="deductions" 
                                  checked={reviewChecks.deductionsAuthorized}
                                  onCheckedChange={(checked) => setReviewChecks({ ...reviewChecks, deductionsAuthorized: !!checked })}
                                />
                                <label htmlFor="deductions" className="text-sm cursor-pointer">
                                  {language === "fr" ? "Déductions autorisées" : "Deductions authorized"}
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="banking" 
                                  checked={reviewChecks.bankingVerified}
                                  onCheckedChange={(checked) => setReviewChecks({ ...reviewChecks, bankingVerified: !!checked })}
                                />
                                <label htmlFor="banking" className="text-sm cursor-pointer">
                                  {language === "fr" ? "Coordonnées bancaires vérifiées" : "Banking details verified"}
                                </label>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Net Payable */}
                      <Card className="bg-primary/5 border-primary">
                        <CardContent className="p-6 text-center">
                          <div className="text-sm text-muted-foreground mb-2">
                            {language === "fr" ? "Montant Net à Payer" : "Net Payable Amount"}
                          </div>
                          <div className="text-5xl font-bold text-primary">
                            ${netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                          variant="outline"
                          onClick={handleSaveDraft}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button
                          onClick={handleProceedToApproval}
                          disabled={!reviewChecks.feesMatchPO || !reviewChecks.deductionsAuthorized || !reviewChecks.bankingVerified}
                          className="min-w-[200px]"
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Procéder à l'Approbation" : "Proceed to Approval"}
                        </Button>
                        <Button variant="outline">
                          <FileText className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Demander Amendement" : "Request Amendment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 3: Dual Approval & Execution */}
                <TabsContent value="approval" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        {language === "fr" ? "Double Approbation & Exécution" : "Dual Approval & Execution"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Autorisation sécurisée de transfert de fonds"
                          : "Secure fund transfer authorization"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Settlement Summary */}
                      <Card className="bg-muted/30">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base text-center">
                            {language === "fr" ? "Résumé du Règlement" : "Settlement Summary"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-center">
                          <div>
                            <span className="text-muted-foreground">{language === "fr" ? "Contrepartie" : "Counterparty"}: </span>
                            <span className="font-semibold">{settlement.counterparty.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{language === "fr" ? "Montant" : "Amount"}: </span>
                            <span className="font-bold text-xl">${netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedCurrency}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{language === "fr" ? "Date de valeur" : "Value Date"}: </span>
                            <span>{new Date().toISOString().split("T")[0]}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dual Approval Slots */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Approver 1 */}
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardHeader className="pb-3 bg-blue-100/50">
                            <CardTitle className="text-base text-center">
                              {language === "fr" ? "Approbateur 1" : "Approver 1"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{settlement.approver1.role}</span>
                              <span className="text-sm font-medium">→</span>
                              <Input 
                                value={settlement.approver1.name} 
                                disabled 
                                className="max-w-[180px] bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">
                                {language === "fr" ? "Authentifier via OTP" : "Authenticate via OTP"}
                              </Label>
                              <Input 
                                type="text" 
                                maxLength={6}
                                value={otp1}
                                onChange={(e) => setOtp1(e.target.value.replace(/\D/g, ""))}
                                placeholder="• • • • • •"
                                className="text-center tracking-[0.5em] font-mono"
                                disabled={settlement.approver1.approved}
                              />
                              {settlement.approver1.approved && (
                                <div className="flex items-center justify-center gap-1 text-emerald-500 text-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {language === "fr" ? "Approuvé" : "Approved"}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Approver 2 */}
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardHeader className="pb-3 bg-blue-100/50">
                            <CardTitle className="text-base text-center">
                              {language === "fr" ? "Approbateur 2" : "Approver 2"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{settlement.approver2.role}</span>
                              <span className="text-sm font-medium">→</span>
                              <Input 
                                value={settlement.approver2.name} 
                                disabled 
                                className="max-w-[180px] bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">
                                {language === "fr" ? "Authentifier via OTP" : "Authenticate via OTP"}
                              </Label>
                              <Input 
                                type="text" 
                                maxLength={6}
                                value={otp2}
                                onChange={(e) => setOtp2(e.target.value.replace(/\D/g, ""))}
                                placeholder="• • • • • •"
                                className="text-center tracking-[0.5em] font-mono"
                                disabled={settlement.approver2.approved}
                              />
                              {settlement.approver2.approved && (
                                <div className="flex items-center justify-center gap-1 text-emerald-500 text-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {language === "fr" ? "Approuvé" : "Approved"}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Approval Status */}
                      <div className="flex justify-center">
                        <Badge 
                          variant="outline" 
                          className={`text-lg px-6 py-2 ${
                            approvalStatus === "executed" 
                              ? "border-emerald-500 bg-emerald-500 text-white" 
                              : approvalStatus === "processing"
                              ? "border-blue-500 text-blue-500"
                              : "border-amber-500 bg-amber-100 text-amber-700"
                          }`}
                        >
                          {approvalStatus === "executed" 
                            ? (language === "fr" ? "Exécuté" : "Executed")
                            : approvalStatus === "processing"
                            ? (language === "fr" ? "Traitement..." : "Processing...")
                            : (language === "fr" ? "En Attente d'Approbation" : "Pending Approval")}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                          variant="outline"
                          onClick={handleSaveDraft}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button
                          onClick={handleApproveExecute}
                          disabled={otp1.length !== 6 || otp2.length !== 6 || approvalStatus !== "pending"}
                          className="min-w-[180px] bg-emerald-500 hover:bg-emerald-600"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Approuver & Exécuter" : "Approve & Execute"}
                        </Button>
                        <Button variant="destructive" className="min-w-[120px]">
                          <XCircle className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Rejeter" : "Reject"}
                        </Button>
                        <Button variant="outline" className="min-w-[180px]">
                          <FileText className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Demander Amendement" : "Request Amendment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 4: Allocation Confirmation & Reserve Update */}
                <TabsContent value="allocation" className="space-y-6">
                  {/* Success Banner */}
                  <Card className="bg-emerald-500 text-white">
                    <CardContent className="p-6 text-center">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                      <div className="text-2xl font-bold">
                        {language === "fr" ? "Règlement Réussi - Alloué aux Réserves" : "Settlement Successful - Allocated to Reserves"}
                      </div>
                      <div className="text-emerald-100 mt-2">
                        {language === "fr" ? "ID Règlement" : "Settlement ID"}: {settlement.settlementId || "SETT-2026-XXXX"}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Reserve Allocation Entry */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        {language === "fr" ? "Entrée d'Allocation de Réserve" : "Reserve Allocation Entry"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-4">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">{language === "fr" ? "Poids d'Or Ajouté" : "Gold Weight Added"}:</span>
                            <span className="font-mono font-bold">{settlement.pureAuWeightKg.toFixed(3)} kg</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">{language === "fr" ? "ID Compte de Réserve" : "Reserve Account ID"}:</span>
                            <span className="font-mono">{settlement.reserveAccountId || "CB-RESERVE-001"}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">{language === "fr" ? "Date de Valorisation" : "Valuation Date"}:</span>
                            <span>{settlement.valuationDate || new Date().toISOString().split("T")[0]}</span>
                          </div>
                          <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">{language === "fr" ? "Statut de l'Entrée" : "Entry Status"}:</span>
                            <span className="flex items-center gap-2 text-emerald-500 font-semibold">
                              {language === "fr" ? "Posté & Verrouillé" : "Posted & Locked"}
                              <CheckCircle2 className="h-5 w-5" />
                            </span>
                          </div>
                        </div>

                        {/* Title Transfer Certificate */}
                        <Card className="border-dashed">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                              {language === "fr" ? "Certificat de Transfert de Titre" : "Title Transfer Certificate"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                            <FileText className="h-12 w-12 mb-2" />
                            <div className="text-sm text-center">
                              {language === "fr" ? "Document auto-généré" : "Auto-generated document"}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Audit Hash & Compliance */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          {language === "fr" ? "Aperçu du Hash d'Audit" : "Audit Hash Preview"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-muted p-3 rounded font-mono text-sm overflow-hidden text-ellipsis">
                            {settlement.auditHash || "a3b2c0d4e5f6...7890abcd"}
                          </code>
                          <Button variant="ghost" size="icon">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-200 bg-emerald-50/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {language === "fr" ? "Badge de Conformité" : "Compliance Badge"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-emerald-700">LBMA RGG Compliant</div>
                          <div className="text-sm text-emerald-600">Step 4.1 Verified</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {language === "fr" ? "Sauvegarder" : "Save"}
                    </Button>
                    {saveSuccess && (
                      <span className="text-sm text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        {language === "fr" ? "Sauvegardé" : "Saved"}
                      </span>
                    )}
                    <Button
                      className="min-w-[220px]"
                      onClick={() => {
                        const troyOunces = settlement.pureAuWeightKg * 32.1507;
                        const pricePerOz = 2650; // Current fixing price
                        const grossValue = troyOunces * pricePerOz;
                        const totalDeductions = settlement.logisticsCost + settlement.insuranceCost + settlement.assayFees + settlement.withholdingTax;
                        const netPayable = grossValue - totalDeductions;
                        
                        generateAllocationCertificatePDF({
                          settlementId: settlement.settlementId || `SETT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999)}`,
                          poReference: settlement.poReference,
                          counterpartyName: settlement.counterparty.name,
                          counterpartyIban: settlement.counterparty.iban,
                          counterpartySwift: settlement.counterparty.swift,
                          counterpartyJurisdiction: settlement.counterparty.jurisdiction,
                          netWeightKg: settlement.netWeightKg,
                          purity: settlement.purity,
                          pureAuWeightKg: settlement.pureAuWeightKg,
                          pricePerOz: pricePerOz,
                          totalGrossValue: grossValue,
                          totalDeductions: totalDeductions,
                          netPayable: netPayable,
                          currency: settlement.currency,
                          reserveAccountId: settlement.reserveAccountId || "CB-RESERVE-001",
                          auditHash: settlement.auditHash || "pending...",
                          valuationDate: settlement.valuationDate || new Date().toISOString().split("T")[0],
                        }, {
                          title: language === "fr" ? "Certificat d'Allocation" : "Allocation Certificate",
                          filename: `CERT-${settlement.settlementId || settlement.poReference}.pdf`,
                        });
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Télécharger Certificat d'Allocation" : "Download Allocation Certificate"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="min-w-[180px]"
                      onClick={handleViewAuditTrail}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Voir Chaîne d'Audit Complète" : "View Full Audit Chain"}
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href="/settlements">
                        {language === "fr" ? "Fermer" : "Close"}
                      </Link>
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Audit Trail Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {language === "fr" ? "Chaîne d'Audit Complète" : "Complete Audit Trail"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? `Historique complet des actions pour ${settlement.poReference}`
                : `Complete action history for ${settlement.poReference}`
              }
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {loadingAudit ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "fr" 
                  ? "Aucune entrée d'audit trouvée pour cet élément."
                  : "No audit entries found for this item."
                }
              </div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log, index) => (
                  <div key={log.id || index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={
                        log.action.includes("created") ? "default" :
                        log.action.includes("approved") || log.action.includes("executed") ? "default" :
                        log.action.includes("rejected") ? "destructive" :
                        "secondary"
                      }>
                        {log.action.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.performed_at).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{language === "fr" ? "Type:" : "Type:"}</span>
                        <span className="ml-2 font-medium">{log.entity_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{language === "fr" ? "Par:" : "By:"}</span>
                        <span className="ml-2 font-medium">{log.performed_by}</span>
                      </div>
                      {log.previous_status && (
                        <div>
                          <span className="text-muted-foreground">{language === "fr" ? "Statut précédent:" : "Previous status:"}</span>
                          <span className="ml-2">{log.previous_status}</span>
                        </div>
                      )}
                      {log.new_status && (
                        <div>
                          <span className="text-muted-foreground">{language === "fr" ? "Nouveau statut:" : "New status:"}</span>
                          <span className="ml-2 font-medium text-primary">{log.new_status}</span>
                        </div>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
