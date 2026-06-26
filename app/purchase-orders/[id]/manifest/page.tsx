"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw,
  FileText, Upload, X, Plus, Save, Clock, Lock, ChevronDown,
  Truck, Scale, ShieldCheck,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const OZ_TO_GRAM = 31.1035;
const TOLERANCE_PCT = 0.5;

function calcFineOz(grossKg: number, fineness: number): number {
  return Math.floor((grossKg * fineness * 1000) / OZ_TO_GRAM) / 1000;
}

const STEPS = ["Expédition", "Lingots", "Documents", "Déclaration"];

const DOC_LABELS: Record<string, string> = {
  export_permit: "Permis d'exportation",
  assay_certificate: "Certificats d'analyse (Assay)",
  chain_of_custody: "Chaîne de garde (Chain of Custody)",
  carrier_waybill: "Lettre de voiture transporteur",
  lbma_rgg: "Rapport d'audit LBMA RGG",
  minamata: "Déclaration Minamata / Due Diligence",
};
const DOC_TYPES = Object.keys(DOC_LABELS);

const CARRIERS = ["Brink's", "G4S Secure Solutions", "Malca-Amit", "Loomis International", "Autre transporteur"];

const REASON_LABELS: Record<string, string> = {
  missing_document: "Document manquant",
  weight_discrepancy: "Écart de poids",
  chain_of_custody_gap: "Rupture de traçabilité",
  other: "Autre motif",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bar { id: string; barNumber: string; grossWeightKg: number | ""; fineness: number | ""; fineOz: number }
interface DocFile { file: File; name: string }
interface SavedDoc { doc_type: string; file_name: string; uploaded_at: string }
interface StoredBar { barNumber: string; grossWeightKg: number; fineness: number; fineOz: number }

interface DraftManifest {
  id: string;
  status: string;
  attempt_number: number;
  shipment_date: string | null;
  carrier: string | null;
  waybill_number: string | null;
  departure_location: string | null;
  seal_number: string | null;
  destination_vault: string | null;
  incoterms: string | null;
  bars_json: StoredBar[] | string | null;
  declarant_name: string | null;
  declarant_title: string | null;
  declaration_accepted: boolean | null;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  documents: SavedDoc[];
  review_notes: string | null;
  reason_code: string | null;
  failed_doc_types: string[] | string | null;
}

interface PurchaseOrder {
  id: string;
  tracking_id: string | null;
  status: string;
  counterparty_id: string;
  estimated_weight_kg: number;
  purity_factor: number;
  delivery_vault_id: string;
  incoterms: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getFailedDocTypes(draft: DraftManifest): string[] {
  if (!draft.failed_doc_types) return [];
  if (Array.isArray(draft.failed_doc_types)) return draft.failed_doc_types;
  try { return JSON.parse(draft.failed_doc_types as string); } catch { return []; }
}

// ─── Resubmission collapsible section ────────────────────────────────────────
function ResSection({
  id, title, icon: Icon, open, onToggle, done, doneLabel, error, locked, children,
}: {
  id: string; title: string; icon: React.ElementType; open: boolean; onToggle: () => void;
  done?: boolean; doneLabel?: string; error?: boolean; locked?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${
        error ? "border-destructive/60" : done ? "border-emerald-500/60" : open ? "border-primary/40" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          error ? "bg-destructive/5 hover:bg-destructive/8" :
          done ? "bg-emerald-500/5 hover:bg-emerald-500/10" :
          open ? "bg-primary/5 hover:bg-primary/8" :
          "bg-muted/30 hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {done && !error ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : error ? (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <Icon className={`h-4 w-4 shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`} />
          )}
          <span className={`text-sm font-medium ${done && !error ? "text-emerald-800" : error ? "text-destructive" : open ? "text-primary" : ""}`}>
            {title}
          </span>
          {locked && <Lock className="h-3 w-3 text-muted-foreground/60" />}
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <Badge className="bg-destructive/10 text-destructive border border-destructive/30 text-xs">Action requise</Badge>
          ) : done ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">{doneLabel ?? "Reporté"}</Badge>
          ) : open ? (
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">En cours</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Non commencé</Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManifestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: po, isLoading: poLoading } = useSWR<PurchaseOrder>(`/api/purchase-orders/${id}`, fetcher);
  const { data: draft, isLoading: draftLoading, mutate: mutateDraft } = useSWR<DraftManifest | null>(
    id ? `/api/purchase-orders/${id}/manifest` : null, fetcher,
  );

  // ── Step wizard state ────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Save state ───────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedDocTypes, setSavedDocTypes] = useState<Record<string, SavedDoc>>({});

  // ── Shipment fields ──────────────────────────────────────────────────────
  const [shipmentDate, setShipmentDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");

  // ── Bars ─────────────────────────────────────────────────────────────────
  const [bars, setBars] = useState<Bar[]>([
    { id: "bar-1", barNumber: "", grossWeightKg: "", fineness: "", fineOz: 0 },
  ]);

  // ── Documents ────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<Record<string, DocFile | null>>(
    Object.fromEntries(DOC_TYPES.map((t) => [t, null])),
  );

  // ── Declaration (wizard) ─────────────────────────────────────────────────
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [declarantName, setDeclarantName] = useState("");
  const [declarantTitle, setDeclarantTitle] = useState("");

  // ── Resubmission-specific state ──────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["documents"]));
  const [decl1, setDecl1] = useState(false);
  const [decl2, setDecl2] = useState(false);
  const [decl3, setDecl3] = useState(false);
  const [decl4, setDecl4] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Restore draft / returned manifest ────────────────────────────────────
  useEffect(() => {
    if (draftRestored || draft === undefined) return;
    if (!draft || !["draft", "returned"].includes(draft.status)) { setDraftRestored(true); return; }

    if (draft.shipment_date) setShipmentDate(draft.shipment_date.slice(0, 10));
    if (draft.carrier) setCarrier(draft.carrier);
    if (draft.waybill_number) setWaybillNumber(draft.waybill_number);
    if (draft.seal_number) setSealNumber(draft.seal_number);
    if (draft.departure_location) setDepartureLocation(draft.departure_location);
    if (draft.declarant_name) setDeclarantName(draft.declarant_name);
    if (draft.declarant_title) setDeclarantTitle(draft.declarant_title);
    if (draft.declaration_accepted) setDeclarationAccepted(true);

    const rawBars = typeof draft.bars_json === "string"
      ? (() => { try { return JSON.parse(draft.bars_json); } catch { return []; } })()
      : draft.bars_json;
    const stored: StoredBar[] = Array.isArray(rawBars) ? rawBars : [];
    if (stored.some((b) => b.barNumber || b.grossWeightKg || b.fineness)) {
      setBars(stored.map((b, i) => ({
        id: `bar-${i}`, barNumber: b.barNumber || "", grossWeightKg: b.grossWeightKg || "",
        fineness: b.fineness || "", fineOz: b.fineOz || 0,
      })));
    }

    if (Array.isArray(draft.documents)) {
      const failed = getFailedDocTypes(draft);
      const byType: Record<string, SavedDoc> = {};
      for (const d of draft.documents) {
        if (draft.status === "returned" && failed.includes(d.doc_type)) continue;
        byType[d.doc_type] = d;
      }
      setSavedDocTypes(byType);
    }
    if (draft.status === "draft") setLastSavedAt(new Date(draft.updated_at));
    setDraftRestored(true);
  }, [draft, draftRestored]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isResubmission =
    draft?.status === "returned" ||
    (draft?.status === "draft" && !!(draft?.review_notes || draft?.reason_code));
  const returnedFailedDocTypes = isResubmission && draft ? getFailedDocTypes(draft) : [];
  const reference = po?.tracking_id ?? id ?? "";
  const poFineOz = po
    ? Math.floor(((Number(po.estimated_weight_kg || 0) * Number(po.purity_factor || 0.9995) * 1000) / OZ_TO_GRAM) * 1000) / 1000
    : 0;
  const totalFineOz = bars.reduce((s, b) => s + b.fineOz, 0);
  const totalGrossKg = bars.reduce((s, b) => s + Number(b.grossWeightKg || 0), 0);
  const variancePct = poFineOz > 0 ? ((totalFineOz - poFineOz) / poFineOz) * 100 : 0;
  const inTolerance = Math.abs(variancePct) <= TOLERANCE_PCT;

  // Resubmission completeness
  const resSec3Done = returnedFailedDocTypes.every((t) => !!docs[t]);
  const resSec4Done = decl1 && decl2 && decl3 && decl4;
  const resCompleted = [true, true, resSec3Done, resSec4Done].filter(Boolean).length;
  const resAllDone = resCompleted === 4;

  // SLA
  const reviewedAt = draft?.reviewed_at;
  const deadline = reviewedAt
    ? new Date(new Date(reviewedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null;
  const attemptsUsed = draft?.attempt_number ?? 1;

  // ── Bar helpers ───────────────────────────────────────────────────────────
  const addBar = () =>
    setBars((p) => [...p, { id: `bar-${Date.now()}`, barNumber: "", grossWeightKg: "", fineness: "", fineOz: 0 }]);
  const removeBar = (bid: string) => setBars((p) => p.filter((b) => b.id !== bid));
  const updateBar = useCallback((bid: string, field: "barNumber" | "grossWeightKg" | "fineness", val: string) => {
    setBars((prev) => prev.map((b) => {
      if (b.id !== bid) return b;
      const isNum = field === "grossWeightKg" || field === "fineness";
      const u = { ...b, [field]: isNum ? (val === "" ? "" : Number(val)) : val };
      const gw = Number(u.grossWeightKg || 0), fn = Number(u.fineness || 0);
      u.fineOz = gw > 0 && fn > 0 ? calcFineOz(gw, fn) : 0;
      return u;
    }));
  }, []);

  const handleFileSelect = (docType: string, file: File | null) =>
    setDocs((p) => ({ ...p, [docType]: file ? { file, name: file.name } : null }));

  const docReady = (t: string) => !!docs[t] || !!savedDocTypes[t];

  // ── Build FormData ────────────────────────────────────────────────────────
  const buildFormData = (withDecl: boolean, declValue?: boolean) => {
    const fd = new FormData();
    fd.append("shipmentDate", shipmentDate);
    fd.append("carrier", carrier);
    fd.append("waybillNumber", waybillNumber);
    fd.append("sealNumber", sealNumber);
    fd.append("departureLocation", departureLocation);
    fd.append("destinationVault", po?.delivery_vault_id || "");
    fd.append("incoterms", po?.incoterms || "");
    fd.append("barsJson", JSON.stringify(bars.map((b) => ({
      barNumber: b.barNumber, grossWeightKg: Number(b.grossWeightKg || 0),
      fineness: Number(b.fineness || 0), fineOz: b.fineOz,
    }))));
    fd.append("declarantName", declarantName);
    fd.append("declarantTitle", declarantTitle);
    if (withDecl) fd.append("declarationAccepted", String(declValue ?? declarationAccepted));
    for (const t of DOC_TYPES) { const d = docs[t]; if (d) fd.append(`doc_${t}`, d.file, d.name); }
    return fd;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/purchase-orders/${id}/manifest`, { method: "PATCH", body: buildFormData(false) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveStatus("error"); return; }
      if (Array.isArray(data.documents)) {
        const byType: Record<string, SavedDoc> = {};
        for (const d of data.documents as SavedDoc[]) byType[d.doc_type] = d;
        setSavedDocTypes(byType);
      }
      setLastSavedAt(new Date(data.savedAt));
      setSaveStatus("saved");
      await mutateDraft();
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch { setSaveStatus("error"); }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (declValue: boolean) => {
    if (!declValue) { setSubmitError("Vous devez accepter la déclaration avant de soumettre."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/manifest`, { method: "POST", body: buildFormData(true, declValue) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSubmitError(data.error || "Erreur lors de la soumission."); return; }
      router.push(`/purchase-orders/${id}?manifest=submitted`);
    } catch { setSubmitError("Une erreur inattendue s'est produite."); }
    finally { setSubmitting(false); }
  };

  // ── Loading / guard ───────────────────────────────────────────────────────
  const isLoading = poLoading || draftLoading || !draftRestored;
  if (isLoading || !po) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (po.status !== "accepted") {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title="Soumission du manifeste" subtitle={reference} />
            <main className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <Link href={`/purchase-orders/${id}`}>
                  <Button variant="ghost" size="sm" className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Button>
                </Link>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Manifeste non disponible</AlertTitle>
                  <AlertDescription>Le manifeste ne peut être soumis que lorsque le bon de commande est en statut «&nbsp;Accepté&nbsp;».</AlertDescription>
                </Alert>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // ── RESUBMISSION PORTAL ───────────────────────────────────────────────────
  if (isResubmission) {
    const toggleSec = (k: string) =>
      setOpenSections((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

    const footerNote = resAllDone ? (
      <span className="text-emerald-600 flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" /> Prêt à resoumettre · Tentative {attemptsUsed + 1} sur 2
      </span>
    ) : resSec3Done ? (
      <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Confirmez toutes les déclarations pour resoumettre</span>
    ) : (
      <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Remplacez les documents requis et confirmez les déclarations</span>
    );

    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title="Resoumission du manifeste" subtitle={reference} />
            <div className="flex flex-1 overflow-hidden">

              {/* ── Left: sections ──────────────────────────────────────── */}
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Progress bar */}
                <div className="border-b bg-background px-6 py-2.5 shrink-0">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{resCompleted} section{resCompleted !== 1 ? "s" : ""} sur 4 complétée{resCompleted !== 1 ? "s" : ""}</span>
                    <span className="font-medium">{Math.round(resCompleted / 4 * 100)}%</span>
                  </div>
                  <Progress value={resCompleted / 4 * 100} className="h-1.5" />
                </div>

                {/* Return banner */}
                <div className="border-b bg-red-50/80 dark:bg-red-950/20 px-6 py-3 shrink-0 flex gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800">
                      Manifeste {draft?.status === "returned" ? "retourné" : "à corriger"} — correction requise
                    </p>
                    {(draft?.reason_code || draft?.review_notes) && (
                      <div className="mt-1.5 border-l-2 border-red-400 pl-3 py-1 text-xs text-red-900 bg-white/40 dark:bg-red-950/30 rounded-r">
                        {draft?.reason_code && <p className="font-medium">{REASON_LABELS[draft.reason_code] ?? draft.reason_code}</p>}
                        {draft?.review_notes && <p className="mt-0.5">{draft.review_notes}</p>}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-red-700">
                      {reviewedAt && <span>Retourné le {new Date(reviewedAt).toLocaleDateString("fr-FR")}</span>}
                      {deadline && <span>Délai : <strong>{deadline.toLocaleDateString("fr-FR")}</strong></span>}
                      {returnedFailedDocTypes.length > 0 && (
                        <span>Docs à remplacer : <strong>{returnedFailedDocTypes.map((t) => DOC_LABELS[t] || t).join(", ")}</strong></span>
                      )}
                      <span className="font-medium text-red-800">
                        {2 - attemptsUsed > 0 ? `${2 - attemptsUsed} resoumission restante avant escalade` : "Dernière tentative"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sections scroll body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">

                  {/* Section 1: Shipment — locked */}
                  <ResSection
                    id="ship" title="Détails de l'expédition" icon={Truck}
                    open={openSections.has("ship")} onToggle={() => toggleSec("ship")}
                    done={true} doneLabel={carrier || "Reporté"} locked={true}
                  >
                    <div className="p-4 space-y-2">
                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        Données reportées de la soumission précédente — aucune modification.
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          ["Date d'expédition", shipmentDate || "—"],
                          ["Transporteur", carrier || "—"],
                          ["N° lettre de voiture", waybillNumber || "—"],
                          ["Sceau de sécurité", sealNumber || "—"],
                          ["Lieu de départ", departureLocation || "—"],
                          ["Coffre de destination", po.delivery_vault_id || "—"],
                          ["Incoterms", po.incoterms || "—"],
                        ].map(([l, v]) => (
                          <div key={l} className="space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
                            <p className="text-sm font-medium font-mono">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ResSection>

                  {/* Section 2: Bars — locked */}
                  <ResSection
                    id="bars" title="Fiche de poids des lingots" icon={Scale}
                    open={openSections.has("bars")} onToggle={() => toggleSec("bars")}
                    done={true} doneLabel={`${bars.filter((b) => b.barNumber).length} lingot${bars.filter((b) => b.barNumber).length !== 1 ? "s" : ""} reporté${bars.filter((b) => b.barNumber).length !== 1 ? "s" : ""}`}
                    locked={true}
                  >
                    <div className="p-4 space-y-3">
                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        Fiche de poids reportée — contactez la conformité commerciale si des corrections sont requises.
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ minWidth: 420 }}>
                          <thead>
                            <tr className="border-b bg-muted/40 text-muted-foreground">
                              <th className="py-2 px-2 text-left font-medium w-6">#</th>
                              <th className="py-2 px-2 text-left font-medium">N° lingot</th>
                              <th className="py-2 px-2 text-left font-medium">Poids brut (kg)</th>
                              <th className="py-2 px-2 text-left font-medium">Titre (‰)</th>
                              <th className="py-2 px-2 text-right font-medium">Oz fin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bars.map((bar, i) => (
                              <tr key={bar.id} className="border-b last:border-0">
                                <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                <td className="py-1.5 px-2 font-mono">{bar.barNumber || "—"}</td>
                                <td className="py-1.5 px-2 font-mono">{Number(bar.grossWeightKg || 0).toFixed(3)}</td>
                                <td className="py-1.5 px-2 font-mono">{Number(bar.fineness || 0).toFixed(1)}</td>
                                <td className="py-1.5 px-2 text-right font-mono font-medium">{bar.fineOz > 0 ? bar.fineOz.toFixed(3) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-primary/5 text-primary font-medium border-t-2 border-primary/20">
                              <td colSpan={2} className="py-2 px-2 text-xs">Total ({bars.length} lingots)</td>
                              <td className="py-2 px-2 font-mono text-xs">{totalGrossKg.toFixed(3)}</td>
                              <td className="py-2 px-2 text-xs text-muted-foreground">avg ‰</td>
                              <td className="py-2 px-2 text-right font-mono text-sm">{totalFineOz > 0 ? totalFineOz.toFixed(3) : "—"}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {totalFineOz > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Quantité BCC (oz fin)", value: poFineOz.toFixed(3), ok: null },
                            { label: "Oz fin déclarés", value: totalFineOz.toFixed(3), ok: null },
                            {
                              label: inTolerance ? "Variance ✓ dans la tolérance" : "Variance ⚠ hors tolérance",
                              value: `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(3)}%`,
                              ok: inTolerance,
                            },
                          ].map(({ label, value, ok }) => (
                            <div key={label} className={`rounded-lg p-2.5 ${ok === null ? "bg-muted/40" : ok ? "bg-emerald-50" : "bg-amber-50"}`}>
                              <p className={`text-[10px] mb-0.5 ${ok === null ? "text-muted-foreground" : ok ? "text-emerald-700" : "text-amber-700"}`}>{label}</p>
                              <p className={`font-mono font-medium text-sm ${ok === null ? "" : ok ? "text-emerald-800" : "text-amber-800"}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ResSection>

                  {/* Section 3: Documents */}
                  <ResSection
                    id="documents" title={returnedFailedDocTypes.length > 0 ? `Documents — ${returnedFailedDocTypes.length} élément${returnedFailedDocTypes.length > 1 ? "s" : ""} à remplacer` : "Documents"}
                    icon={FileText}
                    open={openSections.has("documents")} onToggle={() => toggleSec("documents")}
                    done={resSec3Done} doneLabel="6 / 6 documents"
                    error={!resSec3Done && returnedFailedDocTypes.length > 0}
                  >
                    <div className="p-4 space-y-3">
                      {returnedFailedDocTypes.length > 0 && (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2.5 text-xs text-destructive flex gap-2 items-start">
                          <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>
                            <strong>Remplacez uniquement les documents marqués «&nbsp;À remplacer&nbsp;».</strong>{" "}
                            Les documents marqués «&nbsp;Reporté&nbsp;» sont déjà acceptés — vous n'avez pas besoin de les recharger.
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {DOC_TYPES.map((docType) => {
                          const newDoc = docs[docType];
                          const serverDoc = savedDocTypes[docType];
                          const needsReplace = returnedFailedDocTypes.includes(docType);
                          const isCarried = !needsReplace && !!serverDoc;
                          const isReplaced = needsReplace && !!newDoc;

                          return (
                            <div
                              key={docType}
                              onClick={() => (needsReplace && !isReplaced) ? fileInputRefs.current[docType]?.click() : undefined}
                              className={`relative rounded-lg border p-3 text-center transition-all
                                ${isCarried ? "border-emerald-400 bg-emerald-50/40 cursor-default" : ""}
                                ${needsReplace && !isReplaced ? "border-destructive border-[1.5px] bg-destructive/5 cursor-pointer hover:bg-destructive/10" : ""}
                                ${isReplaced ? "border-emerald-400 bg-emerald-50/40 cursor-default" : ""}
                              `}
                            >
                              {/* Tag */}
                              <div className={`absolute top-1.5 right-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded
                                ${isCarried ? "bg-emerald-100 text-emerald-700" : ""}
                                ${needsReplace && !isReplaced ? "bg-red-100 text-red-700" : ""}
                                ${isReplaced ? "bg-emerald-100 text-emerald-700" : ""}
                              `}>
                                {isCarried ? "Reporté" : isReplaced ? "Remplacé" : "À remplacer"}
                              </div>
                              {/* Icon */}
                              <div className={`text-2xl mb-1.5 flex justify-center ${isCarried || isReplaced ? "text-emerald-600" : "text-destructive"}`}>
                                {isCarried || isReplaced ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                              </div>
                              <p className="text-xs font-medium leading-tight">{DOC_LABELS[docType]}</p>
                              <p className={`text-[10px] mt-1 ${isCarried ? "text-emerald-600" : isReplaced ? "text-emerald-600" : "text-destructive"}`}>
                                {isCarried ? (serverDoc?.file_name ?? "Fichier reporté") : isReplaced ? (newDoc?.name ?? "") : "Cliquer pour charger"}
                              </p>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[docType] = el; }}
                                onChange={(e) => {
                                  handleFileSelect(docType, e.target.files?.[0] || null);
                                  e.target.value = "";
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ResSection>

                  {/* Section 4: Declaration */}
                  <ResSection
                    id="declaration" title="Déclaration — re-signature requise" icon={ShieldCheck}
                    open={openSections.has("declaration")} onToggle={() => toggleSec("declaration")}
                    done={resSec4Done} doneLabel="Toutes déclarations confirmées"
                  >
                    <div className="p-4 space-y-0.5">
                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 mb-3">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        La déclaration doit être re-confirmée à chaque soumission, y compris les resoumissions.
                      </div>
                      {[
                        { id: "d1", checked: decl1, set: setDecl1, text: "Je confirme que tous les lingots listés dans ce manifeste proviennent du site minier déclaré et ont été traités exclusivement par les installations nommées dans le document de chaîne de garde." },
                        { id: "d2", checked: decl2, set: setDecl2, text: "Je confirme que tous les certificats d'analyse joints sont émis par un laboratoire accrédité ISO 17025 et reflètent fidèlement la pureté et le poids de chaque lingot tel qu'estampillé." },
                        { id: "d3", checked: decl3, set: setDecl3, text: "Je confirme qu'aucun travail des enfants, travail forcé ou violation du Protocole de Minamata (mercure) n'est survenu à aucune étape de la chaîne d'approvisionnement pour cet envoi." },
                        { id: "d4", checked: decl4, set: setDecl4, text: "Je comprends que la soumission d'un manifeste comportant des informations fausses ou trompeuses constitue une violation du contrat d'achat et peut entraîner la radiation permanente du registre des contreparties." },
                      ].map(({ id: did, checked, set, text }) => (
                        <div key={did} className="flex items-start gap-3 py-3 border-b last:border-0">
                          <Checkbox id={did} checked={checked} onCheckedChange={(v) => set(Boolean(v))} className="mt-0.5 shrink-0" />
                          <Label htmlFor={did} className="text-sm leading-relaxed cursor-pointer text-muted-foreground">{text}</Label>
                        </div>
                      ))}
                    </div>
                  </ResSection>

                  {submitError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="h-2" />
                </div>

                {/* Footer */}
                <div className="border-t bg-background px-5 py-3 flex items-center justify-between gap-3 shrink-0">
                  <div className="text-xs">{footerNote}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saveStatus === "saving"}>
                      {saveStatus === "saving" ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                      Sauvegarder
                    </Button>
                    <Button
                      onClick={() => handleSubmit(resSec4Done)}
                      disabled={!resAllDone || submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {submitting ? "Soumission en cours…" : "Resoumettre le manifeste →"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Right panel ──────────────────────────────────────────── */}
              <div className="w-60 border-l flex-shrink-0 overflow-y-auto bg-background flex flex-col divide-y text-xs">

                {/* PO Info */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Bon de commande</p>
                  {[
                    ["Réf. PO", reference],
                    ["Quantité", `${poFineOz.toFixed(3)} oz fin`],
                    ["Incoterms", po.incoterms || "—"],
                    ["Coffre", po.delivery_vault_id || "—"],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between items-start py-1.5 border-b last:border-0">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-medium text-right max-w-[110px] break-all">{v}</span>
                    </div>
                  ))}
                </div>

                {/* SLA */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">SLA de resoumission</p>
                  {[
                    ["Délai", deadline ? deadline.toLocaleDateString("fr-FR") : "—"],
                    ["Jours restants", daysLeft != null ? `${daysLeft} jour${daysLeft !== 1 ? "s" : ""}` : "—"],
                    ["Tentatives", `${attemptsUsed} sur 2 utilisées`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between items-start py-1.5 border-b last:border-0">
                      <span className="text-muted-foreground">{l}</span>
                      <span className={`font-medium text-right ${l === "Jours restants" && daysLeft != null && daysLeft <= 3 ? "text-amber-600" : ""}`}>{v}</span>
                    </div>
                  ))}
                  <div className="flex gap-1.5 mt-3">
                    {[1, 2].map((n) => (
                      <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= attemptsUsed ? "bg-destructive" : "bg-muted"}`} />
                    ))}
                  </div>
                  <div className="mt-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg px-2.5 py-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    Un 2ème rejet escalade ce dossier au Trade Manager et le met en attente.
                  </div>
                </div>

                {/* Timeline */}
                <div className="px-4 py-3 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-3">Historique</p>
                  {[
                    { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-300", label: "Bon de commande reçu", sub: "" },
                    { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-300", label: `Manifeste soumis — Tentative ${attemptsUsed}`, sub: draft?.submitted_at ? new Date(draft.submitted_at).toLocaleDateString("fr-FR") : "" },
                    { icon: X, color: "text-destructive bg-red-50 border-red-300", label: "Manifeste retourné", sub: reviewedAt ? new Date(reviewedAt).toLocaleDateString("fr-FR") : "" },
                    { icon: RefreshCw, color: "text-primary bg-primary/10 border-primary/30", label: "Resoumission en cours", sub: `Tentative ${attemptsUsed + 1} · délai ${deadline ? deadline.toLocaleDateString("fr-FR") : "—"}` },
                    { icon: FileText, color: "text-muted-foreground bg-muted/30 border-muted-foreground/20", label: "Entrée en coffre", sub: "En attente d'autorisation" },
                  ].map(({ icon: TlIcon, color, label, sub }, i, arr) => (
                    <div key={i} className="flex gap-2.5 pb-3 relative">
                      {i < arr.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border ${color}`}>
                        <TlIcon className="h-3 w-3" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium leading-tight">{label}</p>
                        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // ── STEP WIZARD (fresh submission) ────────────────────────────────────────
  const SaveIndicator = () => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {saveStatus === "saving" && <><RefreshCw className="h-3 w-3 animate-spin" /><span>Sauvegarde…</span></>}
      {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-emerald-600" /><span className="text-emerald-600">Sauvegardé</span></>}
      {saveStatus === "error" && <><AlertTriangle className="h-3 w-3 text-destructive" /><span className="text-destructive">Erreur</span></>}
      {saveStatus === "idle" && lastSavedAt && <><Clock className="h-3 w-3" /><span>Sauvegardé à {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></>}
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title="Soumission du manifeste d'expédition" subtitle={reference} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-2xl space-y-4">

              <Link href={`/purchase-orders/${id}`}>
                <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Retour au bon de commande</Button>
              </Link>

              {/* PO info bar */}
              <div className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-1.5">
                <div className="flex items-center gap-2 text-sm"><span className="text-blue-400/70">Réf.</span><span className="font-bold text-blue-300 tracking-wide">{reference}</span></div>
                {poFineOz > 0 && <div className="flex items-center gap-2 text-sm"><span className="text-blue-400/70">Quantité</span><span className="font-bold text-blue-300 font-mono">{poFineOz.toFixed(3)}&nbsp;oz fin</span></div>}
                {po.incoterms && <div className="flex items-center gap-2 text-sm"><span className="text-blue-400/70">Incoterms</span><span className="font-bold text-blue-300">{po.incoterms}</span></div>}
                {po.delivery_vault_id && <div className="flex items-center gap-2 text-sm"><span className="text-blue-400/70">Coffre</span><span className="font-bold text-blue-300">{po.delivery_vault_id}</span></div>}
              </div>

              {/* Step indicator + Save */}
              <Card>
                <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-0">
                    {STEPS.map((label, i) => (
                      <div key={label} className="flex items-center">
                        <button
                          type="button"
                          onClick={() => i < step && setStep(i)}
                          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                            ${i === step ? "bg-primary text-primary-foreground" : i < step ? "cursor-pointer text-primary hover:bg-primary/10" : "cursor-default text-muted-foreground"}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold
                            ${i === step ? "border-primary-foreground/40 bg-primary-foreground/20" : i < step ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 bg-muted/40"}`}>
                            {i < step ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                          </span>
                          {label}
                        </button>
                        {i < STEPS.length - 1 && <div className={`h-px w-8 mx-1 transition-colors ${i < step ? "bg-primary/40" : "bg-muted-foreground/20"}`} />}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <SaveIndicator />
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saveStatus === "saving"}>
                      {saveStatus === "saving" ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                      Sauvegarder
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Step 0 */}
              {step === 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Détails de l&apos;expédition</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Date d&apos;expédition <span className="text-destructive">*</span></Label>
                        <Input type="date" value={shipmentDate} onChange={(e) => setShipmentDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Transporteur <span className="text-destructive">*</span></Label>
                        <Select value={carrier} onValueChange={setCarrier}>
                          <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                          <SelectContent>{CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">N° lettre de voiture (AWB / BL) <span className="text-destructive">*</span></Label>
                        <Input placeholder="AWB-1234567890" className="font-mono" value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sceau de sécurité <span className="text-destructive">*</span></Label>
                        <Input placeholder="TE-4490-A" className="font-mono" value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Lieu de départ</Label>
                      <Input placeholder="ex. Kinshasa, DRC" value={departureLocation} onChange={(e) => setDepartureLocation(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Coffre de destination</Label>
                        <Input value={po.delivery_vault_id || ""} readOnly className="bg-muted/40 text-muted-foreground font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Incoterms</Label>
                        <Input value={po.incoterms || ""} readOnly className="bg-muted/40 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 1 */}
              {step === 1 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Fiche de poids des lingots</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ minWidth: 480 }}>
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="py-2 text-left font-medium w-6">#</th>
                            <th className="py-2 text-left font-medium pr-2">N° lingot</th>
                            <th className="py-2 text-left font-medium pr-2">Poids brut (kg)</th>
                            <th className="py-2 text-left font-medium pr-2">Titre (‰)</th>
                            <th className="py-2 text-right font-medium pr-2">Oz fin</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {bars.map((bar, idx) => (
                            <tr key={bar.id} className="border-b">
                              <td className="py-2 text-xs text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 pr-2"><Input value={bar.barNumber} onChange={(e) => updateBar(bar.id, "barNumber", e.target.value)} className="h-8 text-xs font-mono" placeholder="BAR-001" /></td>
                              <td className="py-2 pr-2"><Input type="number" step="0.001" min="0" value={bar.grossWeightKg === "" ? "" : bar.grossWeightKg} onChange={(e) => updateBar(bar.id, "grossWeightKg", e.target.value)} className="h-8 text-xs font-mono" placeholder="12.441" /></td>
                              <td className="py-2 pr-2"><Input type="number" step="0.1" min="0" max="1000" value={bar.fineness === "" ? "" : bar.fineness} onChange={(e) => updateBar(bar.id, "fineness", e.target.value)} className="h-8 text-xs font-mono" placeholder="995.0" /></td>
                              <td className="py-2 pr-2 text-right"><span className="font-mono font-medium text-sm">{bar.fineOz > 0 ? bar.fineOz.toFixed(3) : "—"}</span></td>
                              <td className="py-2">
                                {bars.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeBar(bar.id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 font-medium">
                            <td colSpan={2} className="py-2 pl-1 text-xs text-muted-foreground">Total</td>
                            <td className="py-2 font-mono text-xs">{totalGrossKg > 0 ? totalGrossKg.toFixed(3) : "—"}</td>
                            <td />
                            <td className="py-2 font-mono text-sm text-right">{totalFineOz > 0 ? totalFineOz.toFixed(3) : "—"}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <Button variant="outline" size="sm" onClick={addBar} className="text-xs">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un lingot
                    </Button>
                    {totalFineOz > 0 && (
                      <div className={`rounded-lg border px-4 py-3 text-sm ${inTolerance ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span>Cible BCC : <strong className="font-mono">{poFineOz.toFixed(3)} oz fin</strong></span>
                          <span>Déclaré : <strong className="font-mono">{totalFineOz.toFixed(3)} oz fin</strong></span>
                          <span className="flex items-center gap-1.5">
                            {inTolerance ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            Variance <strong className="font-mono">{variancePct >= 0 ? "+" : ""}{variancePct.toFixed(3)}%</strong>{" "}
                            {inTolerance ? "(dans la tolérance)" : "(hors tolérance ±0.50%)"}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Oz fin = poids brut × titre ÷ 1000, troncature LBMA Annexe C. Tolérance ±{TOLERANCE_PCT}%.</p>
                  </CardContent>
                </Card>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Documents requis</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">Les 6 documents suivants sont obligatoires. Formats PDF, JPEG ou PNG (max 20 Mo).</p>
                    {DOC_TYPES.map((docType) => {
                      const newDoc = docs[docType];
                      const serverDoc = savedDocTypes[docType];
                      const ready = !!newDoc || !!serverDoc;
                      return (
                        <div key={docType} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${ready ? "border-emerald-500/30 bg-emerald-500/5" : "border-dashed border-muted-foreground/30"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${ready ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                              {ready ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{DOC_LABELS[docType]}</p>
                              {newDoc ? <p className="text-xs text-emerald-600">{newDoc.name}</p> : serverDoc ? <p className="text-xs text-emerald-600">✓ {serverDoc.file_name}</p> : <p className="text-xs text-muted-foreground">PDF · JPEG · PNG requis</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant={ready ? "ghost" : "outline"} size="sm" className="text-xs" onClick={() => fileInputRefs.current[docType]?.click()}>
                              <Upload className="mr-1.5 h-3 w-3" />{ready ? "Remplacer" : "Uploader"}
                            </Button>
                            {newDoc && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleFileSelect(docType, null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" ref={(el) => { fileInputRefs.current[docType] = el; }}
                              onChange={(e) => { handleFileSelect(docType, e.target.files?.[0] || null); e.target.value = ""; }} />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground pt-1">{DOC_TYPES.filter((t) => docReady(t)).length} / {DOC_TYPES.length} documents prêts</p>
                  </CardContent>
                </Card>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Déclaration du représentant autorisé</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label className="text-xs">Nom du déclarant (optionnel)</Label><Input placeholder="Prénom Nom" value={declarantName} onChange={(e) => setDeclarantName(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Fonction / Titre (optionnel)</Label><Input placeholder="ex. Directeur général" value={declarantTitle} onChange={(e) => setDeclarantTitle(e.target.value)} /></div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3 text-sm text-muted-foreground leading-relaxed">
                      <p>Je soussigné(e), représentant(e) autorisé(e) de la contrepartie, déclare que les informations contenues dans ce manifeste d&apos;expédition sont exactes et complètes à ma connaissance, que les lingots décrits proviennent de sources légales conformes au protocole LBMA Responsible Gold Guidance, et que les documents joints sont authentiques.</p>
                      <p>Je comprends que toute déclaration fausse ou trompeuse entraîne la suspension immédiate du dossier et peut donner lieu à des poursuites judiciaires.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox id="decl" checked={declarationAccepted} onCheckedChange={(v) => setDeclarationAccepted(Boolean(v))} className="mt-0.5" />
                      <Label htmlFor="decl" className="text-sm leading-snug cursor-pointer">J&apos;ai lu et j&apos;accepte la déclaration ci-dessus. Je certifie que toutes les informations fournies sont exactes.</Label>
                    </div>
                    {submitError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{submitError}</AlertDescription></Alert>}
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Précédent
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep((s) => s + 1)}>Suivant <ArrowRight className="ml-2 h-4 w-4" /></Button>
                ) : (
                  <Button onClick={() => handleSubmit(declarationAccepted)} disabled={!declarationAccepted || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {submitting ? "Soumission en cours…" : "Soumettre le manifeste"}
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
