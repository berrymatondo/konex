"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, FileWarning,
  Scale, GitFork, HelpCircle, Send, Clock, Files, TruckIcon, X, ChevronRight,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  export_permit: "Permis d'exportation",
  assay_certificate: "Certificats d'analyse (Assay)",
  chain_of_custody: "Chaîne de garde (Chain of Custody)",
  carrier_waybill: "Lettre de voiture transporteur",
  lbma_rgg: "Rapport d'audit LBMA RGG",
  minamata: "Déclaration Minamata / Due Diligence",
};

const REASON_OPTIONS = [
  {
    code: "missing_document",
    title: "Document manquant ou expiré",
    icon: FileWarning,
    desc: "Permis d'exportation, certificat d'analyse, rapport LBMA RGG invalide, absent ou mauvaise catégorie",
  },
  {
    code: "weight_discrepancy",
    title: "Écart de poids / titre",
    icon: Scale,
    desc: "Oz fin déclarés ou pureté en dehors de la tolérance PO ou du minimum LBMA",
  },
  {
    code: "chain_of_custody_gap",
    title: "Rupture de chaîne de garde",
    icon: GitFork,
    desc: "Transfert non comptabilisé entre la mine, la raffinerie ou le transporteur",
  },
  {
    code: "other",
    title: "Autre — préciser dans les notes",
    icon: HelpCircle,
    desc: "Problème de conformité non couvert par les catégories ci-dessus",
  },
];

interface SavedDoc { doc_type: string; file_name: string; uploaded_at: string }

interface Manifest {
  id: string;
  status: string;
  attempt_number: number;
  submitted_at: string | null;
  shipment_date: string | null;
  carrier: string | null;
  waybill_number: string | null;
  declarant_name: string | null;
  bars_json: unknown;
  documents: SavedDoc[];
}

interface PurchaseOrder {
  id: string;
  tracking_id: string | null;
  estimated_weight_kg: number;
  purity_factor: number;
  delivery_vault_id: string;
  incoterms: string;
  counterparty_id: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function addDays(iso: string | null | undefined, days: number): string {
  if (!iso) return "—";
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ManifestRejectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: po, isLoading: poLoading } = useSWR<PurchaseOrder>(`/api/purchase-orders/${id}`, fetcher);
  const { data: manifest, isLoading: mLoading } = useSWR<Manifest | null>(
    id ? `/api/purchase-orders/${id}/manifest` : null, fetcher,
  );

