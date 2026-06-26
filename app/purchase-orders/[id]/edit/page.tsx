"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Send,
  DollarSign,
  Scale,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Building2,
  XCircle,
  FileText,
  Wallet,
  Truck,
  Calculator,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const OZ_TO_GRAM = 31.1035;

interface Counterparty {
  id: string;
  legalName: string;
  status: string;
  riskLevel: string | null;
  screeningStatus: string | null;
  countryOfIncorporation: string;
}

interface PurchaseOrder {
  id: string;
  counterparty_id: string;
  counterparty_name: string | null;
  status: string;
  estimated_weight_kg: number;
  gold_type: string;
  assay_range: string;
  incoterms: string;
  delivery_vault_id: string;
  expected_dispatch_date: string | null;
  notes: string | null;
  lbma_price_per_oz: number | null;
  purity_factor: number | null;
  premium_discount: number | null;
  logistics_cost: number | null;
  total_estimated_value: number | null;
  currency: string;
  created_at: string;
  tolerance_percent: number | null;
  delivery_window_end: string | null;
  payment_usd_cdf_split: string | null;
  payment_timing: string | null;
  payment_term: string | null;
  prepayment_percent: number | null;
  cdf_fx_basis: string | null;
}

const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP"];
const GOLD_TYPES = [
  { value: "dore_bars", label: { en: "Doré Bars", fr: "Doré" } },
  { value: "refined_bars", label: { en: "Refined Bars", fr: "Lingots Raffinés" } },
  { value: "gold_dust", label: { en: "Gold Dust", fr: "Poudre d'Or" } },
  { value: "scrap_gold", label: { en: "Scrap Gold", fr: "Or de Récupération" } },
];

const VAULTS = [
  { id: "vault-kinshasa", name: { en: "BCC Vault – Kinshasa", fr: "Coffre BCC – Kinshasa" } },
  { id: "vault-zurich", name: { en: "Zurich Vault", fr: "Coffre Zurich" } },
  { id: "vault-london", name: { en: "London Vault", fr: "Coffre Londres" } },
  { id: "vault-dubai", name: { en: "Dubai Vault", fr: "Coffre Dubaï" } },
];

// Assay range → purity bounds used for the valuation hypotheses.
const ASSAY_BOUNDS: Record<string, { low: number; central: number; high: number }> = {
  "85-92": { low: 0.85, central: 0.885, high: 0.92 },
  "92-99": { low: 0.92, central: 0.955, high: 0.99 },
  "99.5+": { low: 0.995, central: 0.9999, high: 0.9999 },
};

type PurchaseOrderAction = "draft" | "submit" | "transmit";

