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

// ─── Troy oz ↔ gram conversion (matches app/api/purchase-orders/[id]/manifest/route.ts) ──
const OZ_TO_GRAM = 31.1035;

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
    validTo: "2026-09-10",
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

type EquipmentState = "ok" | "near" | "over";

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

function getScaleState(scale: (typeof SCALES)[number]): EquipmentState {
  if (scale.expired) return "over";
  return getCalibrationPct(scale) <= 20 ? "near" : "ok";
}

// % of accreditation life remaining (relative to 1-year window)
function getAccreditationPct(lab: (typeof LABS)[number]): number {
  const now = Date.now();
  const next = new Date(lab.validTo).getTime();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if (next < now) return 0;
  return Math.max(0, Math.min(100, ((next - now) / oneYear) * 100));
}

function getLabState(lab: (typeof LABS)[number]): EquipmentState {
  if (new Date(lab.validTo).getTime() < Date.now()) return "over";
  return getAccreditationPct(lab) <= 20 ? "near" : "ok";
}

// ─── Per-bar record shared by the weighing (§3) and assay (§4) steps ─────────
interface BarRecord {
  serial: string;
  manifestWeightG: number | null; // declared at dispatch (US-04 manifest), null if no manifest detail
  vaultGrossWeightG: string; // entered in §3
  manifestFineness: number | null; // declared at dispatch — stands in for a "reference certificate"
  vaultFineness: string; // entered in §4
}

interface ManifestBar {
  barNumber?: string;
  grossWeightKg?: number;
  fineness?: number;
}

interface ManifestInfo {
  sealPrimaryDeclared: string | null;
  sealSecondaryDeclared: string | null;
  totalBars: number | null;
  carrier: string | null;
  totalGrossWeightKg: number | null;
  totalFineOz: number | null;
  poFineOz: number | null;
  destinationVault: string | null;
  bars: ManifestBar[];
}

type SealCondition = "intact" | "broken" | null;
interface SealState {
  declared: string;
  physical: string;
  condition: SealCondition;
}

function weightVarianceOf(bar: BarRecord): number | null {
  const vault = parseFloat(bar.vaultGrossWeightG);
  if (!bar.manifestWeightG || bar.manifestWeightG <= 0 || isNaN(vault) || vault <= 0) return null;
  return ((vault - bar.manifestWeightG) / bar.manifestWeightG) * 100;
}

function fineWeightOf(bar: BarRecord): number | null {
  const vault = parseFloat(bar.vaultGrossWeightG);
  const fineness = parseFloat(bar.vaultFineness);
  if (isNaN(vault) || isNaN(fineness) || vault <= 0 || fineness <= 0) return null;
  return Math.floor(((vault * fineness) / 1000) * 1000) / 1000;
}

