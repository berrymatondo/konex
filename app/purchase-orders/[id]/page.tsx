"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  Users,
  DollarSign,
  Truck,
  Building2,
  FileText,
  Send,
  Printer,
  QrCode,
  Copy,
  RefreshCw,
  Lock,
  Eye,
  Scale,
  ShieldCheck,
  TrendingUp,
  Download,
  RotateCcw,
  Package,
  GitMerge,
  Warehouse,
  Wallet,
  ExternalLink,
  Circle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { generatePurchaseOrderPDF } from "@/lib/pdf-generator";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DUAL_APPROVAL_THRESHOLD = 1000000; // $1M USD

const OZ_TO_GRAM = 31.1035;

// Shared label maps so the read-only detail view shows the same friendly
// labels as the new/edit purchase order forms.
const GOLD_TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  dore_bars: { en: "Doré Bars", fr: "Doré" },
  refined_bars: { en: "Refined Bars", fr: "Lingots Raffinés" },
  gold_dust: { en: "Gold Dust", fr: "Poudre d'Or" },
  scrap_gold: { en: "Scrap Gold", fr: "Or de Récupération" },
};

const VAULT_LABELS: Record<string, { en: string; fr: string }> = {
  "vault-kinshasa": { en: "BCC Vault – Kinshasa", fr: "Coffre BCC – Kinshasa" },
  "vault-zurich": { en: "Zurich Vault", fr: "Coffre Zurich" },
  "vault-london": { en: "London Vault", fr: "Coffre Londres" },
  "vault-dubai": { en: "Dubai Vault", fr: "Coffre Dubaï" },
};

interface PurchaseOrder {
  id: string;
  counterparty_id: string;
  counterparty_name?: string;
  status: string;
  created_by: string | null;
  estimated_weight_kg: number;
  gold_type: string;
  assay_range: string;
  incoterms: string;
  delivery_vault_id: string;
  expected_dispatch_date: string | null;
  notes: string | null;
  lbma_price_per_oz: number;
  purity_factor: number;
  premium_discount: number;
  logistics_cost: number;
  total_estimated_value: number;
  currency: string;
  price_lock_expiry: string | null;
  tracking_id: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  sent_to_counterparty_at?: string | null;
  cp_response?: string | null;
  cp_responded_at?: string | null;
  cp_comment?: string | null;
  cp_lot_reference?: string | null;
  cp_proposed_weight_kg?: number | null;
  cp_proposed_purity?: number | null;
  cp_gold_form?: string | null;
  cp_lot_availability?: string | null;
  cp_lot_available_date?: string | null;
  cp_lot_location?: string | null;
  cp_assay_certificate_url?: string | null;
  cp_assay_certificate_file_name?: string | null;
  cp_proposed_dispatch_date?: string | null;
  cp_estimated_delivery_date?: string | null;
  cp_proposed_premium?: number | null;
  tolerance_percent?: number | null;
  delivery_window_end?: string | null;
  payment_usd_cdf_split?: string | null;
  payment_timing?: string | null;
  payment_term?: string | null;
  prepayment_percent?: number | null;
  cdf_fx_basis?: string | null;
}

interface Counterparty {
  id: string;
  legalName: string;
  status: string;
  riskLevel: string | null;
  screeningStatus: string | null;
  hasLinkedUser: boolean;
}

interface ManifestDocument {
  id: string;
  doc_type: string;
  file_name: string;
  status: string;
}

interface Manifest {
  id: string;
  status: string;
  attempt_number: number;
  shipment_date: string | null;
  carrier: string | null;
  waybill_number: string | null;
  departure_location: string | null;
  destination_vault: string | null;
  incoterms: string | null;
  seal_number: string | null;
  total_bars: number | null;
  total_gross_weight_kg: number | null;
  total_fine_oz: number | null;
  po_fine_oz: number | null;
  variance_percent: number | null;
  bars_json: unknown;
  declarant_name: string | null;
  declarant_title: string | null;
  declaration_accepted_at: string | null;
  review_notes: string | null;
  reason_code: string | null;
  failed_doc_types: string[] | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  documents: ManifestDocument[];
}