export default function EditPurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { language } = useLanguage();
  const { data: session } = authClient.useSession();

  const agentName = session?.user?.name ?? session?.user?.email ?? "—";

  const { data: po, isLoading: poLoading } = useSWR<PurchaseOrder>(`/api/purchase-orders/${id}`, fetcher);
  const { data: counterparties = [] } = useSWR<Counterparty[]>("/api/counterparties", fetcher);

  // US-03: Only show APPROVED counterparties with completed EDD (if high risk).
  const approvedCounterparties = counterparties.filter(
    (c) =>
      (c.status === "approved" || c.status === "active") &&
      !(c.riskLevel === "high" && c.screeningStatus !== "passed")
  );

  const [formData, setFormData] = useState({
    counterpartyId: "",
    estimatedWeightKg: "",
    tolerancePercent: "5",
    goldType: "dore_bars",
    assayRange: "85-92",
    incoterms: "DAP",
    // Payment conditions (desired terms captured for negotiation)
    currency: "Mixte",
    usdCdfSplit: "70/30",
    paymentTiming: "after_delivery",
    paymentTerm: "T+2",
    prepayment: "10",
    cdfFxBasis: "bcc_payment_date",
    // Delivery
    deliveryVaultId: "",
    deliveryWindowStart: "",
    deliveryWindowEnd: "",
    notes: "",
    premiumDiscount: "0",
    logisticsCost: "2500",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<string[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [priceLocked, setPriceLocked] = useState(false);
  const [priceExpiry, setPriceExpiry] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [lbmaAmPrice, setLbmaAmPrice] = useState(2348.6);
  const [lbmaPmPrice, setLbmaPmPrice] = useState(2351.2);

  // Load existing PO data into the form.
  useEffect(() => {
    if (po) {
      setFormData((prev) => ({
        ...prev,
        counterpartyId: po.counterparty_id || "",
        estimatedWeightKg: String(po.estimated_weight_kg || ""),
        goldType: po.gold_type || "dore_bars",
        assayRange: po.assay_range || "85-92",
        incoterms: po.incoterms || "DAP",
        deliveryVaultId: po.delivery_vault_id || "",
        deliveryWindowStart: po.expected_dispatch_date ? po.expected_dispatch_date.split("T")[0] : "",
        deliveryWindowEnd: po.delivery_window_end ? po.delivery_window_end.split("T")[0] : "",
        notes: po.notes || "",
        premiumDiscount: String(po.premium_discount ?? 0),
        logisticsCost: String(po.logistics_cost ?? 2500),
        currency: po.currency || "Mixte",
        tolerancePercent: po.tolerance_percent != null ? String(po.tolerance_percent) : prev.tolerancePercent,
        usdCdfSplit: po.payment_usd_cdf_split || prev.usdCdfSplit,
        paymentTiming: po.payment_timing || prev.paymentTiming,
        paymentTerm: po.payment_term || prev.paymentTerm,
        prepayment: po.prepayment_percent != null ? String(po.prepayment_percent) : prev.prepayment,
        cdfFxBasis: po.cdf_fx_basis || prev.cdfFxBasis,
      }));
      if (po.lbma_price_per_oz) {
        setLbmaAmPrice(Number(po.lbma_price_per_oz));
        setLbmaPmPrice(Number(po.lbma_price_per_oz) + 2.6);
      }
    }
  }, [po]);

  // Price lock countdown timer.
  useEffect(() => {
    if (!priceLocked || !priceExpiry) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((priceExpiry.getTime() - now.getTime()) / 1000));
      setTimeRemaining(diff);
      if (diff <= 0) {
        setPriceLocked(false);
        setPriceExpiry(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [priceLocked, priceExpiry]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const locale = language === "fr" ? "fr-FR" : "en-US";
  const num = (v: number, digits = 0) =>
    v.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `USD ${num(v / 1_000_000, 2)} M`;
    return `USD ${num(v, 0)}`;
  };

  const selectedCounterparty = counterparties.find((c) => c.id === formData.counterpartyId);

  // LBMA fixing selection based on London time (PM after ~14:30 local).
  const now = new Date();
  const isPmFixing = now.getHours() >= 15 || (now.getHours() === 14 && now.getMinutes() >= 30);
  const currentLbmaPrice = isPmFixing ? lbmaPmPrice : lbmaAmPrice;
  const activeFixing: "AM" | "PM" = isPmFixing ? "PM" : "AM";

  const weightKg = parseFloat(formData.estimatedWeightKg) || 0;
  const tolerancePct = parseFloat(formData.tolerancePercent) || 0;
  const rangeLow = weightKg * (1 - tolerancePct / 100);
  const rangeHigh = weightKg * (1 + tolerancePct / 100);
  const weightOz = (weightKg * 1000) / OZ_TO_GRAM;

  const bounds = ASSAY_BOUNDS[formData.assayRange] || ASSAY_BOUNDS["85-92"];
  const purityFactor = bounds.central;
  const fineWeightKg = weightKg * purityFactor;
  const fineWeightOz = (fineWeightKg * 1000) / OZ_TO_GRAM;

  const valuationLow = weightOz * bounds.low * currentLbmaPrice;
  const valuationCentral = weightOz * bounds.central * currentLbmaPrice;
  const valuationHigh = weightOz * bounds.high * currentLbmaPrice;

  const premiumDiscount = parseFloat(formData.premiumDiscount) || 0;
  const logisticsCost = parseFloat(formData.logisticsCost) || 0;
  const totalValue = valuationCentral + premiumDiscount - logisticsCost;

  // Last comparable operation (indicative reference data).
  const lastNegotiatedPrice = currentLbmaPrice - 4.4;
  const priceGap = currentLbmaPrice - lastNegotiatedPrice;
  const priceGapPct = (priceGap / lastNegotiatedPrice) * 100;

  const handleCalculate = () => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15);
    setPriceExpiry(expiry);
    setPriceLocked(true);
  };

  const persistPayload = (status?: string) => ({
    ...(status ? { status } : {}),
    counterpartyId: formData.counterpartyId,
    estimatedWeightKg: formData.estimatedWeightKg ? parseFloat(formData.estimatedWeightKg) : null,
    goldType: formData.goldType || null,
    assayRange: formData.assayRange || null,
    incoterms: formData.incoterms || null,
    deliveryVaultId: formData.deliveryVaultId || null,
    expectedDispatchDate: formData.deliveryWindowStart || null,
    notes: formData.notes || null,
    lbmaPricePerOz: currentLbmaPrice,
    purityFactor,
    premiumDiscount,
    logisticsCost,
    totalEstimatedValue: totalValue,
    currency: formData.currency,
    priceLockExpiry: priceLocked ? priceExpiry?.toISOString() : null,
    // Tolerance, delivery window end and desired payment terms
    tolerancePercent: formData.tolerancePercent ? parseFloat(formData.tolerancePercent) : null,
    deliveryWindowEnd: formData.deliveryWindowEnd || null,
    paymentUsdCdfSplit: formData.usdCdfSplit || null,
    paymentTiming: formData.paymentTiming || null,
    paymentTerm: formData.paymentTerm || null,
    prepaymentPercent: formData.prepayment ? parseFloat(formData.prepayment) : null,
    cdfFxBasis: formData.cdfFxBasis || null,
  });

  const getMissingFieldsForAction = (action: PurchaseOrderAction) => {
    const missingFields: string[] = [];

    if (!formData.counterpartyId) {
      missingFields.push(language === "fr" ? "Contrepartie" : "Counterparty");
    }

    if (action === "submit" || action === "transmit") {
      if (!formData.estimatedWeightKg || parseFloat(formData.estimatedWeightKg) <= 0) {
        missingFields.push(language === "fr" ? "Quantité cible" : "Target Quantity");
      }
      if (!formData.goldType) missingFields.push(language === "fr" ? "Type d'or" : "Gold Type");
      if (!formData.deliveryVaultId)
        missingFields.push(language === "fr" ? "Coffre de destination" : "Delivery Vault");
      if (!formData.deliveryWindowStart)
        missingFields.push(language === "fr" ? "Début de la fenêtre de livraison souhaitée" : "Desired Delivery Window Start");
      if (!formData.incoterms) missingFields.push("Incoterm");
      if (!priceLocked)
        missingFields.push(language === "fr" ? "Estimation calculée" : "Estimation calculated");
    }

    return missingFields;
  };

  const canSubmitForApproval = getMissingFieldsForAction("submit").length === 0;

  const handleAction = async (action: PurchaseOrderAction) => {
    const missingFields = getMissingFieldsForAction(action);

    if (missingFields.length > 0) {
      setMissingFieldsList(missingFields);
      setShowMissingFieldsModal(true);
      return;
    }

    const isDraft = action === "draft";
    if (isDraft) setIsSaving(true);
    else setIsSubmitting(true);

    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persistPayload(isDraft ? undefined : "submitted")),
      });

      if (response.ok) {
        if (isDraft) {
          router.push("/purchase-orders");
        } else {
          router.push(`/purchase-orders/${id}?submitted=true`);
        }
      } else {
        const errorData = await response.json().catch(() => null);
        setErrorMessage(
          errorData?.error ||
            (language === "fr"
              ? "Impossible d'enregistrer le bon de commande"
              : "Failed to save purchase order")
        );
        setErrorDetails(errorData?.details || []);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Error saving purchase order:", error);
      setErrorMessage(language === "fr" ? "Erreur de connexion" : "Connection error");
      setErrorDetails([
        language === "fr"
          ? "Impossible de contacter le serveur. Veuillez réessayer."
          : "Unable to reach the server. Please try again.",
      ]);
      setShowErrorModal(true);
    }
    setIsSaving(false);
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
      if (response.ok) {
        router.push("/purchase-orders");
      }
    } catch (error) {
      console.error("Error deleting purchase order:", error);
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
  };

  const isMixed = formData.currency === "Mixte";
  const involvesCdf = formData.currency === "Mixte" || formData.currency === "CDF";
  const busy = isSaving || isSubmitting || isDeleting;

  // Loading state.
  if (poLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={language === "fr" ? "Chargement..." : "Loading..."} />
            <main className="flex-1 flex items-center justify-center">
              <Spinner className="h-8 w-8" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Drafts and orders the counterparty sent back for negotiation can be edited.
  if (po && po.status !== "draft" && po.status !== "negotiating") {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={language === "fr" ? "Erreur" : "Error"} />
            <main className="flex-1 flex items-center justify-center">
              <Card className="max-w-md">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {language === "fr" ? "Impossible de modifier" : "Cannot edit"}
                  </p>
                  <p className="text-muted-foreground mb-4">
                    {language === "fr"
                      ? "Seuls les brouillons peuvent être modifiés."
                      : "Only drafts can be edited."}
                  </p>
                  <Link href="/purchase-orders">
                    <Button>{language === "fr" ? "Retour" : "Back"}</Button>
                  </Link>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const createdAt = po?.created_at ? new Date(po.created_at) : null;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Modifier le Bon de Commande" : "Edit Purchase Order"}
            subtitle={language === "fr" ? "Modifier un ordre d'achat d'or" : "Edit a gold purchase order"}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  {/* Internal reference */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Référence interne" : "Internal Reference"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        <RefField label={language === "fr" ? "N° de demande" : "Request No."} value={po?.tracking_id ?? "—"} mono />
                        <RefField
                          label={language === "fr" ? "Créée le" : "Created"}
                          value={
                            createdAt
                              ? `${createdAt.toLocaleDateString(locale)} · ${createdAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
                              : "—"
                          }
                        />
                        <RefField label={language === "fr" ? "Desk initiateur" : "Initiating Desk"} value="Bullion Desk" />
                        <RefField label={language === "fr" ? "Agent initiateur" : "Initiating Agent"} value={agentName} />
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Statut" : "Status"}</p>
                          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {language === "fr" ? "Brouillon" : "Draft"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Counterparty */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Contrepartie" : "Counterparty"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-2">
                          <Label>
                            {language === "fr" ? "Sélectionner la contrepartie" : "Select Counterparty"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.counterpartyId}
                            onValueChange={(value) => setFormData({ ...formData, counterpartyId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={language === "fr" ? "Choisir une contrepartie approuvée..." : "Choose an approved counterparty..."}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {approvedCounterparties.map((cp) => (
                                <SelectItem key={cp.id} value={cp.id}>
                                  {cp.legalName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedCounterparty && (
                          <div className="flex items-center gap-2 pb-1">
                            <Badge className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" variant="outline">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {language === "fr" ? "Approuvée" : "Approved"}
                            </Badge>
                            <Badge className="border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400" variant="outline">
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              {language === "fr" ? "KYC valide" : "KYC valid"}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {selectedCounterparty && (
                        <div className="rounded-lg border bg-muted/40 p-4">
                          <p className="font-medium">{selectedCounterparty.legalName}</p>
                          <p className="text-sm text-muted-foreground">{selectedCounterparty.countryOfIncorporation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gold details */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Scale className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Détails de l'Or" : "Gold Details"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Quantité cible (kg)" : "Target Quantity (kg)"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.001"
                              value={formData.estimatedWeightKg}
                              onChange={(e) => setFormData({ ...formData, estimatedWeightKg: e.target.value })}
                              placeholder="50.000"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              kg
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Tolérance autorisée" : "Allowed Tolerance"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.tolerancePercent}
                            onValueChange={(value) => setFormData({ ...formData, tolerancePercent: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2.5">± 2,5 %</SelectItem>
                              <SelectItem value="5">± 5,0 %</SelectItem>
                              <SelectItem value="10">± 10,0 %</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Fourchette calculée" : "Computed Range"}</Label>
                          <Input
                            readOnly
                            value={weightKg > 0 ? `${num(rangeLow, 3)} – ${num(rangeHigh, 3)} kg` : "—"}
                            className="bg-muted/40 text-muted-foreground"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Type d'Or" : "Gold Type"} <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.goldType}
                            onValueChange={(value) => setFormData({ ...formData, goldType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {GOLD_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {language === "fr" ? type.label.fr : type.label.en}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Plage de pureté (%)" : "Assay Range (%)"}</Label>
                          <Select
                            value={formData.assayRange}
                            onValueChange={(value) => setFormData({ ...formData, assayRange: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="85-92">85 % – 92 %</SelectItem>
                              <SelectItem value="92-99">92 % – 99 %</SelectItem>
                              <SelectItem value="99.5+">99,5 %+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Incoterm" : "Incoterm"} <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.incoterms}
                            onValueChange={(value) => setFormData({ ...formData, incoterms: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCOTERMS.map((term) => (
                                <SelectItem key={term} value={term}>
                                  {term}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment conditions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Conditions de paiement souhaitées" : "Desired Payment Terms"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Devise" : "Currency"} <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.currency}
                            onValueChange={(value) => setFormData({ ...formData, currency: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="CDF">CDF</SelectItem>
                              <SelectItem value="Mixte">{language === "fr" ? "Mixte" : "Mixed"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className={isMixed ? "" : "text-muted-foreground"}>
                            {language === "fr" ? "Répartition USD / CDF" : "USD / CDF Split"}
                          </Label>
                          <Select
                            value={formData.usdCdfSplit}
                            onValueChange={(value) => setFormData({ ...formData, usdCdfSplit: value })}
                            disabled={!isMixed}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="50/50">50 % USD / 50 % CDF</SelectItem>
                              <SelectItem value="70/30">70 % USD / 30 % CDF</SelectItem>
                              <SelectItem value="80/20">80 % USD / 20 % CDF</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Moment du paiement" : "Payment Timing"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.paymentTiming}
                            onValueChange={(value) => setFormData({ ...formData, paymentTiming: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="advance">{language === "fr" ? "À la commande" : "On order"}</SelectItem>
                              <SelectItem value="on_delivery">{language === "fr" ? "À la livraison" : "On delivery"}</SelectItem>
                              <SelectItem value="after_delivery">{language === "fr" ? "Après livraison" : "After delivery"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Délai de paiement" : "Payment Term"}</Label>
                          <Select
                            value={formData.paymentTerm}
                            onValueChange={(value) => setFormData({ ...formData, paymentTerm: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="T+0">T+0</SelectItem>
                              <SelectItem value="T+1">T+1</SelectItem>
                              <SelectItem value="T+2">T+2</SelectItem>
                              <SelectItem value="T+5">T+5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Prépaiement éventuel" : "Possible Prepayment"}</Label>
                          <Select
                            value={formData.prepayment}
                            onValueChange={(value) => setFormData({ ...formData, prepayment: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 %</SelectItem>
                              <SelectItem value="10">10 %</SelectItem>
                              <SelectItem value="25">25 %</SelectItem>
                              <SelectItem value="50">50 %</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className={involvesCdf ? "" : "text-muted-foreground"}>
                            {language === "fr" ? "Taux de change pour la part CDF" : "FX Basis for CDF Portion"}
                          </Label>
                          <Select
                            value={formData.cdfFxBasis}
                            onValueChange={(value) => setFormData({ ...formData, cdfFxBasis: value })}
                            disabled={!involvesCdf}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bcc_payment_date">
                                {language === "fr" ? "Cours BCC à la date de paiement" : "BCC rate at payment date"}
                              </SelectItem>
                              <SelectItem value="bcc_order_date">
                                {language === "fr" ? "Cours BCC à la date de commande" : "BCC rate at order date"}
                              </SelectItem>
                              <SelectItem value="spot">{language === "fr" ? "Cours spot du marché" : "Market spot rate"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {language === "fr"
                          ? "Les champs affichés s'adaptent automatiquement à la devise et au mode de paiement sélectionnés."
                          : "The fields shown adapt automatically to the selected currency and payment mode."}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Delivery */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Livraison" : "Delivery"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Coffre de destination" : "Destination Vault"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.deliveryVaultId}
                            onValueChange={(value) => setFormData({ ...formData, deliveryVaultId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner le coffre..." : "Select vault..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {VAULTS.map((vault) => (
                                <SelectItem key={vault.id} value={vault.id}>
                                  {language === "fr" ? vault.name.fr : vault.name.en}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {language === "fr" ? "Fenêtre de livraison souhaitée" : "Desired Delivery Window"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={formData.deliveryWindowStart}
                              onChange={(e) => setFormData({ ...formData, deliveryWindowStart: e.target.value })}
                              required
                              aria-required="true"
                            />
                            <span className="text-sm text-muted-foreground">{language === "fr" ? "au" : "to"}</span>
                            <Input
                              type="date"
                              value={formData.deliveryWindowEnd}
                              onChange={(e) => setFormData({ ...formData, deliveryWindowEnd: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Notes" : "Notes"}</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder={
                            language === "fr"
                              ? "Instructions particulières, contraintes internes ou commentaires pour la contrepartie..."
                              : "Special instructions, internal constraints or comments for the counterparty..."
                          }
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Supprimer" : "Delete"}
                    </Button>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <Button variant="outline" onClick={() => handleAction("draft")} disabled={busy}>
                        <Save className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Enregistrer le brouillon" : "Save Draft"}
                      </Button>
                      <Button onClick={() => handleAction("submit")} disabled={busy || !canSubmitForApproval}>
                        <Send className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Soumettre pour approbation" : "Submit for Approval"}
                      </Button>
                      {po?.status !== "draft" && (
                        <Button variant="ghost" onClick={() => handleAction("transmit")} disabled={busy}>
                          <Send className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Transmettre à la contrepartie" : "Transmit to Counterparty"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estimation panel */}
                <div className="space-y-6">
                  <Card className="sticky top-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        {language === "fr" ? "Estimation indicative" : "Indicative Estimate"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Références de marché et fourchette provisoire"
                          : "Market references and provisional range"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* LBMA prices */}
                      <div className="space-y-2">
                        <div
                          className={`flex items-center justify-between rounded-lg border-2 p-3 transition-all ${
                            activeFixing === "AM" ? "border-emerald-500 bg-emerald-500/10" : "border-border"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`h-4 w-4 ${activeFixing === "AM" ? "text-emerald-500" : "text-muted-foreground"}`} />
                            <span className={`text-sm ${activeFixing === "AM" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}>
                              LBMA Gold (AM Fixing)
                            </span>
                            {activeFixing === "AM" && (
                              <Badge variant="outline" className="ml-1 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs">
                                {language === "fr" ? "Actif" : "Active"}
                              </Badge>
                            )}
                          </div>
                          <span className={`font-mono text-sm font-bold ${activeFixing === "AM" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                            {num(lbmaAmPrice, 2)} USD/oz
                          </span>
                        </div>
                        <div
                          className={`flex items-center justify-between rounded-lg border-2 p-3 transition-all ${
                            activeFixing === "PM" ? "border-sky-500 bg-sky-500/10" : "border-border"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`h-4 w-4 ${activeFixing === "PM" ? "text-sky-500" : "text-muted-foreground"}`} />
                            <span className={`text-sm ${activeFixing === "PM" ? "font-semibold text-sky-600 dark:text-sky-400" : ""}`}>
                              LBMA Gold (PM Fixing)
                            </span>
                            {activeFixing === "PM" && (
                              <Badge variant="outline" className="ml-1 border-sky-500 text-sky-600 dark:text-sky-400 text-xs">
                                {language === "fr" ? "Actif" : "Active"}
                              </Badge>
                            )}
                          </div>
                          <span className={`font-mono text-sm font-bold ${activeFixing === "PM" ? "text-sky-600 dark:text-sky-400" : ""}`}>
                            {num(lbmaPmPrice, 2)} USD/oz
                          </span>
                        </div>
                      </div>

                      {/* Key metrics */}
                      <div className="space-y-2 text-sm">
                        <MetricRow label={language === "fr" ? "Quantité cible" : "Target Quantity"} value={`${num(weightKg, 3)} kg`} />
                        <MetricRow label={language === "fr" ? "Tolérance" : "Tolerance"} value={`± ${num(tolerancePct, 1)} %`} />
                        <MetricRow label={language === "fr" ? "Pureté centrale utilisée" : "Central Purity Used"} value={`${num(purityFactor * 100, 2)} %`} />
                        <MetricRow
                          label={language === "fr" ? "Poids d'or fin estimé" : "Estimated Fine Gold Weight"}
                          value={`${num(fineWeightKg, 3)} kg · ${num(fineWeightOz, 2)} oz`}
                        />
                      </div>

                      <Separator />

                      {/* Last comparable operation */}
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {language === "fr" ? "Dernière opération comparable" : "Last Comparable Operation"}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <MetricRow label={language === "fr" ? "Dernier prix négocié" : "Last Negotiated Price"} value={`${num(lastNegotiatedPrice, 2)} USD/oz`} />
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Écart vs référence actuelle" : "Gap vs Current Reference"}</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              + {num(priceGap, 2)} USD ({priceGapPct >= 0 ? "+" : ""}
                              {num(priceGapPct, 2)} %)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Valuation range */}
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <span className="text-sm font-medium">{language === "fr" ? "Fourchette de valorisation" : "Valuation Range"}</span>
                        <div className="mt-2 space-y-1.5 text-sm">
                          <MetricRow label={`${language === "fr" ? "Hypothèse basse" : "Low"} · ${num(bounds.low * 100, 0)} %`} value={money(valuationLow)} />
                          <MetricRow label={`${language === "fr" ? "Hypothèse centrale" : "Central"} · ${num(bounds.central * 100, 1)} %`} value={money(valuationCentral)} />
                          <MetricRow label={`${language === "fr" ? "Hypothèse haute" : "High"} · ${num(bounds.high * 100, 0)} %`} value={money(valuationHigh)} />
                        </div>
                      </div>

                      {/* Premium / logistics inputs */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{language === "fr" ? "Prime / remise" : "Premium / Discount"}</span>
                          <Input
                            type="number"
                            className="h-7 w-28 text-right"
                            value={formData.premiumDiscount}
                            onChange={(e) => setFormData({ ...formData, premiumDiscount: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{language === "fr" ? "Coût logistique" : "Logistics Cost"}</span>
                          <Input
                            type="number"
                            className="h-7 w-28 text-right"
                            value={formData.logisticsCost}
                            onChange={(e) => setFormData({ ...formData, logisticsCost: e.target.value })}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Indicative amount */}
                      <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 p-4 text-center">
                        <span className="text-sm text-muted-foreground">{language === "fr" ? "Montant indicatif" : "Indicative Amount"}</span>
                        <span className="text-2xl font-bold">
                          {weightKg > 0 ? `${money(valuationLow)} – ${num(valuationHigh / 1_000_000, 2)} M` : "—"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {language === "fr"
                            ? "Estimation hors premium final et coûts logistiques confirmés"
                            : "Estimate excludes final premium and confirmed logistics costs"}
                        </span>
                      </div>

                      {/* Price lock / calculate */}
                      {priceLocked && timeRemaining > 0 ? (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500 bg-emerald-500/10 p-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-emerald-500" />
                            <div>
                              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                {language === "fr" ? "Estimation verrouillée" : "Estimate Locked"}
                              </p>
                              <p className="text-xs text-muted-foreground">{language === "fr" ? "Validité 15 min" : "15 min validity"}</p>
                            </div>
                          </div>
                          <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatTime(timeRemaining)}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={handleCalculate} disabled={!weightKg}>
                            <Calculator className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Calculer l'estimation" : "Calculate Estimate"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setLbmaAmPrice((p) => p + (Math.random() - 0.5) * 5);
                              setLbmaPmPrice((p) => p + (Math.random() - 0.5) * 5);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Missing Fields Modal */}
      <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              {language === "fr" ? "Informations Requises Manquantes" : "Missing Required Information"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Les champs suivants sont obligatoires pour poursuivre :"
                : "The following fields are required to proceed:"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="space-y-2">
              {missingFieldsList.map((field, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMissingFieldsModal(false)}>{language === "fr" ? "Compris" : "Understood"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              {language === "fr" ? "Erreur" : "Error"}
            </DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
          {errorDetails.length > 0 && (
            <div className="py-4">
              <ul className="space-y-2">
                {errorDetails.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowErrorModal(false)}>
              {language === "fr" ? "Fermer" : "Close"}
            </Button>
            <Button onClick={() => { setShowErrorModal(false); handleAction("draft"); }}>
              {language === "fr" ? "Réessayer" : "Try Again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer le brouillon ?" : "Delete draft?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? "Cette action est irréversible. Le bon de commande sera définitivement supprimé."
                : "This action cannot be undone. The purchase order will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function RefField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
