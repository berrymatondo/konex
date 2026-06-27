"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Clock, AlertTriangle, RefreshCw, FileText,
  Download, ChevronRight, Eye, CornerUpLeft, TrendingUp,
  ShieldCheck, BarChart2, Bell, Inbox, ArrowUpLeft,
  Users, X, PencilLine,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Document { doc_type: string; file_name: string; uploaded_at: string }

interface ManifestQueueItem {
  manifestId: string;
  status: "draft" | "submitted" | "returned" | "accepted";
  attemptNumber: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reasonCode: string | null;
  reviewNotes: string | null;
  failedDocTypes: string[];
  declarantName: string | null;
  carrier: string | null;
  shipmentDate: string | null;
  waybillNumber: string | null;
  deliveryVaultId: string | null;
  poId: string;
  poStatus: string | null;
  trackingId: string | null;
  reference: string;
  poFineOz: number;
  declaredFineOz: number;
  barCount: number;
  incoterms: string | null;
  counterpartyId: string;
  counterpartyName: string | null;
  counterpartyCountry: string | null;
  documents: Document[];
  replacedDocTypes: string[];
  carriedDocTypes: string[];
  isResubmission: boolean;
  isFinalAttempt: boolean;
  slaDueAt: string | null;
  slaPct: number;
  slaOverdue: boolean;
  totalReturns: number;
  isFlagged: boolean;
}

interface QueueCounts {
  pending: number;
  resubmissions: number;
  returned: number;
  accepted: number;
  draft: number;
  slaWatch: number;
  slaOverdue: number;
}

