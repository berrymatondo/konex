"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  DollarSign,
  Scale,
  Truck,
  Upload,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

const GOLD_TYPES = [
  { value: "dore_bars", label: { en: "Doré Bars", fr: "Doré" } },
  { value: "refined_bars", label: { en: "Refined Bars", fr: "Lingots Raffinés" } },
  { value: "gold_dust", label: { en: "Gold Dust", fr: "Poudre d'Or" } },
  { value: "scrap_gold", label: { en: "Scrap Gold", fr: "Or de Récupération" } },
];

const LOT_AVAILABILITY = [
  { value: "confirmed", label: { en: "Confirmed", fr: "Confirmée" } },
  { value: "partial", label: { en: "Partial", fr: "Partielle" } },
  { value: "pending", label: { en: "Pending", fr: "En attente" } },
  { value: "on_request", label: { en: "On request", fr: "Sur demande" } },
];

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  });

const OZ_TO_GRAM = 31.1035;

type Decision = "accept" | "negotiate" | "decline";

interface PurchaseOrder {
  id: string;
  counterparty_id: string;
  counterparty_name?: string;
  status: string;
  estimated_weight_kg: string | number;
  gold_type: string;
  assay_range: string;
  incoterms: string;
  delivery_vault_id: string;
  expected_dispatch_date: string | null;
  lbma_price_per_oz: string | number;
  purity_factor: string | number;
  premium_discount: string | number;
  total_estimated_value: string | number;
  currency: string;
  tracking_id: string | null;
  created_at: string;
  sent_to_counterparty_at: string | null;
  cp_response: string | null;
  cp_comment: string | null;
  cp_lot_reference: string | null;
  cp_proposed_weight_kg: string | number | null;
  cp_proposed_purity: string | number | null;
  cp_gold_form: string | null;
  cp_lot_availability: string | null;
  cp_lot_available_date: string | null;
  cp_lot_location: string | null;
  cp_assay_certificate_url: string | null;
  cp_assay_certificate_file_name: string | null;
  cp_proposed_dispatch_date: string | null;
  cp_estimated_delivery_date: string | null;
  cp_proposed_premium: string | number | null;
}

