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
  ArrowRight,
  ArrowLeft,
  Shield,
  Lock,
  FileText,
  Copy,
  ExternalLink,
  Save,
  Microscope,
  ClipboardCheck,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

// ─── Equipment register — precision scales ───────────────────────────────────
const SCALES = [
  {
    id: "VLT-SCALE-01",
    model: "Mettler Toledo PR8001",
    lastCalibration: "2026-01-15",
    nextDue: "2027-01-15",
    certifiedBy: "Bureau Veritas",
    expired: false,
  },
  {
    id: "VLT-SCALE-02",
    model: "Sartorius BCE6201",
    lastCalibration: "2026-03-20",
    nextDue: "2027-03-20",
    certifiedBy: "SGS",
    expired: false,
  },
  {
    id: "VLT-SCALE-03",
    model: "Ohaus Defender 5000",
    lastCalibration: "2025-11-10",
    nextDue: "2026-11-10",
    certifiedBy: "Intertek",
    expired: false,
  },
  {
    id: "VLT-SCALE-04",
    model: "A&D FX-120i",
    lastCalibration: "2024-06-01",
    nextDue: "2025-06-01",
    certifiedBy: "—",
    expired: true,
  },
];

// ─── Equipment register — ISO 17025 accredited labs ──────────────────────────
const LABS = [
  {
    id: "lab_a",
    name: "Accredited Lab A",
    type: "External Lab",
    method: "fire_assay" as const,
    accreditationNumber: "ACC-2025-0012",
    body: "ILAC / ISO 17025",
    validTo: "2027-12-31",
    turnaround: "48h",
  },
  {
    id: "lab_b",
    name: "Metalor Technologies",
    type: "External Lab",
    method: "fire_assay" as const,
    accreditationNumber: "ACC-2025-0048",
    body: "ILAC / ISO 17025",
    validTo: "2026-06-15",
    turnaround: "72h",
  },
  {
    id: "lab_c",
    name: "Argor-Heraeus",
    type: "External Lab",
    method: "xrf" as const,
    accreditationNumber: "ACC-2026-0103",
    body: "ILAC / ISO 17025",
    validTo: "2028-03-20",
    turnaround: "24h",
  },
];

// % of calibration life remaining (0-100)
function getCalibrationPct(scale: (typeof SCALES)[number]): number {
  if (scale.expired) return 0;
  const now = Date.now();
  const last = new Date(scale.lastCalibration).getTime();
  const next = new Date(scale.nextDue).getTime();
  const total = next - last;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((next - now) / total) * 100));
}

