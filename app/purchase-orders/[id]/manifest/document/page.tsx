"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Download, CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoredBar {
  barNumber: string;
  grossWeightKg: number;
  fineness: number;
  fineOz: number;
}

interface SavedDoc {
  doc_type: string;
  file_name: string;
  uploaded_at: string;
}

interface Manifest {
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
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  reason_code: string | null;
  documents: SavedDoc[];
}

interface PurchaseOrder {
  id: string;
  tracking_id: string | null;
  status: string;
  estimated_weight_kg: number;
  purity_factor: number;
  delivery_vault_id: string;
  incoterms: string;
  counterparty_id: string;
  created_at: string;
}

const DOC_LABELS: Record<string, string> = {
  export_permit: "Permis d'exportation",
  assay_certificate: "Certificats d'analyse (Assay)",
  chain_of_custody: "Chaîne de garde (Chain of Custody)",
  carrier_waybill: "Lettre de voiture transporteur",
  lbma_rgg: "Rapport d'audit LBMA RGG",
  minamata: "Déclaration Minamata / Due Diligence",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "BROUILLON", color: "text-slate-600 border-slate-400" },
  submitted: { label: "SOUMIS — EN COURS D'EXAMEN", color: "text-blue-800 border-blue-500" },
  accepted: { label: "MANIFESTE AUTORISÉ", color: "text-emerald-800 border-emerald-600" },
  returned: { label: "RETOURNÉ À LA CONTREPARTIE", color: "text-red-800 border-red-500" },
};

const OZ_TO_GRAM = 31.1035;
const TOLERANCE_PCT = 0.5;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parseBars(raw: StoredBar[] | string | null): StoredBar[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtMmYy(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { month: "2-digit", year: "2-digit" });
}