const DOC_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  export_permit: { fr: "Autorisation d'exportation", en: "Export Permit" },
  assay_certificate: { fr: "Certificat d'essai", en: "Assay Certificate" },
  chain_of_custody: { fr: "Chaîne de traçabilité", en: "Chain of Custody" },
  carrier_waybill: {
    fr: "Lettre de voiture transporteur",
    en: "Carrier Waybill",
  },
  lbma_rgg: { fr: "Certificat LBMA-RGG", en: "LBMA-RGG Certificate" },
  minamata: { fr: "Déclaration Minamata", en: "Minamata Declaration" },
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const justSubmitted = searchParams.get("submitted") === "true";

  const { data: po, mutate } = useSWR<PurchaseOrder>(
    `/api/purchase-orders/${id}`,
    fetcher,
  );
  const { data: counterparty } = useSWR<Counterparty>(
    po?.counterparty_id ? `/api/counterparties/${po.counterparty_id}` : null,
    fetcher,
  );
  // Current user role — counterparty users get a "Respond to offer" CTA instead
  // of the Central Bank action buttons.
  const { data: access } = useSWR<{ id: string | null; role: string | null }>(
    "/api/access/me",
    fetcher,
  );
  const isCounterparty = access?.role === "counterparty";

  // Manifest data — loaded for all roles. For counterparty the GET returns their
  // own draft/submitted manifest; for agents/admins it returns the submitted one.
  const { data: manifest, mutate: mutateManifest } = useSWR<Manifest | null>(
    id ? `/api/purchase-orders/${id}/manifest` : null,
    fetcher,
  );

  // Traceability data — PO → Manifest → Vault Reception → Settlement
  const { data: traceData } = useSWR<{
    manifests: Array<{
      id: string; status: string; attempt_number: number;
      submitted_at: string | null; reviewed_at: string | null;
      shipment_date: string | null; carrier: string | null;
      waybill_number: string | null; total_gross_weight_kg: number | null;
      total_fine_oz: number | null; variance_percent: number | null;
      destination_vault: string | null;
    }>;
    reception: {
      id: string; po_reference: string | null; tracking_id: string | null;
      gross_weight_kg: number | null; net_weight_kg: number | null;
      au_purity: number | null; pure_gold_weight: number | null;
      vault_location: string | null; validation_status: string | null;
      created_at: string; sample_id: string | null; assay_method: string | null;
    } | null;
    settlement: {
      id: string; settlement_reference: string; status: string;
      fine_gold_weight_kg: number; total_amount: number; currency: string;
      payment_method: string | null; initiated_at: string;
      approved_at: string | null; completed_at: string | null;
    } | null;
    auditLog: Array<{
      action: string; previous_status: string | null; new_status: string | null;
      performed_by: string; performed_at: string;
    }>;
  }>(
    id ? `/api/purchase-orders/${id}/trace` : null,
    fetcher,
  );
  const hasSubmittedManifest =
    manifest?.status === "submitted" ||
    manifest?.status === "accepted" ||
    manifest?.status === "returned";
  const counterpartyManifestSubmitted =
    isCounterparty &&
    (manifest?.status === "submitted" ||
      manifest?.status === "accepted" ||
      po?.status === "manifest_validated");

  // Manifest review state
  const [reasonCode, setReasonCode] = useState("");
  const [failedDocTypesSelected, setFailedDocTypesSelected] = useState<
    string[]
  >([]);
  const [publicNotes, setPublicNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState<
    "validate" | "return" | null
  >(null);
  const [reviewResult, setReviewResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const MANIFEST_DOC_LABELS: Record<string, string> = {
    export_permit: language === "fr" ? "Permis d'exportation" : "Export Permit",
    assay_certificate:
      language === "fr" ? "Certificats d'analyse" : "Assay Certificates",
    chain_of_custody:
      language === "fr" ? "Chaîne de garde" : "Chain of Custody",
    carrier_waybill:
      language === "fr" ? "Lettre de voiture" : "Carrier Waybill",
    lbma_rgg: "LBMA RGG",
    minamata:
      language === "fr" ? "Déclaration Minamata" : "Minamata Declaration",
  };

  const handleManifestReview = async (action: "validate" | "return") => {
    if (action === "return" && !reasonCode && !publicNotes.trim()) {
      setReviewResult({
        type: "error",
        text:
          language === "fr"
            ? "Sélectionnez un motif ou saisissez une note publique."
            : "Select a reason code or enter a public note.",
      });
      return;
    }
    setReviewSubmitting(action);
    setReviewResult(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/manifest/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          publicNotes: publicNotes.trim() || null,
          internalNotes: internalNotes.trim() || null,
          reasonCode: action === "return" ? reasonCode || null : null,
          failedDocTypes: action === "return" ? failedDocTypesSelected : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      await mutateManifest();
      setReasonCode("");
      setFailedDocTypesSelected([]);
      setPublicNotes("");
      setInternalNotes("");
      setReviewResult({
        type: "success",
        text:
          action === "validate"
            ? language === "fr"
              ? "Manifeste validé avec succès."
              : "Manifest validated successfully."
            : language === "fr"
              ? `Manifeste retourné à la contrepartie.${data.isFinalAttempt ? " ⚠️ Tentative finale — escalade notifiée." : ""}`
              : `Manifest returned to counterparty.${data.isFinalAttempt ? " ⚠️ Final attempt — escalation notified." : ""}`,
      });
    } catch (e) {
      setReviewResult({
        type: "error",
        text: e instanceof Error ? e.message : "Erreur",
      });
    } finally {
      setReviewSubmitting(null);
    }
  };

  // Compliance re-check states
  const [complianceChecks, setComplianceChecks] = useState({
    counterpartyStatus: "pending" as "pending" | "passed" | "failed",
    eddComplete: "pending" as "pending" | "passed" | "failed" | "na",
    sanctionsRecheck: "pending" as "pending" | "passed" | "failed",
  });
  const [isRecheckingCompliance, setIsRecheckingCompliance] = useState(false);

  // Dual approval states
  const [approvals, setApprovals] = useState<
    { role: string; name: string; timestamp: Date; otp?: string }[]
  >([]);
  const [currentApproverOTP, setCurrentApproverOTP] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Dispatch tracking states
  const [dispatchStatus, setDispatchStatus] = useState<
    "awaiting" | "in_transit" | "received"
  >("awaiting");

  // Email sending state
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // Counterparty submission state
  const [submittingToCp, setSubmittingToCp] = useState(false);
  const [cancellingPo, setCancellingPo] = useState(false);
  const [markingShipped, setMarkingShipped] = useState(false);

  const requiresDualApproval =
    (po?.total_estimated_value || 0) > DUAL_APPROVAL_THRESHOLD;
  const approvalsNeeded = requiresDualApproval ? 2 : 1;
  const approvalsComplete = approvals.length >= approvalsNeeded;
  const allCompliancesPassed =
    complianceChecks.counterpartyStatus === "passed" &&
    (complianceChecks.eddComplete === "passed" ||
      complianceChecks.eddComplete === "na") &&
    complianceChecks.sanctionsRecheck === "passed";
  // Segregation of duties: the agent who submitted the PO cannot approve it.
  const isSelfApproval = !!(
    access?.id &&
    po?.created_by &&
    access.id === po.created_by
  );

  // Run compliance re-check
  const runComplianceRecheck = async () => {
    setIsRecheckingCompliance(true);

    // Simulate API calls with delays
    await new Promise((r) => setTimeout(r, 500));
    setComplianceChecks((prev) => ({
      ...prev,
      counterpartyStatus:
        counterparty?.status === "active" ? "passed" : "failed",
    }));

    await new Promise((r) => setTimeout(r, 500));
    const eddRequired = counterparty?.riskLevel === "high";
    setComplianceChecks((prev) => ({
      ...prev,
      eddComplete: eddRequired
        ? counterparty?.screeningStatus === "passed"
          ? "passed"
          : "failed"
        : "na",
    }));

    await new Promise((r) => setTimeout(r, 800));
    // Simulate sanctions re-check (in production, this would be a real API call)
    setComplianceChecks((prev) => ({ ...prev, sanctionsRecheck: "passed" }));

    setIsRecheckingCompliance(false);
  };

  // Auto-run compliance check when PO is loaded and in submitted status
  useEffect(() => {
    if (po?.status === "submitted" && counterparty) {
      runComplianceRecheck();
    }
  }, [po?.status, counterparty?.id]);

  // Validate PO has all required fields for approval
  const validatePOForApproval = () => {
    if (!po) return { isValid: false, missingFields: ["Purchase Order data"] };

    const missingFields: string[] = [];

    if (!po.gold_type || po.gold_type.trim() === "") {
      missingFields.push(language === "fr" ? "Type d'or" : "Gold Type");
    }
    if (!po.delivery_vault_id || po.delivery_vault_id.trim() === "") {
      missingFields.push(
        language === "fr" ? "Coffre de livraison" : "Delivery Vault",
      );
    }
    if (!po.expected_dispatch_date) {
      missingFields.push(
        language === "fr"
          ? "Début de la fenêtre de livraison souhaitée"
          : "Desired Delivery Window Start",
      );
    }
    if (!po.estimated_weight_kg || po.estimated_weight_kg <= 0) {
      missingFields.push(
        language === "fr" ? "Poids estimé" : "Estimated Weight",
      );
    }
    if (!po.assay_range || po.assay_range.trim() === "") {
      missingFields.push(language === "fr" ? "Plage d'essai" : "Assay Range");
    }
    if (!po.incoterms || po.incoterms.trim() === "") {
      missingFields.push("Incoterms");
    }
    if (!po.counterparty_id) {
      missingFields.push(language === "fr" ? "Contrepartie" : "Counterparty");
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  };

  const poValidation = validatePOForApproval();

  // Handle OTP verification only (does not submit)
  const handleVerifyOTP = () => {
    if (!currentApproverOTP || currentApproverOTP.length !== 6) {
      alert(
        language === "fr"
          ? "Veuillez entrer un OTP valide à 6 chiffres"
          : "Please enter a valid 6-digit OTP",
      );
      return;
    }
    // In a real app, this would validate the OTP against a backend service
    // For now, we just mark it as verified
    setOtpVerified(true);
  };

  const handleApprove = async () => {
    // Validate PO has all required fields
    if (!poValidation.isValid) {
      alert(
        language === "fr"
          ? `Impossible d'approuver. Champs manquants: ${poValidation.missingFields.join(", ")}`
          : `Cannot approve. Missing fields: ${poValidation.missingFields.join(", ")}`,
      );
      return;
    }

    // The approver must be different from the agent who submitted the PO.
    if (access?.id && po?.created_by && access.id === po.created_by) {
      alert(
        language === "fr"
          ? "Vous ne pouvez pas approuver un bon de commande que vous avez soumis. Un autre agent doit valider cette approbation."
          : "You cannot approve a purchase order that you submitted. Another agent must validate this approval.",
      );
      return;
    }

    // Check if OTP is verified
    if (!otpVerified) {
      alert(
        language === "fr"
          ? "Veuillez d'abord vérifier votre code OTP"
          : "Please verify your OTP code first",
      );
      return;
    }

    if (!currentApproverOTP || currentApproverOTP.length !== 6) {
      alert(
        language === "fr"
          ? "Veuillez entrer un OTP valide à 6 chiffres"
          : "Please enter a valid 6-digit OTP",
      );
      return;
    }

    const newApproval = {
      role: approvals.length === 0 ? "Trade Manager" : "Compliance Officer",
      name: approvals.length === 0 ? "Jean Dupont" : "Marie Martin",
      timestamp: new Date(),
      otp: currentApproverOTP,
    };

    // Save approval to database
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval: {
          role: newApproval.role,
          name: newApproval.name,
          decision: "approved",
          comments: approvalNotes || null,
        },
      }),
    });

    const updatedApprovals = [...approvals, newApproval];
    setApprovals(updatedApprovals);
    setCurrentApproverOTP("");
    setOtpVerified(false);

    // If all approvals complete, update PO status to approved
    if (updatedApprovals.length >= approvalsNeeded && allCompliancesPassed) {
      await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          approvedAt: new Date().toISOString(),
          trackingId: `GAC-TRK-${Date.now().toString(36).toUpperCase()}`,
        }),
      });
      mutate();
    }
  };

  const handleReject = async () => {
    // Validate rejection reason is provided
    if (!approvalNotes.trim()) {
      alert(
        language === "fr"
          ? "Veuillez fournir une raison pour le rejet"
          : "Please provide a reason for rejection",
      );
      return;
    }

    // Record rejection in approvals
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rejected",
        notes: approvalNotes,
        approval: {
          role: "Compliance Officer",
          name: "Marie Martin",
          decision: "rejected",
          comments: approvalNotes || "No reason provided",
        },
      }),
    });
    mutate();
  };

  const handleConfirmDispatch = async () => {
    setDispatchStatus("in_transit");
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_transit" }),
    });
    mutate();
  };

  // Email the purchase order PDF to the counterparty's user account email.
  const handleSendEmail = async () => {
    setSendingEmail(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/send`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSendResult({
          type: "success",
          text:
            language === "fr"
              ? `PDF envoyé à ${data.email}`
              : `PDF sent to ${data.email}`,
        });
      } else {
        setSendResult({
          type: "error",
          text:
            (language === "fr" ? "Échec de l'envoi : " : "Send failed: ") +
            (data.error || res.statusText),
        });
      }
    } catch {
      setSendResult({
        type: "error",
        text:
          language === "fr"
            ? "Échec de l'envoi de l'email."
            : "Failed to send email.",
      });
    } finally {
      setSendingEmail(false);
      // Auto-dismiss the inline feedback after a few seconds.
      setTimeout(() => setSendResult(null), 5000);
    }
  };

  // Transmit the approved purchase order to the counterparty so they can
  // accept, negotiate or decline it from their portal.
  const handleSubmitToCounterparty = async () => {
    setSubmittingToCp(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent_to_counterparty" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const meta = data._submitMeta as { email?: string; emailError?: string } | undefined;
        setSendResult({
          type: meta?.emailError ? "error" : "success",
          text: meta?.emailError
            ? language === "fr"
              ? `BC transmis. L'email n'a pas pu être envoyé (${meta.email}).`
              : `PO submitted. Email could not be delivered to ${meta.email}.`
            : language === "fr"
              ? `Bon de commande transmis à la contrepartie${meta?.email ? ` (${meta.email})` : ""}.`
              : `Purchase order submitted to the counterparty${meta?.email ? ` (${meta.email})` : ""}.`,
        });
        mutate();
      } else {
        setSendResult({
          type: "error",
          text:
            (language === "fr"
              ? "Échec de la soumission : "
              : "Submission failed: ") + (data.error || res.statusText),
        });
      }
    } catch {
      setSendResult({
        type: "error",
        text:
          language === "fr"
            ? "Échec de la soumission à la contrepartie."
            : "Failed to submit to counterparty.",
      });
    } finally {
      setSubmittingToCp(false);
      setTimeout(() => setSendResult(null), 6000);
    }
  };

  const handleMarkAsShipped = async () => {
    setMarkingShipped(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_transit" }),
      });
      if (res.ok) {
        mutate();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || (isFr ? "Erreur lors de la mise à jour." : "Update failed."));
      }
    } finally {
      setMarkingShipped(false);
    }
  };

  const handleCancelTransmittedOrder = async () => {
    const confirmed = window.confirm(
      language === "fr"
        ? "Annuler ce bon de commande transmis à la contrepartie ?"
        : "Cancel this purchase order sent to the counterparty?",
    );

    if (!confirmed) {
      return;
    }

    setCancellingPo(true);
    setSendResult(null);

    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          notes:
            language === "fr"
              ? "Annulé par l'agent avant acceptation de la contrepartie"
              : "Cancelled by agent before counterparty acceptance",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSendResult({
          type: "success",
          text:
            language === "fr"
              ? "Bon de commande annulé."
              : "Purchase order cancelled.",
        });
        mutate();
      } else {
        setSendResult({
          type: "error",
          text:
            (language === "fr"
              ? "Échec de l'annulation : "
              : "Cancellation failed: ") + (data.error || res.statusText),
        });
      }
    } catch {
      setSendResult({
        type: "error",
        text:
          language === "fr"
            ? "Échec de l'annulation du bon de commande."
            : "Failed to cancel purchase order.",
      });
    } finally {
      setCancellingPo(false);
      setTimeout(() => setSendResult(null), 5000);
    }
  };

  if (!po) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const statusConfig: Record<
    string,
    { label: string; className: string; icon: typeof Clock }
  > = {
    draft: {
      label: language === "fr" ? "Brouillon" : "Draft",
      className: "border-muted-foreground text-muted-foreground",
      icon: FileText,
    },
    submitted: {
      label: language === "fr" ? "Soumis" : "Submitted",
      className: "border-warning text-warning",
      icon: Clock,
    },
    approved: {
      label: language === "fr" ? "Approuvé" : "Approved",
      className: "border-success text-success",
      icon: CheckCircle2,
    },
    rejected: {
      label: language === "fr" ? "Rejeté" : "Rejected",
      className: "border-destructive text-destructive",
      icon: XCircle,
    },
    in_transit: {
      label: language === "fr" ? "En Transit" : "In Transit",
      className: "border-info text-info",
      icon: Truck,
    },
    received: {
      label: language === "fr" ? "Reçu" : "Received",
      className: "border-success text-success",
      icon: CheckCircle2,
    },
    sent_to_counterparty: {
      label:
        language === "fr"
          ? "Transmis à la contrepartie"
          : "Sent to Counterparty",
      className: "border-info text-info",
      icon: Send,
    },
    accepted: {
      label: language === "fr" ? "Accepté" : "Accepted",
      className: "border-success text-success",
      icon: CheckCircle2,
    },
    negotiating: {
      label: language === "fr" ? "En négociation" : "Negotiating",
      className: "border-warning text-warning",
      icon: RefreshCw,
    },
    declined: {
      label: language === "fr" ? "Décliné" : "Declined",
      className: "border-destructive text-destructive",
      icon: XCircle,
    },
    cancelled: {
      label: language === "fr" ? "Annulé" : "Cancelled",
      className: "border-destructive text-destructive",
      icon: XCircle,
    },
    manifest_validated: {
      label: language === "fr" ? "Manifeste validé" : "Manifest Validated",
      className: "border-violet-500 text-violet-600",
      icon: CheckCircle2,
    },
  };

  const currentStatus = statusConfig[po.status] || statusConfig.draft;
  const canRespondToOffer = [
    "approved",
    "sent_to_counterparty",
    "negotiating",
  ].includes(po.status);
  const canCancelTransmittedOrder =
    !isCounterparty &&
    po.status === "sent_to_counterparty" &&
    po.cp_response !== "accept";

  // ── Manifest phase tracker ────────────────────────────────────────────────
  type ManifestStage = {
    label: string;
    sub?: string;
    Icon: typeof Clock;
    cardStyle: string;
    iconColor: string;
    labelColor: string;
  };
  const isFr = language === "fr";
  const ms =
    po.status === "in_transit"
      ? "in_transit_stage"
      : po.status === "manifest_validated"
        ? manifest?.status || "accepted"
        : po.status === "accepted"
          ? (manifest?.status ?? (manifest === null ? "none" : "loading"))
          : null;

  const manifestStages: ManifestStage[] | null =
    ms === null || ms === "loading"
      ? null
      : ms === "in_transit_stage"
        ? [
            {
              label: isFr ? "Manifeste soumis" : "Manifest submitted",
              Icon: CheckCircle2,
              cardStyle: "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700",
            },
            {
              label: isFr ? "Révision BCC" : "BCC review",
              Icon: CheckCircle2,
              cardStyle: "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700",
            },
            {
              label: isFr ? "Entrée coffre autorisée" : "Vault entry authorized",
              sub: manifest?.reviewed_at
                ? new Date(manifest.reviewed_at).toLocaleDateString(isFr ? "fr-FR" : "en-US")
                : undefined,
              Icon: CheckCircle2,
              cardStyle: "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700",
            },
            {
              label: isFr ? "Or en transit" : "Gold in transit",
              sub: isFr ? "Expédié par la contrepartie" : "Shipped by counterparty",
              Icon: Truck,
              cardStyle: "border-blue-500 bg-blue-500/10 dark:bg-blue-950/30 shadow-sm",
              iconColor: "text-blue-600",
              labelColor: "text-blue-700 font-semibold",
            },
          ]
        : ms === "accepted"
        ? [
            {
              label: isFr ? "Manifeste soumis" : "Manifest submitted",
              Icon: CheckCircle2,
              cardStyle:
                "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700",
            },
            {
              label: isFr ? "Révision BCC" : "BCC review",
              Icon: CheckCircle2,
              cardStyle:
                "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700",
            },
            {
              label: isFr
                ? "Entrée coffre autorisée"
                : "Vault entry authorized",
              sub: manifest?.reviewed_at
                ? new Date(manifest.reviewed_at).toLocaleDateString(
                    isFr ? "fr-FR" : "en-US",
                  )
                : undefined,
              Icon: CheckCircle2,
              cardStyle:
                "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30",
              iconColor: "text-emerald-600",
              labelColor: "text-emerald-700 font-semibold",
            },
          ]
        : ms === "submitted"
          ? [
              {
                label: isFr ? "Manifeste soumis" : "Manifest submitted",
                sub: manifest?.submitted_at
                  ? new Date(manifest.submitted_at).toLocaleDateString(
                      isFr ? "fr-FR" : "en-US",
                    )
                  : undefined,
                Icon: CheckCircle2,
                cardStyle:
                  "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20",
                iconColor: "text-emerald-600",
                labelColor: "text-emerald-700",
              },
              {
                label: isFr ? "Examen en cours" : "Under review",
                sub: isFr ? "Décision BCC en attente" : "BCC decision pending",
                Icon: Clock,
                cardStyle:
                  "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm",
                iconColor: "text-amber-600",
                labelColor: "text-amber-700 font-semibold",
              },
              {
                label: isFr ? "Entrée coffre" : "Vault entry",
                Icon: Lock,
                cardStyle: "border-border bg-muted/30",
                iconColor: "text-muted-foreground",
                labelColor: "text-muted-foreground",
              },
            ]
          : ms === "returned"
            ? [
                {
                  label: isFr
                    ? "Resoumission requise"
                    : "Resubmission required",
                  sub: isFr ? "Retourné par la BCC" : "Returned by BCC",
                  Icon: AlertTriangle,
                  cardStyle:
                    "border-destructive/50 bg-destructive/5 dark:bg-destructive/10 shadow-sm",
                  iconColor: "text-destructive",
                  labelColor: "text-destructive font-semibold",
                },
                {
                  label: isFr ? "Révision BCC" : "BCC review",
                  Icon: Clock,
                  cardStyle: "border-border bg-muted/30",
                  iconColor: "text-muted-foreground",
                  labelColor: "text-muted-foreground",
                },
                {
                  label: isFr ? "Entrée coffre" : "Vault entry",
                  Icon: Lock,
                  cardStyle: "border-border bg-muted/30",
                  iconColor: "text-muted-foreground",
                  labelColor: "text-muted-foreground",
                },
              ]
            : /* none / draft */ [
                {
                  label: isFr ? "En attente du manifeste" : "Awaiting manifest",
                  sub: isCounterparty
                    ? isFr
                      ? "Soumettez votre manifeste"
                      : "Submit your manifest"
                    : isFr
                      ? "Attente de la contrepartie"
                      : "Awaiting counterparty",
                  Icon: Clock,
                  cardStyle:
                    "border-blue-400/70 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm",
                  iconColor: "text-blue-600",
                  labelColor: "text-blue-700 font-semibold",
                },
                {
                  label: isFr ? "Révision BCC" : "BCC review",
                  Icon: Clock,
                  cardStyle: "border-border bg-muted/30",
                  iconColor: "text-muted-foreground",
                  labelColor: "text-muted-foreground",
                },
                {
                  label: isFr ? "Entrée coffre" : "Vault entry",
                  Icon: Lock,
                  cardStyle: "border-border bg-muted/30",
                  iconColor: "text-muted-foreground",
                  labelColor: "text-muted-foreground",
                },
              ];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={po.tracking_id ?? po.id}
            subtitle={counterparty?.legalName || ""}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
              {/* Back button */}
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "fr" ? "Retour" : "Back"}
              </Button>

              {/* Manifest submitted banner */}
              {searchParams.get("manifest") === "submitted" && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <AlertTitle className="text-emerald-700">
                    {language === "fr"
                      ? "Manifeste soumis avec succès"
                      : "Manifest submitted successfully"}
                  </AlertTitle>
                  <AlertDescription className="text-emerald-700/80">
                    {language === "fr"
                      ? "Votre manifeste d'expédition a été transmis à la Banque Centrale pour examen."
                      : "Your shipping manifest has been sent to the Central Bank for review."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Banner for just submitted */}
              {justSubmitted && (
                <Alert className="border-success bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <AlertTitle className="text-success">
                    {language === "fr"
                      ? "Bon de Commande Soumis"
                      : "Purchase Order Submitted"}
                  </AlertTitle>
                  <AlertDescription>
                    {language === "fr"
                      ? "Votre bon de commande a été soumis avec succès. Vérification de conformité en cours..."
                      : "Your purchase order has been successfully submitted. Compliance verification in progress..."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Approved Success Banner - Screen 4 */}
              {po.status === "approved" && (
                <div className="relative w-full rounded-lg border border-emerald-900/40 bg-gradient-to-r from-emerald-950 to-emerald-900 p-6 overflow-hidden">
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
                  </div>
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-900/50">
                      <CheckCircle2 className="h-7 w-7 text-emerald-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-emerald-300 text-xl">
                        {po.tracking_id ?? po.id}{" "}
                        {language === "fr" ? "Confirmé" : "Confirmed"}
                      </h3>
                      <p className="mt-1 text-sm text-emerald-50/80">
                        {language === "fr"
                          ? "Bon de commande approuvé et prêt pour l'expédition"
                          : "Purchase order approved and ready for dispatch"}
                      </p>
                      {po.tracking_id && (
                        <div className="mt-4 flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-emerald-400 text-emerald-300 text-lg px-4 py-1"
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            {po.tracking_id}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-300 hover:text-emerald-200"
                            onClick={() =>
                              navigator.clipboard.writeText(
                                po.tracking_id || "",
                              )
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Awaiting counterparty response */}
              {po.status === "sent_to_counterparty" && (
                <Alert className="border-info bg-info/10">
                  <Send className="h-5 w-5 text-info" />
                  <AlertTitle className="text-info">
                    {language === "fr"
                      ? "Transmis à la contrepartie"
                      : "Sent to Counterparty"}
                  </AlertTitle>
                  <AlertDescription>
                    {language === "fr"
                      ? "Le bon de commande a été transmis à la contrepartie. En attente de sa réponse (acceptation, négociation ou refus)."
                      : "The purchase order was sent to the counterparty. Awaiting their response (accept, negotiate or decline)."}
                    {po.sent_to_counterparty_at && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        {language === "fr" ? "Envoyé le" : "Sent on"}{" "}
                        {new Date(po.sent_to_counterparty_at).toLocaleString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Counterparty has responded */}
              {(po.status === "accepted" ||
                po.status === "negotiating" ||
                po.status === "declined") && (
                <Alert
                  className={
                    po.status === "accepted"
                      ? "border-success bg-success/10"
                      : po.status === "declined"
                        ? "border-destructive bg-destructive/10"
                        : "border-warning bg-warning/10"
                  }
                >
                  {po.status === "accepted" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : po.status === "declined" ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <RefreshCw className="h-5 w-5 text-warning" />
                  )}
                  <AlertTitle
                    className={
                      po.status === "accepted"
                        ? "text-success"
                        : po.status === "declined"
                          ? "text-destructive"
                          : "text-warning"
                    }
                  >
                    {po.status === "accepted"
                      ? language === "fr"
                        ? "Offre acceptée par la contrepartie"
                        : "Offer accepted by counterparty"
                      : po.status === "declined"
                        ? language === "fr"
                          ? "Offre déclinée par la contrepartie"
                          : "Offer declined by counterparty"
                        : language === "fr"
                          ? "Contre-proposition de la contrepartie"
                          : "Counter-proposal from counterparty"}
                  </AlertTitle>
                  <AlertDescription className="space-y-3">
                    {po.cp_responded_at && (
                      <span className="block text-xs text-muted-foreground">
                        {language === "fr" ? "Répondu le" : "Responded on"}{" "}
                        {new Date(po.cp_responded_at).toLocaleString()}
                      </span>
                    )}

                    {/* Negotiation detail cards — only for "negotiating" status */}
                    {po.status === "negotiating" && (
                      <div className="mt-3 space-y-3">
                        {/* Lot proposé */}
                        {(po.cp_lot_reference ||
                          po.cp_proposed_weight_kg != null ||
                          po.cp_proposed_purity != null ||
                          po.cp_gold_form ||
                          po.cp_lot_availability ||
                          po.cp_lot_available_date ||
                          po.cp_lot_location ||
                          po.cp_assay_certificate_url) && (
                          <div className="rounded-md border border-warning/30 bg-background/60 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-warning mb-2">
                              {language === "fr" ? "Lot proposé" : "Proposed lot"}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                              {po.cp_lot_reference && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Référence du lot" : "Lot reference"}
                                  </span>
                                  <span className="font-medium">{po.cp_lot_reference}</span>
                                </>
                              )}
                              {po.cp_proposed_weight_kg != null && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Quantité proposée" : "Proposed weight"}
                                  </span>
                                  <span className="font-medium">
                                    {Number(po.cp_proposed_weight_kg).toLocaleString(isFr ? "fr-FR" : "en-US", { maximumFractionDigits: 3 })} kg
                                  </span>
                                </>
                              )}
                              {po.cp_proposed_purity != null && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Pureté estimée" : "Estimated purity"}
                                  </span>
                                  <span className="font-medium">
                                    {Number(po.cp_proposed_purity).toLocaleString(isFr ? "fr-FR" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %
                                  </span>
                                </>
                              )}
                              {po.cp_gold_form && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Forme de l'or" : "Gold form"}
                                  </span>
                                  <span className="font-medium">
                                    {({ dore_bars: isFr ? "Doré" : "Doré Bars", refined_bars: isFr ? "Lingots Raffinés" : "Refined Bars", gold_dust: isFr ? "Poudre d'Or" : "Gold Dust", scrap_gold: isFr ? "Or de Récupération" : "Scrap Gold" } as Record<string, string>)[po.cp_gold_form] ?? po.cp_gold_form}
                                  </span>
                                </>
                              )}
                              {po.cp_lot_availability && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Disponibilité" : "Availability"}
                                  </span>
                                  <span className="font-medium">
                                    {({ confirmed: isFr ? "Confirmée" : "Confirmed", partial: isFr ? "Partielle" : "Partial", pending: isFr ? "En attente" : "Pending", on_request: isFr ? "Sur demande" : "On request" } as Record<string, string>)[po.cp_lot_availability] ?? po.cp_lot_availability}
                                  </span>
                                </>
                              )}
                              {po.cp_lot_available_date && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Date de disponibilité" : "Available date"}
                                  </span>
                                  <span className="font-medium">
                                    {new Date(po.cp_lot_available_date).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
                                  </span>
                                </>
                              )}
                              {po.cp_lot_location && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Localisation" : "Location"}
                                  </span>
                                  <span className="font-medium">{po.cp_lot_location}</span>
                                </>
                              )}
                              {po.cp_assay_certificate_url && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Certificat d'assay" : "Assay certificate"}
                                  </span>
                                  <a
                                    href={po.cp_assay_certificate_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline underline-offset-2"
                                  >
                                    {po.cp_assay_certificate_file_name ?? (isFr ? "Voir le fichier" : "View file")}
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Livraison et conditions */}
                        {(po.cp_proposed_dispatch_date ||
                          po.cp_estimated_delivery_date ||
                          po.cp_proposed_premium != null) && (
                          <div className="rounded-md border border-warning/30 bg-background/60 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-warning mb-2">
                              {isFr ? "Livraison et conditions" : "Delivery & terms"}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                              {po.cp_proposed_dispatch_date && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Date d'expédition proposée" : "Proposed dispatch date"}
                                  </span>
                                  <span className="font-medium">
                                    {new Date(po.cp_proposed_dispatch_date).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
                                  </span>
                                </>
                              )}
                              {po.cp_estimated_delivery_date && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Date de livraison estimée" : "Estimated delivery date"}
                                  </span>
                                  <span className="font-medium">
                                    {new Date(po.cp_estimated_delivery_date).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
                                  </span>
                                </>
                              )}
                              {po.cp_proposed_premium != null && (
                                <>
                                  <span className="text-muted-foreground">
                                    {isFr ? "Prime proposée" : "Proposed premium"}
                                  </span>
                                  <span className="font-medium">
                                    {Number(po.cp_proposed_premium) > 0 ? "+" : ""}
                                    {Number(po.cp_proposed_premium).toLocaleString(isFr ? "fr-FR" : "en-US", { maximumFractionDigits: 2 })} %
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Commentaire */}
                        {po.cp_comment && (
                          <div className="rounded-md border border-warning/30 bg-background/60 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-warning mb-1.5">
                              {language === "fr" ? "Commentaire" : "Comment"}
                            </p>
                            <p className="text-sm">{po.cp_comment}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* For accepted/declined: just show the comment */}
                    {po.status !== "negotiating" && po.cp_comment && (
                      <span className="block">{po.cp_comment}</span>
                    )}
                    {po.status !== "negotiating" && !po.cp_comment && (
                      <span className="block">
                        {language === "fr"
                          ? "La contrepartie a soumis sa réponse."
                          : "The counterparty submitted their response."}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Header with Status */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold">
                      {po.tracking_id ?? po.id}
                    </h1>
                    <Badge
                      variant="outline"
                      className={currentStatus.className}
                    >
                      <currentStatus.icon className="mr-1 h-3 w-3" />
                      {currentStatus.label}
                    </Badge>
                    {requiresDualApproval && (
                      <Badge
                        variant="secondary"
                        className="hidden sm:inline-flex"
                      >
                        <Users className="mr-1 h-3 w-3" />
                        {language === "fr"
                          ? "Double Approbation"
                          : "Dual Approval"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "fr" ? "Créé le" : "Created"}{" "}
                    {new Date(po.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      generatePurchaseOrderPDF(
                        {
                          reference: po.tracking_id ?? po.id,
                          counterpartyName:
                            counterparty?.legalName ||
                            po.counterparty_name ||
                            "Unknown",
                          status: po.status,
                          estimatedWeight: Number(po.estimated_weight_kg) || 0,
                          purityFactor: Number(po.purity_factor) || 0.88,
                          totalValue: Number(po.total_estimated_value) || 0,
                          currency: po.currency || "USD",
                          incoterms: po.incoterms,
                          deliveryVault: po.delivery_vault_id,
                          createdAt: po.created_at,
                        },
                        {
                          title:
                            language === "fr"
                              ? "Ordre d'Achat"
                              : "Purchase Order",
                          filename: `${po.tracking_id ?? po.id}.pdf`,
                        },
                      );
                    }}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "Imprimer PDF" : "Print PDF"}
                    </span>
                  </Button>
                  {po.status !== "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {sendingEmail
                          ? language === "fr"
                            ? "Envoi..."
                            : "Sending..."
                          : language === "fr"
                            ? "Envoyer"
                            : "Send"}
                      </span>
                    </Button>
                  )}
                  {!isCounterparty &&
                    po.status !== "draft" &&
                    po.status !== "manifest_validated" &&
                    po.status !== "in_transit" &&
                    (() => {
                      const noUser =
                        counterparty !== undefined &&
                        counterparty?.hasLinkedUser === false;
                      const canSubmitToCp =
                        po.status === "approved" ||
                        po.status === "negotiating" ||
                        po.status === "sent_to_counterparty";
                      const isDisabled = submittingToCp || !canSubmitToCp || noUser;
                      return (
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={handleSubmitToCounterparty}
                          disabled={isDisabled}
                          title={
                            noUser
                              ? language === "fr"
                                ? "Aucun utilisateur contrepartie trouvé"
                                : "No counterparty user found"
                              : undefined
                          }
                        >
                          {submittingToCp ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : noUser ? (
                            <AlertTriangle className="mr-2 h-4 w-4" />
                          ) : (
                            <Building2 className="mr-2 h-4 w-4" />
                          )}
                          <span>
                            {submittingToCp
                              ? language === "fr"
                                ? "Soumission..."
                                : "Submitting..."
                              : noUser
                                ? language === "fr"
                                  ? "Aucun utilisateur trouvé"
                                  : "No user found"
                                : po.status === "sent_to_counterparty"
                                  ? language === "fr"
                                    ? "Renvoyer à la contrepartie"
                                    : "Resend to Counterparty"
                                  : language === "fr"
                                    ? "Soumettre à la contrepartie"
                                    : "Submit to Counterparty"}
                          </span>
                        </Button>
                      );
                    })()}
                  {canCancelTransmittedOrder && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={handleCancelTransmittedOrder}
                      disabled={cancellingPo}
                    >
                      {cancellingPo ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      <span>
                        {cancellingPo
                          ? language === "fr"
                            ? "Annulation..."
                            : "Cancelling..."
                          : language === "fr"
                            ? "Annuler le BC"
                            : "Cancel PO"}
                      </span>
                    </Button>
                  )}
                  {isCounterparty &&
                    [
                      "approved",
                      "sent_to_counterparty",
                      "negotiating",
                    ].includes(po.status) &&
                    (canRespondToOffer ? (
                      <Link
                        href={`/purchase-orders/${id}/respond`}
                        className="flex-1 sm:flex-none"
                      >
                        <Button size="sm" className="w-full">
                          <Send className="mr-2 h-4 w-4" />
                          <span>
                            {language === "fr"
                              ? "Répondre à l'offre"
                              : "Respond to Offer"}
                          </span>
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-none"
                        disabled
                      >
                        <Send className="mr-2 h-4 w-4" />
                        <span>
                          {language === "fr"
                            ? "Répondre à l'offre"
                            : "Respond to Offer"}
                        </span>
                      </Button>
                    ))}
                  {isCounterparty &&
                    ["accepted", "manifest_validated", "in_transit"].includes(po.status) &&
                    (counterpartyManifestSubmitted ? (
                      <>
                        {/* Manifest status pill */}
                        <Button
                          size="sm"
                          className={`flex-1 sm:flex-none ${
                            po.status === "manifest_validated" || po.status === "in_transit"
                              ? "border-emerald-500/50 text-emerald-500"
                              : ""
                          }`}
                          variant="outline"
                          disabled
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                          <span>
                            {po.status === "in_transit"
                              ? (isFr ? "Or expédié" : "Gold shipped")
                              : po.status === "manifest_validated"
                                ? (isFr ? "Manifeste validé par la BCC" : "Manifest validated by BCC")
                                : (isFr ? "Manifeste soumis — en révision" : "Manifest submitted — under review")}
                          </span>
                        </Button>

                        {/* Ship button — only when manifest validated and not yet shipped */}
                        {po.status === "manifest_validated" && (
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleMarkAsShipped}
                            disabled={markingShipped}
                          >
                            {markingShipped
                              ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              : <Truck className="mr-2 h-4 w-4" />}
                            <span>
                              {markingShipped
                                ? (isFr ? "Enregistrement..." : "Saving...")
                                : (isFr ? "Marquer l'or comme expédié" : "Mark gold as shipped")}
                            </span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <Link
                        href={`/purchase-orders/${id}/manifest`}
                        className="flex-1 sm:flex-none"
                      >
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <span>
                            {isFr ? "Soumettre le manifeste" : "Submit Manifest"}
                          </span>
                        </Button>
                      </Link>
                    ))}
                  {!isCounterparty && po.status === "negotiating" && (
                    <Link
                      href={`/purchase-orders/${id}/edit`}
                      className="flex-1 sm:flex-none"
                    >
                      <Button size="sm" className="w-full">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        <span>
                          {language === "fr"
                            ? "Modifier et re-soumettre"
                            : "Modify & Resubmit"}
                        </span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {sendResult && (
                <div
                  role="status"
                  className={`rounded-md border px-4 py-2 text-sm ${
                    sendResult.type === "success"
                      ? "border-green-600/30 bg-green-600/10 text-green-600"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {sendResult.text}
                </div>
              )}

              {/* ── Manifest Phase Tracker ────────────────────────────────── */}
              {manifestStages && (
                <div className="rounded-xl border bg-card px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    {isFr
                      ? "Phase — manifeste d'expédition"
                      : "Phase — shipping manifest"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {manifestStages.map((stage, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-3 flex flex-col items-center text-center transition-colors ${stage.cardStyle}`}
                      >
                        <stage.Icon
                          className={`h-5 w-5 mb-1.5 ${stage.iconColor}`}
                        />
                        <p
                          className={`text-xs leading-tight ${stage.labelColor}`}
                        >
                          {stage.label}
                        </p>
                        {stage.sub && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                            {stage.sub}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Tabs
                defaultValue={
                  hasSubmittedManifest && !isCounterparty
                    ? "manifest"
                    : po.status === "approved" && !isCounterparty
                      ? "tracking"
                      : "details"
                }
                className="space-y-6"
              >
                <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                  <TabsTrigger value="details" className="text-xs sm:text-sm">
                    <FileText className="mr-1 sm:mr-2 h-4 w-4" />
                    {language === "fr" ? "Détails" : "Details"}
                  </TabsTrigger>
                  {po.status === "submitted" && !isCounterparty && (
                    <TabsTrigger
                      value="approval"
                      className="text-xs sm:text-sm"
                    >
                      <Shield className="mr-1 sm:mr-2 h-4 w-4" />
                      {language === "fr" ? "Approbation" : "Approval"}
                    </TabsTrigger>
                  )}
                  {(po.status === "approved" || po.status === "in_transit") &&
                    !isCounterparty && (
                      <TabsTrigger
                        value="tracking"
                        className="text-xs sm:text-sm"
                      >
                        <Truck className="mr-1 sm:mr-2 h-4 w-4" />
                        {language === "fr" ? "Suivi" : "Tracking"}
                      </TabsTrigger>
                    )}
                  {hasSubmittedManifest && (!isCounterparty || counterpartyManifestSubmitted) && (
                    <TabsTrigger
                      value="manifest"
                      className="text-xs sm:text-sm"
                    >
                      <Package className="mr-1 sm:mr-2 h-4 w-4" />
                      {language === "fr" ? "Manifeste" : "Manifest"}
                    </TabsTrigger>
                  )}
                  {!isCounterparty && (
                    <TabsTrigger value="trace" className="text-xs sm:text-sm">
                      <GitMerge className="mr-1 sm:mr-2 h-4 w-4" />
                      {language === "fr" ? "Traçabilité" : "Traceability"}
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 sm:space-y-6">
                  {(() => {
                    const locale = language === "fr" ? "fr-FR" : "en-US";
                    const weightKg = Number(po.estimated_weight_kg || 0);
                    const purityFactor = Number(po.purity_factor || 0.88);
                    const fineWeightKg = weightKg * purityFactor;
                    const fineWeightOz = (fineWeightKg * 1000) / OZ_TO_GRAM;
                    const num = (n: number, d = 2) =>
                      Number(n || 0).toLocaleString(locale, {
                        minimumFractionDigits: d,
                        maximumFractionDigits: d,
                      });
                    const goldTypeLabel =
                      GOLD_TYPE_LABELS[po.gold_type]?.[
                        language === "fr" ? "fr" : "en"
                      ] ?? po.gold_type?.replace(/_/g, " ");
                    const vaultLabel =
                      VAULT_LABELS[po.delivery_vault_id]?.[
                        language === "fr" ? "fr" : "en"
                      ] ?? po.delivery_vault_id;

                    return (
                      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                        {/* Main column */}
                        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                          {/* Internal reference */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                {language === "fr"
                                  ? "Référence interne"
                                  : "Internal Reference"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(4,auto)_1fr]">
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "N° de demande"
                                      : "Request No."
                                  }
                                  value={po.tracking_id ?? po.id}
                                  mono
                                />
                                <RefField
                                  label={
                                    language === "fr" ? "Créée le" : "Created"
                                  }
                                  value={new Date(
                                    po.created_at,
                                  ).toLocaleDateString(locale)}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Desk initiateur"
                                      : "Initiating Desk"
                                  }
                                  value="Bullion Desk"
                                />
                                <RefField
                                  label={
                                    language === "fr" ? "Suivi" : "Tracking"
                                  }
                                  value={po.tracking_id || "—"}
                                  mono
                                />
                                <div className="space-y-1 min-w-0">
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? "Statut" : "Status"}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={`${currentStatus.className} whitespace-normal h-auto inline-flex gap-1`}
                                  >
                                    <currentStatus.icon className="h-3 w-3 shrink-0 mt-0.5" />
                                    {currentStatus.label}
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
                                {language === "fr"
                                  ? "Contrepartie"
                                  : "Counterparty"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {counterparty?.riskLevel && (
                                  <Badge
                                    variant={
                                      counterparty.riskLevel === "high"
                                        ? "destructive"
                                        : counterparty.riskLevel === "medium"
                                          ? "secondary"
                                          : "outline"
                                    }
                                  >
                                    {counterparty.riskLevel} risk
                                  </Badge>
                                )}
                                <Badge
                                  className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  variant="outline"
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  {language === "fr" ? "Approuvée" : "Approved"}
                                </Badge>
                                <Badge
                                  className="border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                  variant="outline"
                                >
                                  <ShieldCheck className="mr-1 h-3 w-3" />
                                  {language === "fr"
                                    ? "KYC valide"
                                    : "KYC valid"}
                                </Badge>
                              </div>
                              <div className="rounded-lg border bg-muted/40 p-4">
                                <p className="font-medium">
                                  {counterparty?.legalName ||
                                    po.counterparty_name ||
                                    "—"}
                                </p>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {counterparty?.status || "—"}
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Gold details */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Scale className="h-5 w-5 text-muted-foreground" />
                                {language === "fr"
                                  ? "Détails de l'Or"
                                  : "Gold Details"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Quantité cible"
                                      : "Target Quantity"
                                  }
                                  value={`${num(weightKg, 3)} kg`}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Type d'Or"
                                      : "Gold Type"
                                  }
                                  value={goldTypeLabel}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Plage de pureté"
                                      : "Assay Range"
                                  }
                                  value={
                                    po.assay_range ? `${po.assay_range} %` : "—"
                                  }
                                />
                                <RefField
                                  label="Incoterm"
                                  value={po.incoterms || "—"}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Pureté centrale"
                                      : "Central Purity"
                                  }
                                  value={`${num(purityFactor * 100, 2)} %`}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Poids d'or fin estimé"
                                      : "Estimated Fine Gold"
                                  }
                                  value={`${num(fineWeightKg, 3)} kg`}
                                />
                              </div>
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
                              <div className="grid grid-cols-2 gap-4">
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Coffre de destination"
                                      : "Destination Vault"
                                  }
                                  value={vaultLabel || "—"}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Fenêtre de livraison souhaitée"
                                      : "Desired Delivery Window"
                                  }
                                  value={
                                    po.expected_dispatch_date
                                      ? `${new Date(po.expected_dispatch_date).toLocaleDateString(locale)}${
                                          po.delivery_window_end
                                            ? ` – ${new Date(po.delivery_window_end).toLocaleDateString(locale)}`
                                            : ""
                                        }`
                                      : "—"
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  {language === "fr" ? "Notes" : "Notes"}
                                </p>
                                <p className="text-sm">
                                  {po.notes ||
                                    (language === "fr"
                                      ? "Aucune note"
                                      : "No notes")}
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Payment terms */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <DollarSign className="h-5 w-5 text-muted-foreground" />
                                {language === "fr"
                                  ? "Conditions de paiement souhaitées"
                                  : "Desired Payment Terms"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className={`grid gap-4 ${po.currency === "Mixte" ? "grid-cols-3" : "grid-cols-2"}`}>
                                <RefField
                                  label={
                                    language === "fr" ? "Devise" : "Currency"
                                  }
                                  value={po.currency || "—"}
                                />
                                {po.currency === "Mixte" && (
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Répartition USD / CDF"
                                      : "USD / CDF Split"
                                  }
                                  value={po.payment_usd_cdf_split || "—"}
                                />
                                )}
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Moment du paiement"
                                      : "Payment Timing"
                                  }
                                  value={
                                    po.payment_timing === "after_delivery"
                                      ? language === "fr"
                                        ? "Après livraison"
                                        : "After delivery"
                                      : po.payment_timing === "on_delivery"
                                        ? language === "fr"
                                          ? "À la livraison"
                                          : "On delivery"
                                        : po.payment_timing ===
                                            "before_delivery"
                                          ? language === "fr"
                                            ? "Avant livraison"
                                            : "Before delivery"
                                          : po.payment_timing || "—"
                                  }
                                />
                              </div>
                              <div className={`grid gap-4 ${(po.currency === "Mixte" || po.currency === "CDF") ? "grid-cols-3" : "grid-cols-2"}`}>
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Délai de paiement"
                                      : "Payment Term"
                                  }
                                  value={po.payment_term || "—"}
                                />
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Prépaiement"
                                      : "Prepayment"
                                  }
                                  value={
                                    po.prepayment_percent != null
                                      ? `${num(Number(po.prepayment_percent), 0)} %`
                                      : "—"
                                  }
                                />
                                {(po.currency === "Mixte" || po.currency === "CDF") && (
                                <RefField
                                  label={
                                    language === "fr"
                                      ? "Taux de change part CDF"
                                      : "CDF FX Basis"
                                  }
                                  value={
                                    po.cdf_fx_basis === "bcc_payment_date"
                                      ? language === "fr"
                                        ? "Cours BCC à la date de paiement"
                                        : "BCC rate at payment date"
                                      : po.cdf_fx_basis || "—"
                                  }
                                />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Valuation panel */}
                        <div className="space-y-6">
                          <Card className="sticky top-6">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <DollarSign className="h-5 w-5 text-muted-foreground" />
                                {language === "fr"
                                  ? "Estimation indicative"
                                  : "Indicative Estimate"}
                              </CardTitle>
                              <CardDescription>
                                {language === "fr"
                                  ? "Références de marché et valorisation"
                                  : "Market references and valuation"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex items-center justify-between rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    LBMA Gold
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                  {num(Number(po.lbma_price_per_oz || 0), 2)}{" "}
                                  USD/oz
                                </span>
                              </div>

                              <div className="space-y-2 text-sm">
                                <MetricRow
                                  label={
                                    language === "fr"
                                      ? "Quantité cible"
                                      : "Target Quantity"
                                  }
                                  value={`${num(weightKg, 3)} kg`}
                                />
                                <MetricRow
                                  label={
                                    language === "fr"
                                      ? "Pureté centrale utilisée"
                                      : "Central Purity Used"
                                  }
                                  value={`${num(purityFactor * 100, 2)} %`}
                                />
                                <MetricRow
                                  label={
                                    language === "fr"
                                      ? "Poids d'or fin estimé"
                                      : "Estimated Fine Gold Weight"
                                  }
                                  value={`${num(fineWeightKg, 3)} kg · ${num(fineWeightOz, 2)} oz`}
                                />
                                <MetricRow
                                  label={
                                    language === "fr"
                                      ? "Prime / remise"
                                      : "Premium / Discount"
                                  }
                                  value={num(
                                    Number(po.premium_discount || 0),
                                    2,
                                  )}
                                />
                                <MetricRow
                                  label={
                                    language === "fr"
                                      ? "Coût logistique"
                                      : "Logistics Cost"
                                  }
                                  value={num(Number(po.logistics_cost || 0), 0)}
                                />
                              </div>

                              <Separator />

                              <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 p-4 text-center">
                                <span className="text-sm text-muted-foreground">
                                  {language === "fr"
                                    ? "Montant total estimé"
                                    : "Total Estimated Amount"}
                                </span>
                                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                  {num(
                                    Number(po.total_estimated_value || 0),
                                    0,
                                  )}{" "}
                                  {po.currency || "USD"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* Approval Tab - Screen 3 */}
                {po.status === "submitted" && !isCounterparty && (
                  <TabsContent value="approval" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Compliance Validation Checklist */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            {language === "fr"
                              ? "Vérification de Conformité"
                              : "Compliance Validation"}
                          </CardTitle>
                          <CardDescription>
                            {language === "fr"
                              ? "Re-vérification automatique des sanctions avant soumission"
                              : "Automatic sanctions re-check before submission"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Counterparty Status */}
                          <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              {complianceChecks.counterpartyStatus ===
                                "pending" && (
                                <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
                              )}
                              {complianceChecks.counterpartyStatus ===
                                "passed" && (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              )}
                              {complianceChecks.counterpartyStatus ===
                                "failed" && (
                                <XCircle className="h-5 w-5 text-destructive" />
                              )}
                              <span>
                                {language === "fr"
                                  ? "Statut Contrepartie: APPROUVÉ"
                                  : "Counterparty Status: APPROVED"}
                              </span>
                            </div>
                            {complianceChecks.counterpartyStatus ===
                              "passed" && (
                              <Badge
                                variant="outline"
                                className="border-success text-success"
                              >
                                ✓
                              </Badge>
                            )}
                          </div>

                          {/* EDD Complete */}
                          <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              {complianceChecks.eddComplete === "pending" && (
                                <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
                              )}
                              {complianceChecks.eddComplete === "passed" && (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              )}
                              {complianceChecks.eddComplete === "na" && (
                                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                              )}
                              {complianceChecks.eddComplete === "failed" && (
                                <XCircle className="h-5 w-5 text-destructive" />
                              )}
                              <span>
                                {language === "fr"
                                  ? "EDD Complet (si HIGH risk)"
                                  : "EDD Complete (if HIGH risk)"}
                              </span>
                            </div>
                            {complianceChecks.eddComplete === "passed" && (
                              <Badge
                                variant="outline"
                                className="border-success text-success"
                              >
                                ✓
                              </Badge>
                            )}
                            {complianceChecks.eddComplete === "na" && (
                              <Badge variant="outline">N/A</Badge>
                            )}
                          </div>

                          {/* Sanctions Re-check */}
                          <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              {complianceChecks.sanctionsRecheck ===
                                "pending" && (
                                <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
                              )}
                              {complianceChecks.sanctionsRecheck ===
                                "passed" && (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              )}
                              {complianceChecks.sanctionsRecheck ===
                                "failed" && (
                                <XCircle className="h-5 w-5 text-destructive" />
                              )}
                              <span>
                                {language === "fr"
                                  ? "Re-vérification Sanctions: CLEAR"
                                  : "Sanctions Re-check: CLEAR"}
                              </span>
                            </div>
                            {complianceChecks.sanctionsRecheck === "passed" && (
                              <Badge
                                variant="outline"
                                className="border-success text-success"
                              >
                                ✓
                              </Badge>
                            )}
                          </div>

                          {isRecheckingCompliance && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {language === "fr"
                                ? "Vérification en cours..."
                                : "Verification in progress..."}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={runComplianceRecheck}
                            disabled={isRecheckingCompliance}
                          >
                            <RefreshCw
                              className={`mr-2 h-4 w-4 ${isRecheckingCompliance ? "animate-spin" : ""}`}
                            />
                            {language === "fr"
                              ? "Relancer la vérification"
                              : "Re-run Compliance Check"}
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Dual Approval Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {language === "fr" ? "Approbation" : "Approval"}
                            {requiresDualApproval && (
                              <Badge variant="secondary" className="ml-2">
                                {language === "fr"
                                  ? "Double requis"
                                  : "Dual Required"}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {requiresDualApproval
                              ? language === "fr"
                                ? `Transaction > $1M - Deux approbateurs requis`
                                : `Transaction > $1M - Two approvers required`
                              : language === "fr"
                                ? "Une approbation requise"
                                : "One approval required"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Progress */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>
                                {language === "fr" ? "Progression" : "Progress"}
                              </span>
                              <span>
                                {approvals.length}/{approvalsNeeded}
                              </span>
                            </div>
                            <Progress
                              value={(approvals.length / approvalsNeeded) * 100}
                            />
                          </div>

                          {/* Existing Approvals */}
                          {approvals.map((approval, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30"
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-success" />
                                <div>
                                  <p className="font-medium">{approval.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {approval.role}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {approval.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          ))}

                          {/* OTP Input for next approver */}
                          {!approvalsComplete && allCompliancesPassed && (
                            <div className="space-y-3 pt-4 border-t">
                              <Label>
                                {language === "fr"
                                  ? "Code OTP Approbateur"
                                  : "Approver OTP Code"}
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  maxLength={6}
                                  placeholder="123456"
                                  value={currentApproverOTP}
                                  onChange={(e) => {
                                    setCurrentApproverOTP(
                                      e.target.value.replace(/\D/g, ""),
                                    );
                                    setOtpVerified(false); // Reset verification if OTP changes
                                  }}
                                  className="font-mono text-center text-lg tracking-widest"
                                  disabled={otpVerified || isSelfApproval}
                                />
                                {!otpVerified ? (
                                  <Button
                                    onClick={handleVerifyOTP}
                                    disabled={
                                      currentApproverOTP.length !== 6 ||
                                      isSelfApproval
                                    }
                                  >
                                    <Lock className="mr-2 h-4 w-4" />
                                    {language === "fr" ? "Vérifier" : "Verify"}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    className="border-success text-success"
                                    disabled
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {language === "fr" ? "Vérifié" : "Verified"}
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {otpVerified
                                  ? language === "fr"
                                    ? "OTP vérifié. Cliquez sur 'Approuver & Soumettre' pour finaliser."
                                    : "OTP verified. Click 'Approve & Submit' to finalize."
                                  : language === "fr"
                                    ? "Entrez le code OTP envoyé à votre appareil MFA"
                                    : "Enter the OTP code sent to your MFA device"}
                              </p>
                            </div>
                          )}

                          {!allCompliancesPassed && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>
                                {language === "fr"
                                  ? "Vérification requise"
                                  : "Verification Required"}
                              </AlertTitle>
                              <AlertDescription>
                                {language === "fr"
                                  ? "Toutes les vérifications de conformité doivent passer avant l'approbation"
                                  : "All compliance checks must pass before approval"}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Missing fields warning */}
                          {!poValidation.isValid && (
                            <Alert
                              variant="destructive"
                              className="border-amber-500/50 bg-amber-500/10"
                            >
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <AlertTitle className="text-amber-600">
                                {language === "fr"
                                  ? "Informations incomplètes"
                                  : "Incomplete Information"}
                              </AlertTitle>
                              <AlertDescription className="text-amber-600/80">
                                {language === "fr"
                                  ? `Les champs suivants sont requis: ${poValidation.missingFields.join(", ")}`
                                  : `The following fields are required: ${poValidation.missingFields.join(", ")}`}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Self-approval block */}
                          {isSelfApproval && (
                            <Alert variant="destructive">
                              <Shield className="h-4 w-4" />
                              <AlertTitle>
                                {language === "fr"
                                  ? "Approbation impossible"
                                  : "Approval not allowed"}
                              </AlertTitle>
                              <AlertDescription>
                                {language === "fr"
                                  ? "Vous avez soumis ce bon de commande. Un autre agent doit l'approuver (séparation des tâches)."
                                  : "You submitted this purchase order. Another agent must approve it (segregation of duties)."}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Rejection/Approval Notes */}
                          <div className="space-y-2">
                            <Label htmlFor="approval-notes">
                              {language === "fr"
                                ? "Notes (obligatoire pour le rejet)"
                                : "Notes (required for rejection)"}
                            </Label>
                            <Textarea
                              id="approval-notes"
                              value={approvalNotes}
                              onChange={(e) => setApprovalNotes(e.target.value)}
                              placeholder={
                                language === "fr"
                                  ? "Entrez vos commentaires ou la raison du rejet ici..."
                                  : "Enter your comments or rejection reason here..."
                              }
                              className="min-h-[80px]"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex gap-3">
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={handleReject}
                            disabled={!approvalNotes.trim()}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Rejeter" : "Reject"}
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={
                              !otpVerified ||
                              !allCompliancesPassed ||
                              !poValidation.isValid ||
                              approvalsComplete ||
                              isSelfApproval
                            }
                            onClick={handleApprove}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {language === "fr"
                              ? "Approuver & Soumettre"
                              : "Approve & Submit"}
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>

                    {/* Approval History */}
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {language === "fr"
                            ? "Historique d'Approbation"
                            : "Approval History"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {new Date(po.created_at).toLocaleString()}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span>
                              {language === "fr" ? "PO Créé" : "PO Created"}
                            </span>
                          </div>
                          {po.submitted_at && (
                            <div className="flex items-center gap-3 text-sm">
                              <Send className="h-4 w-4 text-warning" />
                              <span>
                                {new Date(po.submitted_at).toLocaleString()}
                              </span>
                              <span className="text-muted-foreground">-</span>
                              <span>
                                {language === "fr"
                                  ? "Soumis pour approbation"
                                  : "Submitted for approval"}
                              </span>
                            </div>
                          )}
                          {approvals.map((a, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 text-sm"
                            >
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <span>{a.timestamp.toLocaleString()}</span>
                              <span className="text-muted-foreground">-</span>
                              <span>
                                {a.name} ({a.role}){" "}
                                {language === "fr" ? "a approuvé" : "approved"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                {/* Tracking Tab - Screen 4 */}
                {(po.status === "approved" || po.status === "in_transit") &&
                  !isCounterparty && (
                    <TabsContent value="tracking" className="space-y-6">
                      {/* Progress Timeline */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            {language === "fr"
                              ? "Suivi de l'Expédition"
                              : "Dispatch Tracking"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            {/* Stage 1 */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  dispatchStatus === "awaiting"
                                    ? "bg-warning text-warning-foreground"
                                    : "bg-success text-success-foreground"
                                }`}
                              >
                                <Clock className="h-6 w-6" />
                              </div>
                              <p className="text-sm mt-2 font-medium">
                                {language === "fr" ? "En attente" : "Awaiting"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr"
                                  ? "d'expédition"
                                  : "Dispatch"}
                              </p>
                            </div>

                            {/* Connector */}
                            <div
                              className={`flex-1 h-1 mx-4 ${dispatchStatus !== "awaiting" ? "bg-success" : "bg-muted"}`}
                            />

                            {/* Stage 2 */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  dispatchStatus === "in_transit"
                                    ? "bg-info text-info-foreground"
                                    : dispatchStatus === "received"
                                      ? "bg-success text-success-foreground"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Truck className="h-6 w-6" />
                              </div>
                              <p className="text-sm mt-2 font-medium">
                                {language === "fr"
                                  ? "En Transit"
                                  : "In Transit"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "→ Coffre" : "→ Vault"}
                              </p>
                            </div>

                            {/* Connector */}
                            <div
                              className={`flex-1 h-1 mx-4 ${dispatchStatus === "received" ? "bg-success" : "bg-muted"}`}
                            />

                            {/* Stage 3 */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  dispatchStatus === "received"
                                    ? "bg-success text-success-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Building2 className="h-6 w-6" />
                              </div>
                              <p className="text-sm mt-2 font-medium">
                                {language === "fr" ? "Reçu" : "Received"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "& Audit" : "& Audit"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tracking Info & QR */}
                      <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              {language === "fr"
                                ? "Informations de Suivi"
                                : "Tracking Information"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                              <QrCode className="h-16 w-16 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">
                                  Tracking ID
                                </p>
                                <p className="font-mono text-lg font-bold">
                                  {po.tracking_id || "GAC-TRK-PENDING"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {language === "fr"
                                    ? "Coffre destination"
                                    : "Destination Vault"}
                                </span>
                                <span className="font-medium">
                                  {po.delivery_vault_id}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {language === "fr"
                                    ? "Date prévue"
                                    : "Expected Date"}
                                </span>
                                <span className="font-medium">
                                  {po.expected_dispatch_date || "-"}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>
                              {language === "fr"
                                ? "Prochaines Étapes"
                                : "Next Steps"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {dispatchStatus === "awaiting" && (
                              <>
                                <Alert>
                                  <Clock className="h-4 w-4" />
                                  <AlertTitle>
                                    {language === "fr"
                                      ? "En attente de confirmation"
                                      : "Awaiting Confirmation"}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {language === "fr"
                                      ? "La contrepartie doit confirmer l'expédition et fournir les documents de transport"
                                      : "Counterparty must confirm dispatch and provide shipping documents"}
                                  </AlertDescription>
                                </Alert>
                                <Button
                                  className="w-full"
                                  onClick={handleConfirmDispatch}
                                  disabled={po.cp_response !== "accept"}
                                >
                                  <Truck className="mr-2 h-4 w-4" />
                                  {language === "fr"
                                    ? "Simuler Confirmation d'Expédition"
                                    : "Simulate Dispatch Confirmation"}
                                </Button>
                                {po.cp_response !== "accept" && (
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr"
                                      ? "Disponible une fois que la contrepartie a accepté le bon de commande."
                                      : "Available once the counterparty has accepted the purchase order."}
                                  </p>
                                )}
                              </>
                            )}

                            {dispatchStatus === "in_transit" && (
                              <Alert className="border-info">
                                <Truck className="h-4 w-4" />
                                <AlertTitle>
                                  {language === "fr"
                                    ? "En Transit"
                                    : "In Transit"}
                                </AlertTitle>
                                <AlertDescription>
                                  {language === "fr"
                                    ? "L'expédition est en cours. La réception au coffre déclenchera le processus d'essai (US-04)"
                                    : "Shipment is in progress. Vault receipt will trigger the assay process (US-04)"}
                                </AlertDescription>
                              </Alert>
                            )}

                            {dispatchStatus === "received" && (
                              <Alert className="border-success">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <AlertTitle>
                                  {language === "fr"
                                    ? "Reçu au Coffre"
                                    : "Received at Vault"}
                                </AlertTitle>
                                <AlertDescription>
                                  {language === "fr"
                                    ? "L'or a été reçu au coffre et le processus d'essai (assay) peut maintenant débuter."
                                    : "The gold has been received at the vault and the assay process can now begin."}
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  )}
                {/* Manifest Tab — visible to agents/admins when a manifest has been submitted */}
                {hasSubmittedManifest && (!isCounterparty || counterpartyManifestSubmitted) && manifest && (
                  <TabsContent value="manifest" className="space-y-6">
                    {/* Status banner */}
                    {manifest.status === "accepted" && (
                      <Alert className="border-emerald-500/50 bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <AlertTitle className="text-emerald-700">
                          {language === "fr"
                            ? "Manifeste validé"
                            : "Manifest validated"}
                        </AlertTitle>
                        <AlertDescription className="text-emerald-700/80">
                          {language === "fr"
                            ? `Validé le ${manifest.reviewed_at ? new Date(manifest.reviewed_at).toLocaleString("fr-FR") : "—"}`
                            : `Validated on ${manifest.reviewed_at ? new Date(manifest.reviewed_at).toLocaleString("en-US") : "—"}`}
                        </AlertDescription>
                      </Alert>
                    )}
                    {manifest.status === "returned" && (
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <RotateCcw className="h-5 w-5 text-amber-600" />
                        <AlertTitle className="text-amber-700">
                          {language === "fr"
                            ? "Manifeste retourné à la contrepartie"
                            : "Manifest returned to counterparty"}
                        </AlertTitle>
                        {manifest.review_notes && (
                          <AlertDescription className="text-amber-700/80 mt-1">
                            {manifest.review_notes}
                          </AlertDescription>
                        )}
                      </Alert>
                    )}

                    <div className="grid gap-6 lg:grid-cols-3">
                      {/* Left column: shipment details + bars */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Shipment details */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Truck className="h-5 w-5 text-muted-foreground" />
                              {language === "fr"
                                ? "Détails de l'expédition"
                                : "Shipment Details"}
                            </CardTitle>
                            <CardDescription>
                              {language === "fr" ? "Tentative" : "Attempt"} #
                              {manifest.attempt_number}
                              {manifest.submitted_at &&
                                ` — ${new Date(manifest.submitted_at).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}`}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                              {[
                                [
                                  language === "fr"
                                    ? "Date d'expédition"
                                    : "Shipment Date",
                                  manifest.shipment_date
                                    ? new Date(
                                        manifest.shipment_date,
                                      ).toLocaleDateString(
                                        language === "fr" ? "fr-FR" : "en-US",
                                      )
                                    : "—",
                                ],
                                [
                                  language === "fr"
                                    ? "Transporteur"
                                    : "Carrier",
                                  manifest.carrier || "—",
                                ],
                                [
                                  language === "fr"
                                    ? "N° de lettre de voiture"
                                    : "Waybill No.",
                                  manifest.waybill_number || "—",
                                ],
                                [
                                  language === "fr"
                                    ? "Lieu de départ"
                                    : "Departure Location",
                                  manifest.departure_location || "—",
                                ],
                                [
                                  language === "fr"
                                    ? "Coffre de destination"
                                    : "Destination Vault",
                                  manifest.destination_vault || "—",
                                ],
                                ["Incoterms", manifest.incoterms || "—"],
                                [
                                  language === "fr"
                                    ? "N° de scellé"
                                    : "Seal Number",
                                  manifest.seal_number || "—",
                                ],
                              ].map(([label, value]) => (
                                <div key={label} className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    {label}
                                  </p>
                                  <p className="text-sm font-medium">{value}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Weight summary */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Scale className="h-5 w-5 text-muted-foreground" />
                              {language === "fr"
                                ? "Récapitulatif des poids"
                                : "Weight Summary"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                              <div className="rounded-lg bg-muted p-3 text-center">
                                <p className="text-2xl font-bold font-mono">
                                  {manifest.total_bars ?? "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr" ? "Lingots" : "Bars"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-muted p-3 text-center">
                                <p className="text-2xl font-bold font-mono">
                                  {manifest.total_gross_weight_kg != null
                                    ? Number(
                                        manifest.total_gross_weight_kg,
                                      ).toFixed(3)
                                    : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr"
                                    ? "Poids brut (kg)"
                                    : "Gross Weight (kg)"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-muted p-3 text-center">
                                <p className="text-2xl font-bold font-mono">
                                  {manifest.total_fine_oz != null
                                    ? Number(manifest.total_fine_oz).toFixed(3)
                                    : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr"
                                    ? "Poids fin (oz) manifeste"
                                    : "Fine Oz (manifest)"}
                                </p>
                              </div>
                              <div
                                className={`rounded-lg p-3 text-center ${
                                  manifest.variance_percent != null &&
                                  Math.abs(Number(manifest.variance_percent)) <=
                                    0.5
                                    ? "bg-emerald-500/10 border border-emerald-500/30"
                                    : "bg-amber-500/10 border border-amber-500/30"
                                }`}
                              >
                                <p
                                  className={`text-2xl font-bold font-mono ${
                                    manifest.variance_percent != null &&
                                    Math.abs(
                                      Number(manifest.variance_percent),
                                    ) <= 0.5
                                      ? "text-emerald-700"
                                      : "text-amber-700"
                                  }`}
                                >
                                  {manifest.variance_percent != null
                                    ? `${Number(manifest.variance_percent) >= 0 ? "+" : ""}${Number(manifest.variance_percent).toFixed(3)}%`
                                    : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr"
                                    ? "Variance vs BCC"
                                    : "Variance vs PO"}
                                </p>
                              </div>
                            </div>

                            {/* Bar list */}
                            {Array.isArray(manifest.bars_json) &&
                              (manifest.bars_json as unknown[]).length > 0 && (
                                <div className="overflow-x-auto rounded-lg border">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b bg-muted/50">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                          #
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                          {language === "fr"
                                            ? "N° lingot"
                                            : "Bar No."}
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                                          {language === "fr"
                                            ? "Poids brut (kg)"
                                            : "Gross (kg)"}
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                                          {language === "fr"
                                            ? "Finesse"
                                            : "Fineness"}
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                                          {language === "fr"
                                            ? "Poids fin (oz)"
                                            : "Fine Oz"}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(
                                        manifest.bars_json as Array<{
                                          barNumber?: string;
                                          grossWeightKg?: number;
                                          fineness?: number;
                                          fineOz?: number;
                                        }>
                                      ).map((bar, i) => (
                                        <tr
                                          key={i}
                                          className="border-b last:border-0 hover:bg-muted/30"
                                        >
                                          <td className="px-3 py-2 text-muted-foreground">
                                            {i + 1}
                                          </td>
                                          <td className="px-3 py-2 font-mono">
                                            {bar.barNumber || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {bar.grossWeightKg != null
                                              ? Number(
                                                  bar.grossWeightKg,
                                                ).toFixed(3)
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {bar.fineness != null
                                              ? Number(bar.fineness).toFixed(4)
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {bar.fineOz != null
                                              ? Number(bar.fineOz).toFixed(3)
                                              : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                          </CardContent>
                        </Card>

                        {/* Documents */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              {language === "fr"
                                ? "Documents soumis"
                                : "Submitted Documents"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {Object.keys(DOC_TYPE_LABELS).map((docType) => {
                                const doc = manifest.documents?.find(
                                  (d) => d.doc_type === docType,
                                );
                                const label =
                                  DOC_TYPE_LABELS[docType]?.[
                                    language === "fr" ? "fr" : "en"
                                  ] ?? docType;
                                return (
                                  <div
                                    key={docType}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          {label}
                                        </p>
                                        {doc && (
                                          <p className="text-xs text-muted-foreground">
                                            {doc.file_name}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {doc ? (
                                      <a
                                        href={`/api/purchase-orders/${id}/manifest/documents/${doc.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                          {language === "fr"
                                            ? "Télécharger"
                                            : "Download"}
                                        </Button>
                                      </a>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-amber-600 border-amber-300 bg-amber-50"
                                      >
                                        {language === "fr"
                                          ? "Manquant"
                                          : "Missing"}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Declaration */}
                        {(manifest.declarant_name ||
                          manifest.declaration_accepted_at) && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                {language === "fr"
                                  ? "Déclaration du déclarant"
                                  : "Declarant's Declaration"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? "Nom" : "Name"}
                                  </p>
                                  <p className="text-sm font-medium">
                                    {manifest.declarant_name || "—"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? "Titre" : "Title"}
                                  </p>
                                  <p className="text-sm font-medium">
                                    {manifest.declarant_title || "—"}
                                  </p>
                                </div>
                                {manifest.declaration_accepted_at && (
                                  <div className="col-span-2 space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                      {language === "fr"
                                        ? "Acceptée le"
                                        : "Accepted on"}
                                    </p>
                                    <p className="text-sm font-medium">
                                      {new Date(
                                        manifest.declaration_accepted_at,
                                      ).toLocaleString(
                                        language === "fr" ? "fr-FR" : "en-US",
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Right column: review action card */}
                      <div className="space-y-4">
                        {manifest.status === "submitted" && (
                          <Card className="sticky top-4">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">
                                {language === "fr" ? "Décision" : "Decision"}
                              </CardTitle>
                              <CardDescription>
                                {language === "fr"
                                  ? "Validez ou retournez ce manifeste à la contrepartie."
                                  : "Validate or return this manifest to the counterparty."}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {reviewResult && (
                                <div
                                  className={`rounded-lg px-4 py-3 text-sm ${
                                    reviewResult.type === "success"
                                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                                      : "bg-red-500/10 text-red-700 border border-red-500/30"
                                  }`}
                                >
                                  {reviewResult.text}
                                </div>
                              )}

                              {/* Reason code (required for return) */}
                              <div className="space-y-2">
                                <Label className="text-sm">
                                  {language === "fr"
                                    ? "Code motif (si retour)"
                                    : "Reason code (if returning)"}
                                </Label>
                                <Select
                                  value={reasonCode}
                                  onValueChange={setReasonCode}
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        language === "fr"
                                          ? "Sélectionner un motif…"
                                          : "Select a reason…"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="missing_document">
                                      {language === "fr"
                                        ? "Document manquant"
                                        : "Missing Document"}
                                    </SelectItem>
                                    <SelectItem value="weight_discrepancy">
                                      {language === "fr"
                                        ? "Écart de poids"
                                        : "Weight Discrepancy"}
                                    </SelectItem>
                                    <SelectItem value="chain_of_custody_gap">
                                      {language === "fr"
                                        ? "Rupture de traçabilité"
                                        : "Chain of Custody Gap"}
                                    </SelectItem>
                                    <SelectItem value="other">
                                      {language === "fr"
                                        ? "Autre motif"
                                        : "Other"}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Failed document types (checkboxes) */}
                              {reasonCode === "missing_document" && (
                                <div className="space-y-2">
                                  <Label className="text-sm">
                                    {language === "fr"
                                      ? "Documents à remplacer"
                                      : "Documents to replace"}
                                  </Label>
                                  <div className="space-y-1.5 rounded-lg border p-3">
                                    {Object.entries(MANIFEST_DOC_LABELS).map(
                                      ([type, label]) => (
                                        <div
                                          key={type}
                                          className="flex items-center gap-2"
                                        >
                                          <Checkbox
                                            id={`failed-${type}`}
                                            checked={failedDocTypesSelected.includes(
                                              type,
                                            )}
                                            onCheckedChange={(checked) =>
                                              setFailedDocTypesSelected(
                                                (prev) =>
                                                  checked
                                                    ? [...prev, type]
                                                    : prev.filter(
                                                        (t) => t !== type,
                                                      ),
                                              )
                                            }
                                          />
                                          <Label
                                            htmlFor={`failed-${type}`}
                                            className="text-xs font-normal cursor-pointer"
                                          >
                                            {label}
                                          </Label>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Public notes (visible to counterparty) */}
                              <div className="space-y-2">
                                <Label
                                  htmlFor="publicNotes"
                                  className="text-sm"
                                >
                                  {language === "fr"
                                    ? "Note publique (visible par la contrepartie)"
                                    : "Public note (visible to counterparty)"}
                                </Label>
                                <Textarea
                                  id="publicNotes"
                                  value={publicNotes}
                                  onChange={(e) =>
                                    setPublicNotes(e.target.value)
                                  }
                                  placeholder={
                                    language === "fr"
                                      ? "Observations communiquées à la contrepartie…"
                                      : "Observations shared with counterparty…"
                                  }
                                  rows={3}
                                />
                              </div>

                              {/* Internal notes (audit-only, never sent to counterparty) */}
                              <div className="space-y-2">
                                <Label
                                  htmlFor="internalNotes"
                                  className="text-sm text-muted-foreground"
                                >
                                  {language === "fr"
                                    ? "Note interne (non transmise)"
                                    : "Internal note (not shared)"}
                                </Label>
                                <Textarea
                                  id="internalNotes"
                                  value={internalNotes}
                                  onChange={(e) =>
                                    setInternalNotes(e.target.value)
                                  }
                                  placeholder={
                                    language === "fr"
                                      ? "Observations internes à la Banque Centrale…"
                                      : "Internal observations for Banque Centrale…"
                                  }
                                  rows={2}
                                  className="text-xs"
                                />
                              </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2">
                              <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={reviewSubmitting !== null}
                                onClick={() => handleManifestReview("validate")}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {reviewSubmitting === "validate"
                                  ? language === "fr"
                                    ? "Validation…"
                                    : "Validating…"
                                  : language === "fr"
                                    ? "Valider le manifeste"
                                    : "Validate Manifest"}
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full text-amber-700 border-amber-300 hover:bg-amber-50"
                                disabled={reviewSubmitting !== null}
                                onClick={() => handleManifestReview("return")}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                {reviewSubmitting === "return"
                                  ? language === "fr"
                                    ? "Retour en cours…"
                                    : "Returning…"
                                  : language === "fr"
                                    ? "Retourner à la contrepartie"
                                    : "Return to Counterparty"}
                              </Button>
                            </CardFooter>
                          </Card>
                        )}

                        {/* History card when already reviewed */}
                        {(manifest.status === "accepted" ||
                          manifest.status === "returned") && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">
                                {language === "fr"
                                  ? "Décision de révision"
                                  : "Review Decision"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {manifest.reason_code && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {{
                                      missing_document:
                                        language === "fr"
                                          ? "Document manquant"
                                          : "Missing Document",
                                      weight_discrepancy:
                                        language === "fr"
                                          ? "Écart de poids"
                                          : "Weight Discrepancy",
                                      chain_of_custody_gap:
                                        language === "fr"
                                          ? "Rupture de traçabilité"
                                          : "Chain of Custody Gap",
                                      other:
                                        language === "fr" ? "Autre" : "Other",
                                    }[manifest.reason_code as string] ??
                                      manifest.reason_code}
                                  </Badge>
                                </div>
                              )}
                              {manifest.review_notes && (
                                <p className="text-sm text-muted-foreground">
                                  {manifest.review_notes}
                                </p>
                              )}
                              {!manifest.reason_code &&
                                !manifest.review_notes && (
                                  <p className="text-sm text-muted-foreground italic">
                                    {language === "fr"
                                      ? "Aucune note."
                                      : "No notes."}
                                  </p>
                                )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                )}

                {/* Traceability Tab */}
                {!isCounterparty && (
                  <TabsContent value="trace" className="space-y-6">
                    {(() => {
                      const isFr = language === "fr";
                      const fmt = (d: string | null | undefined) =>
                        d ? new Date(d).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      const fmtDt = (d: string | null | undefined) =>
                        d ? new Date(d).toLocaleString(isFr ? "fr-FR" : "en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

                      const manifestData = traceData?.manifests ?? [];
                      const latestManifest = manifestData[manifestData.length - 1] ?? null;
                      const reception = traceData?.reception ?? null;
                      const settlement = traceData?.settlement ?? null;

                      const manifestStatusLabel: Record<string, { fr: string; en: string; color: string }> = {
                        draft:     { fr: "Brouillon", en: "Draft", color: "text-slate-400" },
                        submitted: { fr: "Soumis", en: "Submitted", color: "text-blue-500" },
                        accepted:  { fr: "Accepté — en révision BCC", en: "Accepted — BCC review", color: "text-amber-500" },
                        returned:  { fr: "Retourné", en: "Returned", color: "text-orange-500" },
                        validated: { fr: "Validé par la BCC", en: "Validated by BCC", color: "text-emerald-500" },
                      };
                      const settlementStatusLabel: Record<string, { fr: string; en: string; color: string }> = {
                        pending:          { fr: "En attente", en: "Pending", color: "text-amber-500" },
                        pending_review:   { fr: "En révision", en: "In Review", color: "text-blue-400" },
                        pending_approval: { fr: "En approbation", en: "Pending Approval", color: "text-purple-500" },
                        allocated:        { fr: "Alloué aux réserves", en: "Allocated to reserves", color: "text-emerald-500" },
                        completed:        { fr: "Terminé", en: "Completed", color: "text-emerald-500" },
                      };

                      type NodeStatus = "done" | "active" | "pending" | "error";
                      const poNodeStatus: NodeStatus =
                        po?.status === "approved" || po?.status === "sent_to_counterparty" || po?.status === "accepted" || po?.status === "manifest_validated" || po?.status === "in_transit" || po?.status === "delivered" || po?.status === "settled"
                          ? "done"
                          : po?.status === "rejected" || po?.status === "declined"
                          ? "error"
                          : "active";
                      const manifestNodeStatus: NodeStatus =
                        po?.status === "manifest_validated" || po?.status === "in_transit" || po?.status === "delivered" || po?.status === "settled"
                          ? "done"
                          : latestManifest
                          ? "active"
                          : "pending";
                      const receptionNodeStatus: NodeStatus =
                        reception
                          ? po?.status === "delivered" || po?.status === "settled" ? "done" : "active"
                          : "pending";
                      const settlementNodeStatus: NodeStatus =
                        settlement?.status === "allocated" || settlement?.status === "completed"
                          ? "done"
                          : settlement
                          ? "active"
                          : "pending";

                      const nodeColors: Record<NodeStatus, { ring: string; dot: string; badge: string }> = {
                        done:    { ring: "border-emerald-500", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                        active:  { ring: "border-blue-500",   dot: "bg-blue-500",   badge: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                        pending: { ring: "border-slate-300 dark:border-slate-600", dot: "bg-slate-300 dark:bg-slate-600", badge: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700" },
                        error:   { ring: "border-red-500",    dot: "bg-red-500",    badge: "bg-red-500/10 text-red-600 border-red-500/30" },
                      };

                      const TraceNode = ({
                        icon: Icon, title, subtitle, status, children, href,
                      }: {
                        icon: React.ElementType; title: string; subtitle: string;
                        status: NodeStatus; children?: React.ReactNode; href?: string;
                      }) => {
                        const c = nodeColors[status];
                        return (
                          <div className="flex gap-4">
                            {/* Left column: dot + connector */}
                            <div className="flex flex-col items-center">
                              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${c.ring} bg-background`}>
                                <Icon className={`h-5 w-5 ${status === "pending" ? "text-muted-foreground" : status === "done" ? "text-emerald-500" : status === "error" ? "text-red-500" : "text-blue-500"}`} />
                              </div>
                              <div className="w-0.5 flex-1 bg-border mt-2 mb-0 min-h-6" />
                            </div>
                            {/* Right column: card */}
                            <div className={`flex-1 border rounded-lg p-4 mb-6 transition-colors ${status === "pending" ? "opacity-60 bg-muted/30" : "bg-card"}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <div className="font-semibold text-sm">{title}</div>
                                  <div className="text-xs text-muted-foreground">{subtitle}</div>
                                </div>
                                {href && status !== "pending" && (
                                  <Link href={href} className="shrink-0">
                                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                      <ExternalLink className="h-3 w-3" />
                                      {isFr ? "Voir" : "View"}
                                    </Button>
                                  </Link>
                                )}
                              </div>
                              {children}
                            </div>
                          </div>
                        );
                      };

                      const InfoRow = ({ label, value }: { label: string; value: string }) => (
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium font-mono">{value}</span>
                        </div>
                      );

                      const StatusPill = ({ label, color }: { label: string; color: string }) => (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color.includes("emerald") ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : color.includes("blue") ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : color.includes("amber") ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : color.includes("purple") ? "bg-purple-500/10 text-purple-600 border-purple-500/30" : color.includes("orange") ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}>
                          <Circle className="h-1.5 w-1.5 fill-current" />
                          {label}
                        </span>
                      );

                      return (
                        <div className="max-w-2xl mx-auto">
                          {/* Header */}
                          <div className="mb-6 p-4 rounded-lg border bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">{isFr ? "Bon de commande" : "Purchase Order"}</div>
                            <div className="font-mono font-bold text-lg">{po?.tracking_id ?? po?.id}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {po?.counterparty_name} · {isFr ? "Créé le" : "Created"} {fmt(po?.created_at)}
                            </div>
                          </div>

                          {/* Timeline */}
                          <div className="relative">
                            {/* 1. Bon de commande */}
                            <TraceNode
                              icon={ShoppingCart}
                              title={isFr ? "Bon de commande" : "Purchase Order"}
                              subtitle={po?.tracking_id ?? ""}
                              status={poNodeStatus}
                              href={`/purchase-orders/${po?.id}`}
                            >
                              <div className="space-y-1 mt-2">
                                <InfoRow label={isFr ? "Statut" : "Status"} value={po?.status?.replace(/_/g, " ") ?? "—"} />
                                <InfoRow label={isFr ? "Poids estimé" : "Est. weight"} value={po?.estimated_weight_kg ? `${Number(po.estimated_weight_kg).toFixed(3)} kg` : "—"} />
                                <InfoRow label={isFr ? "Valeur estimée" : "Est. value"} value={po?.total_estimated_value ? `${Number(po.total_estimated_value).toLocaleString(isFr ? "fr-FR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${po.currency}` : "—"} />
                                <InfoRow label={isFr ? "Approuvé le" : "Approved"} value={fmt(po?.approved_at)} />
                                <InfoRow label={isFr ? "Envoyé à la CP le" : "Sent to CP"} value={fmt(po?.sent_to_counterparty_at)} />
                              </div>
                            </TraceNode>

                            {/* 2. Manifeste */}
                            <TraceNode
                              icon={Package}
                              title={isFr ? "Manifeste d'expédition" : "Shipping Manifest"}
                              subtitle={latestManifest ? `${isFr ? "Tentative" : "Attempt"} #${latestManifest.attempt_number}` : isFr ? "Aucun manifeste soumis" : "No manifest submitted"}
                              status={manifestNodeStatus}
                              href={latestManifest ? `/purchase-orders/${po?.id}` : undefined}
                            >
                              {latestManifest ? (
                                <div className="space-y-1 mt-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    {(() => {
                                      const s = manifestStatusLabel[latestManifest.status];
                                      return s ? <StatusPill label={isFr ? s.fr : s.en} color={s.color} /> : <span className="text-xs text-muted-foreground">{latestManifest.status}</span>;
                                    })()}
                                    {manifestData.length > 1 && (
                                      <span className="text-xs text-muted-foreground">({manifestData.length} {isFr ? "tentatives" : "attempts"})</span>
                                    )}
                                  </div>
                                  <InfoRow label={isFr ? "Soumis le" : "Submitted"} value={fmtDt(latestManifest.submitted_at)} />
                                  <InfoRow label={isFr ? "Révisé le" : "Reviewed"} value={fmtDt(latestManifest.reviewed_at)} />
                                  {latestManifest.carrier && <InfoRow label={isFr ? "Transporteur" : "Carrier"} value={latestManifest.carrier} />}
                                  {latestManifest.waybill_number && <InfoRow label={isFr ? "Lettre de voiture" : "Waybill"} value={latestManifest.waybill_number} />}
                                  {latestManifest.total_gross_weight_kg && <InfoRow label={isFr ? "Poids brut" : "Gross weight"} value={`${Number(latestManifest.total_gross_weight_kg).toFixed(3)} kg`} />}
                                  {latestManifest.total_fine_oz && <InfoRow label={isFr ? "Or fin déclaré" : "Declared fine oz"} value={`${Number(latestManifest.total_fine_oz).toFixed(3)} oz`} />}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  {isFr ? "En attente de soumission par la contrepartie." : "Awaiting submission by counterparty."}
                                </p>
                              )}
                            </TraceNode>

                            {/* 3. Réception Coffre */}
                            <TraceNode
                              icon={Warehouse}
                              title={isFr ? "Réception Coffre" : "Vault Reception"}
                              subtitle={reception ? (reception.po_reference as string | null ?? reception.tracking_id as string ?? "—") : isFr ? "Pas encore reçu" : "Not yet received"}
                              status={receptionNodeStatus}
                              href={reception ? `/vault-intake/${reception.id}` : undefined}
                            >
                              {reception ? (
                                <div className="space-y-1 mt-2">
                                  {reception.validation_status && (
                                    <div className="mb-2">
                                      <StatusPill
                                        label={reception.validation_status === "passed" ? (isFr ? "Analyse validée" : "Assay passed") : reception.validation_status === "failed" ? (isFr ? "Analyse échouée" : "Assay failed") : String(reception.validation_status)}
                                        color={reception.validation_status === "passed" ? "text-emerald-500" : "text-red-500"}
                                      />
                                    </div>
                                  )}
                                  <InfoRow label={isFr ? "Reçu le" : "Received"} value={fmtDt(reception.created_at)} />
                                  {reception.gross_weight_kg && <InfoRow label={isFr ? "Poids brut" : "Gross weight"} value={`${Number(reception.gross_weight_kg).toFixed(3)} kg`} />}
                                  {reception.net_weight_kg && <InfoRow label={isFr ? "Poids net" : "Net weight"} value={`${Number(reception.net_weight_kg).toFixed(3)} kg`} />}
                                  {reception.au_purity && <InfoRow label={isFr ? "Pureté Au" : "Au purity"} value={`${Number(reception.au_purity).toFixed(2)}%`} />}
                                  {reception.pure_gold_weight && <InfoRow label={isFr ? "Or pur" : "Pure gold"} value={`${Number(reception.pure_gold_weight).toFixed(2)} g`} />}
                                  {reception.vault_location && <InfoRow label={isFr ? "Emplacement" : "Location"} value={String(reception.vault_location)} />}
                                  {reception.assay_method && <InfoRow label={isFr ? "Méthode" : "Method"} value={String(reception.assay_method)} />}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  {isFr ? "En attente de réception physique à la BCC." : "Awaiting physical receipt at BCC vault."}
                                </p>
                              )}
                            </TraceNode>

                            {/* 4. Règlement */}
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${nodeColors[settlementNodeStatus].ring} bg-background`}>
                                  <Wallet className={`h-5 w-5 ${settlementNodeStatus === "pending" ? "text-muted-foreground" : settlementNodeStatus === "done" ? "text-emerald-500" : "text-blue-500"}`} />
                                </div>
                              </div>
                              <div className={`flex-1 border rounded-lg p-4 mb-2 transition-colors ${settlementNodeStatus === "pending" ? "opacity-60 bg-muted/30" : "bg-card"}`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <div className="font-semibold text-sm">{isFr ? "Règlement" : "Settlement"}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {settlement ? (settlement.settlement_reference as string) : isFr ? "Aucun règlement initié" : "No settlement initiated"}
                                    </div>
                                  </div>
                                  {settlement && (
                                    <Link href={`/settlements/${settlement.id}`}>
                                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                        <ExternalLink className="h-3 w-3" />
                                        {isFr ? "Voir" : "View"}
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                                {settlement ? (
                                  <div className="space-y-1">
                                    {(() => {
                                      const s = settlementStatusLabel[settlement.status as string];
                                      return s ? <div className="mb-2"><StatusPill label={isFr ? s.fr : s.en} color={s.color} /></div> : null;
                                    })()}
                                    <InfoRow label={isFr ? "Initié le" : "Initiated"} value={fmtDt(settlement.initiated_at)} />
                                    <InfoRow label={isFr ? "Or fin" : "Fine gold"} value={`${Number(settlement.fine_gold_weight_kg).toFixed(3)} kg`} />
                                    <InfoRow label={isFr ? "Montant total" : "Total amount"} value={`${Number(settlement.total_amount).toLocaleString(isFr ? "fr-FR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${settlement.currency}`} />
                                    {settlement.approved_at && <InfoRow label={isFr ? "Approuvé le" : "Approved"} value={fmtDt(settlement.approved_at)} />}
                                    {settlement.completed_at && <InfoRow label={isFr ? "Complété le" : "Completed"} value={fmtDt(settlement.completed_at)} />}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    {isFr
                                      ? "Le règlement sera initié après validation de la réception coffre."
                                      : "Settlement will be initiated after vault reception is validated."}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Audit log */}
                          {traceData?.auditLog && traceData.auditLog.length > 0 && (
                            <div className="mt-6">
                              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {isFr ? "Journal d'activité" : "Activity Log"}
                              </h3>
                              <div className="space-y-1 border rounded-lg overflow-hidden">
                                {traceData.auditLog.map((entry, i) => (
                                  <div key={i} className={`flex items-start gap-3 px-3 py-2 text-xs ${i % 2 === 0 ? "bg-muted/30" : ""}`}>
                                    <span className="text-muted-foreground shrink-0 w-28 font-mono">
                                      {new Date(entry.performed_at).toLocaleString(isFr ? "fr-FR" : "en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <span className="flex-1 text-foreground">
                                      {entry.action.replace(/_/g, " ")}
                                      {entry.new_status && (
                                        <span className="ml-1 text-muted-foreground">→ <span className="font-mono">{entry.new_status}</span></span>
                                      )}
                                    </span>
                                    <span className="text-muted-foreground shrink-0">{entry.performed_by}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TabsContent>
                )}

              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function RefField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
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