interface QueueResponse {
  items: ManifestQueueItem[];
  counts: QueueCounts;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DOC_LABELS: Record<string, string> = {
  export_permit: "Permis d'exportation",
  assay_certificate: "Certificats d'analyse",
  chain_of_custody: "Chaîne de garde",
  carrier_waybill: "Lettre de voiture",
  lbma_rgg: "Audit LBMA RGG",
  minamata: "Déclaration Minamata",
};

const REASON_LABELS: Record<string, string> = {
  missing_document: "Document manquant",
  weight_discrepancy: "Écart de poids",
  chain_of_custody_gap: "Rupture de traçabilité",
  other: "Autre",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "il y a < 1 h";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  return `il y a ${d}j`;
}

function fmtShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " · " + new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Left border stripe per row status ───────────────────────────────────────
function RowStripe({ item }: { item: ManifestQueueItem }) {
  if (item.status === "accepted") return <div className="absolute left-0 inset-y-0 w-[3px] bg-emerald-500 rounded-l" />;
  if (item.status === "returned") return <div className="absolute left-0 inset-y-0 w-[3px] bg-red-500 rounded-l" />;
  if (item.status === "draft") return <div className="absolute left-0 inset-y-0 w-[3px] bg-slate-400 rounded-l" />;
  if (item.slaOverdue) return <div className="absolute left-0 inset-y-0 w-[3px] bg-red-400 rounded-l" />;
  if (item.isResubmission) return <div className="absolute left-0 inset-y-0 w-[3px] bg-violet-500 rounded-l" />;
  if (item.isFlagged || item.slaPct >= 75) return <div className="absolute left-0 inset-y-0 w-[3px] bg-amber-400 rounded-l" />;
  return <div className="absolute left-0 inset-y-0 w-[3px] bg-blue-500 rounded-l" />;
}

// ─── Notification bell ────────────────────────────────────────────────────────
function NotifBell({ items }: { items: ManifestQueueItem[] }) {
  const [open, setOpen] = useState(false);

  const notifs = items
    .filter((i) => i.submittedAt)
    .slice(0, 5)
    .map((i) => ({
      id: i.manifestId,
      read: i.status !== "submitted",
      text: i.isResubmission
        ? `Resoumission reçue — ${i.counterpartyName || i.counterpartyId} a resoumis contre ${i.reference}. Tentative ${i.attemptNumber} sur 2.${i.replacedDocTypes.length > 0 ? ` ${DOC_LABELS[i.replacedDocTypes[0]] || i.replacedDocTypes[0]} remplacé.` : ""}`
        : i.status === "accepted"
        ? `${i.counterpartyName || i.reference} — manifeste autorisé · expédition en route.`
        : i.status === "returned"
        ? `${i.reference} retourné à ${i.counterpartyName || "la contrepartie"} — ${REASON_LABELS[i.reasonCode ?? ""] || "voir détails"}.`
        : `Nouveau manifeste soumis — ${i.counterpartyName || i.counterpartyId} · ${i.reference}.`,
      time: fmtTime(i.submittedAt),
      poId: i.poId,
    }));

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 w-80 rounded-xl border bg-background shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium">Notifications</span>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen(false)}>
                Tout marquer lu
              </button>
            </div>
            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune notification.</div>
            ) : (
              notifs.map((n) => (
                <Link
                  key={n.id}
                  href={`/purchase-orders/${n.poId}`}
                  onClick={() => setOpen(false)}
                  className={`flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors ${n.read ? "" : "bg-violet-50/40 dark:bg-violet-950/20"}`}
                >
                  <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-transparent border border-muted-foreground/30" : "bg-violet-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{n.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ item, onClose }: { item: ManifestQueueItem; onClose: () => void }) {
  const manifestRef = `MNF-${item.reference}-${String(item.attemptNumber).padStart(2, "0")}`;
  const displayDate = item.submittedAt || item.updatedAt || item.createdAt;

  return (
    <div className="w-72 border-l flex-shrink-0 overflow-y-auto bg-muted/10 flex flex-col text-xs divide-y">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-background sticky top-0 z-10 border-b">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Manifeste</p>
          <p className="font-bold text-sm font-mono mt-0.5">{manifestRef}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.counterpartyName || item.counterpartyId} · {fmtShort(displayDate)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Draft notice */}
      {item.status === "draft" && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex gap-2 text-[11px] text-slate-700">
          <PencilLine className="h-3.5 w-3.5 shrink-0 text-slate-500 mt-0.5" />
          <span>Brouillon en cours — la contrepartie n'a pas encore soumis ce manifeste.</span>
        </div>
      )}

      {/* Final attempt warning */}
      {item.isFinalAttempt && item.status === "submitted" && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex gap-2 text-[11px] text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
          <span><strong>Tentative finale — 2 sur 2.</strong> Un 2ème rejet escalade ce PO au Trade Manager et le place en attente.</span>
        </div>
      )}

      {/* What changed (resubmission only) */}
      {item.isResubmission && item.status === "submitted" && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2.5">Ce qui a changé</p>
          {item.replacedDocTypes.length > 0 && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 px-3 py-2.5 mb-2">
              <p className="text-[11px] font-medium text-emerald-800 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item.replacedDocTypes.length} document{item.replacedDocTypes.length > 1 ? "s" : ""} remplacé{item.replacedDocTypes.length > 1 ? "s" : ""}
              </p>
              {item.replacedDocTypes.map((dt) => (
                <p key={dt} className="text-[11px] text-emerald-700">{DOC_LABELS[dt] || dt}</p>
              ))}
            </div>
          )}
          {item.carriedDocTypes.length > 0 && (
            <div className="rounded-lg border bg-background px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5">
                {item.carriedDocTypes.length} document{item.carriedDocTypes.length > 1 ? "s" : ""} reporté{item.carriedDocTypes.length > 1 ? "s" : ""} inchangé{item.carriedDocTypes.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">{item.carriedDocTypes.map((dt) => DOC_LABELS[dt] || dt).join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Return detail (returned manifests) */}
      {item.status === "returned" && (
        <div className="px-4 py-3 bg-red-50/50">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Motif du retour</p>
          {item.reasonCode && (
            <p className="text-[11px] font-medium text-destructive mb-1">{REASON_LABELS[item.reasonCode] ?? item.reasonCode}</p>
          )}
          {item.reviewNotes && <p className="text-[11px] text-muted-foreground">{item.reviewNotes}</p>}
          {item.failedDocTypes.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">Docs à remplacer :</p>
              {item.failedDocTypes.map((dt) => (
                <p key={dt} className="text-[11px] text-destructive">{DOC_LABELS[dt] || dt}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shipment */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Expédition</p>
        {[
          ["Contrepartie", item.counterpartyName || "—"],
          ["Pays", item.counterpartyCountry || "—"],
          ["Déclarant", item.declarantName || "—"],
          ["Transporteur", item.carrier || "—"],
          ["Lettre de voiture", item.waybillNumber || "—"],
          ["Coffre", item.deliveryVaultId || "—"],
          ["Incoterms", item.incoterms || "—"],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-1.5 border-b last:border-0">
            <span className="text-muted-foreground">{l}</span>
            <span className="font-medium text-right max-w-[150px] break-all">{v}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1.5 border-t mt-1.5">
          <span className="text-muted-foreground">Lingots</span>
          <span className="font-medium">{item.barCount > 0 ? item.barCount : "—"}</span>
        </div>
        <div className="flex justify-between pt-1.5 border-t">
          <span className="text-muted-foreground">Oz fin déclarés</span>
          <span className="font-bold font-mono">{item.declaredFineOz > 0 ? item.declaredFineOz.toFixed(3) : "—"}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-muted-foreground">Oz fin PO</span>
          <span className="font-mono text-muted-foreground">{item.poFineOz.toFixed(3)}</span>
        </div>
      </div>

      {/* SLA */}
      {item.status === "submitted" && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">SLA d&apos;examen (72 h)</p>
          <Progress value={item.slaPct} className="h-1.5 mb-2" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reçu {fmtTime(item.submittedAt)}</span>
            <span className={`font-medium ${item.slaOverdue ? "text-destructive" : item.slaPct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
              {item.slaOverdue ? "Dépassé" : `${Math.max(0, 100 - item.slaPct)}% restant`}
            </span>
          </div>
          {item.slaDueAt && (
            <p className="text-muted-foreground mt-1">Échéance : {new Date(item.slaDueAt).toLocaleString("fr-FR")}</p>
          )}
        </div>
      )}

      {/* Documents */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
          Documents ({Array.isArray(item.documents) ? item.documents.length : 0}/6)
        </p>
        {Array.isArray(item.documents) && item.documents.length > 0 ? (
          <div className="space-y-1.5">
            {item.documents.map((doc) => {
              const isNew = item.replacedDocTypes.includes(doc.doc_type);
              return (
                <div key={doc.doc_type} className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight truncate">{DOC_LABELS[doc.doc_type] || doc.doc_type}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doc.file_name}</p>
                  </div>
                  {isNew && (
                    <span className="shrink-0 text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">NEW</span>
                  )}
                  <a href={`/api/purchase-orders/${item.poId}/manifest/documents/${doc.doc_type}`} download onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">Aucun document disponible.</p>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-3">Historique</p>
        {buildTimeline(item).map(({ icon: TlIcon, color, label, sub }, i, arr) => (
          <div key={i} className="flex gap-2.5 pb-3 relative">
            {i < arr.length - 1 && <div className="absolute left-[10px] top-5 bottom-0 w-px bg-border" />}
            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${color}`}>
              <TlIcon className="h-2.5 w-2.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium leading-tight">{label}</p>
              {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-background border-t space-y-2 sticky bottom-0">
        <Link href={`/purchase-orders/${item.poId}`} className="block">
          <Button className="w-full" size="sm">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Ouvrir le bon de commande →
          </Button>
        </Link>
        {item.status === "submitted" && (
          <Link href={`/purchase-orders/${item.poId}/manifest/reject`} className="block">
            <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5">
              <CornerUpLeft className="mr-1.5 h-3.5 w-3.5" />
              Retourner à la contrepartie →
            </Button>
          </Link>
        )}
        {item.status !== "draft" && (
          <Link href={`/purchase-orders/${item.poId}/manifest/document`} className="block">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Voir document formel
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function buildTimeline(item: ManifestQueueItem) {
  const done = { color: "text-emerald-600 bg-emerald-50 border-emerald-300" };
  const fail = { color: "text-destructive bg-red-50 border-red-300" };
  const active = { color: "text-violet-600 bg-violet-50 border-violet-300" };
  const pending = { color: "text-muted-foreground bg-muted/30 border-border" };
  const draft = { color: "text-slate-500 bg-slate-50 border-slate-300" };

  const tl = [
    { icon: CheckCircle2, ...done, label: "Bon de commande reçu", sub: "" },
  ];

  if (item.attemptNumber > 1) {
    tl.push({ icon: X, ...fail, label: "Tentative 1 retournée", sub: REASON_LABELS[item.reasonCode ?? ""] || "Voir détails" });
  }

  if (item.status === "draft") {
    tl.push({ icon: PencilLine, ...draft, label: "Manifeste en cours de rédaction", sub: fmtShort(item.updatedAt || item.createdAt) });
    tl.push({ icon: FileText, ...pending, label: "Soumission attendue", sub: "En attente de la contrepartie" });
    tl.push({ icon: FileText, ...pending, label: "Entrée en coffre", sub: "Pending" });
  } else if (item.status === "submitted") {
    tl.push({ icon: CheckCircle2, ...done, label: `Manifeste soumis — tentative ${item.attemptNumber}`, sub: fmtShort(item.submittedAt) });
    tl.push({ icon: Eye, ...active, label: "En cours d'examen", sub: "En attente de révision BCC" });
    tl.push({ icon: FileText, ...pending, label: "Entrée en coffre", sub: "En attente d'autorisation" });
  } else if (item.status === "returned") {
    tl.push({ icon: X, ...fail, label: `Tentative ${item.attemptNumber} retournée`, sub: fmtShort(item.reviewedAt) });
    tl.push({ icon: RefreshCw, ...active, label: "Resoumission attendue", sub: "En attente de la contrepartie" });
    tl.push({ icon: FileText, ...pending, label: "Entrée en coffre", sub: "Pending" });
  } else if (item.status === "accepted") {
    tl.push({ icon: CheckCircle2, ...done, label: `Manifeste autorisé — tentative ${item.attemptNumber}`, sub: fmtShort(item.reviewedAt) });
    tl.push({ icon: CheckCircle2, ...done, label: "Entrée en coffre", sub: "Expédition en route" });
  }

  return tl;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ManifestQueuePage() {
  const { data, isLoading, mutate } = useSWR<QueueResponse>("/api/manifest-queue", fetcher, { refreshInterval: 30_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"submitted" | "returned" | "accepted" | "draft" | "all" | "resubmissions">("submitted");

  const items = data?.items ?? [];
  const counts = data?.counts ?? { pending: 0, resubmissions: 0, returned: 0, accepted: 0, draft: 0, slaWatch: 0, slaOverdue: 0 };

  const filtered = items.filter((i) => {
    if (activeTab === "submitted") return i.status === "submitted";
    if (activeTab === "resubmissions") return i.status === "submitted" && i.isResubmission;
    if (activeTab === "returned") return i.status === "returned";
    if (activeTab === "accepted") return i.status === "accepted";
    if (activeTab === "draft") return i.status === "draft";
    return true;
  });

  const selected = selectedId ? items.find((i) => i.manifestId === selectedId) ?? null : null;

  const avgReviewH = "3.1";
  const submittedItems = items.filter((i) => i.status === "submitted");
  const slaCompliance = submittedItems.length > 0
    ? Math.round(submittedItems.filter((i) => !i.slaOverdue).length / submittedItems.length * 100)
    : 100;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title="File d'attente — manifestes" subtitle="Bureau de conformité commerciale" />
          <div className="flex flex-1 overflow-hidden">

            {/* ── Workqueue sidebar ──────────────────────────────────── */}
            <div className="w-48 border-r flex-shrink-0 bg-muted/20 flex flex-col py-3 overflow-y-auto">

              <NavSection label="File de travail" />
              <NavItem
                icon={Inbox} label="Examen manifest." active={activeTab === "submitted"}
                count={counts.pending} countColor={counts.pending > 0 ? "red" : "gray"}
                onClick={() => setActiveTab("submitted")}
              />
              <NavItem
                icon={RefreshCw} label="Resoumissions" active={activeTab === "resubmissions"}
                count={counts.resubmissions} countColor={counts.resubmissions > 0 ? "purple" : "gray"}
                onClick={() => setActiveTab("resubmissions")}
              />
              <NavItem
                icon={Clock} label="SLA watch"
                count={counts.slaWatch + counts.slaOverdue} countColor={counts.slaOverdue > 0 ? "red" : counts.slaWatch > 0 ? "amber" : "gray"}
                onClick={() => {}}
              />
              <NavItem
                icon={ArrowUpLeft} label="Retournés"
                count={counts.returned} countColor={counts.returned > 0 ? "amber" : "gray"}
                active={activeTab === "returned"}
                onClick={() => setActiveTab("returned")}
              />
              <NavItem
                icon={PencilLine} label="Brouillons"
                count={counts.draft} countColor="gray"
                active={activeTab === "draft"}
                onClick={() => setActiveTab("draft")}
              />

              <NavSection label="Historique" />
              <NavItem
                icon={CheckCircle2} label="Autorisés"
                count={counts.accepted} countColor="gray"
                active={activeTab === "accepted"}
                onClick={() => setActiveTab("accepted")}
              />
              <NavItem icon={BarChart2} label="Journal d'activité" onClick={() => {}} />

              <NavSection label="Référence" />
              <NavItem icon={Users} label="Registre" onClick={() => {}} />
              <NavItem icon={FileText} label="Tous les manifestes" active={activeTab === "all"} onClick={() => setActiveTab("all")} />
            </div>

            {/* ── Main content ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Metrics + notification bell */}
              <div className="border-b bg-background px-5 py-2.5 shrink-0 flex items-start gap-2">
                <div className="grid grid-cols-4 gap-3 flex-1">
                  {[
                    { icon: Clock, label: "En attente", value: counts.pending, note: `${counts.resubmissions} resoumission${counts.resubmissions !== 1 ? "s" : ""}`, color: "text-blue-600 bg-blue-50" },
                    { icon: TrendingUp, label: "Délai moy. examen", value: `${avgReviewH} h`, note: "objectif < 8 h", color: "text-violet-600 bg-violet-50" },
                    { icon: ShieldCheck, label: "Conformité SLA", value: `${slaCompliance}%`, note: `${counts.slaWatch} en alerte`, color: slaCompliance >= 90 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50" },
                    { icon: BarChart2, label: "Autorisés (total)", value: counts.accepted, note: `${counts.draft} brouillon${counts.draft !== 1 ? "s" : ""}`, color: "text-emerald-600 bg-emerald-50" },
                  ].map(({ icon: Icon, label, value, note, color }) => (
                    <div key={label} className="flex items-start gap-2">
                      <div className={`rounded-lg p-1.5 ${color} shrink-0`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={`text-lg font-bold leading-tight ${color.split(" ")[0]}`}>{value}</p>
                        <p className="text-[9px] text-muted-foreground">{note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-1 shrink-0">
                  <NotifBell items={items} />
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b px-5 shrink-0 flex items-center gap-0.5">
                {([
                  { key: "submitted", label: "À examiner", count: counts.pending },
                  { key: "resubmissions", label: "Resoumissions", count: counts.resubmissions },
                  { key: "returned", label: "Retournés", count: counts.returned },
                  { key: "accepted", label: "Autorisés", count: counts.accepted },
                  { key: "draft", label: "Brouillons", count: counts.draft },
                  { key: "all", label: "Tous", count: items.length },
                ] as const).map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 py-2">
                  <Button variant="ghost" size="sm" onClick={() => mutate()} className="h-7 text-xs text-muted-foreground">
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Actualiser
                  </Button>
                </div>
              </div>

              {/* Queue list */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Layers className="h-8 w-8 mb-3 opacity-40" />
                    <p className="text-sm">Aucun manifeste dans cette catégorie.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filtered.map((item) => {
                      const isSelected = selectedId === item.manifestId;
                      const displayTime = item.submittedAt || item.updatedAt || item.createdAt;
                      return (
                        <button
                          key={item.manifestId}
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : item.manifestId)}
                          className={`w-full relative pl-4 pr-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                            isSelected ? "bg-muted/50" :
                            item.status === "draft" ? "bg-slate-50/40 dark:bg-slate-950/10" :
                            item.isResubmission && item.status === "submitted" ? "bg-violet-50/30 dark:bg-violet-950/10" : ""
                          }`}
                        >
                          <RowStripe item={item} />
                          <div className="flex items-center gap-3 pl-2">
                            {/* Dot indicator */}
                            <div className={`h-2 w-2 rounded-full shrink-0 ${
                              item.status === "accepted" ? "bg-emerald-500" :
                              item.status === "returned" ? "bg-red-500" :
                              item.status === "draft" ? "bg-slate-400" :
                              item.isResubmission ? "bg-violet-500" :
                              item.slaOverdue ? "bg-red-400" :
                              "bg-blue-500"
                            }`} />

                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                {item.isResubmission && item.status === "submitted" && (
                                  <span className="text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">Resoumis</span>
                                )}
                                <span className="font-mono font-bold text-sm">{item.reference}</span>
                                <StatusBadge item={item} />
                                {item.isFinalAttempt && item.status === "submitted" && (
                                  <Badge className="bg-red-100 text-red-700 border border-red-300 text-[10px]">
                                    <AlertTriangle className="mr-1 h-2.5 w-2.5 inline" /> Dernier essai
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{item.counterpartyName || "—"}</span>
                                {item.counterpartyCountry && <span>{item.counterpartyCountry}</span>}
                                {(item.declaredFineOz > 0 || item.poFineOz > 0) && (
                                  <span className="font-mono">{(item.declaredFineOz > 0 ? item.declaredFineOz : item.poFineOz).toFixed(3)} oz fin</span>
                                )}
                                {item.barCount > 0 && <span>{item.barCount} lingots</span>}
                                {item.carrier && <span>{item.carrier}</span>}
                                <span>{fmtTime(displayTime)}</span>
                              </div>
                              {/* Resubmission diff summary */}
                              {item.isResubmission && item.replacedDocTypes.length > 0 && (
                                <p className="text-[10px] text-violet-700 mt-0.5">
                                  Remplacé : {item.replacedDocTypes.map((dt) => DOC_LABELS[dt] || dt).join(", ")}
                                </p>
                              )}
                            </div>

                            {/* SLA + docs + arrow */}
                            <div className="shrink-0 flex flex-col items-end gap-1 min-w-[100px]">
                              {item.status === "submitted" && (
                                <div className="w-24">
                                  <div className="flex justify-between text-[10px] mb-0.5">
                                    <span className="text-muted-foreground">SLA</span>
                                    <span className={item.slaOverdue ? "text-destructive font-medium" : item.slaPct >= 75 ? "text-amber-600 font-medium" : "text-emerald-600"}>
                                      {item.slaOverdue ? "Dépassé" : `${item.slaPct}%`}
                                    </span>
                                  </div>
                                  <Progress value={item.slaPct} className="h-1" />
                                </div>
                              )}
                              <span className="text-[10px] text-muted-foreground">{Array.isArray(item.documents) ? item.documents.length : 0}/6 docs</span>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground/60 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Detail panel ─────────────────────────────────────── */}
            {selected && <DetailPanel item={selected} onClose={() => setSelectedId(null)} />}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function StatusBadge({ item }: { item: ManifestQueueItem }) {
  if (item.status === "accepted") return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Autorisé</Badge>;
  if (item.status === "returned") return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Retourné ({item.totalReturns}×)</Badge>;
  if (item.status === "draft") return <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px]">Brouillon</Badge>;
  if (item.isResubmission) return <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px]">Tentative {item.attemptNumber}/2</Badge>;
  if (item.isFlagged) return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Signalé</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">En attente</Badge>;
}

function NavSection({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest px-4 pt-3 pb-1.5">{label}</p>
  );
}

function NavItem({
  icon: Icon, label, count, countColor, active, onClick,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
  countColor?: "red" | "amber" | "gray" | "purple";
  active?: boolean;
  onClick: () => void;
}) {
  const countColors = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-violet-100 text-violet-700",
    gray: "bg-muted text-muted-foreground",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors ${
        active
          ? "text-primary bg-primary/10 border-l-2 border-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${countColors[countColor ?? "gray"]}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Layers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4L2 9l10 5 10-5-10-5zM2 14l10 5 10-5M2 19l10 5 10-5" />
    </svg>
  );
}
