"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n/language-context";
import QRCode from "qrcode";
import {
  Warehouse,
  Package,
  Scale,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Camera,
  X,
  Search,
  ArrowRight,
  ArrowLeft,
  Clock,
  Shield,
  Lock,
  FileText,
  Copy,
  ExternalLink,
  Truck,
  MapPin,
  Timer,
  Save,
} from "lucide-react";

// Mock labs data
const LABS = [
  { id: "lab_a", name: "Accredited Lab A", expiry: "2025-12-31", sla: "48h", method: "fire_assay" },
  { id: "lab_b", name: "Accredited Lab B", expiry: "2026-06-15", sla: "72h", method: "fire_assay" },
  { id: "lab_c", name: "Metalor Technologies", expiry: "2027-03-20", sla: "24h", method: "xrf" },
  { id: "lab_d", name: "Argor-Heraeus", expiry: "2026-09-30", sla: "36h", method: "fire_assay" },
];

export default function VaultIntakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const intakeId = params.id as string;

  const [activeTab, setActiveTab] = useState("intake");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [slaCountdown, setSlaCountdown] = useState({ hours: 2, minutes: 14, seconds: 37 });
  const [intakeData, setIntakeData] = useState<Record<string, unknown> | null>(null);

  // Shipped POs available for vault intake selection
  const [shippedPOs, setShippedPOs] = useState<Array<{
    poId: string;
    trackingId: string | null;
    counterpartyName: string;
    estimatedWeight: number;
  }>>([]);

  // Selected PO summary info (counterparty / value) loaded from the intake API
  const [selectedPOInfo, setSelectedPOInfo] = useState<{
    counterpartyName: string;
    poValue: number;
    currency: string;
  }>({ counterpartyName: "—", poValue: 0, currency: "USD" });

  useEffect(() => {
    const loadShippedPOs = async () => {
      try {
        const response = await fetch("/api/dispatch");
        if (response.ok) {
          const data = await response.json();
          // Only POs that have actually been shipped (in transit or dispatched)
          const shipped = (Array.isArray(data) ? data : []).filter(
            (d: { status: string }) => d.status === "in_transit" || d.status === "dispatched"
          );
          setShippedPOs(shipped);
        }
      } catch (error) {
        console.error("Error loading shipped POs:", error);
      }
    };
    loadShippedPOs();
  }, []);

  // Load real PO data
  useEffect(() => {
    const loadIntakeData = async () => {
      try {
        const response = await fetch(`/api/vault-intake/${intakeId}`);
        if (response.ok) {
          const data = await response.json();
          setIntakeData(data);
          const r = data.reception;
          // Update intake form with real data, preferring any previously saved reception values
          setIntakeForm(prev => ({
            ...prev,
            poReference: r?.selectedPoId ?? (data.poReference || prev.poReference),
            trackingId: data.trackingId || prev.trackingId,
            seal1: r?.seal1 ?? prev.seal1,
            seal2: r?.seal2 ?? prev.seal2,
            manifestMatch: r?.manifestMatch ?? prev.manifestMatch,
            grossWeightKg: String(r?.grossWeightKg ?? data.grossWeightKg ?? prev.grossWeightKg),
            netWeightKg: r?.netWeightKg != null ? String(r.netWeightKg) : prev.netWeightKg,
          }));
          // Re-hydrate OTP digits if a code was saved
          if (r?.otpCode) {
            const digits = String(r.otpCode).slice(0, 6).split("");
            setOtpDigits([0, 1, 2, 3, 4, 5].map((i) => digits[i] ?? ""));
          }
          // Re-hydrate assay request form (lab selector, sample id, method)
          setAssayForm((prev) => ({
            ...prev,
            sampleId: r?.sampleId ?? prev.sampleId,
            selectedLab: r?.labId ?? prev.selectedLab,
            assayMethod: r?.assayMethod ?? prev.assayMethod,
          }));
          // Re-hydrate assay results (purity, certificate, validation status)
          setAssayResults((prev) => ({
            ...prev,
            auPurity: r?.auPurity ?? prev.auPurity,
            agPurity: r?.agPurity ?? prev.agPurity,
            cuPurity: r?.cuPurity ?? prev.cuPurity,
            fePurity: r?.fePurity ?? prev.fePurity,
            pureGoldWeight: r?.pureGoldWeight ?? prev.pureGoldWeight,
            poEstimate: r?.poEstimate ?? prev.poEstimate,
            validationStatus: r?.validationStatus ?? prev.validationStatus,
            certificatePathname: r?.certificatePathname ?? prev.certificatePathname,
            certificateFileName: r?.certificateFileName ?? prev.certificateFileName,
            certificateUploaded: Boolean(r?.certificatePathname),
          }));
          // Re-hydrate previously uploaded photo evidence
          if (Array.isArray(r?.photoEvidence) && r.photoEvidence.length > 0) {
            setPhotoEvidence(
              r.photoEvidence.map((p: { pathname: string; fileName: string }) => ({
                pathname: p.pathname,
                fileName: p.fileName,
                previewUrl: `/api/vault-intake/photos?pathname=${encodeURIComponent(p.pathname)}`,
              }))
            );
          }
          setSelectedPOInfo({
            counterpartyName: data.counterpartyName || "—",
            poValue: data.poValue || 0,
            currency: data.currency || "USD",
          });
          // Make sure the saved/selected PO stays selectable even if it is no
          // longer "shipped" (e.g. after it transitioned to delivered on save).
          const keepPoId = r?.selectedPoId ?? data.id;
          if (keepPoId) {
            setShippedPOs((prev) =>
              prev.some((po) => po.poId === keepPoId)
                ? prev
                : [
                    {
                      poId: keepPoId,
                      trackingId: data.trackingId ?? null,
                      counterpartyName: data.counterpartyName || "—",
                      estimatedWeight: data.grossWeightKg ?? 0,
                    },
                    ...prev,
                  ]
            );
          }
        }
      } catch (error) {
        console.error("Error loading intake data:", error);
      }
    };
    loadIntakeData();
  }, [intakeId]);

  // Screen 1: Intake form state
  const [intakeForm, setIntakeForm] = useState({
    poReference: "PO-2026-0891",
    trackingId: "TRK-990",
    seal1: "78945",
    seal2: "78946",
    manifestMatch: true,
    grossWeightKg: "327.50",
    netWeightKg: "324.85",
    otpCode: "",
  });

  // Screen 2: Assay scheduling state
  const [assayForm, setAssayForm] = useState({
    sampleId: "SAMP-2026-4482",
    selectedLab: "",
    assayMethod: "fire_assay",
  });
  const [sampleQrUrl, setSampleQrUrl] = useState<string>("");
  useEffect(() => {
    if (!assayForm.sampleId) return;
    QRCode.toDataURL(assayForm.sampleId, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setSampleQrUrl)
      .catch(() => {});
  }, [assayForm.sampleId]);

  // Screen 3: Assay results state
  const [assayResults, setAssayResults] = useState({
    auPurity: 99.25,
    agPurity: 0.32,
    cuPurity: 0.18,
    fePurity: 0.07,
    pureGoldWeight: 322.41,
    poEstimate: 325.00,
    certificateUploaded: false,
    certificatePathname: "" as string,
    certificateFileName: "" as string,
    validationStatus: "pending" as "pending" | "passed" | "review" | "rejected",
  });
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  // Screen 4: Handoff state
  const [handoffData] = useState({
    allocationId: "ALLOC-2026-4482",
    vaultLocation: "LON-VLT-07B",
    auditHash: "a3b2c10d4e5f6789...",
    fullAuditHash: "a3b2c10d4e5f6789bcda15b8a3d4e5f67890abcd",
    lbmaCompliant: true,
  });

  // Photo evidence state — each entry holds the uploaded blob pathname, file name and a local preview URL
  const [photoEvidence, setPhotoEvidence] = useState<
    Array<{ pathname: string; fileName: string; previewUrl: string }>
  >([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // OTP digits (6) bound to the inputs
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Custody log state
  const [custodyLog] = useState([
    { timestamp: "2026-05-10 09:22", location: "Receiving Bay", handler: "J. Smith" },
    { timestamp: "2026-05-10 09:45", location: "Weighing Room", handler: "J. Smith" },
    { timestamp: "2026-05-10 10:15", location: "Vault Staging", handler: "M. Johnson" },
  ]);

  // Courier tracking state
  const [courierStatus] = useState({
    pickupScheduled: true,
    inTransit: false,
    delivered: false,
  });

  // SLA countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSlaCountdown((prev) => {
        let { hours, minutes, seconds } = prev;
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
          hours = 0;
          minutes = 0;
          seconds = 0;
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate weight variance
  const calculateVariance = () => {
    const net = parseFloat(intakeForm.netWeightKg) || 0;
    const gross = parseFloat(intakeForm.grossWeightKg) || 0;
    if (gross === 0) return 0;
    return ((net - gross) / gross) * 100;
  };

  const weightVariance = calculateVariance();

  // Calculate purity variance
  const purityVariance = ((assayResults.pureGoldWeight - assayResults.poEstimate) / assayResults.poEstimate) * 100;

  // Get variance color
  const getVarianceColor = (variance: number, thresholds: { green: number; yellow: number }) => {
    const abs = Math.abs(variance);
    if (abs <= thresholds.green) return "text-emerald-600";
    if (abs <= thresholds.yellow) return "text-amber-600";
    return "text-red-600";
  };

  // Build the reception payload from the current form state
  const buildReceptionPayload = () => ({
    poId: intakeId,
    // The shipped PO actually selected in the dropdown (may differ from the route id)
    selectedPoId: intakeForm.poReference || intakeId,
    poReference: intakeForm.poReference,
    trackingId: intakeForm.trackingId,
    counterpartyName:
      shippedPOs.find((po) => po.poId === intakeForm.poReference)?.counterpartyName ||
      selectedPOInfo.counterpartyName,
    seal1: intakeForm.seal1,
    seal2: intakeForm.seal2,
    sealVerified: Boolean(intakeForm.seal1 && intakeForm.seal2),
    manifestMatch: intakeForm.manifestMatch,
    grossWeightKg: parseFloat(intakeForm.grossWeightKg) || null,
    netWeightKg: parseFloat(intakeForm.netWeightKg) || null,
    vaultLocation: (intakeData?.vaultLocation as string) || handoffData.vaultLocation,
    operatorId: "vault_operator",
    otpCode: otpDigits.join(""),
    photoEvidence: photoEvidence.map((p) => ({ pathname: p.pathname, fileName: p.fileName })),
    // Assay request fields
    sampleId: assayForm.sampleId,
    labId: assayForm.selectedLab,
    assayMethod: assayForm.assayMethod,
    // Assay results (screen 3)
    auPurity: assayResults.auPurity,
    agPurity: assayResults.agPurity,
    cuPurity: assayResults.cuPurity,
    fePurity: assayResults.fePurity,
    pureGoldWeight: assayResults.pureGoldWeight,
    poEstimate: assayResults.poEstimate,
    validationStatus: assayResults.validationStatus,
    certificatePathname: assayResults.certificatePathname || null,
    certificateFileName: assayResults.certificateFileName || null,
  });

  // Upload a selected photo to private Blob storage and track its pathname
  const handlePhotoUpload = async (file: File) => {
    if (photoEvidence.length >= 4) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("poId", intakeId);
      const response = await fetch("/api/vault-intake/photos", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await response.json();
      setPhotoEvidence((prev) => [
        ...prev,
        { pathname: data.pathname, fileName: data.fileName, previewUrl: URL.createObjectURL(file) },
      ]);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert(
        language === "fr"
          ? `Erreur lors de l'upload: ${(error as Error).message}`
          : `Upload error: ${(error as Error).message}`,
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload the assay certificate (PDF/image) to private Blob storage
  const handleCertificateUpload = async (file: File) => {
    setUploadingCertificate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("poId", intakeId);
      const response = await fetch("/api/vault-intake/certificate", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await response.json();
      setAssayResults((prev) => ({
        ...prev,
        certificateUploaded: true,
        certificatePathname: data.pathname,
        certificateFileName: data.fileName,
      }));
    } catch (error) {
      console.error("Error uploading certificate:", error);
      alert(
        language === "fr"
          ? `Erreur lors de l'upload: ${(error as Error).message}`
          : `Upload error: ${(error as Error).message}`,
      );
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handleRemoveCertificate = () => {
    setAssayResults((prev) => ({
      ...prev,
      certificateUploaded: false,
      certificatePathname: "",
      certificateFileName: "",
    }));
  };

  // Update a purity field and recompute the pure gold weight from net weight × Au purity
  const handlePurityChange = (
    field: "auPurity" | "agPurity" | "cuPurity" | "fePurity",
    value: string,
  ) => {
    const num = parseFloat(value);
    setAssayResults((prev) => {
      const next = { ...prev, [field]: Number.isNaN(num) ? 0 : num };
      // Recompute pure gold weight whenever Au purity changes and a net weight exists
      const netWeightG = (parseFloat(intakeForm.netWeightKg) || 0) * 1000;
      if (netWeightG > 0) {
        next.pureGoldWeight = (netWeightG * next.auPurity) / 100;
      }
      return next;
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    // Auto-advance focus to the next field once a digit has been entered
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      // Move focus back when deleting an already-empty field
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };


  // Save the reception record to the database without leaving the tab
  const handleSaveReception = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (!response.ok) throw new Error("Failed to save reception");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving reception:", error);
      alert(language === "fr" ? "Erreur lors de la sauvegarde de la réception" : "Error saving reception");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntake = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (!response.ok) throw new Error("Failed to save intake");
      setActiveTab("scheduling");
    } catch (error) {
      console.error("Error saving intake:", error);
      alert(language === "fr" ? "Erreur lors de l'enregistrement" : "Error saving intake");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAssayRequest = async () => {
    // Lab selection is required before a request can be submitted
    if (!assayForm.selectedLab) {
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (!response.ok) {
        console.error("Error saving vault reception:", await response.text());
      } else {
        setActiveTab("results");
      }
    } catch (error) {
      console.error("Error submitting assay request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateResults = async () => {
    setIsSubmitting(true);
    // Determine validation outcome from purity variance threshold (±0.5%)
    const status: "passed" | "review" =
      Math.abs(purityVariance) <= 0.5 ? "passed" : "review";
    try {
      const response = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildReceptionPayload(), validationStatus: status }),
      });
      if (!response.ok) {
        console.error("Error saving assay results:", await response.text());
      } else {
        setAssayResults((prev) => ({ ...prev, validationStatus: status }));
        setActiveTab("handoff");
      }
    } catch (error) {
      console.error("Error validating results:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockAndProceed = async () => {
    setIsSubmitting(true);
    try {
      // First, get the PO data if not already loaded
      let poData = intakeData;
      if (!poData) {
        const poResponse = await fetch(`/api/vault-intake/${intakeId}`);
        if (poResponse.ok) {
          poData = await poResponse.json();
        }
      }
      
      // Create settlement in database
      const settlementPayload = {
        purchaseOrderId: intakeId,
        counterpartyId: poData?.counterpartyId || null,
        fineGoldWeightKg: assayResults.pureGoldWeight,
        settlementPricePerOz: 2650,
        currency: "USD",
        paymentMethod: "wire_transfer",
        notes: `Intake validated. PO: ${intakeForm.poReference}, Purity: ${assayResults.auPurity}%`,
      };
      
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settlementPayload),
      });
      
      if (response.ok) {
        // Update PO status to pending_settlement
        await fetch(`/api/purchase-orders/${intakeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending_settlement" }),
        });
        
        setShowSuccessDialog(true);
      } else {
        console.error("Error creating settlement:", await response.text());
      }
    } catch (error) {
      console.error("Error in lock and proceed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SVG Weight Tolerance Gauge Component
  const WeightToleranceGauge = ({ variance }: { variance: number }) => {
    // Clamp variance to -10 to +10 range for display
    const clampedVariance = Math.max(-10, Math.min(10, variance));
    // Convert to angle (-90 to 90 degrees)
    const angle = (clampedVariance / 10) * 90;
    
    return (
      <div className="flex flex-col items-center">
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {/* Green zone (-2% to +2%) */}
          <path
            d="M 56 100 A 80 80 0 0 1 144 100"
            fill="none"
            stroke="#22c55e"
            strokeWidth="20"
          />
          {/* Yellow zone left (-5% to -2%) */}
          <path
            d="M 32 100 A 80 80 0 0 1 56 100"
            fill="none"
            stroke="#eab308"
            strokeWidth="20"
          />
          {/* Yellow zone right (+2% to +5%) */}
          <path
            d="M 144 100 A 80 80 0 0 1 168 100"
            fill="none"
            stroke="#eab308"
            strokeWidth="20"
          />
          {/* Red zone left (-10% to -5%) */}
          <path
            d="M 20 100 A 80 80 0 0 1 32 100"
            fill="none"
            stroke="#ef4444"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {/* Red zone right (+5% to +10%) */}
          <path
            d="M 168 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#ef4444"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {/* Needle */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke="#1f2937"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle}, 100, 100)`}
          />
          {/* Center circle */}
          <circle cx="100" cy="100" r="8" fill="#1f2937" />
        </svg>
        <div className="flex justify-between w-full px-4 text-xs text-muted-foreground">
          <span>-5%</span>
          <span>0%</span>
          <span>+5%</span>
        </div>
      </div>
    );
  };

  // Purity Variance Bar Component
  const PurityVarianceBar = ({ variance }: { variance: number }) => {
    const abs = Math.abs(variance);
    let color = "bg-emerald-500";
    if (abs > 0.1 && abs <= 0.3) color = "bg-amber-500";
    if (abs > 0.3) color = "bg-red-500";

    return (
      <div className="space-y-2">
        <div className="flex gap-0 h-3 rounded-full overflow-hidden">
          <div className="flex-1 bg-emerald-500 flex items-center justify-center">
            <span className="text-[10px] text-white font-medium">±0.1g</span>
          </div>
          <div className="flex-1 bg-amber-500 flex items-center justify-center">
            <span className="text-[10px] text-white font-medium">±0.1-0.3g</span>
          </div>
          <div className="flex-1 bg-red-500 flex items-center justify-center">
            <span className="text-[10px] text-white font-medium">{">"}±0.3g</span>
          </div>
        </div>
        <div className="relative h-2 bg-muted rounded-full">
          <div 
            className={`absolute top-0 h-full ${color} rounded-full transition-all`}
            style={{ 
              width: `${Math.min(100, (abs / 3) * 100)}%`,
              left: variance < 0 ? `${50 - Math.min(50, (abs / 3) * 50)}%` : '50%',
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground" />
        </div>
      </div>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Validation Réception Coffre" : "Vault Intake Validation"}
            subtitle={`${intakeForm.poReference} - ${language === "fr" ? "Workflow US-05" : "US-05 Workflow"}`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* PO Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {language === "fr" ? "Résumé du Bon de Commande" : "Purchase Order Summary"}
                    </div>
                    {intakeForm.poReference && (
                      <span className="text-sm font-mono text-muted-foreground">{intakeForm.poReference}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intakeForm.poReference ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* PO ID */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Bon de Commande" : "PO ID"}
                        </p>
                        <p className="text-sm font-mono font-semibold">{intakeForm.poReference}</p>
                      </div>

                      {/* Tracking ID */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Tracking ID" : "Tracking ID"}
                        </p>
                        <p className="text-sm font-mono">{intakeForm.trackingId || "—"}</p>
                      </div>

                      {/* Gross Weight */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Poids Brut" : "Gross Weight"}
                        </p>
                        <p className="text-sm font-semibold">
                          {intakeForm.grossWeightKg ? `${intakeForm.grossWeightKg} kg` : "—"}
                        </p>
                      </div>

                      {/* PO Value */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Valeur Estimée" : "Estimated Value"}
                        </p>
                        <p className="text-sm font-semibold">
                          {selectedPOInfo.poValue
                            ? `${selectedPOInfo.currency} ${selectedPOInfo.poValue.toLocaleString("en-US")}`
                            : "—"}
                        </p>
                      </div>

                      {/* Counterparty */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Contrepartie" : "Counterparty"}
                        </p>
                        <p className="text-sm">
                          {shippedPOs.find((po) => po.poId === intakeForm.poReference)?.counterpartyName ||
                            selectedPOInfo.counterpartyName ||
                            "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {language === "fr"
                        ? "Sélectionnez un PO expédié pour afficher les informations"
                        : "Select a shipped PO to display information"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Progress Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="intake" className="gap-2">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "1. Réception" : "1. Intake"}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="scheduling" className="gap-2">
                    <FlaskConical className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "2. Planif. Essai" : "2. Assay Sched."}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="results" className="gap-2">
                    <Scale className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "3. Résultats" : "3. Results"}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="handoff" className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "4. Transfert" : "4. Handoff"}
                    </span>
                  </TabsTrigger>
                </TabsList>

                {/* Screen 1: Vault Intake & Receipt Logging */}
                <TabsContent value="intake" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {language === "fr" ? "Réception & Enregistrement de Chaîne de Garde" : "Vault Intake & Receipt Logging"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Vérifiez les scellés, enregistrez les poids et authentifiez l'opérateur"
                          : "Verify seals, record weights, and authenticate operator"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* PO/Tracking Lookup */}
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Sélectionner un PO expédié" : "Select a Shipped PO"} <span className="text-destructive">*</span></Label>
                        <Select
                          value={intakeForm.poReference}
                          onValueChange={(value) => {
                            const selected = shippedPOs.find((po) => po.poId === value);
                            setIntakeForm({
                              ...intakeForm,
                              poReference: value,
                              trackingId: selected?.trackingId || intakeForm.trackingId,
                              grossWeightKg: selected ? String(selected.estimatedWeight) : intakeForm.grossWeightKg,
                            });
                          }}
                        >
                          <SelectTrigger className="font-mono">
                            <SelectValue
                              placeholder={language === "fr" ? "Choisissez un PO expédié" : "Choose a shipped PO"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {shippedPOs.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                {language === "fr" ? "Aucun PO expédié disponible" : "No shipped PO available"}
                              </div>
                            ) : (
                              shippedPOs.map((po) => (
                                <SelectItem key={po.poId} value={po.poId} className="font-mono">
                                  {po.poId}
                                  {po.trackingId ? ` · ${po.trackingId}` : ""}
                                  {` — ${po.counterpartyName}`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {/* Barcode visualization */}
                        <div className="flex justify-center py-2">
                          <div className="flex gap-[2px]">
                            {Array.from({ length: 40 }).map((_, i) => (
                              <div 
                                key={i} 
                                className="bg-foreground" 
                                style={{ 
                                  width: Math.random() > 0.5 ? '2px' : '1px',
                                  height: '40px'
                                }} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Seal Verification */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">
                            {language === "fr" ? "Vérification des Scellés" : "Seal Verification"} <span className="text-destructive">*</span>
                          </Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Seal #1 <span className="text-destructive">*</span></Label>
                              <Input
                                value={intakeForm.seal1}
                                onChange={(e) => setIntakeForm({ ...intakeForm, seal1: e.target.value })}
                                className="font-mono"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Seal #2 <span className="text-destructive">*</span></Label>
                              <Input
                                value={intakeForm.seal2}
                                onChange={(e) => setIntakeForm({ ...intakeForm, seal2: e.target.value })}
                                className="font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Manifest Comparison */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">
                            {language === "fr" ? "Comparaison Manifeste" : "Manifest Comparison"} <span className="text-destructive">*</span>
                          </Label>

                          {/* Expected (manifest) vs received comparison rows */}
                          <div className="rounded-lg border divide-y">
                            {(() => {
                              const selectedPO = shippedPOs.find((po) => po.poId === intakeForm.poReference);
                              const expectedWeight = selectedPO?.estimatedWeight ?? (intakeData?.grossWeightKg as number) ?? 0;
                              const receivedWeight = parseFloat(intakeForm.grossWeightKg) || 0;
                              const weightOk = expectedWeight > 0
                                ? Math.abs(receivedWeight - expectedWeight) / expectedWeight <= 0.05
                                : receivedWeight > 0;
                              const expectedRef = selectedPO?.trackingId || intakeForm.trackingId || "—";
                              const refOk = Boolean(intakeForm.trackingId) && intakeForm.trackingId === expectedRef;
                              const sealsOk = Boolean(intakeForm.seal1 && intakeForm.seal2);

                              const rows = [
                                {
                                  label: language === "fr" ? "Référence / Tracking" : "Reference / Tracking",
                                  expected: expectedRef,
                                  received: intakeForm.trackingId || "—",
                                  ok: refOk,
                                },
                                {
                                  label: language === "fr" ? "Poids attendu (kg)" : "Expected weight (kg)",
                                  expected: expectedWeight ? `${expectedWeight}` : "—",
                                  received: receivedWeight ? `${receivedWeight}` : "—",
                                  ok: weightOk,
                                },
                                {
                                  label: language === "fr" ? "Scellés enregistrés" : "Seals recorded",
                                  expected: "2",
                                  received: `${[intakeForm.seal1, intakeForm.seal2].filter(Boolean).length}`,
                                  ok: sealsOk,
                                },
                              ];

                              return (
                                <>
                                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
                                    <span>{language === "fr" ? "Champ" : "Field"}</span>
                                    <span className="text-right">{language === "fr" ? "Attendu" : "Expected"}</span>
                                    <span className="text-right">{language === "fr" ? "Reçu" : "Received"}</span>
                                    <span className="sr-only">{language === "fr" ? "État" : "Status"}</span>
                                  </div>
                                  {rows.map((row) => (
                                    <div
                                      key={row.label}
                                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                                    >
                                      <span className="text-muted-foreground">{row.label}</span>
                                      <span className="text-right font-mono">{row.expected}</span>
                                      <span className="text-right font-mono">{row.received}</span>
                                      {row.ok ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label={language === "fr" ? "Conforme" : "Match"} />
                                      ) : (
                                        <AlertTriangle className="h-4 w-4 text-destructive" aria-label={language === "fr" ? "Écart" : "Mismatch"} />
                                      )}
                                    </div>
                                  ))}
                                </>
                              );
                            })()}
                          </div>

                          {/* Operator decision */}
                          <div className="flex gap-4">
                            <Button
                              variant={intakeForm.manifestMatch ? "default" : "outline"}
                              className="flex-1"
                              onClick={() => setIntakeForm({ ...intakeForm, manifestMatch: true })}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {language === "fr" ? "Correspondance" : "Match"}
                            </Button>
                            <Button
                              variant={!intakeForm.manifestMatch ? "destructive" : "outline"}
                              className="flex-1"
                              onClick={() => setIntakeForm({ ...intakeForm, manifestMatch: false })}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              {language === "fr" ? "Non-correspondance" : "Mismatch"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Weight Recording */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Enregistrement du Poids" : "Weight Recording"} <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>{language === "fr" ? "Poids brut (kg)" : "Gross Weight (kg)"} <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={intakeForm.grossWeightKg}
                                  onChange={(e) => setIntakeForm({ ...intakeForm, grossWeightKg: e.target.value })}
                                  className="font-mono"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{language === "fr" ? "Poids net (kg)" : "Net Weight (kg)"} <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={intakeForm.netWeightKg}
                                  onChange={(e) => setIntakeForm({ ...intakeForm, netWeightKg: e.target.value })}
                                  className="font-mono"
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <WeightToleranceGauge variance={weightVariance} />
                          </div>
                        </div>
                      </div>

                      {/* Photo Evidence */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Preuves Photographiques" : "Photo Evidence"}
                        </Label>
                        <div className="grid grid-cols-4 gap-4">
                          {[0, 1, 2, 3].map((idx) => {
                            const photo = photoEvidence[idx];
                            if (photo) {
                              return (
                                <div
                                  key={idx}
                                  className="relative aspect-square border rounded-lg overflow-hidden group"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photo.previewUrl || "/placeholder.svg"}
                                    alt={photo.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(idx)}
                                    aria-label={language === "fr" ? "Supprimer la photo" : "Remove photo"}
                                    className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            }
                            // First empty slot is the active uploader
                            const isActiveSlot = idx === photoEvidence.length;
                            return (
                              <label
                                key={idx}
                                className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                                  isActiveSlot && !uploadingPhoto
                                    ? "cursor-pointer hover:bg-muted/50"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                              >
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png"
                                  className="sr-only"
                                  disabled={!isActiveSlot || uploadingPhoto}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePhotoUpload(file);
                                    e.target.value = "";
                                  }}
                                />
                                {uploadingPhoto && isActiveSlot ? (
                                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                                ) : (
                                  <>
                                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                                    <span className="text-xs text-muted-foreground text-center px-2">
                                      {language === "fr" ? "Cliquez pour uploader" : "Click to upload"}
                                    </span>
                                  </>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {`Max 4 images, JPG/PNG, ≤5MB each — ${photoEvidence.length}/4`}
                        </p>
                      </div>

                      {/* Operator Authentication */}
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Authentification Opérateur" : "Operator Authentication"} <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-4">
                          <Label className="shrink-0">One-Time Passcode (OTP) <span className="text-destructive">*</span></Label>
                          <div className="flex gap-2">
                            {[0, 1, 2, 3, 4, 5].map((idx) => (
                              <Input
                                key={idx}
                                ref={(el) => {
                                  otpRefs.current[idx] = el;
                                }}
                                maxLength={1}
                                inputMode="numeric"
                                value={otpDigits[idx]}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                className="w-10 h-12 text-center font-mono text-lg"
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {language === "fr" ? "Envoyé via SMS/Authenticator App" : "Sent via SMS/Authenticator App"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleSaveReception}
                          disabled={isSaving || isSubmitting}
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
                            {language === "fr" ? "Réception sauvegardée" : "Reception saved"}
                          </span>
                        )}
                        <Button 
                          onClick={handleSaveIntake} 
                          disabled={isSubmitting || isSaving}
                          className="flex-1 min-w-40"
                        >
                          {isSubmitting ? (
                            <>{language === "fr" ? "Enregistrement..." : "Saving..."}</>
                          ) : (
                            <>{language === "fr" ? "Enregistrer & Continuer vers Essai" : "Save Intake Record"}</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 2: Assay Scheduling & Lab Integration */}
                <TabsContent value="scheduling" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5" />
                        {language === "fr" ? "Planification Essai & Intégration Labo" : "Assay Scheduling & Lab Integration"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Coordonnez l'extraction d'échantillon et l'envoi vers un laboratoire accrédité ISO 17025"
                          : "Coordinate sample extraction and dispatch to ISO 17025 accredited laboratory"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Sample ID */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{language === "fr" ? "Identifiant d'échantillon" : "Sample ID"}</Label>
                            <Input
                              value={assayForm.sampleId}
                              readOnly
                              className="font-mono bg-muted"
                            />
                          </div>
                          {/* QR Code */}
                          {sampleQrUrl && (
                            <div className="flex justify-center p-3 border rounded-lg bg-white">
                              <img src={sampleQrUrl} alt={assayForm.sampleId} className="w-40 h-40" />
                            </div>
                          )}
                        </div>

                        {/* SLA Countdown Timer */}
                        <div className="space-y-4">
                          <Label>{language === "fr" ? "Minuterie SLA" : "SLA Countdown Timer"}</Label>
                          <Card className="bg-muted/50">
                            <CardContent className="p-4 flex flex-col items-center">
                              <div className="text-4xl font-mono font-bold text-primary">
                                {String(slaCountdown.hours).padStart(2, '0')}:
                                {String(slaCountdown.minutes).padStart(2, '0')}:
                                {String(slaCountdown.seconds).padStart(2, '0')}
                              </div>
                              <div className="text-sm text-muted-foreground mt-2">
                                {language === "fr" ? "H:Min:Sec" : "H:Min:Sec"}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Lab Selector */}
                      <div className="space-y-2">
                        <Label>
                          {language === "fr" ? "Sélecteur de Laboratoire" : "Lab Selector"}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={assayForm.selectedLab}
                          onValueChange={(v) => setAssayForm({ ...assayForm, selectedLab: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === "fr" ? "Sélectionner un laboratoire accrédité..." : "Select accredited lab..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {LABS.map((lab) => (
                              <SelectItem key={lab.id} value={lab.id}>
                                {lab.name} ({language === "fr" ? "Expire le" : "Expires"}: {lab.expiry})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assay Method */}
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Méthode d'Essai" : "Assay Method"}</Label>
                        <RadioGroup
                          value={assayForm.assayMethod}
                          onValueChange={(v) => setAssayForm({ ...assayForm, assayMethod: v })}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fire_assay" id="fire_assay" />
                            <Label htmlFor="fire_assay">Fire Assay</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="xrf" id="xrf" />
                            <Label htmlFor="xrf">XRF</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Courier Tracking Timeline */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Timeline Suivi Transporteur" : "Courier Tracking Timeline"}
                        </Label>
                        <div className="flex items-center justify-between">
                          {[
                            { key: "pickupScheduled", label: language === "fr" ? "Collecte Planifiée" : "Pickup Scheduled", done: courierStatus.pickupScheduled },
                            { key: "inTransit", label: language === "fr" ? "En Transit" : "In Transit", done: courierStatus.inTransit },
                            { key: "delivered", label: language === "fr" ? "Livré" : "Delivered", done: courierStatus.delivered },
                          ].map((step, idx) => (
                            <div key={step.key} className="flex items-center gap-4 flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div className={`w-4 h-4 rounded-full ${step.done ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                <span className="text-xs mt-2 text-center">{step.label}</span>
                              </div>
                              {idx < 2 && (
                                <div className={`flex-1 h-0.5 ${courierStatus.inTransit || courierStatus.delivered ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Custody Log */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Journal de Garde" : "Custody Log"}
                        </Label>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "fr" ? "Horodatage" : "Timestamp"}</TableHead>
                              <TableHead>{language === "fr" ? "Emplacement" : "Location"}</TableHead>
                              <TableHead>{language === "fr" ? "Responsable" : "Handler"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {custodyLog.map((entry, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-sm">{entry.timestamp}</TableCell>
                                <TableCell>{entry.location}</TableCell>
                                <TableCell>{entry.handler}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-4">
                        <Button variant="outline" onClick={() => setActiveTab("intake")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSaveReception}
                          disabled={isSaving || isSubmitting}
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
                          onClick={handleSubmitAssayRequest}
                          disabled={isSubmitting || !assayForm.selectedLab}
                          className="flex-1"
                        >
                          {isSubmitting ? (
                            <>{language === "fr" ? "Soumission..." : "Submitting..."}</>
                          ) : (
                            <>{language === "fr" ? "Soumettre Demande" : "Submit Request"}</>
                          )}
                        </Button>
                        <Button variant="outline">
                          {language === "fr" ? "Annuler" : "Cancel"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 3: Assay Results & Purity Verification */}
                <TabsContent value="results" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "Résultats Essai & Vérification Pureté" : "Assay Results & Purity Verification"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Upload du certificat, analyse de pureté et comparaison de variance"
                          : "Certificate upload, purity breakdown, and variance comparison"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Certificate Upload */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">
                            {language === "fr" ? "Upload Certificat" : "Certificate Upload"}
                          </Label>
                          {assayResults.certificateUploaded ? (
                            <div className="aspect-square border-2 rounded-lg flex flex-col items-center justify-center p-4 relative">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7"
                                onClick={handleRemoveCertificate}
                                aria-label={language === "fr" ? "Retirer le certificat" : "Remove certificate"}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <FileText className="h-12 w-12 text-emerald-600 mb-3" />
                              <span className="text-sm font-medium text-center break-all px-2">
                                {assayResults.certificateFileName}
                              </span>
                              {assayResults.certificatePathname && (
                                <a
                                  href={`/api/vault-intake/certificate?pathname=${encodeURIComponent(assayResults.certificatePathname)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-3 text-sm text-primary underline"
                                >
                                  {language === "fr" ? "Voir le certificat" : "View certificate"}
                                </a>
                              )}
                            </div>
                          ) : (
                            <label
                              className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <input
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                className="sr-only"
                                disabled={uploadingCertificate}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCertificateUpload(file);
                                  e.target.value = "";
                                }}
                              />
                              {uploadingCertificate ? (
                                <Spinner className="h-10 w-10 text-muted-foreground" />
                              ) : (
                                <>
                                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                                  <span className="text-sm text-muted-foreground text-center px-4">
                                    {language === "fr" ? "Cliquez pour uploader (PDF/JPG/PNG)" : "Click to upload (PDF/JPG/PNG)"}
                                  </span>
                                </>
                              )}
                            </label>
                          )}
                        </div>

                        {/* Purity Breakdown */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">
                            {language === "fr" ? "Détail Pureté" : "Purity Breakdown"}
                          </Label>
                          <Table>
                            <TableBody>
                              {([
                                { key: "auPurity", label: "Au" },
                                { key: "agPurity", label: "Ag" },
                                { key: "cuPurity", label: "Cu" },
                                { key: "fePurity", label: "Fe" },
                              ] as const).map(({ key, label }) => (
                                <TableRow key={key}>
                                  <TableCell className="font-medium">{label}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={assayResults[key]}
                                        onChange={(e) => handlePurityChange(key, e.target.value)}
                                        className="w-24 h-8 text-right font-mono"
                                        aria-label={`${label} purity`}
                                      />
                                      <span className="text-muted-foreground">%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Validation Status */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">
                            {language === "fr" ? "Statut Validation" : "Validation Status"}
                          </Label>
                          <div className="flex justify-center">
                            <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${
                              assayResults.validationStatus === "passed" 
                                ? "border-emerald-500 bg-emerald-50" 
                                : assayResults.validationStatus === "rejected"
                                ? "border-red-500 bg-red-50"
                                : "border-muted-foreground/30 bg-muted/30"
                            }`}>
                              <span className={`text-sm font-medium ${
                                assayResults.validationStatus === "passed"
                                  ? "text-emerald-600"
                                  : assayResults.validationStatus === "rejected"
                                  ? "text-red-600"
                                  : "text-muted-foreground"
                              }`}>
                                {assayResults.validationStatus === "passed" 
                                  ? (language === "fr" ? "Validé" : "Passed")
                                  : assayResults.validationStatus === "rejected"
                                  ? (language === "fr" ? "Rejeté" : "Rejected")
                                  : (language === "fr" ? "En attente" : "Pending")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pure Gold Weight */}
                      <div className="p-4 bg-primary/5 rounded-lg">
                        <div className="text-center">
                          <span className="text-sm text-muted-foreground">
                            {language === "fr" ? "Poids Or Pur" : "Pure Gold Weight"}
                          </span>
                          <div className="text-3xl font-bold text-primary">
                            {assayResults.pureGoldWeight.toFixed(2)} g
                          </div>
                        </div>
                      </div>

                      {/* Variance Comparison */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          {language === "fr" ? "Comparaison de Variance" : "Variance Comparison"}
                        </Label>
                        <div className="flex items-center gap-4 mb-4">
                          <Card className="flex-1 p-4">
                            <div className="text-sm text-muted-foreground">
                              {language === "fr" ? "Estimation PO" : "PO Estimate"}
                            </div>
                            <div className="text-xl font-mono font-bold">{assayResults.poEstimate.toFixed(2)} g</div>
                          </Card>
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                          <Card className="flex-1 p-4">
                            <div className="text-sm text-muted-foreground">
                              {language === "fr" ? "Réel" : "Actual"}
                            </div>
                            <div className="text-xl font-mono font-bold">{assayResults.pureGoldWeight.toFixed(2)} g</div>
                          </Card>
                        </div>
                        <PurityVarianceBar variance={purityVariance} />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-4">
                        <Button variant="outline" onClick={() => setActiveTab("scheduling")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSaveReception}
                          disabled={isSaving || isSubmitting}
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
                          onClick={handleValidateResults}
                          disabled={isSubmitting}
                          className="flex-1"
                        >
                          {isSubmitting ? (
                            <>{language === "fr" ? "Validation..." : "Validating..."}</>
                          ) : (
                            <>{language === "fr" ? "Valider Résultats" : "Validate Results"}</>
                          )}
                        </Button>
                        <Button variant="outline">
                          {language === "fr" ? "Demander Re-Essai" : "Request Re-Assay"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Screen 4: Vault Inventory Update & Settlement Handoff */}
                <TabsContent value="handoff" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowRight className="h-5 w-5" />
                        {language === "fr" ? "Mise à Jour Inventaire & Transfert Règlement" : "Vault Inventory Update & Settlement Handoff"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Confirmation finale"
                          : "Final confirmation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Allocation Summary */}
                        <Card className="border-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">
                              {language === "fr" ? "Résumé Allocation" : "Allocation Summary"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Réf. PO:" : "PO Reference:"}
                              </span>
                              <span className="font-mono font-medium">{intakeForm.poReference}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Poids Net:" : "Net Weight:"}
                              </span>
                              <span className="font-mono font-medium">{intakeForm.netWeightKg} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Pureté:" : "Purity:"}
                              </span>
                              <span className="font-mono font-medium">{assayResults.auPurity}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Poids Or Pur:" : "Pure Au Weight:"}
                              </span>
                              <span className="font-mono font-medium">{assayResults.pureGoldWeight.toFixed(2)} g</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Emplacement Coffre:" : "Vault Location:"}
                              </span>
                              <span className="font-mono font-medium">{handoffData.vaultLocation}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Status Transition & Compliance */}
                        <div className="space-y-4">
                          {/* Status Flow */}
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500">RECEIVED</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500">ASSAYED</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className="bg-primary text-primary-foreground">{language === "fr" ? "En attente de règlement" : "Pending Settlement"}</Badge>
                          </div>

                          {/* Compliance Badge */}
                          <Card className="border-emerald-500/50 bg-emerald-50/50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <CheckCircle2 className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="font-semibold text-emerald-700">
                                    {language === "fr" ? "Conforme LBMA RGG" : "LBMA RGG Compliant"}
                                  </div>
                                  <div className="text-sm text-emerald-600">
                                    {language === "fr" ? "Étape 3.2 vérifiée" : "Step 3.2 Verified"}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Audit Hash Preview */}
                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            {language === "fr" ? "Aperçu Hash d'Audit" : "Audit Hash Preview"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-sm bg-background p-3 rounded border">
                              {handoffData.fullAuditHash}
                            </code>
                            <Button variant="outline" size="icon">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex flex-wrap items-center gap-4 pt-4">
                        <Button variant="outline" onClick={() => setActiveTab("results")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSaveReception}
                          disabled={isSaving || isSubmitting}
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
                          onClick={handleLockAndProceed}
                          disabled={isSubmitting}
                          className="flex-1"
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          {isSubmitting ? (
                            <>{language === "fr" ? "Verrouillage..." : "Locking..."}</>
                          ) : (
                            <>{language === "fr" ? "Verrouiller & Procéder au Règlement" : "Lock and Proceed to Settlement"}</>
                          )}
                        </Button>
                        <Button variant="outline">
                          {language === "fr" ? "Demander Correction" : "Request Correction"}
                        </Button>
                        <Button variant="outline">
                          <FileText className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Voir Piste d'Audit" : "View Full Audit Trail"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              {language === "fr" ? "Allocation Verrouillée avec Succès!" : "Allocation Locked Successfully!"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {language === "fr"
                ? "L'enregistrement a été verrouillé cryptographiquement et archivé dans le système de règlement"
                : "Record has been cryptographically locked and archived in the settlement system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "ID Allocation:" : "Allocation ID:"}</span>
              <span className="font-mono font-medium">{handoffData.allocationId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "Poids Or Pur:" : "Pure Au Weight:"}</span>
              <span className="font-mono font-medium">{assayResults.pureGoldWeight.toFixed(2)} g</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "Statut:" : "Status:"}</span>
              <Badge className="bg-emerald-500">{language === "fr" ? "En attente de règlement" : "Pending Settlement"}</Badge>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button onClick={() => router.push("/vault-intake")} className="flex-1">
              {language === "fr" ? "Retour aux Réceptions" : "Back to Intakes"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/settlements")} className="flex-1">
              {language === "fr" ? "Voir Règlements" : "View Settlements"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