type AssayStatus = "pending" | "confirmed" | "diverges" | "below_floor";
function assayStatusOf(bar: BarRecord): AssayStatus {
  const fineness = parseFloat(bar.vaultFineness);
  if (!bar.vaultFineness || isNaN(fineness)) return "pending";
  if (fineness < 995.0) return "below_floor";
  if (bar.manifestFineness != null && Math.abs(fineness - bar.manifestFineness) > 1.0) return "diverges";
  return "confirmed";
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
  const [manifest, setManifest] = useState<ManifestInfo | null>(null);
  const [receivedByDefault, setReceivedByDefault] = useState<string>("");

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
    grossWeightKg: "327.50",
    netWeightKg: "324.85",
    arrivalDate: "",
    arrivalTime: "",
    carrierRepPresent: "",
    conditionOnArrival: "good",
  });

  const [seals, setSeals] = useState<{ primary: SealState; secondary: SealState }>({
    primary: { declared: "", physical: "", condition: null },
    secondary: { declared: "", physical: "", condition: null },
  });

  const [barCount, setBarCount] = useState({ expected: 0, received: 0 });

  const sealMatch = (role: "primary" | "secondary") => {
    const s = seals[role];
    if (!s.declared || !s.physical) return null;
    return s.physical.trim().toUpperCase() === s.declared.trim().toUpperCase();
  };
  const sealMismatch =
    (["primary", "secondary"] as const).some((role) => seals[role].condition === "broken") ||
    (["primary", "secondary"] as const).some((role) => sealMatch(role) === false);
  const secondarySealLocked = !seals.primary.physical.trim();
  const countMismatch = barCount.expected > 0 && barCount.received < barCount.expected;

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

  const [declarations, setDeclarations] = useState([false, false, false]);

  const [selectedScale, setSelectedScale] = useState("");
  const [weighingScheduledAt, setWeighingScheduledAt] = useState("");

  const [assayCommission, setAssayCommission] = useState({
    selectedLab: "",
    assayMethod: "fire_assay",
    expectedResultsAt: "",
  });

  const sampleId = `SAMP-${intakeId}-${new Date().getFullYear()}`;
  const [sampleQrUrl, setSampleQrUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(sampleId, { width: 160, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setSampleQrUrl)
      .catch(() => {});
  }, [sampleId]);

  const scaleDetail = SCALES.find((s) => s.id === selectedScale) ?? null;
  const labDetail = LABS.find((l) => l.id === assayCommission.selectedLab) ?? null;

  // ─── Sections 3+4: per-bar weighing & assay (same bar identity throughout) ─
  const [barRecords, setBarRecords] = useState<BarRecord[]>([]);
  const barRecordsInitialized = useRef(false);

  // Initialize bar records from the counterparty manifest once it (or the bar
  // count) is known — real declared weight/fineness per bar when available,
  // otherwise an even split of the total gross weight with no fineness reference.
  useEffect(() => {
    if (barRecordsInitialized.current) return;
    const received = barCount.received;
    if (received <= 0) return;
    barRecordsInitialized.current = true;
    const manifestBars = manifest?.bars ?? [];
    if (manifestBars.length > 0) {
      setBarRecords(
        manifestBars.map((b, i) => ({
          serial: b.barNumber || `BAR-${intakeForm.poReference}-${String(i + 1).padStart(4, "0")}`,
          manifestWeightG: b.grossWeightKg != null ? b.grossWeightKg * 1000 : null,
          vaultGrossWeightG: "",
          manifestFineness: b.fineness ?? null,
          vaultFineness: "",
        }))
      );
    } else {
      const totalG = (parseFloat(intakeForm.grossWeightKg) || 0) * 1000;
      const perBarG = received > 0 ? totalG / received : null;
      setBarRecords(
        Array.from({ length: received }, (_, i) => ({
          serial: `BAR-${intakeForm.poReference}-${String(i + 1).padStart(4, "0")}`,
          manifestWeightG: perBarG,
          vaultGrossWeightG: "",
          manifestFineness: null,
          vaultFineness: "",
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barCount.received, manifest]);

  // Certificate (global lab document, complements the per-bar figures)
  const [certificate, setCertificate] = useState({
    uploaded: false,
    pathname: "" as string,
    fileName: "" as string,
  });
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  // ─── Section 5: Acceptance ────────────────────────────────────────────────
  const [handoffData] = useState({
    allocationId: "ALLOC-2026-4482",
    vaultLocation: "LON-VLT-07B",
    fullAuditHash: "a3b2c10d4e5f6789bcda15b8a3d4e5f67890abcd",
    lbmaCompliant: true,
  });

  // ─── Load existing PO data (+ US-04 manifest + saved reception) ──────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/vault-intake/${intakeId}`);
        if (!res.ok) return;
        const data = await res.json();
        setIntakeData(data);
        const m = (data.manifest ?? null) as ManifestInfo | null;
        setManifest(m);
        setReceivedByDefault(data.receivedByDefault || "");
        const r = data.reception;

        setIntakeForm((prev) => ({
          ...prev,
          poReference: r?.selectedPoId ?? (data.poReference || prev.poReference),
          trackingId: data.trackingId || prev.trackingId,
          grossWeightKg: String(r?.grossWeightKg ?? data.grossWeightKg ?? prev.grossWeightKg),
          netWeightKg: r?.netWeightKg != null ? String(r.netWeightKg) : prev.netWeightKg,
          arrivalDate: r?.arrivalDate ?? prev.arrivalDate,
          arrivalTime: r?.arrivalTime ?? prev.arrivalTime,
          carrierRepPresent: r?.carrierRepPresent ?? prev.carrierRepPresent,
          conditionOnArrival: r?.conditionOnArrival ?? prev.conditionOnArrival,
        }));

        setSeals({
          primary: {
            declared: m?.sealPrimaryDeclared ?? "",
            physical: r?.sealVerifications?.[0]?.physical ?? r?.seal1 ?? "",
            condition: r?.sealVerifications?.[0]?.condition ?? null,
          },
          secondary: {
            declared: m?.sealSecondaryDeclared ?? "",
            physical: r?.sealVerifications?.[1]?.physical ?? r?.seal2 ?? "",
            condition: r?.sealVerifications?.[1]?.condition ?? null,
          },
        });

        setBarCount({
          expected: r?.barCountExpected ?? m?.totalBars ?? 0,
          received: r?.barCountReceived ?? m?.totalBars ?? 0,
        });

        if (r?.otpCode) {
          const digits = String(r.otpCode).slice(0, 6).split("");
          setOtpDigits([0, 1, 2, 3, 4, 5].map((i) => digits[i] ?? ""));
        }

        setSecureTransfer((prev) => ({
          witnessName: r?.witnessName ?? prev.witnessName,
          holdingBay: r?.holdingBay ?? prev.holdingBay,
          containerOpened: r?.containerOpened ?? prev.containerOpened,
          barsTransferred: r?.barsTransferred ?? prev.barsTransferred,
        }));
        if (r?.labId) {
          setAssayCommission((prev) => ({
            ...prev,
            selectedLab: r.labId,
            assayMethod: r.assayMethod ?? prev.assayMethod,
            expectedResultsAt: r.expectedResultsAt ?? prev.expectedResultsAt,
          }));
        }
        if (r?.scaleId) setSelectedScale(r.scaleId);
        if (r?.weighingScheduledAt) setWeighingScheduledAt(r.weighingScheduledAt);

        if (Array.isArray(r?.barRecords) && r.barRecords.length > 0) {
          barRecordsInitialized.current = true;
          setBarRecords(r.barRecords);
        }

        setCertificate({
          uploaded: Boolean(r?.certificatePathname),
          pathname: r?.certificatePathname ?? "",
          fileName: r?.certificateFileName ?? "",
        });

        setDeclarations([
          Boolean(r?.declarationMeasurements),
          Boolean(r?.declarationAssay),
          Boolean(r?.declarationCompliance),
        ]);

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

  const totalManifestWeightG = barRecords.reduce((s, b) => s + (b.manifestWeightG || 0), 0);
  const totalVaultWeightG = barRecords.reduce((s, b) => s + (parseFloat(b.vaultGrossWeightG) || 0), 0);
  const barsWeighedCount = barRecords.filter((b) => b.vaultGrossWeightG).length;

  const totalFineWeightG = barRecords.reduce((s, b) => s + (fineWeightOf(b) || 0), 0);
  const barsAssayedCount = barRecords.filter((b) => b.vaultFineness).length;
  const anyBarBelowFloor = barRecords.some((b) => b.vaultFineness && assayStatusOf(b) === "below_floor");
  const anyBarDiverges = barRecords.some((b) => b.vaultFineness && assayStatusOf(b) === "diverges");

  const poFineWeightG = manifest?.poFineOz != null ? manifest.poFineOz * OZ_TO_GRAM : null;
  const purityVariance =
    poFineWeightG && poFineWeightG > 0 ? ((totalFineWeightG - poFineWeightG) / poFineWeightG) * 100 : null;

  const overallValidationStatus: "pending" | "passed" | "review" | "rejected" =
    barsAssayedCount === 0
      ? "pending"
      : anyBarBelowFloor
      ? "rejected"
      : anyBarDiverges || (purityVariance != null && Math.abs(purityVariance) > 0.5)
      ? "review"
      : "passed";

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const buildReceptionPayload = () => ({
    poId: intakeId,
    selectedPoId: intakeForm.poReference || intakeId,
    poReference: intakeForm.poReference,
    trackingId: intakeForm.trackingId,
    counterpartyName:
      shippedPOs.find((po) => po.poId === intakeForm.poReference)?.counterpartyName ||
      selectedPOInfo.counterpartyName,
    seal1: seals.primary.physical,
    seal2: seals.secondary.physical,
    sealVerified: !sealMismatch && Boolean(seals.primary.physical && seals.secondary.physical),
    manifestMatch: !sealMismatch,
    grossWeightKg: parseFloat(intakeForm.grossWeightKg) || null,
    netWeightKg: parseFloat(intakeForm.netWeightKg) || null,
    vaultLocation: (intakeData?.vaultLocation as string) || handoffData.vaultLocation,
    operatorId: "vault_operator",
    otpCode: otpDigits.join(""),
    photoEvidence: photoEvidence.map((p) => ({ pathname: p.pathname, fileName: p.fileName })),
    arrivalDate: intakeForm.arrivalDate || null,
    arrivalTime: intakeForm.arrivalTime || null,
    receivedBy: receivedByDefault || null,
    carrierName: manifest?.carrier ?? null,
    carrierRepPresent: intakeForm.carrierRepPresent || null,
    conditionOnArrival: intakeForm.conditionOnArrival || null,
    barCountExpected: barCount.expected || null,
    barCountReceived: barCount.received || null,
    sealVerifications: [
      { role: "primary", declared: seals.primary.declared, physical: seals.primary.physical, condition: seals.primary.condition, match: sealMatch("primary") },
      { role: "secondary", declared: seals.secondary.declared, physical: seals.secondary.physical, condition: seals.secondary.condition, match: sealMatch("secondary") },
    ],
    // vault_scheduling fields
    witnessName: secureTransfer.witnessName,
    holdingBay: secureTransfer.holdingBay,
    containerOpened: secureTransfer.containerOpened,
    barsTransferred: secureTransfer.barsTransferred,
    scaleId: selectedScale,
    weighingScheduledAt,
    labId: assayCommission.selectedLab,
    assayMethod: assayCommission.assayMethod,
    accreditationNumber: labDetail?.accreditationNumber ?? null,
    expectedResultsAt: assayCommission.expectedResultsAt,
    sampleId,
    // per-bar weighing + assay
    barRecords,
    pureGoldWeight: totalFineWeightG,
    poEstimate: poFineWeightG,
    validationStatus: overallValidationStatus,
    certificatePathname: certificate.pathname || null,
    certificateFileName: certificate.fileName || null,
    declarationMeasurements: declarations[0],
    declarationAssay: declarations[1],
    declarationCompliance: declarations[2],
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

  const handleContinueToAssay = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (res.ok) setActiveTab("assay");
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateResults = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vault-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReceptionPayload()),
      });
      if (res.ok) setActiveTab("handoff");
    } catch { /**/ } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReassay = () => {
    setBarRecords((prev) => prev.map((b) => ({ ...b, vaultFineness: "" })));
    setCertificate({ uploaded: false, pathname: "", fileName: "" });
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
          fineGoldWeightKg: totalFineWeightG / 1000,
          settlementPricePerOz: 2650,
          currency: "USD",
          paymentMethod: "wire_transfer",
          notes: `Intake validated. PO: ${intakeForm.poReference}, Bars assayed: ${barsAssayedCount}/${barRecords.length}`,
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
      setCertificate({ uploaded: true, pathname: data.pathname, fileName: data.fileName });
    } catch (e) {
      alert(language === "fr" ? `Erreur upload: ${(e as Error).message}` : `Upload error: ${(e as Error).message}`);
    } finally {
      setUploadingCertificate(false);
    }
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

  // ─── Progress bar component used for calibration & accreditation ──────────
  const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );

  const stateColor = (state: EquipmentState) =>
    state === "over" ? "bg-red-500" : state === "near" ? "bg-amber-500" : "bg-emerald-500";

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

  const assayStatusBadge = (status: AssayStatus, required: boolean) => {
    if (status === "pending") {
      return <Badge variant={required ? "outline" : "secondary"} className={required ? "border-amber-400 text-amber-700 bg-amber-50" : ""}>{required ? (language === "fr" ? "Requis" : "Required") : (language === "fr" ? "En attente" : "Pending")}</Badge>;
    }
    if (status === "below_floor") return <Badge variant="destructive">{language === "fr" ? "Sous le seuil" : "Below floor"}</Badge>;
    if (status === "diverges") return <Badge className="bg-amber-500 hover:bg-amber-500">{language === "fr" ? "Diverge" : "Diverges"}</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">{language === "fr" ? "Confirmé" : "Confirmed"}</Badge>;
  };

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

                      {/* Arrival details */}
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{language === "fr" ? "Date d'arrivée" : "Arrival date"}</Label>
                          <Input type="date" value={intakeForm.arrivalDate} onChange={(e) => setIntakeForm({ ...intakeForm, arrivalDate: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{language === "fr" ? "Heure d'arrivée" : "Arrival time"}</Label>
                          <Input type="time" value={intakeForm.arrivalTime} onChange={(e) => setIntakeForm({ ...intakeForm, arrivalTime: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{language === "fr" ? "Reçu par" : "Received by"}</Label>
                          <Input value={receivedByDefault || (language === "fr" ? "Officier Coffre" : "Vault Officer")} readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{language === "fr" ? "Transporteur" : "Carrier"}</Label>
                          <Input value={manifest?.carrier || "—"} readOnly />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* ── Tamper seal verification ── */}
                        <div className="space-y-3">
                          <Label className="text-base font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {language === "fr" ? "Vérification Scellés Anti-Effraction" : "Tamper Seal Verification"}
                            <span className="text-destructive">*</span>
                          </Label>

                          {/* Primary seal */}
                          <div className={`rounded-lg border-2 p-3 space-y-2 ${seals.primary.condition === "broken" || sealMatch("primary") === false ? "border-red-300 bg-red-50/40" : sealMatch("primary") === true ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{language === "fr" ? "Scellé primaire" : "Primary seal"}</span>
                              {sealMatch("primary") === true && <Badge className="bg-emerald-600 hover:bg-emerald-600">{language === "fr" ? "Correspond" : "Matched"}</Badge>}
                              {sealMatch("primary") === false && <Badge variant="destructive">{language === "fr" ? "Discordance" : "Mismatch"}</Badge>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{language === "fr" ? "Déclaré (manifeste)" : "Manifest declared"}</Label>
                                <Input value={seals.primary.declared || "—"} readOnly className="font-mono bg-muted/40" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{language === "fr" ? "Physique (observé)" : "Physical (observed)"}</Label>
                                <Input
                                  value={seals.primary.physical}
                                  onChange={(e) => setSeals((prev) => ({ ...prev, primary: { ...prev.primary, physical: e.target.value.toUpperCase() } }))}
                                  placeholder={language === "fr" ? "Saisir tel qu'estampillé" : "Type exactly as stamped"}
                                  className="font-mono"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" className={seals.primary.condition === "intact" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : ""} onClick={() => setSeals((prev) => ({ ...prev, primary: { ...prev.primary, condition: "intact" } }))}>
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{language === "fr" ? "Intact" : "Intact"}
                              </Button>
                              <Button type="button" size="sm" variant="outline" className={seals.primary.condition === "broken" ? "border-red-500 bg-red-100 text-red-800" : ""} onClick={() => setSeals((prev) => ({ ...prev, primary: { ...prev.primary, condition: "broken" } }))}>
                                <X className="mr-1.5 h-3.5 w-3.5" />{language === "fr" ? "Cassé / manquant" : "Broken / missing"}
                              </Button>
                            </div>
                          </div>

                          {/* Secondary seal — locked until primary has a value */}
                          <div className={`rounded-lg border-2 p-3 space-y-2 transition-opacity ${secondarySealLocked ? "opacity-50 pointer-events-none" : ""} ${seals.secondary.condition === "broken" || sealMatch("secondary") === false ? "border-red-300 bg-red-50/40" : sealMatch("secondary") === true ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{language === "fr" ? "Scellé secondaire" : "Secondary seal"}</span>
                              {secondarySealLocked ? (
                                <Badge variant="secondary">{language === "fr" ? "Compléter le primaire d'abord" : "Complete primary first"}</Badge>
                              ) : (
                                <>
                                  {sealMatch("secondary") === true && <Badge className="bg-emerald-600 hover:bg-emerald-600">{language === "fr" ? "Correspond" : "Matched"}</Badge>}
                                  {sealMatch("secondary") === false && <Badge variant="destructive">{language === "fr" ? "Discordance" : "Mismatch"}</Badge>}
                                </>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{language === "fr" ? "Déclaré (manifeste)" : "Manifest declared"}</Label>
                                <Input value={seals.secondary.declared || "—"} readOnly className="font-mono bg-muted/40" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{language === "fr" ? "Physique (observé)" : "Physical (observed)"}</Label>
                                <Input
                                  value={seals.secondary.physical}
                                  onChange={(e) => setSeals((prev) => ({ ...prev, secondary: { ...prev.secondary, physical: e.target.value.toUpperCase() } }))}
                                  placeholder={language === "fr" ? "Saisir tel qu'estampillé" : "Type exactly as stamped"}
                                  className="font-mono"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" className={seals.secondary.condition === "intact" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : ""} onClick={() => setSeals((prev) => ({ ...prev, secondary: { ...prev.secondary, condition: "intact" } }))}>
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{language === "fr" ? "Intact" : "Intact"}
                              </Button>
                              <Button type="button" size="sm" variant="outline" className={seals.secondary.condition === "broken" ? "border-red-500 bg-red-100 text-red-800" : ""} onClick={() => setSeals((prev) => ({ ...prev, secondary: { ...prev.secondary, condition: "broken" } }))}>
                                <X className="mr-1.5 h-3.5 w-3.5" />{language === "fr" ? "Cassé / manquant" : "Broken / missing"}
                              </Button>
                            </div>
                          </div>

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
                                  onClick={() => {
                                    const q = new URLSearchParams({
                                      primaryDeclared: seals.primary.declared,
                                      primaryPhysical: seals.primary.physical,
                                      primaryCondition: seals.primary.condition || "",
                                      primaryMatch: String(sealMatch("primary") === true),
                                      secondaryDeclared: seals.secondary.declared,
                                      secondaryPhysical: seals.secondary.physical,
                                      secondaryCondition: seals.secondary.condition || "",
                                      secondaryMatch: String(sealMatch("secondary") === true),
                                    });
                                    router.push(`/vault-intake/${intakeId}/security?${q.toString()}`);
                                  }}
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

                          {manifest?.totalBars ? (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">{language === "fr" ? "Reçu (compté)" : "Received (counted)"}</Label>
                              <Input
                                type="number"
                                min={0}
                                value={barCount.received}
                                onChange={(e) => setBarCount((prev) => ({ ...prev, received: parseInt(e.target.value, 10) || 0 }))}
                                className="font-mono text-center text-lg font-bold"
                              />
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "Attendu (manifeste) :" : "Expected (manifest):"} <span className="font-mono font-medium text-foreground">{barCount.expected}</span> {language === "fr" ? "barres" : "bars"}
                              </p>
                            </div>
                          ) : (
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
                          )}

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
                                  onClick={() => {
                                    const q = new URLSearchParams({
                                      expected: String(barCount.expected),
                                      received: String(barCount.received),
                                    });
                                    router.push(`/vault-intake/${intakeId}/count-discrepancy?${q.toString()}`);
                                  }}
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  {language === "fr" ? "Signaler Discordance" : "Report Discrepancy"}
                                </Button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5 pt-1">
                            <Label className="text-xs text-muted-foreground">{language === "fr" ? "Représentant transporteur présent" : "Carrier rep. present"}</Label>
                            <Input
                              value={intakeForm.carrierRepPresent}
                              onChange={(e) => setIntakeForm({ ...intakeForm, carrierRepPresent: e.target.value })}
                              placeholder={language === "fr" ? "Nom complet" : "Full name"}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{language === "fr" ? "Condition à l'arrivée" : "Condition on arrival"}</Label>
                            <Select value={intakeForm.conditionOnArrival} onValueChange={(v) => setIntakeForm({ ...intakeForm, conditionOnArrival: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="good">{language === "fr" ? "Bon état — aucun dommage visible" : "Good — no visible damage"}</SelectItem>
                                <SelectItem value="minor">{language === "fr" ? "Marques de surface mineures" : "Minor surface marks"}</SelectItem>
                                <SelectItem value="damaged">{language === "fr" ? "Endommagé" : "Damaged"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                          ? "Effectuez les étapes sous témoin, dans l'ordre, avant de procéder à la pesée"
                          : "Complete both steps under witness, in order, before proceeding to weighing"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>{language === "fr" ? "Baie de stockage assignée" : "Assigned holding bay"} <span className="text-destructive">*</span></Label>
                        <Input
                          value={secureTransfer.holdingBay}
                          onChange={(e) => setSecureTransfer({ ...secureTransfer, holdingBay: e.target.value })}
                          placeholder="Ex: HB-03"
                          className="font-mono max-w-xs"
                        />
                      </div>

                      <div className="space-y-3 pt-1">
                        {/* Step 1 — container opened under witness (inline witness name) */}
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${secureTransfer.containerOpened ? "border-emerald-300 bg-emerald-50/50" : ""}`}>
                          <button
                            type="button"
                            onClick={() => setSecureTransfer((prev) => ({ ...prev, containerOpened: !prev.containerOpened && Boolean(prev.witnessName.trim()) ? true : !prev.containerOpened }))}
                            disabled={!secureTransfer.witnessName.trim()}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${secureTransfer.containerOpened ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"} ${!secureTransfer.witnessName.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {secureTransfer.containerOpened && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <div className="flex-1">
                            <div className="text-sm font-medium flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" />{language === "fr" ? "Conteneur ouvert sous témoin — comptage confirmé" : "Container opened in witness presence — count confirmed"}</div>
                          </div>
                          <Input
                            value={secureTransfer.witnessName}
                            onChange={(e) => setSecureTransfer({ ...secureTransfer, witnessName: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={language === "fr" ? "Nom du témoin" : "Witness full name"}
                            className="w-48 shrink-0"
                          />
                        </div>

                        {/* Step 2 — bars transferred, locked until step 1 */}
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${secureTransfer.barsTransferred ? "border-emerald-300 bg-emerald-50/50" : ""} ${!secureTransfer.containerOpened ? "opacity-50 pointer-events-none" : ""}`}>
                          <button
                            type="button"
                            onClick={() => setSecureTransfer((prev) => ({ ...prev, barsTransferred: !prev.barsTransferred }))}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${secureTransfer.barsTransferred ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"}`}
                          >
                            {secureTransfer.barsTransferred && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <div className="flex-1 text-sm font-medium">
                            {language === "fr" ? "Barres transférées vers la baie de stockage — comptage confirmé" : "Bars transferred to holding bay — count confirmed"}
                          </div>
                          {secureTransfer.barsTransferred && <Badge className="bg-emerald-600 hover:bg-emerald-600">{language === "fr" ? "Confirmé" : "Confirmed"}</Badge>}
                        </div>
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

                      {/* Calibration status card — 3 states (ok / near / over) */}
                      {scaleDetail && (() => {
                        const state = getScaleState(scaleDetail);
                        const pct = getCalibrationPct(scaleDetail);
                        return (
                          <div className={`rounded-lg border-2 p-4 space-y-3 ${state === "over" ? "border-red-300 bg-red-50/50" : state === "near" ? "border-amber-300 bg-amber-50/50" : "border-emerald-300 bg-emerald-50/50"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{language === "fr" ? "Statut d'Étalonnage" : "Calibration Status"}</span>
                              <Badge variant={state === "over" ? "destructive" : "default"} className={state === "over" ? "" : state === "near" ? "bg-amber-500 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-600"}>
                                {state === "over" ? (language === "fr" ? "Expiré — Bloqué" : "Expired — Blocked") : state === "near" ? (language === "fr" ? "Expire bientôt" : "Expiring soon") : (language === "fr" ? "Étalonnage valide" : "Calibration current")}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div className="text-muted-foreground">{language === "fr" ? "ID Balance" : "Scale ID"}</div><div className="font-mono font-medium">{scaleDetail.id}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Modèle" : "Model"}</div><div className="font-medium">{scaleDetail.model}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Dernier étalonnage" : "Last calibration"}</div><div className="font-mono">{scaleDetail.lastCalibration}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Prochain dû" : "Next due"}</div><div className={`font-mono ${state === "over" ? "text-red-600 font-semibold" : ""}`}>{scaleDetail.nextDue}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Certifié par" : "Certified by"}</div><div className="font-medium">{scaleDetail.certifiedBy}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{language === "fr" ? "Durée de vie étalonnage" : "Calibration life"}</span>
                                <span>{Math.round(pct)}%</span>
                              </div>
                              <ProgressBar pct={pct} color={stateColor(state)} />
                            </div>
                            {state === "over" && (
                              <p className="text-xs text-red-700 font-medium">
                                {language === "fr"
                                  ? "⚠ Étalonnage expiré — cette balance ne peut pas être utilisée. Sélectionnez une autre balance."
                                  : "⚠ Calibration expired — this scale cannot be used. Please select a different scale."}
                              </p>
                            )}
                            {state === "near" && (
                              <p className="text-xs text-amber-700">
                                {language === "fr" ? "Étalonnage encore valide mais expire bientôt — prévoir un renouvellement." : "Calibration current but expiring soon — schedule renewal."}
                              </p>
                            )}
                          </div>
                        );
                      })()}

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
                                <SelectItem key={l.id} value={l.id} disabled={getLabState(l) === "over"}>
                                  {l.name} ({l.turnaround}){getLabState(l) === "over" ? (language === "fr" ? " ⚠ Accréditation expirée" : " ⚠ Accreditation expired") : ""}
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
                                ? "XRF : lit la pureté de surface uniquement. Le fire assay lit la pureté en profondeur — à privilégier pour les barres à essai requis (intake_assay_required)."
                                : "XRF reads surface purity only. Fire assay reads bulk purity — prefer it for bars with the intake_assay_required flag."}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Accreditation status card — 3 states (ok / near / over) */}
                      {labDetail && (() => {
                        const state = getLabState(labDetail);
                        const pct = getAccreditationPct(labDetail);
                        return (
                          <div className={`rounded-lg border-2 p-4 space-y-3 ${state === "over" ? "border-red-300 bg-red-50/50" : state === "near" ? "border-amber-300 bg-amber-50/50" : "border-blue-300 bg-blue-50/50"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{language === "fr" ? "Statut Accréditation" : "Accreditation Status"}</span>
                              <Badge className={state === "over" ? "bg-red-600 hover:bg-red-600" : state === "near" ? "bg-amber-500 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-600"}>
                                {state === "over" ? (language === "fr" ? "Expirée — Bloquée" : "Expired — Blocked") : state === "near" ? (language === "fr" ? "Expire bientôt" : "Expiring soon") : `ISO 17025 ${language === "fr" ? "Valide" : "Valid"}`}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div className="text-muted-foreground">{language === "fr" ? "ID Labo / Équip." : "Lab / Equip. ID"}</div><div className="font-mono font-medium">{labDetail.id}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Type" : "Type"}</div><div className="font-medium">{labDetail.type}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Méthode" : "Method"}</div><div className="font-medium">{labDetail.method === "fire_assay" ? "Fire Assay" : "XRF"}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "N° Accréditation" : "Accreditation no."}</div><div className="font-mono">{labDetail.accreditationNumber}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Organisme" : "Body"}</div><div className="font-medium">{labDetail.body}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Valable jusqu'au" : "Valid to"}</div><div className={`font-mono ${state === "over" ? "text-red-600 font-semibold" : ""}`}>{labDetail.validTo}</div>
                              <div className="text-muted-foreground">{language === "fr" ? "Délai typique" : "Typical turnaround"}</div><div className="font-medium">{labDetail.turnaround}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{language === "fr" ? "Durée de vie accréditation" : "Accreditation life"}</span>
                                <span>{Math.round(pct)}%</span>
                              </div>
                              <ProgressBar pct={pct} color={stateColor(state)} />
                            </div>
                            {state === "over" && (
                              <p className="text-xs text-red-700 font-medium">
                                {language === "fr" ? "⚠ Accréditation expirée — ce laboratoire ne peut pas être utilisé." : "⚠ Accreditation expired — this lab cannot be used."}
                              </p>
                            )}
                            {state === "near" && (
                              <p className="text-xs text-amber-700">
                                {language === "fr" ? "Accréditation encore valide mais expire bientôt — labo utilisable, renouvellement à prévoir." : "Accreditation current but expiring soon — lab usable now, renewal should be scheduled."}
                              </p>
                            )}
                          </div>
                        );
                      })()}

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
                        scaleDetail == null ||
                        getScaleState(scaleDetail) === "over" ||
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
                    SECTION 3 — Independent Weighing (weight only, per bar)
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
                          : (language === "fr" ? "Saisissez le poids brut mesuré pour chaque barre, comparé au poids manifeste" : "Enter measured gross weight for each bar, compared to the manifest weight")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>{language === "fr" ? "N° Série" : "Serial No."}</TableHead>
                            <TableHead>{language === "fr" ? "Poids manifeste (g)" : "Manifest weight (g)"}</TableHead>
                            <TableHead>{language === "fr" ? "Poids balance (g)" : "Vault scale weight (g)"}</TableHead>
                            <TableHead>{language === "fr" ? "Variance" : "Variance"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Statut" : "Status"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {barRecords.map((bar, idx) => {
                            const variance = weightVarianceOf(bar);
                            const status = variance === null ? null : Math.abs(variance) <= 0.5 ? "ok" : "flag";
                            return (
                              <TableRow key={bar.serial}>
                                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                <TableCell className="font-mono text-sm">{bar.serial}</TableCell>
                                <TableCell className="font-mono text-sm">{bar.manifestWeightG != null ? bar.manifestWeightG.toFixed(3) : "—"}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={bar.vaultGrossWeightG}
                                    onChange={(e) => setBarRecords((prev) => prev.map((b, i) => i === idx ? { ...b, vaultGrossWeightG: e.target.value } : b))}
                                    className="h-8 w-32 font-mono"
                                    placeholder="0.000"
                                  />
                                </TableCell>
                                <TableCell className={`font-mono text-sm ${status === "flag" ? "text-red-600" : status === "ok" ? "text-emerald-600" : "text-muted-foreground"}`}>
                                  {variance !== null ? `${variance >= 0 ? "+" : ""}${variance.toFixed(2)}%` : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {status === "ok" && <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>}
                                  {status === "flag" && <Badge variant="destructive">{language === "fr" ? "Signalé" : "Flag"}</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Totals row */}
                      <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/30 border">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Poids manifeste total (g)" : "Total manifest weight (g)"}</p>
                          <p className="font-mono font-bold text-lg">{totalManifestWeightG.toFixed(3)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Poids balance total (g)" : "Total vault scale weight (g)"}</p>
                          <p className="font-mono font-bold text-lg text-primary">{totalVaultWeightG.toFixed(3)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{language === "fr" ? "Barres pesées" : "Bars weighed"}</p>
                          <p className="font-mono font-bold text-lg">{barsWeighedCount} / {barRecords.length}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Button variant="outline" onClick={() => setActiveTab("transfer")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <SaveBtn />
                        <Button onClick={handleContinueToAssay} disabled={isSubmitting} className="flex-1">
                          {language === "fr" ? "Continuer vers Essai" : "Continue to Assay"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 4 — Assay Results (async, fineness only, per bar)
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
                        {language === "fr" ? "Résultats Essai — Barre par Barre" : "Assay Results — Bar by Bar"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Saisissez la finesse mesurée au coffre, comparée à la finesse déclarée au manifeste"
                          : "Enter the vault-measured fineness, compared against the manifest-declared fineness"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>{language === "fr" ? "N° Série" : "Serial No."}</TableHead>
                            <TableHead>{language === "fr" ? "Finesse manifeste (‰)" : "Manifest fineness (‰)"}</TableHead>
                            <TableHead>{language === "fr" ? "Finesse coffre (‰)" : "Vault fineness (‰)"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Statut" : "Status"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {barRecords.map((bar, idx) => {
                            const status = assayStatusOf(bar);
                            return (
                              <TableRow key={bar.serial}>
                                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                <TableCell className="font-mono text-sm">{bar.serial}</TableCell>
                                <TableCell className="font-mono text-sm">{bar.manifestFineness != null ? bar.manifestFineness.toFixed(1) : "—"}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="999.9"
                                    value={bar.vaultFineness}
                                    onChange={(e) => setBarRecords((prev) => prev.map((b, i) => i === idx ? { ...b, vaultFineness: e.target.value } : b))}
                                    className="h-8 w-28 font-mono"
                                    placeholder="999.9"
                                  />
                                </TableCell>
                                <TableCell className="text-right">{assayStatusBadge(status, false)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Certificate */}
                        <div className="space-y-3">
                          <Label className="text-base font-semibold">{language === "fr" ? "Upload Certificat" : "Certificate Upload"}</Label>
                          {certificate.uploaded ? (
                            <div className="border-2 rounded-lg flex items-center gap-3 p-4">
                              <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
                              <span className="text-sm font-medium truncate flex-1">{certificate.fileName}</span>
                              {certificate.pathname && (
                                <a href={`/api/vault-intake/certificate?pathname=${encodeURIComponent(certificate.pathname)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline shrink-0">
                                  {language === "fr" ? "Voir" : "View"}
                                </a>
                              )}
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setCertificate({ uploaded: false, pathname: "", fileName: "" })}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="border-2 border-dashed rounded-lg flex items-center justify-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={uploadingCertificate} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCertificateUpload(f); e.target.value = ""; }} />
                              {uploadingCertificate ? <Spinner className="h-6 w-6 text-muted-foreground" /> : <><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">{language === "fr" ? "Cliquez (PDF/JPG/PNG)" : "Click to upload (PDF/JPG/PNG)"}</span></>}
                            </label>
                          )}
                        </div>

                        {/* Pure gold weight */}
                        <div className="p-4 bg-primary/5 rounded-lg text-center flex flex-col justify-center">
                          <span className="text-sm text-muted-foreground">{language === "fr" ? "Poids Or Pur (calculé)" : "Pure Gold Weight (calculated)"}</span>
                          <div className="text-3xl font-bold text-primary">{totalFineWeightG.toFixed(2)} g</div>
                          <span className="text-xs text-muted-foreground mt-1">{barsAssayedCount} / {barRecords.length} {language === "fr" ? "barres essayées" : "bars assayed"}</span>
                        </div>
                      </div>

                      {/* Variance comparison */}
                      {poFineWeightG != null && (
                        <div className="space-y-3">
                          <Label className="text-base font-semibold">{language === "fr" ? "Comparaison de Variance" : "Variance Comparison"}</Label>
                          <div className="flex items-center gap-4">
                            <Card className="flex-1 p-4">
                              <div className="text-sm text-muted-foreground">{language === "fr" ? "PO fine (manifeste)" : "PO fine (manifest)"}</div>
                              <div className="text-xl font-mono font-bold">{poFineWeightG.toFixed(2)} g</div>
                            </Card>
                            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            <Card className="flex-1 p-4">
                              <div className="text-sm text-muted-foreground">{language === "fr" ? "Réel (coffre)" : "Actual (vault)"}</div>
                              <div className="text-xl font-mono font-bold">{totalFineWeightG.toFixed(2)} g</div>
                            </Card>
                            {purityVariance != null && (
                              <Card className={`flex-1 p-4 ${Math.abs(purityVariance) > 0.5 ? "border-amber-300 bg-amber-50/50" : "border-emerald-300 bg-emerald-50/50"}`}>
                                <div className="text-sm text-muted-foreground">{language === "fr" ? "Variance" : "Variance"}</div>
                                <div className="text-xl font-mono font-bold">{purityVariance >= 0 ? "+" : ""}{purityVariance.toFixed(2)}%</div>
                              </Card>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Button variant="outline" onClick={() => setActiveTab("weighing")}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Retour" : "Back"}
                        </Button>
                        <SaveBtn />
                        <Button onClick={handleValidateResults} disabled={isSubmitting} className="flex-1">
                          {isSubmitting ? (language === "fr" ? "Validation..." : "Validating...") : (language === "fr" ? "Valider Résultats" : "Validate Results")}
                        </Button>
                        <Button variant="outline" onClick={handleRequestReassay}>{language === "fr" ? "Demander Re-Essai" : "Request Re-Assay"}</Button>
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
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-muted/40 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{language === "fr" ? "PO fine (g)" : "PO fine (g)"}</div>
                          <div className="text-lg font-semibold">{poFineWeightG != null ? poFineWeightG.toFixed(2) : "—"}</div>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{language === "fr" ? "Coffre fine (g)" : "Vault fine (g)"}</div>
                          <div className="text-lg font-semibold text-emerald-700">{totalFineWeightG.toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{language === "fr" ? "Variance" : "Variance"}</div>
                          <div className="text-lg font-semibold text-emerald-700">{purityVariance != null ? `${purityVariance >= 0 ? "+" : ""}${purityVariance.toFixed(2)}%` : "—"}</div>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{language === "fr" ? "Seuil LBMA" : "LBMA floor"}</div>
                          <div className="text-lg font-semibold">≥ 995.0‰</div>
                        </div>
                      </div>

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
                              { label: language === "fr" ? "Poids Or Pur (coffre)" : "Pure Au Weight (vault)", value: `${totalFineWeightG.toFixed(2)} g` },
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
                                fr: "Je confirme que les données ci-dessus sont exactes et j'autorise le règlement",
                                en: "I confirm the above data is accurate and I authorize settlement",
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
              <span className="font-mono font-medium">{totalFineWeightG.toFixed(2)} g</span>
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