export default function ManifestDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: po, isLoading: poLoading } = useSWR<PurchaseOrder>(`/api/purchase-orders/${id}`, fetcher);
  const { data: manifest, isLoading: manifestLoading } = useSWR<Manifest | null>(
    id ? `/api/purchase-orders/${id}/manifest` : null, fetcher,
  );

  const isLoading = poLoading || manifestLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!po || !manifest) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Manifeste introuvable.</p>
        <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Button>
      </div>
    );
  }

  const bars = parseBars(manifest.bars_json);
  const reference = po.tracking_id ?? id;
  const manifestRef = `MNF-${reference}-${String(manifest.attempt_number || 1).padStart(2, "0")}`;
  const totalGrossOz = bars.reduce((s, b) => s + (b.grossWeightKg * 1000 / OZ_TO_GRAM), 0);
  const totalGrossKg = bars.reduce((s, b) => s + b.grossWeightKg, 0);
  const totalFineOz = bars.reduce((s, b) => s + b.fineOz, 0);
  const poFineOz = Math.floor(((Number(po.estimated_weight_kg || 0) * Number(po.purity_factor || 0.9995)) * 1000 / OZ_TO_GRAM) * 1000) / 1000;
  const variancePct = poFineOz > 0 ? ((totalFineOz - poFineOz) / poFineOz) * 100 : 0;
  const inTolerance = Math.abs(variancePct) <= TOLERANCE_PCT;
  const statusInfo = STATUS_LABELS[manifest.status] || STATUS_LABELS.draft;

  const indicativeValue = (totalFineOz * 2000).toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-gray-200 print:bg-white">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-6 py-2.5 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm font-medium font-mono">{manifestRef}</span>
        <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-3.5 w-3.5" /> Imprimer
          </Button>
          <Link href={`/api/purchase-orders/${id}/manifest/export`}>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Exporter PDF
            </Button>
          </Link>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto my-8 print:my-0 bg-white shadow-md print:shadow-none rounded-lg print:rounded-none overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 text-white px-10 py-8 print:px-8 print:py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-amber-400 flex items-center justify-center font-black text-slate-900 text-lg">G</div>
                <div>
                  <p className="font-bold text-base leading-none text-white">Banque Centrale du Congo</p>
                  <p className="text-xs text-slate-200 mt-0.5">Direction de l&apos;Or et des Métaux Précieux</p>
                </div>
              </div>
              <h1 className="text-sm font-bold uppercase tracking-widest text-amber-400 mt-4">
                Gold Bullion Shipment Manifest
              </h1>
              <p className="text-xs text-slate-200 mt-0.5">Pre-Dispatch Declaration — LBMA Annex C</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider">Référence manifeste</p>
              <p className="font-mono font-bold text-lg tracking-wider mt-0.5 text-white">{manifestRef}</p>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mt-2">Bon de commande</p>
              <p className="font-mono text-sm tracking-wide mt-0.5 text-white">{reference}</p>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mt-2">Date d&apos;émission</p>
              <p className="text-sm mt-0.5 text-slate-100">{fmtDate(manifest.submitted_at || new Date().toISOString())}</p>
            </div>
          </div>

          {/* Status strip */}
          <div className={`mt-5 border-2 rounded px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest ${statusInfo.color} bg-white`}>
            {statusInfo.label}
          </div>
        </div>

        {/* Meta grid */}
        <div className="px-10 py-6 print:px-8 print:py-5 border-b">
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            <MetaSection title="EXPÉDITEUR (Consignor)">
              <MetaRow label="Contrepartie" value="—" />
              <MetaRow label="Adresse" value={manifest.departure_location || "—"} />
              <MetaRow label="Type de source" value="Artisanal & Small-Scale Mining (ASM)" />
            </MetaSection>
            <MetaSection title="DESTINATAIRE (Consignee)">
              <MetaRow label="Institution" value="Banque Centrale du Congo" />
              <MetaRow label="Coffre de destination" value={manifest.destination_vault || po.delivery_vault_id || "—"} />
              <MetaRow label="Incoterms" value={manifest.incoterms || po.incoterms || "—"} />
            </MetaSection>
            <MetaSection title="TRANSPORT">
              <MetaRow label="Transporteur" value={manifest.carrier || "—"} />
              <MetaRow label="Lettre de voiture / AWB" value={manifest.waybill_number || "—"} mono />
              <MetaRow label="Sceau de sécurité" value={manifest.seal_number || "—"} mono />
            </MetaSection>
            <MetaSection title="DATES">
              <MetaRow label="Date d'expédition" value={fmtDate(manifest.shipment_date)} />
              <MetaRow label="Date de soumission" value={fmtDate(manifest.submitted_at)} />
              {manifest.reviewed_at && <MetaRow label="Date d'examen" value={fmtDate(manifest.reviewed_at)} />}
              <MetaRow label="Tentative n°" value={String(manifest.attempt_number || 1)} />
            </MetaSection>
          </div>
        </div>

        {/* Bar weight table — LBMA Annex C */}
        <div className="px-10 py-6 print:px-8 print:py-5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-4">
            Fiche de poids des lingots — LBMA Annex C
          </h2>
          {bars.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun lingot enregistré.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  {["#", "N° Série / Référence", "Raffinerie", "Fab. (MM/AA)", "Poids brut (troy oz)", "Titre (‰)", "Oz fin", "Poids brut (kg)", "Statut"].map((h) => (
                    <th key={h} className="py-2 px-2 text-left font-semibold text-[10px] first:pl-3 last:pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bars.map((bar, i) => {
                  const grossOz = bar.grossWeightKg * 1000 / OZ_TO_GRAM;
                  return (
                    <tr key={bar.barNumber || i} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-100"}`}>
                      <td className="py-2 px-2 pl-3 text-slate-600">{i + 1}</td>
                      <td className="py-2 px-2 font-mono font-medium text-slate-800">{bar.barNumber || "—"}</td>
                      <td className="py-2 px-2 text-slate-600">—</td>
                      <td className="py-2 px-2 font-mono text-slate-600">{fmtMmYy(manifest.shipment_date)}</td>
                      <td className="py-2 px-2 font-mono text-slate-800">{grossOz.toFixed(3)}</td>
                      <td className="py-2 px-2 font-mono text-slate-800">{Number(bar.fineness).toFixed(1)}</td>
                      <td className="py-2 px-2 font-mono font-bold text-slate-900">{bar.fineOz > 0 ? bar.fineOz.toFixed(3) : "—"}</td>
                      <td className="py-2 px-2 font-mono text-slate-800">{Number(bar.grossWeightKg).toFixed(3)}</td>
                      <td className="py-2 px-2 pr-3">
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold border border-emerald-300">OK</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="py-2.5 px-2 pl-3 text-[10px]" colSpan={4}>TOTAL ({bars.length} lingot{bars.length !== 1 ? "s" : ""})</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{totalGrossOz.toFixed(3)}</td>
                  <td className="py-2.5 px-2 text-slate-300 text-[10px]">— avg</td>
                  <td className="py-2.5 px-2 font-mono text-sm">{totalFineOz > 0 ? totalFineOz.toFixed(3) : "—"}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{totalGrossKg.toFixed(3)}</td>
                  <td className="py-2.5 px-2 pr-3" />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Commercial summary + Documents side by side */}
        <div className="px-10 py-6 print:px-8 print:py-5 border-b grid grid-cols-2 gap-8">
          {/* Commercial summary */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-4">Récapitulatif commercial</h2>
            <div className="space-y-2 text-xs">
              {[
                { label: "Référence BCC", value: reference },
                { label: "Quantité commandée (oz fin)", value: poFineOz.toFixed(3), mono: true },
                { label: "Oz fin déclarés", value: totalFineOz > 0 ? totalFineOz.toFixed(3) : "—", mono: true },
                { label: "Variance", value: `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(3)}%`, mono: true, highlight: inTolerance ? "ok" : "warn" },
                { label: "Valeur indicative (USD)", value: indicativeValue },
              ].map(({ label, value, mono, highlight }) => (
                <div key={label} className="flex justify-between items-start border-b border-slate-200 pb-1.5">
                  <span className="text-slate-600 font-medium">{label}</span>
                  <span className={`font-medium text-right ${mono ? "font-mono" : ""} ${highlight === "ok" ? "text-emerald-700" : highlight === "warn" ? "text-amber-700" : "text-slate-900"}`}>
                    {value}
                    {highlight === "ok" && " ✓"}
                    {highlight === "warn" && " ⚠"}
                  </span>
                </div>
              ))}
            </div>
            {!inTolerance && totalFineOz > 0 && (
              <div className="mt-3 rounded bg-amber-50 border border-amber-300 px-3 py-2 text-[11px] text-amber-800 flex gap-2 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Variance hors tolérance ±{TOLERANCE_PCT}%. Justification requise.
              </div>
            )}
          </div>

          {/* Documents */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-4">Documents joints ({Array.isArray(manifest.documents) ? manifest.documents.length : 0}/6)</h2>
            <div className="space-y-1.5">
              {Object.keys(DOC_LABELS).map((dt) => {
                const doc = Array.isArray(manifest.documents) ? manifest.documents.find((d) => d.doc_type === dt) : null;
                return (
                  <div key={dt} className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs ${doc ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-slate-50"}`}>
                    <div className="flex items-center gap-1.5">
                      {doc ? <CheckCircle2 className="h-3 w-3 text-emerald-700 shrink-0" /> : <Clock className="h-3 w-3 text-slate-500 shrink-0" />}
                      <span className={doc ? "text-slate-800 font-medium" : "text-slate-600"}>{DOC_LABELS[dt]}</span>
                    </div>
                    {doc && <span className="text-[10px] text-emerald-700 font-semibold">Inclus</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compliance certifications */}
        <div className="px-10 py-6 print:px-8 print:py-5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-4">Certifications de conformité & Chaîne de garde</h2>
          <div className="grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-2">
              <CertRow title="LBMA Responsible Gold Guidance" desc="L'or contenu dans cet envoi répond aux exigences de l'OCDE en matière de devoir de diligence pour les chaînes d'approvisionnement responsables." ok />
              <CertRow title="Protocole de Minamata" desc="Aucune utilisation de mercure n'a eu lieu dans la production ou le traitement de cet or." ok={!!manifest.documents?.find?.((d) => d.doc_type === "minamata")} />
              <CertRow title="Lutte contre le travail forcé" desc="Déclaration de l'expéditeur attestant l'absence de travail des enfants et de travail forcé." ok />
            </div>
            <div className="space-y-2">
              <CertRow title="Chaîne de garde (Chain of Custody)" desc="Document de traçabilité depuis l'extraction jusqu'à la remise au transporteur, signé à chaque étape." ok={!!manifest.documents?.find?.((d) => d.doc_type === "chain_of_custody")} />
              <CertRow title="Certificat d'analyse ISO 17025" desc="Résultats d'analyse d'un laboratoire accrédité attestant de la pureté et du poids de chaque lingot." ok={!!manifest.documents?.find?.((d) => d.doc_type === "assay_certificate")} />
              <CertRow title="Permis d'exportation" desc="Autorisation officielle d'exportation émise par les autorités compétentes du pays d'origine." ok={!!manifest.documents?.find?.((d) => d.doc_type === "export_permit")} />
            </div>
          </div>
        </div>

        {/* Signatories */}
        <div className="px-10 py-6 print:px-8 print:py-5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-6">Signataires</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                role: "Déclarant (Contrepartie)",
                name: manifest.declarant_name || "—",
                title: manifest.declarant_title || "—",
                date: fmtDate(manifest.submitted_at),
                signed: !!manifest.declaration_accepted,
              },
              {
                role: "Officier d'analyse / Assay Officer",
                name: "—",
                title: "Laboratoire accrédité ISO 17025",
                date: fmtDate(manifest.shipment_date),
                signed: !!manifest.documents?.find?.((d) => d.doc_type === "assay_certificate"),
              },
              {
                role: "Représentant transporteur",
                name: manifest.carrier || "—",
                title: "Transporteur de valeurs agréé",
                date: fmtDate(manifest.shipment_date),
                signed: !!manifest.documents?.find?.((d) => d.doc_type === "carrier_waybill"),
              },
            ].map(({ role, name, title, date, signed }) => (
              <div key={role} className="border border-slate-300 rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-3">{role}</p>
                <div className={`h-12 border-b-2 border-dashed mb-3 flex items-end pb-1 ${signed ? "border-emerald-500" : "border-slate-300"}`}>
                  {signed && <span className="text-[10px] italic text-emerald-700 font-medium">Déclaration électronique acceptée</span>}
                </div>
                <p className="text-xs font-bold text-slate-900">{name}</p>
                <p className="text-[11px] text-slate-600">{title}</p>
                <p className="text-[10px] text-slate-500 mt-1">{date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-10 py-4 print:px-8 flex items-center justify-between text-[10px] text-slate-600">
          <div>
            <p className="font-bold text-slate-800 mb-0.5">AVERTISSEMENT LÉGAL</p>
            <p>Ce document est un manifeste officiel soumis à la Banque Centrale du Congo. Toute falsification constitue une infraction pénale.</p>
            <p>La présentation de ce document ne constitue pas une autorisation d'entrée en coffre — l'approbation formelle est requise.</p>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="font-mono text-slate-700 font-medium">{manifestRef}</p>
            <p>Généré le {new Date().toLocaleDateString("fr-FR")}</p>
            <p>Page 1 / 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2.5 border-b border-slate-200 pb-1">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function CertRow({ title, desc, ok }: { title: string; desc: string; ok?: boolean }) {
  return (
    <div className="flex gap-2.5 py-2 border-b border-slate-200 last:border-0">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ok ? "bg-emerald-100 border border-emerald-300" : "bg-slate-200 border border-slate-300"}`}>
        {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-700" /> : <Clock className="h-3 w-3 text-slate-500" />}
      </div>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
