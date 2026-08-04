"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, CheckCircle2, Clock3, Factory, Filter, PackageCheck, ShieldAlert, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { authClient } from "@/lib/auth-client";
import { InfoCell, OZ_PER_KG, RefiningPanel, StatusPill, Timeline, WorkflowStepper } from "./refining-shared";

interface RefiningOrderDetail {
  id: string;
  reference: string;
  status: string;
  purchaseOrderReference: string | null;
  lotReference: string | null;
  counterpartyName: string | null;
  refineryName: string | null;
  lbmaGoodDeliveryStatus: string | null;
  targetFineness: string;
  turnaroundDays: number;
  fee: number;
  feeUnit: "oz" | "g";
  expectedLossPercent: number;
  inputGrossWeightKg: number;
  inputFineGoldKg: number;
  expectedOutturnKg: number;
  goldPricePerOz: number;
  createdByName: string | null;
  createdByRole: string | null;
  createdAt: string;
  approvals: Array<{
    id: string;
    approverId: string;
    approverName: string;
    approverRole: string;
    decision: "approved" | "returned" | "rejected";
    note: string | null;
    decidedAt: string;
  }>;
}

const TIERS = [
  { name: "Tier 1", label: "≤ 500,000 USD", max: 500_000, count: 1 },
  { name: "Tier 2", label: "500,000 – 5,000,000 USD", max: 5_000_000, count: 2 },
  { name: "Tier 3", label: "> 5,000,000 USD", max: Number.POSITIVE_INFINITY, count: 3 },
];

const APPROVERS = [
  { initials: "BO", name: "Bullion Operations", role: "Head of Bullion Operations · Authorising Officer", approved: false, you: true, when: "" },
  { initials: "RR", name: "Reserve Risk", role: "Reserve Risk Officer", approved: false, you: false, when: "" },
  { initials: "DG", name: "Deputy Governor", role: "Deputy Governor", approved: false, you: false, when: "" },
];

type Decision = "approved" | "returned" | "rejected" | null;