export default function CounterpartyRespondPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { language } = useLanguage();
  const isFr = language === "fr";

  const { data: po, error, isLoading, mutate } = useSWR<PurchaseOrder>(
    `/api/purchase-orders/${id}/respond`,
    fetcher
  );

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Assay certificate upload state.
  const [assayCertificateFile, setAssayCertificateFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certFileName, setCertFileName] = useState<string>("");

  // Counter-proposal / proposed-lot fields (editable).
  const [lot, setLot] = useState({
    lotReference: "",
    proposedWeightKg: "",
    proposedPurity: "",
    goldForm: "",
    lotAvailability: "",
    lotAvailableDate: "",
    lotLocation: "",
    assayCertificateUrl: "",
    proposedDispatchDate: "",
    estimatedDeliveryDate: "",
    proposedPremium: "",
  });

  // Prefill the proposed lot from the BCC offer once loaded. The lot reference
  // is auto-generated (read-only) from the order and a short random suffix.
  useEffect(() => {
    if (po) {
      const autoRef =
        po.cp_lot_reference ||
        `LOT-${(po.tracking_id || po.id).slice(-6).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 5)
          .toUpperCase()}`;
      const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");
      setComment((prev) => prev || po.cp_comment || "");
      setCertFileName((prev) => prev || po.cp_assay_certificate_file_name || "");
      setLot((prev) => ({
        ...prev,
        lotReference: prev.lotReference || autoRef,
        proposedWeightKg: prev.proposedWeightKg || String(po.cp_proposed_weight_kg ?? po.estimated_weight_kg ?? ""),
        proposedPurity:
          prev.proposedPurity || String(po.cp_proposed_purity ?? Math.round((Number(po.purity_factor) || 0.88) * 10000) / 100),
        goldForm: prev.goldForm || po.cp_gold_form || po.gold_type || "dore_bars",
        lotAvailability: prev.lotAvailability || po.cp_lot_availability || "confirmed",
        lotAvailableDate: prev.lotAvailableDate || dateOnly(po.cp_lot_available_date),
        lotLocation: prev.lotLocation || po.cp_lot_location || "",
        assayCertificateUrl: prev.assayCertificateUrl || po.cp_assay_certificate_url || "",
        proposedDispatchDate: prev.proposedDispatchDate || dateOnly(po.cp_proposed_dispatch_date),
        estimatedDeliveryDate: prev.estimatedDeliveryDate || dateOnly(po.cp_estimated_delivery_date),
        proposedPremium: prev.proposedPremium || String(po.cp_proposed_premium ?? ""),
      }));
    }
  }, [po?.id]);

  // Upload an assay certificate to private Blob storage and keep its pathname.
  const handleCertUpload = async (file: File) => {
    setUploadingCert(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("poId", id);
      const res = await fetch("/api/vault-intake/certificate", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.pathname) {
        setLot((s) => ({ ...s, assayCertificateUrl: data.pathname }));
        setCertFileName(data.fileName || file.name);
      } else {
        setResult({ type: "error", text: data.error || (isFr ? "Échec de l'upload du certificat." : "Certificate upload failed.") });
      }
    } catch {
      setResult({ type: "error", text: isFr ? "Échec de l'upload du certificat." : "Certificate upload failed." });
    } finally {
      setUploadingCert(false);
    }
  };
  void handleCertUpload;

  const handleCertSelect = (file: File) => {
    setResult(null);
    setAssayCertificateFile(file);
    setCertFileName(file.name);
  };

  const num = (n: unknown, d = 2) =>
    Number(n || 0).toLocaleString(isFr ? "fr-FR" : "en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  const [savingDraft, setSavingDraft] = useState(false);

  const buildResponseFormData = (decision: Decision | "save") => {
    const fd = new FormData();
    fd.append("decision", decision);
    fd.append("comment", comment || "");
    fd.append("lotReference", lot.lotReference || "");
    fd.append("proposedWeightKg", lot.proposedWeightKg || "");
    fd.append("proposedPurity", lot.proposedPurity || "");
    fd.append("goldForm", lot.goldForm || "");
    fd.append("lotAvailability", lot.lotAvailability || "");
    fd.append("lotAvailableDate", lot.lotAvailableDate || "");
    fd.append("lotLocation", lot.lotLocation || "");
    fd.append("assayCertificateUrl", lot.assayCertificateUrl || "");
    fd.append("assayCertificateFileName", certFileName || "");
    fd.append("proposedDispatchDate", lot.proposedDispatchDate || "");
    fd.append("estimatedDeliveryDate", lot.estimatedDeliveryDate || "");
    fd.append("proposedPremium", lot.proposedPremium || "");
    if (assayCertificateFile) {
      fd.append("assayCertificate", assayCertificateFile);
    }
    return fd;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setResult(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/respond`, {
        method: "POST",
        body: buildResponseFormData("save"),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({
          type: "success",
          text: isFr ? "Brouillon enregistré." : "Draft saved.",
        });
        if (data.assayCertificateUrl) {
          setLot((s) => ({ ...s, assayCertificateUrl: data.assayCertificateUrl }));
          setAssayCertificateFile(null);
          setCertFileName(data.assayCertificateFileName || certFileName);
        }
        mutate();
      } else {
        setResult({ type: "error", text: data.error || res.statusText });
      }
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSavingDraft(false);
    }
  };

  // Fields that must be filled before accepting or negotiating an offer.
  const REQUIRED_LOT_FIELDS: { key: keyof typeof lot; label: { en: string; fr: string } }[] = [
    { key: "proposedWeightKg", label: { en: "Proposed qty", fr: "Quantité proposée" } },
    { key: "proposedPurity", label: { en: "Estimated purity", fr: "Pureté estimée" } },
    { key: "goldForm", label: { en: "Gold type / form", fr: "Type / forme de l'or" } },
    { key: "lotAvailability", label: { en: "Lot availability", fr: "Disponibilité du lot" } },
    { key: "lotAvailableDate", label: { en: "Available date", fr: "Date de disponibilité" } },
    { key: "proposedDispatchDate", label: { en: "Proposed dispatch date", fr: "Date d'expédition proposée" } },
    { key: "estimatedDeliveryDate", label: { en: "Estimated delivery date", fr: "Date de livraison estimée" } },
  ];

  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const handleSubmit = async (d: Decision) => {
    // Accept and Negotiate require every mandatory field to be filled.
    if (d === "accept" || d === "negotiate") {
      const missing = REQUIRED_LOT_FIELDS.filter((f) => !String(lot[f.key] ?? "").trim());
      if (missing.length > 0) {
        setFieldErrors(Object.fromEntries(missing.map((f) => [f.key, true])));
        setResult({
          type: "error",
          text: isFr
            ? `Veuillez renseigner tous les champs obligatoires : ${missing.map((f) => f.label.fr).join(", ")}.`
            : `Please fill in all required fields: ${missing.map((f) => f.label.en).join(", ")}.`,
        });
        return;
      }
      setFieldErrors({});
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/respond`, {
        method: "POST",
        body: buildResponseFormData(d),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({
          type: "success",
          text: isFr ? "Votre réponse a été transmise à la Banque Centrale." : "Your response was sent to the Central Bank.",
        });
        mutate();
      } else {
        setResult({ type: "error", text: data.error || res.statusText });
      }
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSubmitting(false);
    }
  };

  const reference = po ? po.tracking_id || `PO-${po.id.slice(0, 8).toUpperCase()}` : id;

  // Already responded?
  const alreadyResponded =
    po && ["accepted", "negotiating", "declined"].includes(po.status);

  // Derived commercial figures.
  const weightKg = Number(po?.estimated_weight_kg || 0);
  const purityFactor = Number(po?.purity_factor || 0.88);
  const fineWeightKg = weightKg * purityFactor;
  const fineWeightOz = (fineWeightKg * 1000) / OZ_TO_GRAM;
  const unitPrice =
    (Number(po?.lbma_price_per_oz || 0)) * (1 + Number(po?.premium_discount || 0) / 100);

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={isFr ? "Réponse à la demande d'achat" : "Respond to Purchase Request"}
            subtitle={isFr ? "Examinez l'offre de la Banque Centrale et soumettez votre réponse" : "Review the Central Bank offer and submit your response"}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
              <Link href={`/purchase-orders/${id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {isFr ? "Retour" : "Back"}
                </Button>
              </Link>

              {isLoading && (
                <div className="flex items-center justify-center py-24">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <Card className="border-destructive">
                  <CardContent className="py-8 text-center text-destructive">
                    {isFr ? "Impossible de charger la demande : " : "Could not load the request: "}
                    {error.message}
                  </CardContent>
                </Card>
              )}

              {po && (
                <>
                  {result && (
                    <div
                      role="status"
                      className={`rounded-md border px-4 py-2 text-sm ${
                        result.type === "success"
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {result.text}
                    </div>
                  )}

                  {alreadyResponded && (
                    <Card
                      className={
                        po.status === "accepted"
                          ? "border-success bg-success/5"
                          : po.status === "declined"
                            ? "border-destructive bg-destructive/5"
                            : "border-warning bg-warning/5"
                      }
                    >
                      <CardContent className="flex items-start gap-3 py-4">
                        {po.status === "accepted" ? (
                          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                        ) : po.status === "declined" ? (
                          <XCircle className="h-5 w-5 text-destructive shrink-0" />
                        ) : (
                          <RefreshCw className="h-5 w-5 text-warning shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">
                            {po.status === "accepted"
                              ? isFr
                                ? "Offre acceptée"
                                : "Offer accepted"
                              : po.status === "declined"
                                ? isFr
                                  ? "Offre déclinée"
                                  : "Offer declined"
                                : isFr
                                  ? "Contre-proposition envoyée"
                                  : "Counter-proposal sent"}
                          </p>
                          {po.cp_comment && (
                            <p className="text-sm text-muted-foreground mt-1">{po.cp_comment}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                      {/* Référence de la demande */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4" />
                            {isFr ? "Référence de la demande" : "Request Reference"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                          <Field label={isFr ? "N° de demande" : "Request No."} value={reference} />
                          <Field
                            label={isFr ? "Reçue le" : "Received"}
                            value={
                              po.sent_to_counterparty_at
                                ? new Date(po.sent_to_counterparty_at).toLocaleString()
                                : new Date(po.created_at).toLocaleDateString()
                            }
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">{isFr ? "Statut" : "Status"}</span>
                            <Badge variant="outline" className="w-fit border-warning text-warning">
                              {alreadyResponded
                                ? po.status
                                : isFr
                                  ? "À traiter"
                                  : "To process"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Offre de la Banque Centrale (read-only) */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-4 w-4" />
                            {isFr ? "Offre de la Banque Centrale" : "Central Bank Offer"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <Field label={isFr ? "Quantité cible" : "Target qty"} value={`${num(weightKg, 3)} kg`} />
                          <Field label={isFr ? "Pureté demandée" : "Purity range"} value={po.assay_range || "—"} />
                          <Field label={isFr ? "Type d'or" : "Gold type"} value={po.gold_type || "—"} />
                          <Field label="Incoterm" value={po.incoterms || "—"} />
                          <Field label={isFr ? "Coffre de destination" : "Destination vault"} value={po.delivery_vault_id || "—"} />
                          <Field
                            label={isFr ? "Fenêtre de livraison" : "Delivery window"}
                            value={po.expected_dispatch_date ? new Date(po.expected_dispatch_date).toLocaleDateString() : "—"}
                          />
                        </CardContent>
                      </Card>

                      {/* Lot proposé (editable) */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Scale className="h-4 w-4" />
                            {isFr ? "Lot proposé" : "Proposed Lot"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor="lotReference">
                              {isFr ? "Référence du lot (auto)" : "Lot reference (auto)"}
                            </Label>
                            <Input
                              id="lotReference"
                              value={lot.lotReference}
                              readOnly
                              disabled
                              className="font-mono"
                            />
                          </div>
                          <LabeledInput
                            id="proposedWeightKg"
                            label={isFr ? "Quantité proposée (kg)" : "Proposed qty (kg)"}
                            value={lot.proposedWeightKg}
                            onChange={(v) => setLot((s) => ({ ...s, proposedWeightKg: v }))}
                            type="number"
                            disabled={!!alreadyResponded}
                            required
                            invalid={fieldErrors.proposedWeightKg}
                          />
                          <LabeledInput
                            id="proposedPurity"
                            label={isFr ? "Pureté estimée (%)" : "Estimated purity (%)"}
                            value={lot.proposedPurity}
                            onChange={(v) => setLot((s) => ({ ...s, proposedPurity: v }))}
                            type="number"
                            disabled={!!alreadyResponded}
                            required
                            invalid={fieldErrors.proposedPurity}
                          />
                          <div className="space-y-2">
                            <Label htmlFor="goldForm">
                              {isFr ? "Type / forme de l'or" : "Gold type / form"}
                              <span className="ml-0.5 text-destructive">*</span>
                            </Label>
                            <Select
                              value={lot.goldForm}
                              onValueChange={(v) => setLot((s) => ({ ...s, goldForm: v }))}
                              disabled={!!alreadyResponded}
                            >
                              <SelectTrigger
                                id="goldForm"
                                aria-invalid={fieldErrors.goldForm || undefined}
                                className={fieldErrors.goldForm ? "border-destructive focus-visible:ring-destructive" : undefined}
                              >
                                <SelectValue placeholder={isFr ? "Sélectionner" : "Select"} />
                              </SelectTrigger>
                              <SelectContent>
                                {GOLD_TYPES.map((g) => (
                                  <SelectItem key={g.value} value={g.value}>
                                    {isFr ? g.label.fr : g.label.en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lotAvailability">
                              {isFr ? "Disponibilité du lot" : "Lot availability"}
                              <span className="ml-0.5 text-destructive">*</span>
                            </Label>
                            <Select
                              value={lot.lotAvailability}
                              onValueChange={(v) => setLot((s) => ({ ...s, lotAvailability: v }))}
                              disabled={!!alreadyResponded}
                            >
                              <SelectTrigger
                                id="lotAvailability"
                                aria-invalid={fieldErrors.lotAvailability || undefined}
                                className={fieldErrors.lotAvailability ? "border-destructive focus-visible:ring-destructive" : undefined}
                              >
                                <SelectValue placeholder={isFr ? "Sélectionner" : "Select"} />
                              </SelectTrigger>
                              <SelectContent>
                                {LOT_AVAILABILITY.map((a) => (
                                  <SelectItem key={a.value} value={a.value}>
                                    {isFr ? a.label.fr : a.label.en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <LabeledInput
                            id="lotAvailableDate"
                            label={isFr ? "Date de disponibilité" : "Available date"}
                            value={lot.lotAvailableDate}
                            onChange={(v) => setLot((s) => ({ ...s, lotAvailableDate: v }))}
                            type="date"
                            disabled={!!alreadyResponded}
                            required
                            invalid={fieldErrors.lotAvailableDate}
                          />
                          <LabeledInput
                            id="lotLocation"
                            label={isFr ? "Localisation actuelle" : "Current location"}
                            value={lot.lotLocation}
                            onChange={(v) => setLot((s) => ({ ...s, lotLocation: v }))}
                            placeholder="Bukavu, RDC"
                            disabled={!!alreadyResponded}
                          />
                          <div className="space-y-2">
                            <Label htmlFor="assayCert">{isFr ? "Certificat d'assay" : "Assay certificate"}</Label>
                            <input
                              id="assayCert"
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              className="hidden"
                              disabled={!!alreadyResponded || uploadingCert}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleCertSelect(f);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start font-normal"
                              disabled={!!alreadyResponded || uploadingCert}
                              onClick={() => document.getElementById("assayCert")?.click()}
                            >
                              {uploadingCert ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : assayCertificateFile || lot.assayCertificateUrl ? (
                                <FileText className="mr-2 h-4 w-4 text-success" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              <span className="truncate">
                                {uploadingCert
                                  ? isFr ? "Téléversement…" : "Uploading…"
                                  : certFileName || (lot.assayCertificateUrl
                                      ? (isFr ? "Certificat téléversé" : "Certificate uploaded")
                                      : (isFr ? "Téléverser un PDF/JPG/PNG" : "Upload PDF/JPG/PNG"))}
                              </span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Livraison et conditions */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Truck className="h-4 w-4" />
                            {isFr ? "Livraison et conditions" : "Delivery & terms"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <LabeledInput
                              id="proposedDispatchDate"
                              label={isFr ? "Date d'expédition proposée" : "Proposed dispatch date"}
                              value={lot.proposedDispatchDate}
                              onChange={(v) => setLot((s) => ({ ...s, proposedDispatchDate: v }))}
                              type="date"
                              disabled={!!alreadyResponded}
                              required
                              invalid={fieldErrors.proposedDispatchDate}
                            />
                            <LabeledInput
                              id="estimatedDeliveryDate"
                              label={isFr ? "Date de livraison estimée" : "Estimated delivery date"}
                              value={lot.estimatedDeliveryDate}
                              onChange={(v) => setLot((s) => ({ ...s, estimatedDeliveryDate: v }))}
                              type="date"
                              disabled={!!alreadyResponded}
                              required
                              invalid={fieldErrors.estimatedDeliveryDate}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="comment">{isFr ? "Commentaire" : "Comment"}</Label>
                            <Textarea
                              id="comment"
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder={isFr ? "Précisions sur le lot, la livraison ou les documents transmis…" : "Notes on the lot, delivery or documents…"}
                              disabled={!!alreadyResponded}
                              rows={3}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right commercial panel */}
                    <div className="space-y-4 sm:space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <DollarSign className="h-4 w-4" />
                            {isFr ? "Réponse commerciale" : "Commercial response"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <Row label="LBMA Gold (PM Fixing)" value={`${num(po.lbma_price_per_oz)} USD/oz`} />
                          <Separator />
                          <Row label={isFr ? "Quantité proposée" : "Proposed qty"} value={`${num(weightKg, 3)} kg`} />
                          <Row label={isFr ? "Pureté estimée" : "Estimated purity"} value={`${num(purityFactor * 100)} %`} />
                          <Row label={isFr ? "Poids d'or fin estimé" : "Est. fine gold"} value={`${num(fineWeightKg, 3)} kg · ${num(fineWeightOz, 1)} oz`} />
                          <Separator />
                          <Row label={isFr ? "Premium / décote" : "Premium / discount"} value={`${num(po.premium_discount)} %`} />
                          <Row label={isFr ? "Prix unitaire indicatif" : "Indicative unit price"} value={`${num(unitPrice)} USD/oz`} />
                          <div className="rounded-lg border bg-muted/40 p-4 text-center">
                            <p className="text-xs text-muted-foreground">
                              {isFr ? "Montant indicatif de l'offre" : "Indicative offer amount"}
                            </p>
                            <p className="text-2xl font-bold">
                              {num(po.total_estimated_value, 0)} {po.currency || "USD"}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {isFr
                                ? "Sous réserve de validation du poids et de la pureté"
                                : "Subject to weight and purity validation"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Actions */}
                      {!alreadyResponded && (
                        <Card>
                          <CardContent className="space-y-3 py-4">
                            <Button
                              variant="outline"
                              className="w-full"
                              disabled={submitting || savingDraft || uploadingCert}
                              onClick={handleSaveDraft}
                            >
                              {savingDraft ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="mr-2 h-4 w-4" />
                              )}
                              {isFr ? "Enregistrer le brouillon" : "Save draft"}
                            </Button>
                            <Separator />
                            <Button
                              className="w-full bg-success text-success-foreground hover:bg-success/90"
                              disabled={submitting || savingDraft}
                              onClick={() => handleSubmit("accept")}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {isFr ? "Accepter l'offre" : "Accept offer"}
                            </Button>
                            <Button
                              className="w-full"
                              variant="default"
                              disabled={submitting || savingDraft}
                              onClick={() => handleSubmit("negotiate")}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {isFr ? "Négocier l'offre" : "Negotiate offer"}
                            </Button>
                            <Button
                              className="w-full"
                              variant="destructive"
                              disabled={submitting || savingDraft}
                              onClick={() => handleSubmit("decline")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              {isFr ? "Décliner l'offre" : "Decline offer"}
                            </Button>
                            <p className="text-[11px] text-muted-foreground text-center">
                              {isFr
                                ? "« Négocier » enregistre votre contre-proposition (lot, dates, premium)."
                                : "“Negotiate” records your counter-proposal (lot, dates, premium)."}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  required,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-destructive focus-visible:ring-destructive" : undefined}
      />
    </div>
  );
}