  const [reasonCode, setReasonCode] = useState("missing_document");
  const [failedDocTypes, setFailedDocTypes] = useState<string[]>([]);
  const [publicNotes, setPublicNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = poLoading || mLoading;
  const reference = po?.tracking_id || `PO-${(id || "").slice(0, 8).toUpperCase()}`;
  const manifestRef = manifest
    ? `MNF-${reference}-${String(manifest.attempt_number || 1).padStart(2, "0")}`
    : "—";

  const submittedDocs: SavedDoc[] = Array.isArray(manifest?.documents) ? manifest!.documents : [];
  const acceptedDocs = submittedDocs.filter((d) => !failedDocTypes.includes(d.doc_type));
  const attemptNumber = manifest?.attempt_number ?? 1;
  const isFinalAttempt = attemptNumber >= 2;
  const canConfirm = publicNotes.trim().length > 10;

  const toggleFailed = (dt: string) =>
    setFailedDocTypes((p) => p.includes(dt) ? p.filter((x) => x !== dt) : [...p, dt]);

  const handleReturn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/manifest/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return",
          reasonCode,
          failedDocTypes,
          publicNotes: publicNotes.trim(),
          internalNotes: internalNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Erreur lors du retour."); return; }
      router.push(`/purchase-orders/${id}?manifest=returned`);
    } catch {
      setError("Une erreur inattendue s'est produite.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !po || !manifest) {
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

  if (manifest.status !== "submitted") {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title="Retour manifeste" subtitle={reference} />
            <main className="flex-1 p-6 max-w-xl mx-auto">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Ce manifeste n&apos;est pas en statut «&nbsp;soumis&nbsp;» — il ne peut pas être retourné.
                </AlertDescription>
              </Alert>
              <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour
              </Button>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const reasonLabel = REASON_OPTIONS.find((r) => r.code === reasonCode)?.title ?? reasonCode;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title={`Retour manifeste — ${manifestRef}`} subtitle={reference} />

          {/* Breadcrumb */}
          <div className="border-b bg-background px-6 py-2 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Link href="/manifest-queue" className="text-primary hover:underline">File d&apos;attente</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/purchase-orders/${id}`} className="text-primary hover:underline">{manifestRef}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-destructive font-medium">Retourner à la contrepartie</span>
          </div>

          {/* Attempt banner */}
          <div className={`border-b px-6 py-2.5 flex items-center justify-between shrink-0 ${isFinalAttempt ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${isFinalAttempt ? "text-red-800" : "text-amber-800"}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {isFinalAttempt
                ? `Ceci est la tentative ${attemptNumber} sur 2. Un deuxième rejet escalade ce bon de commande au Trade Manager et le place en attente.`
                : `Ceci est la tentative ${attemptNumber} sur 2. Un 2ème rejet escalade automatiquement vers le Trade Manager.`}
            </div>
            <Badge className={`text-xs ${isFinalAttempt ? "bg-red-100 text-red-700 border-red-300" : "bg-amber-100 text-amber-700 border-amber-300"} border`}>
              {2 - attemptNumber} resoumission{2 - attemptNumber !== 1 ? "s" : ""} restante{2 - attemptNumber !== 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* ── Main left area ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Info strip */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Contrepartie", value: po.counterparty_id },
                    { label: "Réf. manifeste", value: manifestRef, mono: true },
                    { label: "Réf. PO", value: reference, mono: true },
                    { label: "Soumis le", value: fmtDate(manifest.submitted_at) },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                      <p className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Reason code */}
                <div>
                  <SectionHead>Motif du retour</SectionHead>
                  <div className="grid grid-cols-2 gap-2.5">
                    {REASON_OPTIONS.map(({ code, title, icon: Icon, desc }) => {
                      const sel = reasonCode === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setReasonCode(code)}
                          className={`relative rounded-lg border p-3 text-left transition-all ${
                            sel ? "border-destructive border-[1.5px] bg-destructive/5" : "border-border hover:border-destructive/50"
                          }`}
                        >
                          {sel && (
                            <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon className={`h-3.5 w-3.5 ${sel ? "text-destructive" : "text-muted-foreground"}`} />
                            <span className={`text-xs font-medium ${sel ? "text-destructive" : ""}`}>{title}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Failed items */}
                <div>
                  <SectionHead>
                    Éléments à corriger
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">(cochez les documents que la contrepartie doit remplacer)</span>
                  </SectionHead>
                  <div className="rounded-lg border border-destructive/40 overflow-hidden">
                    <div className="px-3 py-2 bg-destructive/5 border-b border-destructive/30 flex items-center gap-2 text-xs font-medium text-destructive">
                      <X className="h-3.5 w-3.5" />
                      {failedDocTypes.length > 0
                        ? `${failedDocTypes.length} élément${failedDocTypes.length > 1 ? "s" : ""} marqué${failedDocTypes.length > 1 ? "s" : ""} à corriger`
                        : "Aucun document sélectionné — cochez ci-dessous"}
                    </div>
                    {submittedDocs.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">Aucun document soumis.</div>
                    ) : (
                      submittedDocs.map((doc) => {
                        const failed = failedDocTypes.includes(doc.doc_type);
                        return (
                          <div
                            key={doc.doc_type}
                            onClick={() => toggleFailed(doc.doc_type)}
                            className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                              failed ? "bg-destructive/5" : "hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              checked={failed}
                              onCheckedChange={() => toggleFailed(doc.doc_type)}
                              className="mt-0.5 shrink-0 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                            />
                            <div>
                              <p className={`text-xs font-medium ${failed ? "text-destructive" : ""}`}>
                                {DOC_LABELS[doc.doc_type] || doc.doc_type}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{doc.file_name}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Accepted items */}
                {acceptedDocs.length > 0 && (
                  <div>
                    <SectionHead>Éléments acceptés — reportés automatiquement</SectionHead>
                    <div className="rounded-lg border border-emerald-500/40 overflow-hidden">
                      <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {acceptedDocs.length} élément{acceptedDocs.length > 1 ? "s" : ""} accepté{acceptedDocs.length > 1 ? "s" : ""} — la contrepartie n&apos;a pas besoin de les recharger
                      </div>
                      {acceptedDocs.map((doc) => (
                        <div key={doc.doc_type} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 text-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{DOC_LABELS[doc.doc_type] || doc.doc_type} — <span className="text-muted-foreground">{doc.file_name}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <SectionHead>Notes</SectionHead>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Message à la contrepartie <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        value={publicNotes}
                        onChange={(e) => setPublicNotes(e.target.value)}
                        placeholder="Visible dans le portail de la contrepartie…"
                        className="w-full text-xs px-3 py-2.5 border rounded-lg bg-background resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Note interne <span className="text-[10px] font-normal">(registre d&apos;audit uniquement — non partagé)</span>
                      </Label>
                      <textarea
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Note interne pour le registre d'audit uniquement…"
                        className="w-full text-xs px-3 py-2.5 border rounded-lg bg-background resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <SectionHead>Aperçu de la notification à la contrepartie</SectionHead>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/30 border-b text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Ce que la contrepartie verra dans son portail
                    </div>
                    <div className="px-4 py-3 bg-background space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Motif</p>
                        <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">{reasonLabel}</Badge>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Message du TCO</p>
                        <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-foreground min-h-[40px] whitespace-pre-wrap">
                          {publicNotes.trim() || <span className="text-muted-foreground italic">Aucun message saisi…</span>}
                        </div>
                      </div>
                      <div className="border-t pt-2.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Examiné le {new Date().toLocaleDateString("fr-FR")}</span>
                        <span>·</span>
                        <span className="text-amber-700">
                          Resoumission avant le <strong>{addDays(new Date().toISOString(), 7)}</strong> (SLA 7 jours)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Escalation note */}
                {isFinalAttempt && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex gap-2.5 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Attention — tentative finale (2 de 2).</strong> Si la resoumission est aussi retournée, le statut du PO passera automatiquement à <code className="bg-amber-100 px-1 rounded">escalated</code> et le Trade Manager sera notifié. Le PO sera mis en attente jusqu&apos;à intervention manuelle.
                    </div>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Footer */}
              <div className="border-t bg-background px-6 py-3 flex items-center justify-between shrink-0">
                <div className="text-xs">
                  {canConfirm ? (
                    <span className="text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Cette action est irréversible — la contrepartie sera notifiée immédiatement
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <X className="h-3.5 w-3.5" />
                      Ajoutez un message à la contrepartie pour confirmer le retour
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour à l&apos;examen
                  </Button>
                  <Button
                    onClick={handleReturn}
                    disabled={!canConfirm || submitting}
                    className="bg-destructive hover:bg-destructive/90 text-white"
                    size="sm"
                  >
                    {submitting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    {submitting ? "Retour en cours…" : "Confirmer — retourner à la contrepartie →"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Right panel ──────────────────────────────────────────── */}
            <div className="w-60 border-l flex-shrink-0 overflow-y-auto bg-muted/10 flex flex-col divide-y text-xs">

              {/* Shipment snapshot */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2.5">Aperçu de l&apos;expédition</p>
                {[
                  ["Transporteur", manifest.carrier || "—"],
                  ["Date d'expédition", fmtDate(manifest.shipment_date)],
                  ["N° lettre de voiture", manifest.waybill_number || "—"],
                  ["Déclarant", manifest.declarant_name || "—"],
                  ["Coffre dest.", po.delivery_vault_id || "—"],
                  ["Incoterms", po.incoterms || "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-start py-1.5 border-b last:border-0">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="font-medium text-right max-w-[110px] break-all font-mono text-[11px]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Attempt tracker */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2.5">Tentatives</p>
                <div className="flex gap-1.5 mb-2">
                  {[1, 2].map((n) => (
                    <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= attemptNumber ? "bg-destructive" : "bg-muted"}`} />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tentative {attemptNumber} sur 2 utilisée après ce retour. {2 - attemptNumber > 0 ? `${2 - attemptNumber} restante avant escalade.` : "Dernière tentative — escalade automatique."}
                </p>
              </div>

              {/* What happens next */}
              <div className="px-4 py-3 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2.5">Ce qui se passe ensuite</p>
                {[
                  { icon: Send, color: "text-violet-600 bg-violet-50", title: "Contrepartie notifiée", sub: "Email + alerte portail · motif et message envoyés immédiatement" },
                  { icon: Clock, color: "text-amber-600 bg-amber-50", title: "SLA resoumission 7 jours", sub: `Délai de resoumission : ${addDays(new Date().toISOString(), 7)}` },
                  { icon: Files, color: "text-emerald-600 bg-emerald-50", title: `${acceptedDocs.length} doc${acceptedDocs.length !== 1 ? "s" : ""} reporté${acceptedDocs.length !== 1 ? "s" : ""}`, sub: "Pré-chargés dans le formulaire de resoumission" },
                  { icon: TruckIcon, color: "text-destructive bg-red-50", title: "L'or ne bouge pas", sub: "Expédition bloquée jusqu'à autorisation du nouveau manifeste" },
                  ...(isFinalAttempt ? [{ icon: AlertTriangle, color: "text-amber-600 bg-amber-50", title: "Escalade au Trade Manager", sub: "PO mis en attente automatiquement en cas de 2ème rejet" }] : []),
                ].map(({ icon: Icon, color, title, sub }) => (
                  <div key={title} className="flex gap-2.5 py-2.5 border-b last:border-0">
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-[11px]">{title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
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

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