export function RefiningOrderApproval() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const { language } = useLanguage();
  const fr = language === "fr";
  const [previewValue, setPreviewValue] = useState("actual");
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const { data: access } = useSWR<{ isAdmin?: boolean }>("/api/access/me", (url: string) => fetch(url).then((response) => response.json()));
  const orderReference = typeof params.id === "string" ? params.id : "GAC-REF-2026-014";
  const { data: order, error: orderError, isLoading: orderLoading, mutate: mutateOrder } = useSWR<RefiningOrderDetail>(
    `/api/refining-orders/${encodeURIComponent(orderReference)}`,
    (url: string) => fetch(url).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load refining order");
      return result;
    }),
  );

  const actualValue = order ? order.expectedOutturnKg * OZ_PER_KG * order.goldPricePerOz : 0;
  const totalCharge = order
    ? order.feeUnit === "oz"
      ? order.fee * order.inputFineGoldKg * OZ_PER_KG
      : order.fee * order.inputFineGoldKg * 1000
    : 0;
  const value = previewValue === "actual" ? actualValue : Number(previewValue);
  const tier = TIERS.find((candidate) => value <= candidate.max) ?? TIERS[2];
  const required = APPROVERS.slice(0, tier.count);
  const currentUserId = session?.user?.id;
  const currentUserAlreadyApproved = Boolean(currentUserId && order?.approvals.some((approval) => approval.approverId === currentUserId && approval.decision === "approved"));
  const approvedCount = Math.min(required.length, order?.approvals.filter((approval) => approval.decision === "approved").length ?? 0);
  const youRequired = Boolean(currentUserId && !currentUserAlreadyApproved && approvedCount < required.length);
  const allChecked = checks.every(Boolean);
  const fullyApproved = approvedCount === required.length;
  const approvedRecords = order?.approvals.filter((approval) => approval.decision === "approved") ?? [];
  const approvalSlots = required.map((template, index) => {
    const recorded = approvedRecords[index];
    const isNext = !recorded && index === approvedRecords.length;
    return {
      initials: recorded
        ? recorded.approverName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()
        : template.initials,
      name: recorded?.approverName || (isNext && session?.user?.name ? session.user.name : template.name),
      role: recorded?.approverRole.replaceAll("_", " ") || template.role,
      approved: Boolean(recorded),
      you: Boolean(isNext && youRequired),
      when: recorded?.decidedAt || "",
    };
  });

  const banner = useMemo(() => {
    if (decision === "returned") return { tone: "warning", title: fr ? "Retourné au Trade Manager pour modification" : "Returned to the Trade Manager for changes", description: note };
    if (decision === "rejected") return { tone: "danger", title: fr ? "Ordre rejeté" : "Order rejected", description: note };
    if (decision === "approved" && fullyApproved) return { tone: "success", title: fr ? "Approuvé — libéré pour expédition" : "Approved — released for dispatch", description: fr ? "Toutes les approbations sont enregistrées. L’ordre est transmis au responsable Coffre & Essai." : "All approvals are recorded. The order is now with the Vault & Assay Officer." };
    if (decision === "approved") return { tone: "info", title: fr ? "Votre approbation est enregistrée" : "Your approval is recorded", description: fr ? "Une approbation supplémentaire est requise avant l’expédition." : "An additional approval is required before dispatch." };
    return { tone: "warning", title: fr ? "Approbation de l’ordre requise" : "Order approval required", description: fr ? `${approvedCount} approbation${approvedCount > 1 ? "s" : ""} enregistrée${approvedCount > 1 ? "s" : ""} sur ${required.length} requise${required.length > 1 ? "s" : ""}.` : `${approvedCount} of ${required.length} required approval${required.length > 1 ? "s" : ""} recorded.` };
  }, [approvedCount, decision, fr, fullyApproved, note, required.length]);

  const makeDecision = async (next: Exclude<Decision, null>) => {
    if ((next === "returned" || next === "rejected") && !note.trim()) {
      setError(fr ? "Une note de décision est obligatoire pour retourner ou rejeter l’ordre." : "A decision note is required to return or reject the order.");
      return;
    }
    setError("");
    setDecisionSaving(true);
    try {
      const response = await fetch(`/api/refining-orders/${encodeURIComponent(orderReference)}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: next, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to record decision");
      setDecision(next);
      await mutateOrder();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : (fr ? "Échec de l’enregistrement." : "Unable to record decision."));
    } finally {
      setDecisionSaving(false);
    }
  };

  const historyItems = [
    {
      state: "done" as const,
      title: fr ? "Ordre créé et soumis" : "Order created & submitted",
      meta: order
        ? `${new Date(order.createdAt).toLocaleString(fr ? "fr-FR" : "en-GB")} · ${order.createdByName || "Bullion Desk"}${order.createdByRole ? ` · ${order.createdByRole.replaceAll("_", " ")}` : ""}`
        : "—",
    },
    ...(order?.approvals.map((approval) => ({
      state: approval.decision === "approved" ? "done" as const : "current" as const,
      title: approval.decision === "approved"
        ? `${fr ? "Approbation" : "Approval"} — ${approval.approverName}`
        : approval.decision === "returned"
          ? `${fr ? "Ordre retourné" : "Order returned"} — ${approval.approverName}`
          : `${fr ? "Ordre rejeté" : "Order rejected"} — ${approval.approverName}`,
      meta: `${new Date(approval.decidedAt).toLocaleString(fr ? "fr-FR" : "en-GB")} · ${approval.approverRole.replaceAll("_", " ")}${approval.note ? ` · ${approval.note}` : ""}`,
    })) ?? []),
    ...Array.from({ length: Math.max(0, required.length - approvedCount) }, (_, index) => ({
      state: index === 0 ? "current" as const : "pending" as const,
      title: fr ? `Approbation ${approvedCount + index + 1} attendue` : `Approval ${approvedCount + index + 1} pending`,
      meta: fr ? "En attente de décision" : "Awaiting decision",
    })),
    {
      state: fullyApproved ? "current" as const : "pending" as const,
      title: fr ? "Expédition par le responsable Coffre & Essai" : "Dispatch by Vault & Assay Officer",
      meta: fullyApproved ? (fr ? "Prêt pour expédition" : "Ready for dispatch") : (fr ? "En attente d’approbation" : "Pending approval"),
    },
  ];

  const deleteOrder = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/refining-orders/${encodeURIComponent(orderReference)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete refining order");
      router.push("/refining-orders");
      router.refresh();
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : (fr ? "Échec de la suppression." : "Delete failed."));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/refining-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{fr ? "Retour à la liste des ordres de raffinage" : "Back to the refining orders list"}</Link>

      {orderLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">{fr ? "Chargement de l’ordre…" : "Loading refining order…"}</div>}
      {orderError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{fr ? "Impossible de charger les données de cet ordre." : "Unable to load this refining order."}</div>}

      <div className={`flex gap-3 rounded-lg border border-l-4 p-4 ${banner.tone === "success" ? "border-l-emerald-500 bg-emerald-500/5" : banner.tone === "danger" ? "border-l-destructive bg-destructive/5" : banner.tone === "info" ? "border-l-sky-500 bg-sky-500/5" : "border-l-amber-500 bg-amber-500/5"}`}>
        {banner.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : banner.tone === "danger" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
        <div><p className="text-sm font-semibold">{banner.title}</p><p className="mt-1 text-xs text-muted-foreground">{banner.description}</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">{order?.reference || orderReference}</h1><StatusPill tone={decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning"}>{decision === "approved" ? (fr ? "Approuvé" : "Approved") : decision === "returned" ? (fr ? "Retourné" : "Returned") : decision === "rejected" ? (fr ? "Rejeté" : "Rejected") : (fr ? "Approbation en attente" : "Pending approval")}</StatusPill><StatusPill>{tier.count === 1 ? (fr ? "Approbation simple" : "Single approval") : tier.count === 2 ? (fr ? "Double approbation" : "Dual approval") : (fr ? "Triple approbation" : "Triple approval")}</StatusPill></div><p className="mt-1 text-xs text-muted-foreground">Bullion Desk · Trade Manager{order?.createdAt ? ` · ${new Date(order.createdAt).toLocaleString(fr ? "fr-FR" : "en-GB")}` : ""}{order?.purchaseOrderReference ? ` · PO ${order.purchaseOrderReference}` : ""}{order?.lotReference ? ` · Lot ${order.lotReference}` : ""}</p>{deleteError && <p className="mt-2 text-xs text-destructive">{deleteError}</p>}</div>{access?.isAdmin && <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={deleting}><Trash2 className="mr-2 h-4 w-4" />{fr ? "Supprimer l’ordre" : "Delete order"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{fr ? "Supprimer cet ordre de raffinage ?" : "Delete this refining order?"}</AlertDialogTitle><AlertDialogDescription>{fr ? `L’ordre ${orderReference} sera supprimé définitivement. Cette action est irréversible.` : `Order ${orderReference} will be permanently deleted. This action cannot be undone.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{fr ? "Annuler" : "Cancel"}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteOrder}>{deleting ? (fr ? "Suppression…" : "Deleting…") : (fr ? "Supprimer définitivement" : "Delete permanently")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>

      <WorkflowStepper active={fullyApproved ? 2 : 1} hrefs={["/refining-orders", `/refining-orders/${orderReference}/approval`, `/refining-orders/${orderReference}/dispatch`, undefined, undefined, `/refining-orders/${orderReference}/reserve-eligibility`]} labels={fr ? ["Brouillon", "Approbation", "Expédition", "En raffinage", "Outturn", "Classification"] : ["Draft", "Approval", "Dispatch", "In refining", "Outturn", "Classification"]} />

      <Tabs defaultValue="review">
        <TabsList><TabsTrigger value="review">{fr ? "Examen de l’ordre" : "Order review"}</TabsTrigger><TabsTrigger value="history">{fr ? "Historique d’approbation" : "Approval history"}</TabsTrigger></TabsList>
        <TabsContent value="review" className="mt-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <RefiningPanel icon={PackageCheck} title={fr ? "Ce que vous approuvez" : "What you are approving"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell label="Source PO"><span className="text-primary">{order?.purchaseOrderReference || "—"}</span></InfoCell><InfoCell label={fr ? "Lot doré" : "Doré lot"}>{order?.counterpartyName ? `${order.counterpartyName}` : ""}</InfoCell><InfoCell label={fr ? "Poids brut" : "Gross weight"}>{order ? `${order.inputGrossWeightKg.toFixed(3)} kg · ${(order.inputGrossWeightKg > 0 ? order.inputFineGoldKg / order.inputGrossWeightKg * 100 : 0).toFixed(2)}%` : "—"}</InfoCell><InfoCell label={fr ? "Teneur en or fin" : "Fine gold content"}>{order ? `${order.inputFineGoldKg.toFixed(3)} kg · ${(order.inputFineGoldKg * OZ_PER_KG).toLocaleString("en-US", { maximumFractionDigits: 2 })} oz` : "—"}</InfoCell></div></RefiningPanel>

              <RefiningPanel icon={Factory} title={fr ? "Raffinerie et conditions" : "Refiner & refining terms"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "Raffinerie" : "Refiner"}>{order?.refineryName || "—"}</InfoCell><InfoCell label="LBMA Good Delivery"><StatusPill tone={order?.lbmaGoodDeliveryStatus === "accredited" ? "success" : "warning"}>{order?.lbmaGoodDeliveryStatus === "accredited" ? (fr ? "Accréditée" : "Accredited") : (fr ? "Non accréditée" : "Not accredited")}</StatusPill></InfoCell><InfoCell label={fr ? "Canal" : "Refining channel"}>{order?.lbmaGoodDeliveryStatus === "accredited" ? (fr ? "Export vers une raffinerie accréditée" : "Export to an accredited refinery") : (fr ? "Export vers une raffinerie non accréditée" : "Export to a non-accredited refinery")}</InfoCell><InfoCell label={fr ? "Base de rendement" : "Yield basis"}>{fr ? "Rendement sur teneur en or fin essayée" : "Outturn on assayed fine content"}</InfoCell><InfoCell label={fr ? "Titre cible" : "Target fineness"}>{order ? `${order.targetFineness} ‰` : "—"}</InfoCell><InfoCell label={fr ? "Perte attendue" : "Expected loss"}>{order ? `${order.expectedLossPercent.toFixed(2)} % · −${(order.inputFineGoldKg - order.expectedOutturnKg).toFixed(3)} kg` : "—"}</InfoCell><InfoCell label={fr ? "Outturn attendu" : "Expected outturn"}>{order ? `${order.expectedOutturnKg.toFixed(3)} kg fine` : "—"}</InfoCell><InfoCell label={fr ? "Délai" : "Turnaround"}>{order ? `${order.turnaroundDays} ${fr ? "jours ouvrés" : "business days"}` : "—"}</InfoCell><InfoCell label={fr ? "Frais" : "Refining fee"}>{order ? `${order.fee.toFixed(2)} USD/${order.feeUnit}` : "—"}</InfoCell><InfoCell label={fr ? "Total des frais" : "Total refining charge"}><span className="text-primary">{order ? `${Math.round(totalCharge).toLocaleString("en-US")} USD` : "—"}</span></InfoCell></div></RefiningPanel>

              <RefiningPanel icon={ShieldAlert} title={fr ? "Traitement en réserves" : "Reserve-treatment flag"}><div className="rounded-lg border border-l-4 border-l-amber-500 bg-amber-500/5 p-4 text-sm text-muted-foreground"><strong className="text-foreground">{fr ? "Cet ordre produit de l’or non monétaire." : "This order produces non-monetary gold."}</strong> {fr ? "La raffinerie n’étant pas LBMA Good Delivery, l’outturn sera détenu comme or non monétaire jusqu’à un nouveau raffinage ou une accréditation." : "The refiner is not LBMA Good Delivery accredited, so outturn will be held as non-monetary gold pending re-refining or accreditation."}<p className="mt-3 border-t pt-3">{fr ? "Si des lingots éligibles sont requis, retournez l’ordre au Trade Manager pour choisir le canal export. Sinon, confirmez ce traitement dans la liste de validation." : "If reserve-eligible bullion is required, return the order to switch to the export channel. Otherwise confirm this outcome in the checklist."}</p></div></RefiningPanel>

              <RefiningPanel icon={Filter} title={<span className="flex w-full flex-wrap items-center gap-2">{fr ? "Circuit d’approbation" : "Approval routing"}<Select value={previewValue} onValueChange={setPreviewValue} disabled={decision !== null}><SelectTrigger className="ml-auto h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="actual">{fr ? "Cet ordre" : "This order"}</SelectItem><SelectItem value="250000">Preview · 250k USD</SelectItem><SelectItem value="3345182">Preview · 3.35M USD</SelectItem><SelectItem value="8500000">Preview · 8.5M USD</SelectItem></SelectContent></Select></span>}>
                <div className="mb-4 grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "Valeur de l’envoi" : "Consignment value"}>{order && order.goldPricePerOz > 0 ? `${Math.round(value).toLocaleString("en-US")} USD${previewValue !== "actual" ? " (preview)" : ""}` : (fr ? "Prix de référence indisponible" : "Reference price unavailable")}</InfoCell><InfoCell label={fr ? "Dépense de raffinage" : "Refining charge"}>{order ? `${Math.round(totalCharge).toLocaleString("en-US")} USD` : "—"}</InfoCell><InfoCell className="sm:col-span-2" label={fr ? "Palier applicable" : "Matched tier"}><StatusPill tone="info">{tier.name}</StatusPill> · {tier.count} {fr ? "approbateur(s) requis" : "approver(s) required"}</InfoCell></div>
                <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Tier</th><th className="px-3 py-2 font-medium">{fr ? "Valeur de l’envoi" : "Consignment value"}</th><th className="px-3 py-2 font-medium">{fr ? "Approbateurs" : "Approvers"}</th></tr></thead><tbody>{TIERS.map((candidate) => <tr key={candidate.name} className={`border-t ${candidate.name === tier.name ? "bg-primary/10" : ""}`}><td className={`px-3 py-2 ${candidate.name === tier.name ? "font-semibold text-primary" : ""}`}>{candidate.name}{candidate.name === tier.name && " ◄"}</td><td className="px-3 py-2 text-muted-foreground">{candidate.label}</td><td className="px-3 py-2">{candidate.count}</td></tr>)}</tbody></table></div>
                <p className="mt-3 text-xs text-muted-foreground">{fr ? "Le routage repose sur la valeur de marché de l’or sortant de garde, et non sur les seuls frais de raffinage." : "Routing is based on the market value of gold leaving custody, not the refining fee."}</p>
              </RefiningPanel>
            </div>

            <RefiningPanel icon={ShieldCheck} title={`${fr ? "Approbations" : "Approvals"} · ${approvedCount} / ${required.length}`} className="xl:sticky xl:top-20">
              <div className="space-y-3">{approvalSlots.map((approver, index) => <div key={`${index}-${approver.name}`} className="flex items-center gap-3 rounded-lg border p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">{approver.initials}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{approver.name}{approver.you && <span className="font-normal text-muted-foreground"> ({fr ? "vous" : "you"})</span>}</p><p className="truncate text-[11px] text-muted-foreground">{approver.role}</p>{approver.when && <p className="text-[10px] text-muted-foreground">{new Date(approver.when).toLocaleString(fr ? "fr-FR" : "en-GB")}</p>}</div>{approver.approved ? <StatusPill tone="success">{fr ? "Approuvé" : "Approved"}</StatusPill> : approver.you ? <StatusPill tone="warning">{fr ? "Votre décision" : "Your decision"}</StatusPill> : <StatusPill>{fr ? "En attente" : "Pending"}</StatusPill>}</div>)}</div>

              {!youRequired && <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{fr ? "Aucune action n’est requise de votre part pour ce palier." : "No action is required from you at this tier."}</div>}

              <div className="my-5 border-t" />
              <p className="mb-3 text-sm font-semibold">{fr ? "Liste de validation" : "Validation checklist"}</p>
              <div className="space-y-3">{[
                [fr ? "KYC et onboarding de la raffinerie à jour" : "Refiner KYC & onboarding current", ""],
                [fr ? "L’or fin correspond au lot livré" : "Fine gold matches the delivered lot", order ? `${order.inputFineGoldKg.toFixed(3)} kg${order.lotReference ? ` · ${order.lotReference}` : ""}` : "—"],
                [fr ? "Frais dans le tarif approuvé" : "Refining fee within approved tariff", order ? `${Math.round(totalCharge).toLocaleString("en-US")} USD` : "—"],
                [fr ? "Traitement en réserves examiné" : "Reserve-treatment outcome reviewed", ""],
                [fr ? "Séparation des tâches respectée" : "Segregation of duties respected", fr ? "L’approbateur n’est pas le créateur" : "Approver is not the maker"],
              ].map(([title, subtitle], index) => <label key={title} className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={checks[index]} disabled={decision !== null} onCheckedChange={(checked) => setChecks((previous) => previous.map((value, current) => current === index ? Boolean(checked) : value))} /><span><span className="block text-xs font-medium">{title}</span><span className="block text-[11px] text-muted-foreground">{subtitle}</span></span></label>)}</div>

              <div className="my-5 border-t" />
              <Label htmlFor="decision-note">{fr ? "Note de décision" : "Decision note"}</Label>
              <Textarea id="decision-note" className="mt-2" value={note} disabled={decision !== null} onChange={(event) => setNote(event.target.value)} placeholder={fr ? "Facultative pour approuver · obligatoire pour retourner ou rejeter" : "Optional for approval · required when returning or rejecting"} />
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
              <div className="mt-4 space-y-2"><Button className="w-full" disabled={!allChecked || !youRequired || decision !== null || decisionSaving} onClick={() => makeDecision("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />{decisionSaving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Approuver et libérer pour expédition" : "Approve & release for dispatch")}</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={decision !== null || decisionSaving} onClick={() => makeDecision("returned")}>{fr ? "Retourner" : "Return for changes"}</Button><Button variant="destructive" disabled={decision !== null || decisionSaving} onClick={() => makeDecision("rejected")}>{fr ? "Rejeter" : "Reject"}</Button></div></div>
              <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">{fr ? "L’approbation complète le double contrôle. L’expédition  reste une étape distincte, effectuée par le responsable Coffre & Essai." : "Approval completes dual control. Dispatch  is a separate step performed by the Vault & Assay Officer."}</p>
            </RefiningPanel>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4"><RefiningPanel icon={Clock3} title={fr ? "Piste d’approbation" : "Approval trail"}><Timeline items={historyItems} /></RefiningPanel></TabsContent>
      </Tabs>
    </div>
  );
}