// % of accreditation life remaining (relative to 1-year window)
function getAccreditationPct(lab: (typeof LABS)[number]): number {
  const now = Date.now();
  const next = new Date(lab.validTo).getTime();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if (next < now) return 0;
  return Math.max(0, Math.min(100, ((next - now) / oneYear) * 100));
}

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
  const [intakeData, setIntakeData] = useState<Record<string, unknown> | null>(null);

  // Shipped POs
  const [shippedPOs, setShippedPOs] = useState<Array<{
    poId: string;
    trackingId: string | null;
    counterpartyName: string;
    estimatedWeight: number;
  }>>([]);

  const [selectedPOInfo, setSelectedPOInfo] = useState<{
    counterpartyName: string;
    poValue: number;
    currency: string;
  }>({ counterpartyName: "—", poValue: 0, currency: "USD" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dispatch");
        if (res.ok) {
          const data = await res.json();
          setShippedPOs(
            (Array.isArray(data) ? data : []).filter(
              (d: { status: string }) => d.status === "in_transit" || d.status === "dispatched"
            )
          );
        }
      } catch { /**/ }
    })();
  }, []);

  // ─── Section 1: Shipment receipt ─────────────────────────────────────────
  const [intakeForm, setIntakeForm] = useState({
    poReference: "PO-2026-0891",
    trackingId: "TRK-990",
    // seal1 = declared seal (manifest), seal2 = physical seal (observed)
    seal1: "SLF-2026-7714A",
    seal2: "",
    manifestMatch: true,
    grossWeightKg: "327.50",
    netWeightKg: "324.85",
    otpCode: "",
  });

  const [barCount, setBarCount] = useState({ expected: 12, received: 12 });

  const sealMismatch =
    Boolean(intakeForm.seal1) &&
    Boolean(intakeForm.seal2) &&
    intakeForm.seal1 !== intakeForm.seal2;
  const countMismatch = barCount.received < barCount.expected;

  // OTP
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Photo evidence
  const [photoEvidence, setPhotoEvidence] = useState<
    Array<{ pathname: string; fileName: string; previewUrl: string }>
  >([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ─── Section 2: Secure transfer & scheduling ──────────────────────────────
  const [secureTransfer, setSecureTransfer] = useState({
    witnessName: "",
    holdingBay: "",
    containerOpened: false,
    barsTransferred: false,
  });

  // Three acceptance declarations for Section 5
  const [declarations, setDeclarations] = useState([false, false, false]);

  const [selectedScale, setSelectedScale] = useState("");
  const [weighingScheduledAt, setWeighingScheduledAt] = useState("");

  const [assayCommission, setAssayCommission] = useState({
    selectedLab: "",
    assayMethod: "fire_assay",
    expectedResultsAt: "",
  });

  // Still generate a sample ID / QR for internal tracking
  const sampleId = `SAMP-${intakeId}-${new Date().getFullYear()}`;
  const [sampleQrUrl, setSampleQrUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(sampleId, { width: 160, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setSampleQrUrl)
      .catch(() => {});
  }, [sampleId]);

  const scaleDetail = SCALES.find((s) => s.id === selectedScale) ?? null;
  const labDetail = LABS.find((l) => l.id === assayCommission.selectedLab) ?? null;

  // ─── Section 3: Independent weighing ─────────────────────────────────────
  const [barWeights, setBarWeights] = useState<Array<{ serial: string; grossWeightG: string; fineness: string }>>(
    Array.from({ length: 12 }, (_, i) => ({
      serial: `BAR-2026-${String(i + 1).padStart(4, "0")}`,
      grossWeightG: "",
      fineness: "",
    }))
  );

  useEffect(() => {
    setBarWeights(
      Array.from({ length: Math.max(1, barCount.received) }, (_, i) => ({
        serial: `BAR-${intakeForm.poReference}-${String(i + 1).padStart(4, "0")}`,
        grossWeightG: "",
        fineness: "",
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barCount.received]);

  // ─── Section 4: Assay results (async) ────────────────────────────────────
  const [assayResults, setAssayResults] = useState({
    auPurity: 99.25,
    agPurity: 0.32,
    cuPurity: 0.18,
    fePurity: 0.07,
    pureGoldWeight: 322.41,
    poEstimate: 325.0,
    certificateUploaded: false,
    certificatePathname: "" as string,
    certificateFileName: "" as string,
    validationStatus: "pending" as "pending" | "passed" | "review" | "rejected",
  });
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  // ─── Section 5: Acceptance ────────────────────────────────────────────────
  const [handoffData] = useState({
    allocationId: "ALLOC-2026-4482",
    vaultLocation: "LON-VLT-07B",
    fullAuditHash: "a3b2c10d4e5f6789bcda15b8a3d4e5f67890abcd",
    lbmaCompliant: true,
  });

  // ─── Load existing PO data ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/vault-intake/${intakeId}`);
        if (!res.ok) return;
        const data = await res.json();
        setIntakeData(data);
        const r = data.reception;
        setIntakeForm((prev) => ({
          ...prev,
          poReference: r?.selectedPoId ?? (data.poReference || prev.poReference),
          trackingId: data.trackingId || prev.trackingId,
          seal1: r?.seal1 ?? prev.seal1,
          seal2: r?.seal2 ?? prev.seal2,
          manifestMatch: r?.manifestMatch ?? prev.manifestMatch,
          grossWeightKg: String(r?.grossWeightKg ?? data.grossWeightKg ?? prev.grossWeightKg),
          netWeightKg: r?.netWeightKg != null ? String(r.netWeightKg) : prev.netWeightKg,
        }));
        if (r?.otpCode) {
          const digits = String(r.otpCode).slice(0, 6).split("");
          setOtpDigits([0, 1, 2, 3, 4, 5].map((i) => digits[i] ?? ""));
        }
        if (r?.labId) {
          setAssayCommission((prev) => ({
            ...prev,
            selectedLab: r.labId,
            assayMethod: r.assayMethod ?? prev.assayMethod,
          }));
        }
        if (r?.scaleId) setSelectedScale(r.scaleId);
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
        const keepPoId = r?.selectedPoId ?? data.id;
        if (keepPoId) {
          setShippedPOs((prev) =>
            prev.some((po) => po.poId === keepPoId)
              ? prev
              : [{ poId: keepPoId, trackingId: data.trackingId ?? null, counterpartyName: data.counterpartyName || "—", estimatedWeight: data.grossWeightKg ?? 0 }, ...prev]
          );
        }
      } catch { /**/ }
    })();
  }, [intakeId]);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const weightVariance = (() => {
    const net = parseFloat(intakeForm.netWeightKg) || 0;
    const gross = parseFloat(intakeForm.grossWeightKg) || 0;
    return gross === 0 ? 0 : ((net - gross) / gross) * 100;
  })();

  const purityVariance =
    ((assayResults.pureGoldWeight - assayResults.poEstimate) / assayResults.poEstimate) * 100;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const buildReceptionPayload = () => ({
    poId: intakeId,
    selectedPoId: intakeForm.poReference || intakeId,
    poReference: intakeForm.poReference,
    trackingId: intakeForm.trackingId,
    counterpartyName:
      shippedPOs.find((po) => po.poId === intakeForm.poReference)?.counterpartyName ||
      selectedPOInfo.counterpartyName,
    seal1: intakeForm.seal1,
    seal2: intakeForm.seal2,
    sealVerified: !sealMismatch && Boolean(intakeForm.seal1 && intakeForm.seal2),
    manifestMatch: intakeForm.manifestMatch,
    grossWeightKg: parseFloat(intakeForm.grossWeightKg) || null,
    netWeightKg: parseFloat(intakeForm.netWeightKg) || null,
    vaultLocation: (intakeData?.vaultLocation as string) || handoffData.vaultLocation,
    operatorId: "vault_operator",
    otpCode: otpDigits.join(""),
    photoEvidence: photoEvidence.map((p) => ({ pathname: p.pathname, fileName: p.fileName })),
    barCountExpected: barCount.expected,
    barCountReceived: barCount.received,
    // vault_scheduling fields
    witnessName: secureTransfer.witnessName,
    holdingBay: secureTransfer.holdingBay,
    scaleId: selectedScale,
    weighingScheduledAt,
    labId: assayCommission.selectedLab,
    assayMethod: assayCommission.assayMethod,
    accreditationNumber: labDetail?.accreditationNumber ?? null,
    expectedResultsAt: assayCommission.expectedResultsAt,
    sampleId,
    // assay results
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

  const handleSaveReception = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (!res.ok) throw new Error("Failed");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch { /**/ } finally {
      setIsSaving(false);
    }
  };

  const handleProceedToTransfer = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (res.ok) setActiveTab("transfer");
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommissionAssay = async () => {
    if (!assayCommission.selectedLab || !selectedScale) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (res.ok) setActiveTab("weighing");
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateResults = async () => {
    setIsSubmitting(true);
    const status: "passed" | "review" =
      Math.abs(purityVariance) <= 0.5 ? "passed" : "review";
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildReceptionPayload(), validationStatus: status }),
      });
      if (res.ok) {
        setAssayResults((prev) => ({ ...prev, validationStatus: status }));
        setActiveTab("handoff");
      }
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockAndProceed = async () => {
    setIsSubmitting(true);
    try {
      let poData = intakeData;
      if (!poData) {
        const r = await fetch(`/api/vault-intake/${intakeId}`);
        if (r.ok) poData = await r.json();
      }
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: intakeId,
          counterpartyId: poData?.counterpartyId || null,
          fineGoldWeightKg: assayResults.pureGoldWeight,
          settlementPricePerOz: 2650,
          currency: "USD",
          paymentMethod: "wire_transfer",
          notes: `Intake validated. PO: ${intakeForm.poReference}, Purity: ${assayResults.auPurity}%`,
        }),
      });
      if (res.ok) {
        await fetch(`/api/purchase-orders/${intakeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending_settlement" }),
        });
        setShowSuccessDialog(true);
      }
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  // Photo handlers
  const handlePhotoUpload = async (file: File) => {
    if (photoEvidence.length >= 4) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("poId", intakeId);
      const res = await fetch("/api/vault-intake/photos", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPhotoEvidence((prev) => [
        ...prev,
        { pathname: data.pathname, fileName: data.fileName, previewUrl: URL.createObjectURL(file) },
      ]);
    } catch (e) {
      alert(language === "fr" ? `Erreur upload: ${(e as Error).message}` : `Upload error: ${(e as Error).message}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCertificateUpload = async (file: File) => {
    setUploadingCertificate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("poId", intakeId);
      const res = await fetch("/api/vault-intake/certificate", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setAssayResults((prev) => ({ ...prev, certificateUploaded: true, certificatePathname: data.pathname, certificateFileName: data.fileName }));
    } catch (e) {
      alert(language === "fr" ? `Erreur upload: ${(e as Error).message}` : `Upload error: ${(e as Error).message}`);
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handlePurityChange = (field: "auPurity" | "agPurity" | "cuPurity" | "fePurity", value: string) => {
    const num = parseFloat(value);
    setAssayResults((prev) => {
      const next = { ...prev, [field]: Number.isNaN(num) ? 0 : num };
      const netWeightG = (parseFloat(intakeForm.netWeightKg) || 0) * 1000;
      if (netWeightG > 0) next.pureGoldWeight = (netWeightG * next.auPurity) / 100;
      return next;
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => { const next = [...prev]; next[index] = digit; return next; });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    else if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    else if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  // ─── Sub-components ───────────────────────────────────────────────────────
  const WeightToleranceGauge = ({ variance }: { variance: number }) => {
    const clamped = Math.max(-10, Math.min(10, variance));
    const angle = (clamped / 10) * 90;
    return (
      <div className="flex flex-col items-center">
        <svg width="200" height="120" viewBox="0 0 200 120">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" strokeWidth="20" strokeLinecap="round" />
          <path d="M 56 100 A 80 80 0 0 1 144 100" fill="none" stroke="#22c55e" strokeWidth="20" />
          <path d="M 32 100 A 80 80 0 0 1 56 100" fill="none" stroke="#eab308" strokeWidth="20" />
          <path d="M 144 100 A 80 80 0 0 1 168 100" fill="none" stroke="#eab308" strokeWidth="20" />
          <path d="M 20 100 A 80 80 0 0 1 32 100" fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" />
          <path d="M 168 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" />
          <line x1="100" y1="100" x2="100" y2="30" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle}, 100, 100)`} />
          <circle cx="100" cy="100" r="8" fill="#1f2937" />
        </svg>
        <div className="flex justify-between w-full px-4 text-xs text-muted-foreground">
          <span>-5%</span><span>0%</span><span>+5%</span>
        </div>
      </div>
    );
  };

  const PurityVarianceBar = ({ variance }: { variance: number }) => {
    const abs = Math.abs(variance);
    let color = "bg-emerald-500";
    if (abs > 0.1 && abs <= 0.3) color = "bg-amber-500";
    if (abs > 0.3) color = "bg-red-500";
    return (
      <div className="space-y-2">
        <div className="flex gap-0 h-3 rounded-full overflow-hidden">
          <div className="flex-1 bg-emerald-500 flex items-center justify-center"><span className="text-[10px] text-white font-medium">±0.1g</span></div>
          <div className="flex-1 bg-amber-500 flex items-center justify-center"><span className="text-[10px] text-white font-medium">±0.1-0.3g</span></div>
          <div className="flex-1 bg-red-500 flex items-center justify-center"><span className="text-[10px] text-white font-medium">{">"}±0.3g</span></div>
        </div>
        <div className="relative h-2 bg-muted rounded-full">
          <div className={`absolute top-0 h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, (abs / 3) * 100)}%`, left: variance < 0 ? `${50 - Math.min(50, (abs / 3) * 50)}%` : "50%" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground" />
        </div>
      </div>
    );
  };

  // ─── Progress bar component used for calibration & accreditation ──────────
  const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );

  // Save button (reused across tabs)
  const SaveBtn = () => (
    <>
      <Button variant="outline" onClick={handleSaveReception} disabled={isSaving || isSubmitting}>
        {isSaving ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" /> : <Save className="mr-2 h-4 w-4" />}
        {language === "fr" ? "Sauvegarder" : "Save"}
      </Button>
      {saveSuccess && (
        <span className="text-sm text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" />
          {language === "fr" ? "Sauvegardé" : "Saved"}
        </span>
      )}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Validation Réception Coffre" : "Vault Intake Validation"}
            subtitle={`${intakeForm.poReference} — ${language === "fr" ? "Workflow US-05" : "US-05 Workflow"}`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">

              {/* PO Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {language === "fr" ? "Résumé Bon de Commande" : "Purchase Order Summary"}
                    </div>
                    {intakeForm.poReference && (
                      <span className="text-sm font-mono text-muted-foreground">{intakeForm.poReference}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intakeForm.poReference ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Bon de Commande" : "PO ID"}</p>
                        <p className="text-sm font-mono font-semibold">{intakeForm.poReference}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Tracking ID</p>
                        <p className="text-sm font-mono">{intakeForm.trackingId || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Poids Brut" : "Gross Weight"}</p>
                        <p className="text-sm font-semibold">{intakeForm.grossWeightKg ? `${intakeForm.grossWeightKg} kg` : "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Valeur Estimée" : "Estimated Value"}</p>
                        <p className="text-sm font-semibold">
                          {selectedPOInfo.poValue ? `${selectedPOInfo.currency} ${selectedPOInfo.poValue.toLocaleString("en-US")}` : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Contrepartie" : "Counterparty"}</p>
                        <p className="text-sm">
                          {shippedPOs.find((po) => po.poId === intakeForm.poReference)?.counterpartyName || selectedPOInfo.counterpartyName || "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {language === "fr" ? "Sélectionnez un PO expédié" : "Select a shipped PO"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ── 5-section tabs ── */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="intake" className="gap-1.5 text-xs">
                    <Package className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === "fr" ? "1. Réception" : "1. Receipt"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="transfer" className="gap-1.5 text-xs">
                    <Warehouse className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === "fr" ? "2. Transfert" : "2. Transfer"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="weighing" className="gap-1.5 text-xs">
                    <Scale className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === "fr" ? "3. Pesée" : "3. Weighing"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="assay" className="gap-1.5 text-xs">
                    <FlaskConical className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === "fr" ? "4. Essai" : "4. Assay"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="handoff" className="gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === "fr" ? "5. Acceptation" : "5. Acceptance"}</span>
                  </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 1 — Shipment Receipt
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="intake" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {language === "fr" ? "Réception & Vérification de l'Expédition" : "Shipment Receipt & Verification"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Vérifiez les scellés, le comptage des barres et enregistrez les données d'arrivée"
                          : "Verify seals, bar count, and record arrival details"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                      {/* PO selector */}
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Sélectionner un PO expédié" : "Select a Shipped PO"} <span className="text-destructive">*</span></Label>
                        <Select
                          value={intakeForm.poReference}
                          onValueChange={(v) => {
                            const sel = shippedPOs.find((po) => po.poId === v);
                            setIntakeForm({ ...intakeForm, poReference: v, trackingId: sel?.trackingId || intakeForm.trackingId, grossWeightKg: sel ? String(sel.estimatedWeight) : intakeForm.grossWeightKg });
                          }}
                        >
                          <SelectTrigger className="font-mono">
                            <SelectValue placeholder={language === "fr" ? "Choisissez un PO expédié" : "Choose a shipped PO"} />
                          </SelectTrigger>
                          <SelectContent>
                            {shippedPOs.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                {language === "fr" ? "Aucun PO expédié disponible" : "No shipped PO available"}
                              </div>
                            ) : (
                              shippedPOs.map((po) => (
                                <SelectItem key={po.poId} value={po.poId} className="font-mono">
                                  {po.poId}{po.trackingId ? ` · ${po.trackingId}` : ""} — {po.counterpartyName}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* ── Tamper seal verification ── */}
                        <div className="space-y-3">
                          <Label className="text-base font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {language === "fr" ? "Vérification Scellés Anti-Effraction" : "Tamper Seal Verification"}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {language === "fr" ? "Scellé déclaré (manifeste)" : "Declared seal (manifest)"}
                              </Label>
                              <Input
                                value={intakeForm.seal1}
                                onChange={(e) => setIntakeForm({ ...intakeForm, seal1: e.target.value })}
                                placeholder="Ex: SLF-2026-7714A"
                                className="font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {language === "fr" ? "Scellé physique (observé sur le conteneur)" : "Physical seal (observed on container)"}
                              </Label>
                              <Input
                                value={intakeForm.seal2}
                                onChange={(e) => setIntakeForm({ ...intakeForm, seal2: e.target.value })}
                                placeholder="Ex: SLF-2026-7714A"
                                className="font-mono"
                              />
                            </div>
                          </div>

                          {/* Seal match indicator */}
                          {intakeForm.seal1 && intakeForm.seal2 && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${sealMismatch ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              {sealMismatch ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                              {sealMismatch
                                ? (language === "fr" ? "Discordance de scellé détectée" : "Seal mismatch detected")
                                : (language === "fr" ? "Scellés correspondants" : "Seals match")}
                            </div>
                          )}

                          {/* Seal escalation */}
                          {sealMismatch && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
                              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-red-800 text-sm">
                                  {language === "fr" ? "Protocole d'escalade requis — SLA 2h" : "Escalation protocol required — 2h SLA"}
                                </p>
                                <p className="text-xs text-red-700 mt-1 mb-3">
                                  {language === "fr"
                                    ? "L'expédition sera placée en quarantaine. Un officier de sécurité doit être notifié immédiatement."
                                    : "Shipment will be quarantined. A Security Officer must be notified immediately."}
                                </p>
                                <Button
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => router.push(`/vault-intake/${intakeId}/security`)}
                                >
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  {language === "fr" ? "Escalader à l'Officier de Sécurité" : "Escalate to Security Officer"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ── Bar count verification ── */}
                        <div className="space-y-3">
                          <Label className="text-base font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {language === "fr" ? "Comptage des Barres" : "Bar Count Verification"}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">{language === "fr" ? "Attendu (manifeste)" : "Expected (manifest)"}</Label>
                              <Input
                                type="number"
                                min={1}
                                value={barCount.expected}
                                onChange={(e) => setBarCount((prev) => ({ ...prev, expected: parseInt(e.target.value, 10) || 0 }))}
                                className="font-mono text-center text-lg font-bold"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">{language === "fr" ? "Reçu (compté)" : "Received (counted)"}</Label>
                              <Input
                                type="number"
                                min={0}
                                value={barCount.received}
                                onChange={(e) => setBarCount((prev) => ({ ...prev, received: parseInt(e.target.value, 10) || 0 }))}
                                className="font-mono text-center text-lg font-bold"
                              />
                            </div>
                          </div>

                          {barCount.expected > 0 && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${countMismatch ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              {countMismatch ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                              {countMismatch
                                ? (language === "fr" ? `${barCount.expected - barCount.received} barre(s) manquante(s)` : `${barCount.expected - barCount.received} bar(s) missing`)
                                : (language === "fr" ? "Comptage conforme" : "Count matches")}
                            </div>
                          )}

                          {/* Count escalation */}
                          {countMismatch && (
                            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-amber-800 text-sm">
                                  {language === "fr" ? "Discordance de comptage — SLA 4h" : "Count discrepancy — 4h SLA"}
                                </p>
                                <p className="text-xs text-amber-700 mt-1 mb-3">
                                  {language === "fr"
                                    ? "Le Gestionnaire Coffre doit être notifié. L'expédition sera mise en attente."
                                    : "Vault Manager must be notified. Shipment will be placed on hold."}
                                </p>
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-700 text-white"
                                  onClick={() => router.push(`/vault-intake/${intakeId}/count-discrepancy`)}
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  {language === "fr" ? "Signaler Discordance" : "Report Discrepancy"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Weight recording */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">{language === "fr" ? "Enregistrement du Poids" : "Weight Recording"} <span className="text-destructive">*</span></Label>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Poids brut (kg)" : "Gross Weight (kg)"} <span className="text-destructive">*</span></Label>
                              <Input type="number" step="0.01" value={intakeForm.grossWeightKg} onChange={(e) => setIntakeForm({ ...intakeForm, grossWeightKg: e.target.value })} className="font-mono" />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Poids net (kg)" : "Net Weight (kg)"} <span className="text-destructive">*</span></Label>
                              <Input type="number" step="0.01" value={intakeForm.netWeightKg} onChange={(e) => setIntakeForm({ ...intakeForm, netWeightKg: e.target.value })} className="font-mono" />
                            </div>
                          </div>
                          <WeightToleranceGauge variance={weightVariance} />
                        </div>
                      </div>

                      {/* Photo evidence */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">{language === "fr" ? "Preuves Photographiques" : "Photo Evidence"}</Label>
                        <div className="grid grid-cols-4 gap-4">
                          {[0, 1, 2, 3].map((idx) => {
                            const photo = photoEvidence[idx];
                            if (photo) {
                              return (
                                <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo.previewUrl || "/placeholder.svg"} alt={photo.fileName} className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => setPhotoEvidence((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            }
                            const isActiveSlot = idx === photoEvidence.length;
                            return (
                              <label key={idx} className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${isActiveSlot && !uploadingPhoto ? "cursor-pointer hover:bg-muted/50" : "opacity-50 cursor-not-allowed"}`}>
                                <input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={!isActiveSlot || uploadingPhoto} onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
                                {uploadingPhoto && isActiveSlot ? <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /> : <><Camera className="h-8 w-8 text-muted-foreground mb-2" /><span className="text-xs text-muted-foreground text-center px-2">{language === "fr" ? "Cliquez pour uploader" : "Click to upload"}</span></>}
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">Max 4 images, JPG/PNG, ≤5MB — {photoEvidence.length}/4</p>
                      </div>

                      {/* OTP */}
                      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                        <Label className="text-base font-semibold">{language === "fr" ? "Authentification Opérateur" : "Operator Authentication"} <span className="text-destructive">*</span></Label>
                        <div className="flex items-center gap-4">
                          <Label className="shrink-0">OTP <span className="text-destructive">*</span></Label>
                          <div className="flex gap-2">
                            {[0, 1, 2, 3, 4, 5].map((idx) => (
                              <Input key={idx} ref={(el) => { otpRefs.current[idx] = el; }} maxLength={1} inputMode="numeric" value={otpDigits[idx]} onChange={(e) => handleOtpChange(idx, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(idx, e)} className="w-10 h-12 text-center font-mono text-lg" />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">{language === "fr" ? "Via SMS / App Authenticator" : "Via SMS / Authenticator App"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <SaveBtn />
                        <Button onClick={handleProceedToTransfer} disabled={isSubmitting || isSaving || sealMismatch} className="flex-1 min-w-40">
                          {isSubmitting ? (language === "fr" ? "Enregistrement..." : "Saving...") : (language === "fr" ? "Enregistrer & Continuer" : "Save & Continue to Transfer")}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 2 — Secure Transfer & Scheduling
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="transfer" className="space-y-4 mt-6">

                  {/* Step A: Secure Transfer Checklist */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5" />
                        {language === "fr" ? "A — Transfert Sécurisé vers la Baie de Stockage" : "A — Secure Transfer to Holding Bay"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Effectuez les étapes sous témoin avant de procéder à la pesée"
                          : "Complete both steps under witness before proceeding to weighing"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4" />
                            {language === "fr" ? "Nom du témoin" : "Witness name"}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={secureTransfer.witnessName}
                            onChange={(e) => setSecureTransfer({ ...secureTransfer, witnessName: e.target.value })}
                            placeholder={language === "fr" ? "Ex: M. Dupont — Responsable Coffre" : "Ex: J. Smith — Vault Supervisor"}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{language === "fr" ? "Baie de stockage assignée" : "Assigned holding bay"} <span className="text-destructive">*</span></Label>
                          <Input
                            value={secureTransfer.holdingBay}
                            onChange={(e) => setSecureTransfer({ ...secureTransfer, holdingBay: e.target.value })}
                            placeholder="Ex: HB-03"
                            className="font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        {[
                          {
                            key: "containerOpened" as const,
                            labelFr: "Conteneur ouvert en présence du témoin — comptage confirmé",
                            labelEn: "Container opened in witness presence — count confirmed",
                          },
                          {
                            key: "barsTransferred" as const,
                            labelFr: "Barres transférées à la baie de stockage avec confirmation du comptage",
                            labelEn: "Bars transferred to holding bay with count confirmation",
                          },
                        ].map(({ key, labelFr, labelEn }) => (
                          <div
                            key={key}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${secureTransfer[key] ? "border-emerald-300 bg-emerald-50/50" : "hover:bg-muted/30"}`}
                          >
                            <Checkbox
                              id={key}
                              checked={secureTransfer[key]}
                              onCheckedChange={(v) => setSecureTransfer({ ...secureTransfer, [key]: Boolean(v) })}
                              className="mt-0.5"
                              disabled={!secureTransfer.witnessName || !secureTransfer.holdingBay}
                            />
                            <label htmlFor={key} className="text-sm cursor-pointer leading-relaxed">
                              {language === "fr" ? labelFr : labelEn}
                            </label>
                            {secureTransfer[key] && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 ml-auto mt-0.5" />}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step B: Scale selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "B — Sélection Balance (Registre Équipements)" : "B — Scale Selection (Equipment Register)"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Seules les balances avec étalonnage en cours sont disponibles"
                          : "Only calibration-current scales are selectable"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Balance de pesée" : "Weighing scale"} <span className="text-destructive">*</span></Label>
                        <Select value={selectedScale} onValueChange={setSelectedScale}>
                          <SelectTrigger className="font-mono">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner une balance étalonnée..." : "Select a calibrated scale..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {SCALES.map((s) => (
                              <SelectItem key={s.id} value={s.id} disabled={s.expired} className="font-mono">
                                {s.id} — {s.model}
                                {s.expired ? (language === "fr" ? " ⚠ Étalonnage expiré" : " ⚠ Calibration expired") : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Calibration status card */}
                      {scaleDetail && (
                        <div className={`rounded-lg border-2 p-4 space-y-3 ${scaleDetail.expired ? "border-red-300 bg-red-50/50" : "border-emerald-300 bg-emerald-50/50"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{language === "fr" ? "Statut d'Étalonnage" : "Calibration Status"}</span>
                            <Badge variant={scaleDetail.expired ? "destructive" : "default"} className={scaleDetail.expired ? "" : "bg-emerald-600"}>
                              {scaleDetail.expired ? (language === "fr" ? "Expiré — Bloqué" : "Expired — Blocked") : (language === "fr" ? "Étalonnage valide" : "Calibration current")}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="text-muted-foreground">{language === "fr" ? "ID Balance" : "Scale ID"}</div><div className="font-mono font-medium">{scaleDetail.id}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Modèle" : "Model"}</div><div className="font-medium">{scaleDetail.model}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Dernier étalonnage" : "Last calibration"}</div><div className="font-mono">{scaleDetail.lastCalibration}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Prochain dû" : "Next due"}</div><div className={`font-mono ${scaleDetail.expired ? "text-red-600 font-semibold" : ""}`}>{scaleDetail.nextDue}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Certifié par" : "Certified by"}</div><div className="font-medium">{scaleDetail.certifiedBy}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{language === "fr" ? "Durée de vie étalonnage" : "Calibration life"}</span>
                              <span>{Math.round(getCalibrationPct(scaleDetail))}%</span>
                            </div>
                            <ProgressBar
                              pct={getCalibrationPct(scaleDetail)}
                              color={scaleDetail.expired ? "bg-red-500" : getCalibrationPct(scaleDetail) > 50 ? "bg-emerald-500" : "bg-amber-500"}
                            />
                          </div>
                          {scaleDetail.expired && (
                            <p className="text-xs text-red-700 font-medium">
                              {language === "fr"
                                ? "⚠ Étalonnage expiré — cette balance ne peut pas être utilisée. Sélectionnez une autre balance."
                                : "⚠ Calibration expired — this scale cannot be used. Please select a different scale."}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label>{language === "fr" ? "Pesée planifiée le" : "Weighing scheduled for"}</Label>
                        <Input
                          type="datetime-local"
                          value={weighingScheduledAt}
                          onChange={(e) => setWeighingScheduledAt(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step C: Lab/assay commissioning */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Microscope className="h-5 w-5" />
                        {language === "fr" ? "C — Commissionnement Essai (Registre Équipements)" : "C — Assay Commissioning (Equipment Register)"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Seuls les laboratoires accrédités ISO 17025 apparaissent dans la liste"
                          : "Only ISO 17025 accredited labs appear in the list"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Laboratoire / Équipement" : "Lab / Equipment"} <span className="text-destructive">*</span></Label>
                          <Select value={assayCommission.selectedLab} onValueChange={(v) => setAssayCommission({ ...assayCommission, selectedLab: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner un labo accrédité..." : "Select accredited lab..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {LABS.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.name} ({l.turnaround})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Méthode d'essai" : "Assay method"}</Label>
                          <RadioGroup
                            value={assayCommission.assayMethod}
                            onValueChange={(v) => setAssayCommission({ ...assayCommission, assayMethod: v })}
                            className="flex gap-6 pt-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="fire_assay" id="fa" />
                              <Label htmlFor="fa">Fire Assay</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="xrf" id="xrf" />
                              <Label htmlFor="xrf">XRF</Label>
                            </div>
                          </RadioGroup>
                          {assayCommission.assayMethod === "xrf" && (
                            <p className="text-xs text-amber-600 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {language === "fr"
                                ? "XRF : précision réduite pour barres à essai requis (intake_assay_required)"
                                : "XRF: reduced precision for bars with intake_assay_required flag"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Accreditation status card */}
                      {labDetail && (
                        <div className="rounded-lg border-2 border-blue-300 bg-blue-50/50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{language === "fr" ? "Statut Accréditation" : "Accreditation Status"}</span>
                            <Badge className="bg-blue-600">ISO 17025 {language === "fr" ? "Valide" : "Valid"}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="text-muted-foreground">{language === "fr" ? "ID Labo / Équip." : "Lab / Equip. ID"}</div><div className="font-mono font-medium">{labDetail.id}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Type" : "Type"}</div><div className="font-medium">{labDetail.type}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Méthode" : "Method"}</div><div className="font-medium">{labDetail.method === "fire_assay" ? "Fire Assay" : "XRF"}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "N° Accréditation" : "Accreditation no."}</div><div className="font-mono">{labDetail.accreditationNumber}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Organisme" : "Body"}</div><div className="font-medium">{labDetail.body}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Valable jusqu'au" : "Valid to"}</div><div className="font-mono">{labDetail.validTo}</div>
                            <div className="text-muted-foreground">{language === "fr" ? "Délai typique" : "Typical turnaround"}</div><div className="font-medium">{labDetail.turnaround}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{language === "fr" ? "Durée de vie accréditation" : "Accreditation life"}</span>
                              <span>{Math.round(getAccreditationPct(labDetail))}%</span>
                            </div>
                            <ProgressBar
                              pct={getAccreditationPct(labDetail)}
                              color={getAccreditationPct(labDetail) > 50 ? "bg-blue-500" : "bg-amber-500"}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label>{language === "fr" ? "Résultats attendus le" : "Expected results by"}</Label>
                        <Input
                          type="datetime-local"
                          value={assayCommission.expectedResultsAt}
                          onChange={(e) => setAssayCommission({ ...assayCommission, expectedResultsAt: e.target.value })}
                          className="font-mono"
                        />
                      </div>

                      {/* Sample QR code */}
                      {sampleQrUrl && (
                        <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                          <div className="bg-white p-1 rounded border">
                            <img src={sampleQrUrl} alt={sampleId} className="w-20 h-20" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "ID d'échantillon" : "Sample ID"}</p>
                            <p className="font-mono font-medium text-sm">{sampleId}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="outline" onClick={() => setActiveTab("intake")}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Retour" : "Back"}
                    </Button>
                    <SaveBtn />
                    <Button
                      onClick={handleCommissionAssay}
                      disabled={
                        isSubmitting ||
                        !secureTransfer.containerOpened ||
                        !secureTransfer.barsTransferred ||
                        !secureTransfer.witnessName ||
                        !secureTransfer.holdingBay ||
                        !selectedScale ||
                        scaleDetail?.expired === true ||
                        !assayCommission.selectedLab
                      }
                      className="flex-1"
                    >
                      {isSubmitting ? (language === "fr" ? "Commissionnement..." : "Commissioning...") : (language === "fr" ? "Valider Transfert & Commissionner Essai" : "Confirm Transfer & Commission Assay")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 3 — Independent Weighing
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="weighing" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "Pesée Indépendante — Barre par Barre" : "Independent Weighing — Bar by Bar"}
                      </CardTitle>
                      <CardDescription>
                        {selectedScale
                          ? `${language === "fr" ? "Balance utilisée" : "Scale in use"}: ${selectedScale} — ${SCALES.find((s) => s.id === selectedScale)?.model}`
                          : (language === "fr" ? "Saisissez le poids brut mesuré pour chaque barre" : "Enter measured gross weight for each bar")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>{language === "fr" ? "N° Série" : "Serial No."}</TableHead>
                            <TableHead>{language === "fr" ? "Poids brut mesuré (g)" : "Measured gross weight (g)"}</TableHead>
                            <TableHead>{language === "fr" ? "Titre / Finesse (‰)" : "Fineness (‰)"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Poids fin (g)" : "Fine weight (g)"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {barWeights.map((bar, idx) => {
                            const gross = parseFloat(bar.grossWeightG) || 0;
                            const fin = parseFloat(bar.fineness) || 0;
                            const fineWeight = gross > 0 && fin > 0 ? Math.floor((gross * fin) / 1000 * 1000) / 1000 : null;
                            return (
                              <TableRow key={bar.serial}>
                                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                <TableCell className="font-mono text-sm">{bar.serial}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={bar.grossWeightG}
                                    onChange={(e) => setBarWeights((prev) => prev.map((b, i) => i === idx ? { ...b, grossWeightG: e.target.value } : b))}
                                    className="h-8 w-32 font-mono"
                                    placeholder="0.000"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="999.9"
                                    value={bar.fineness}
                                    onChange={(e) => setBarWeights((prev) => prev.map((b, i) => i === idx ? { ...b, fineness: e.target.value } : b))}
                                    className="h-8 w-28 font-mono"
                                    placeholder="999.9"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {fineWeight !== null ? fineWeight.toFixed(3) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Totals row */}
                      <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/30 border">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Poids brut total (g)" : "Total gross weight (g)"}</p>
                          <p className="font-mono font-bold text-lg">
                            {barWeights.reduce((s, b) => s + (parseFloat(b.grossWeightG) || 0), 0).toFixed(3)}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Poids fin total LBMA (g)" : "LBMA total fine weight (g)"}</p>
                          <p className="font-mono font-bold text-lg text-primary">
                            {barWeights.reduce((s, b) => {
                              const g = parseFloat(b.grossWeightG) || 0;
                              const f = parseFloat(b.fineness) || 0;
                              return s + (g > 0 && f > 0 ? Math.floor((g * f) / 1000 * 1000) / 1000 : 0);
                            }, 0).toFixed(3)}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Barres pesées" : "Bars weighed"}</p>
                          <p className="font-mono font-bold text-lg">
                            {barWeights.filter((b) => b.grossWeightG).length} / {barWeights.length}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Button variant="outline" onClick={() => setActiveTab("transfer")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <SaveBtn />
                        <Button onClick={() => setActiveTab("assay")} className="flex-1">
                          {language === "fr" ? "Continuer vers Essai" : "Continue to Assay"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 4 — Assay Results (async)
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="assay" className="space-y-4 mt-6">
                  {/* Async notice banner */}
                  {assayCommission.selectedLab && (
                    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                      <Microscope className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-800 text-sm">
                          {language === "fr" ? "Essai en cours — résultats asynchrones" : "Assay in progress — results are asynchronous"}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          {language === "fr" ? "Labo :" : "Lab:"} {LABS.find((l) => l.id === assayCommission.selectedLab)?.name} ·{" "}
                          {language === "fr" ? "Méthode :" : "Method:"} {assayCommission.assayMethod === "fire_assay" ? "Fire Assay" : "XRF"} ·{" "}
                          {assayCommission.expectedResultsAt && `${language === "fr" ? "Résultats attendus le" : "Expected by"}: ${new Date(assayCommission.expectedResultsAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5" />
                        {language === "fr" ? "Résultats Essai & Vérification Pureté" : "Assay Results & Purity Verification"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Saisissez les résultats transmis par le laboratoire et uploadez le certificat"
                          : "Enter results received from the lab and upload the assay certificate"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Certificate */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">{language === "fr" ? "Upload Certificat" : "Certificate Upload"}</Label>
                          {assayResults.certificateUploaded ? (
                            <div className="aspect-square border-2 rounded-lg flex flex-col items-center justify-center p-4 relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setAssayResults((prev) => ({ ...prev, certificateUploaded: false, certificatePathname: "", certificateFileName: "" }))}>
                                <X className="h-4 w-4" />
                              </Button>
                              <FileText className="h-12 w-12 text-emerald-600 mb-3" />
                              <span className="text-sm font-medium text-center break-all px-2">{assayResults.certificateFileName}</span>
                              {assayResults.certificatePathname && (
                                <a href={`/api/vault-intake/certificate?pathname=${encodeURIComponent(assayResults.certificatePathname)}`} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm text-primary underline">
                                  {language === "fr" ? "Voir le certificat" : "View certificate"}
                                </a>
                              )}
                            </div>
                          ) : (
                            <label className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                              <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={uploadingCertificate} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCertificateUpload(f); e.target.value = ""; }} />
                              {uploadingCertificate ? <Spinner className="h-10 w-10 text-muted-foreground" /> : <><Upload className="h-12 w-12 text-muted-foreground mb-4" /><span className="text-sm text-muted-foreground text-center px-4">{language === "fr" ? "Cliquez (PDF/JPG/PNG)" : "Click to upload (PDF/JPG/PNG)"}</span></>}
                            </label>
                          )}
                        </div>

                        {/* Purity breakdown */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">{language === "fr" ? "Détail Pureté" : "Purity Breakdown"}</Label>
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
                                      <Input type="number" step="0.01" min="0" max="100" value={assayResults[key]} onChange={(e) => handlePurityChange(key, e.target.value)} className="w-24 h-8 text-right font-mono" />
                                      <span className="text-muted-foreground">%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Validation status */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">{language === "fr" ? "Statut Validation" : "Validation Status"}</Label>
                          <div className="flex justify-center">
                            <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${assayResults.validationStatus === "passed" ? "border-emerald-500 bg-emerald-50" : assayResults.validationStatus === "rejected" ? "border-red-500 bg-red-50" : "border-muted-foreground/30 bg-muted/30"}`}>
                              <span className={`text-sm font-medium ${assayResults.validationStatus === "passed" ? "text-emerald-600" : assayResults.validationStatus === "rejected" ? "text-red-600" : "text-muted-foreground"}`}>
                                {assayResults.validationStatus === "passed" ? (language === "fr" ? "Validé" : "Passed") : assayResults.validationStatus === "rejected" ? (language === "fr" ? "Rejeté" : "Rejected") : (language === "fr" ? "En attente" : "Pending")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pure gold weight */}
                      <div className="p-4 bg-primary/5 rounded-lg text-center">
                        <span className="text-sm text-muted-foreground">{language === "fr" ? "Poids Or Pur" : "Pure Gold Weight"}</span>
                        <div className="text-3xl font-bold text-primary">{assayResults.pureGoldWeight.toFixed(2)} g</div>
                      </div>

                      {/* Variance comparison */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">{language === "fr" ? "Comparaison de Variance" : "Variance Comparison"}</Label>
                        <div className="flex items-center gap-4 mb-4">
                          <Card className="flex-1 p-4">
                            <div className="text-sm text-muted-foreground">{language === "fr" ? "Estimation PO" : "PO Estimate"}</div>
                            <div className="text-xl font-mono font-bold">{assayResults.poEstimate.toFixed(2)} g</div>
                          </Card>
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                          <Card className="flex-1 p-4">
                            <div className="text-sm text-muted-foreground">{language === "fr" ? "Réel" : "Actual"}</div>
                            <div className="text-xl font-mono font-bold">{assayResults.pureGoldWeight.toFixed(2)} g</div>
                          </Card>
                        </div>
                        <PurityVarianceBar variance={purityVariance} />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Button variant="outline" onClick={() => setActiveTab("weighing")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <SaveBtn />
                        <Button onClick={handleValidateResults} disabled={isSubmitting} className="flex-1">
                          {isSubmitting ? (language === "fr" ? "Validation..." : "Validating...") : (language === "fr" ? "Valider Résultats" : "Validate Results")}
                        </Button>
                        <Button variant="outline">{language === "fr" ? "Demander Re-Essai" : "Request Re-Assay"}</Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 5 — Acceptance & Settlement
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="handoff" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        {language === "fr" ? "Décision d'Acceptation & Transfert Règlement" : "Acceptance Decision & Settlement Handoff"}
                      </CardTitle>
                      <CardDescription>{language === "fr" ? "Confirmation finale — trois déclarations requises" : "Final confirmation — three declarations required"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Allocation summary */}
                        <Card className="border-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{language === "fr" ? "Résumé Allocation" : "Allocation Summary"}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {[
                              { label: language === "fr" ? "Réf. PO" : "PO Reference", value: intakeForm.poReference },
                              { label: language === "fr" ? "Poids Net" : "Net Weight", value: `${intakeForm.netWeightKg} kg` },
                              { label: language === "fr" ? "Pureté Au" : "Au Purity", value: `${assayResults.auPurity}%` },
                              { label: language === "fr" ? "Poids Or Pur" : "Pure Au Weight", value: `${assayResults.pureGoldWeight.toFixed(2)} g` },
                              { label: language === "fr" ? "Balance utilisée" : "Scale used", value: selectedScale || "—" },
                              { label: language === "fr" ? "Laboratoire" : "Lab", value: labDetail?.name || "—" },
                              { label: language === "fr" ? "N° Accréditation" : "Accreditation no.", value: labDetail?.accreditationNumber || "—" },
                              { label: language === "fr" ? "Emplacement Coffre" : "Vault Location", value: handoffData.vaultLocation },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-muted-foreground">{label}:</span>
                                <span className="font-mono font-medium">{value}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        {/* Status flow & compliance */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500">RECEIVED</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500">ASSAYED</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className="bg-primary text-primary-foreground">{language === "fr" ? "En attente règlement" : "Pending Settlement"}</Badge>
                          </div>

                          <Card className="border-emerald-500/50 bg-emerald-50/50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <CheckCircle2 className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="font-semibold text-emerald-700">{language === "fr" ? "Conforme LBMA RGG" : "LBMA RGG Compliant"}</div>
                                  <div className="text-sm text-emerald-600">{language === "fr" ? "Étape 3.2 vérifiée" : "Step 3.2 Verified"}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Three acceptance declarations */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">{language === "fr" ? "Déclarations d'acceptation" : "Acceptance declarations"}</Label>
                            {[
                              {
                                idx: 0,
                                fr: "Je confirme que les barres ont été pesées sur la balance étalonnée sélectionnée",
                                en: "I confirm bars were weighed on the selected calibrated scale",
                              },
                              {
                                idx: 1,
                                fr: "Je confirme que le certificat d'essai reçu du laboratoire accrédité est authentique",
                                en: "I confirm the assay certificate received from the accredited lab is genuine",
                              },
                              {
                                idx: 2,
                                fr: "Je confirme que les données ci-dessus sont exactes et autorise le règlement",
                                en: "I confirm the above data is accurate and autorise le règlement",
                              },
                            ].map(({ idx, fr, en }) => (
                              <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${declarations[idx] ? "border-emerald-300 bg-emerald-50/50" : "hover:bg-muted/30"}`}>
                                <Checkbox
                                  id={`decl-${idx}`}
                                  checked={declarations[idx]}
                                  onCheckedChange={(v) => setDeclarations((prev) => prev.map((d, i) => i === idx ? Boolean(v) : d))}
                                  className="mt-0.5"
                                />
                                <label htmlFor={`decl-${idx}`} className="cursor-pointer leading-relaxed">{language === "fr" ? fr : en}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Audit hash */}
                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            {language === "fr" ? "Aperçu Hash d'Audit" : "Audit Hash Preview"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-sm bg-background p-3 rounded border">{handoffData.fullAuditHash}</code>
                            <Button variant="outline" size="icon"><Copy className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Button variant="outline" onClick={() => setActiveTab("assay")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <SaveBtn />
                        <Button onClick={handleLockAndProceed} disabled={isSubmitting || !declarations.every(Boolean)} className="flex-1">
                          <Lock className="mr-2 h-4 w-4" />
                          {isSubmitting ? (language === "fr" ? "Verrouillage..." : "Locking...") : (language === "fr" ? "Verrouiller & Procéder au Règlement" : "Lock and Proceed to Settlement")}
                        </Button>
                        <Button variant="outline">
                          <FileText className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Piste d'Audit" : "Full Audit Trail"}
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

      {/* Success dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              {language === "fr" ? "Allocation Verrouillée avec Succès !" : "Allocation Locked Successfully!"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {language === "fr"
                ? "L'enregistrement a été verrouillé cryptographiquement et archivé dans le système de règlement"
                : "Record has been cryptographically locked and archived in the settlement system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "ID Allocation :" : "Allocation ID:"}</span>
              <span className="font-mono font-medium">{handoffData.allocationId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "Poids Or Pur :" : "Pure Au Weight:"}</span>
              <span className="font-mono font-medium">{assayResults.pureGoldWeight.toFixed(2)} g</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{language === "fr" ? "Statut :" : "Status:"}</span>
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
