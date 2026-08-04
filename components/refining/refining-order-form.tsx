"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Box,
  Clock3,
  Factory,
  FileText,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, OZ_PER_KG, RefiningPanel, StatusPill, Timeline, WorkflowStepper } from "./refining-shared";

interface Lot {
  id: string;
  po: string;
  counterparty: string;
  lot: string;
  delivered: string;
  gross: number;
  purity: number;
  type: string;
  goldType: string | null;
  sourceRefinerId: string | null;
  status: string;
}

interface PurchaseOrderSource {
  id: string;
  trackingId: string | null;
  counterpartyName: string | null;
  status: string;
  estimatedWeightKg: number | string | null;
  goldType: string | null;
  assayRange: string | null;
  purityFactor: number | string | null;
  lotReference: string | null;
  deliveredAt: string | null;
  receivedGrossWeightKg: number | string | null;
  receivedPurity: number | string | null;
  sourceRefinerId: string | null;
}

interface RefinerSource {
  id: string;
  legalName: string;
  countryOfIncorporation: string | null;
  registeredAddress: string | null;
  counterpartyType?: "trading_house" | "refinery";
  lbmaGoodDeliveryStatus?: string | null;
  maxOutputFineness?: string | null;
  status: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load purchase orders");
  return response.json();
};

const GOLD_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  dore_bars: { fr: "Doré", en: "Doré Bars" },
  refined_bars: { fr: "Lingots raffinés", en: "Refined Bars" },
  gold_dust: { fr: "Poudre d'or", en: "Gold Dust" },
  scrap_gold: { fr: "Or de récupération", en: "Scrap Gold" },
};

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  draft: { fr: "Brouillon", en: "Draft" },
  pending_compliance: { fr: "Conformité", en: "Compliance" },
  pending_finance: { fr: "Finance", en: "Finance" },
  approved: { fr: "Approuvé", en: "Approved" },
  sent_to_counterparty: { fr: "Envoyé", en: "Sent" },
  negotiating: { fr: "Négociation", en: "Negotiating" },
  accepted: { fr: "Accepté", en: "Accepted" },
  manifest_validated: { fr: "Manifeste validé", en: "Manifest validated" },
  in_transit: { fr: "En transit", en: "In transit" },
  delivered: { fr: "Livré", en: "Delivered" },
  pending_settlement: { fr: "Règlement", en: "Settlement" },
  declined: { fr: "Refusé", en: "Declined" },
  cancelled: { fr: "Annulé", en: "Cancelled" },
};

function purityPercent(order: PurchaseOrderSource): number {
  const receivedPurity = Number(order.receivedPurity);
  if (Number.isFinite(receivedPurity) && receivedPurity > 0) {
    return receivedPurity <= 1 ? receivedPurity * 100 : receivedPurity;
  }

  const factor = Number(order.purityFactor);
  if (Number.isFinite(factor) && factor > 0) return factor <= 1 ? factor * 100 : factor;

  const values = order.assayRange?.match(/\d+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(",", "."))) ?? [];
  if (values.length === 1) return values[0];
  if (values.length >= 2) return (values[0] + values[1]) / 2;
  return 0;
}

const CHANNELS = {
  domestic: { name: "Kinshasa Refinery SA", location: "Kinshasa, DRC", gd: false, turnaround: "10", fineness: "995" },
  export: { name: "Rand Refinery", location: "Germiston, South Africa", gd: true, turnaround: "21", fineness: "9999" },
} as const;

const fmt = (value: number, digits = 3) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (value: number) => `${Math.round(value).toLocaleString("en-US")} USD`;

export function RefiningOrderForm() {
  const router = useRouter();
  const { language } = useLanguage();
  const fr = language === "fr";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lot | null>(null);
  const [selectedRefinerId, setSelectedRefinerId] = useState("");
  const [channel, setChannel] = useState<keyof typeof CHANNELS>("domestic");
  const [fineness, setFineness] = useState("995");
  const [turnaround, setTurnaround] = useState("10");
  const [fee, setFee] = useState("14.50");
  const [feeUnit, setFeeUnit] = useState<"oz" | "g">("oz");
  const [loss, setLoss] = useState("0.50");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);
  const {
    data: purchaseOrders = [],
    isLoading: purchaseOrdersLoading,
    error: purchaseOrdersError,
  } = useSWR<PurchaseOrderSource[]>("/api/purchase-orders", fetcher);
  const {
    data: counterparties = [],
    isLoading: counterpartiesLoading,
    error: counterpartiesError,
  } = useSWR<RefinerSource[]>("/api/counterparties", fetcher);

  const approvedRefiners = useMemo(
    () =>
      counterparties.filter(
        (counterparty) =>
          counterparty.counterpartyType === "refinery" &&
          ["approved", "active"].includes(counterparty.status),
      ),
    [counterparties],
  );

  const lots = useMemo<Lot[]>(
    () =>
      purchaseOrders.map((order) => ({
        id: order.id,
        po: order.trackingId || `PO-${order.id.slice(0, 8).toUpperCase()}`,
        counterparty:
          order.counterpartyName ||
          (fr ? "Contrepartie inconnue" : "Unknown counterparty"),
        lot: order.lotReference || "—",
        delivered: order.deliveredAt
          ? new Date(order.deliveredAt).toLocaleDateString(fr ? "fr-FR" : "en-GB")
          : "—",
        gross:
          Number(order.receivedGrossWeightKg) ||
          Number(order.estimatedWeightKg) ||
          0,
        purity: purityPercent(order),
        type:
          GOLD_TYPE_LABELS[order.goldType || ""]?.[fr ? "fr" : "en"] ||
          order.goldType?.replace(/_/g, " ") ||
          "—",
        goldType: order.goldType,
        sourceRefinerId: order.sourceRefinerId,
        status: order.status,
      })),
    [fr, purchaseOrders],
  );

  const selectedRefiner = approvedRefiners.find((refiner) => refiner.id === selectedRefinerId) ?? null;
  const selectedRefinerIsGoodDelivery = selectedRefiner?.lbmaGoodDeliveryStatus === "accredited";
  const currentChannel = selectedRefiner
    ? {
        name: selectedRefiner.legalName,
        location: selectedRefiner.registeredAddress || selectedRefiner.countryOfIncorporation || "â€”",
        gd: selectedRefinerIsGoodDelivery,
      }
    : { name: "â€”", location: "â€”", gd: false };
  const fineKg = selected ? selected.gross * selected.purity / 100 : 0;
  const fineOz = fineKg * OZ_PER_KG;
  const lossKg = fineKg * (Number(loss) || 0) / 100;
  const outturnKg = fineKg - lossKg;
  const totalCharge = feeUnit === "oz" ? (Number(fee) || 0) * fineOz : (Number(fee) || 0) * fineKg * 1000;
  const reserveEligible = selectedRefinerIsGoodDelivery && ["995", "9999"].includes(fineness);
  const refinerLockedFromPO = selected?.goldType === "refined_bars" && Boolean(selected.sourceRefinerId);

  const filteredLots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lots.filter((lot) =>
      `${lot.po} ${lot.counterparty} ${lot.lot} ${lot.type} ${lot.status}`
        .toLowerCase()
        .includes(query),
    );
  }, [lots, search]);

  useEffect(() => {
    if (!selectedRefiner?.maxOutputFineness) return;
    const normalized = selectedRefiner.maxOutputFineness.replace(/[^\d]/g, "");
    if (normalized === "9999") setFineness("9999");
    if (normalized === "995") setFineness("995");
  }, [selectedRefiner?.maxOutputFineness]);

  const chooseChannel = (next: keyof typeof CHANNELS) => {
    setChannel(next);
    setTurnaround(CHANNELS[next].turnaround);
    setFineness(CHANNELS[next].fineness);
  };

  const selectLot = (lot: Lot) => {
    setSelected(lot);
    setSelectedRefinerId(lot.goldType === "refined_bars" && lot.sourceRefinerId ? lot.sourceRefinerId : "");
    setPickerOpen(false);
    setSaved(false);
    setSaveError("");
    setOrderId(null);
    setOrderReference(null);
    setOrderCreatedAt(null);
  };

  const saveDraft = async () => {
    if (!selected) {
      setPickerOpen(true);
      return null;
    }
    if (!selectedRefinerId) {
      setSaveError(fr ? "Sélectionnez une raffinerie avant d’enregistrer." : "Select a refinery before saving.");
      return null;
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/refining-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          purchaseOrderId: selected.id,
          refineryId: selectedRefinerId,
          targetFineness: fineness,
          turnaroundDays: Number(turnaround),
          fee: Number(fee),
          feeUnit,
          expectedLossPercent: Number(loss),
          inputGrossWeightKg: selected.gross,
          inputFineGoldKg: fineKg,
          expectedOutturnKg: outturnKg,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save refining order");
      setOrderId(String(result.id));
      setOrderReference(String(result.reference));
      setOrderCreatedAt(String(result.createdAt));
      setSaved(true);
      await mutate("/api/refining-orders");
      return result as { id: string; reference: string };
    } catch (error) {
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : (fr ? "Échec de l’enregistrement." : "Save failed."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const order = await saveDraft();
    if (order) router.push(`/refining-orders/${order.reference}/approval`);
  };

  const displayedReference = orderReference || (fr ? "Nouvel ordre" : "New order");
  const displayedDate = orderCreatedAt
    ? new Date(orderCreatedAt).toLocaleDateString(fr ? "fr-FR" : "en-GB")
    : new Date().toLocaleDateString(fr ? "fr-FR" : "en-GB");

  return (
    <div className="space-y-5">
      <Link href="/refining-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{fr ? "Retour aux ordres de raffinage" : "Back to refining orders"}</Link>

      <div className="flex gap-3 rounded-lg border border-l-4 border-l-primary bg-primary/5 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">{selected ? (fr ? `Ordre de raffinage en brouillon — lot ${selected.lot} sélectionné` : `Draft refining order — ${selected.lot} selected`) : (fr ? "Nouvel ordre de raffinage — sélectionnez un bon de commande" : "New refining order — select a purchase order to begin")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{selected ? (fr ? `Raffinage de ${fmt(selected.gross)} kg de doré provenant du PO ${selected.po}. Définissez les conditions puis soumettez au double contrôle.` : `Refining ${fmt(selected.gross)} kg doré from PO ${selected.po}. Set the terms, then submit for dual approval.`) : (fr ? "Choisissez un bon de commande du système, définissez les conditions et soumettez-le au double contrôle." : "Pick a purchase order from the system, set the refining terms, then submit it for dual approval.")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">{displayedReference}</h1><StatusPill tone="warning">{fr ? "Brouillon" : "Draft"}</StatusPill><StatusPill>{fr ? "Double approbation" : "Dual Approval"}</StatusPill>{saved && <StatusPill tone="success">{fr ? "Enregistré" : "Saved"}</StatusPill>}</div><p className="mt-1 text-xs text-muted-foreground">{fr ? `Créé le ${displayedDate}` : `Created ${displayedDate}`}{selected ? ` · PO ${selected.po} · Lot ${selected.lot}` : ` · ${fr ? "Aucun PO associé" : "No PO linked yet"}`}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />PDF</Button><Button variant="outline" onClick={saveDraft} disabled={saving}>{saving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer" : "Save Draft")}</Button><Button onClick={submit} disabled={saving}><Send className="mr-2 h-4 w-4" />{fr ? "Soumettre pour approbation" : "Submit for Approval"}</Button></div>
      </div>

      {saveError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}

      <WorkflowStepper active={0} hrefs={["/refining-orders", orderReference ? `/refining-orders/${orderReference}/approval` : undefined, orderReference ? `/refining-orders/${orderReference}/dispatch` : undefined, undefined, undefined, undefined, orderReference ? `/refining-orders/${orderReference}/reserve-eligibility` : undefined]} labels={fr ? ["Brouillon", "Approuvé", "Expédié", "En raffinage", "Outturn reçu", "Rapproché", "Classification"] : ["Draft", "Approved", "Dispatched", "In refining", "Outturn received", "Reconciled", "Classification"]} />

      <Tabs defaultValue="details">
        <TabsList><TabsTrigger value="details">{fr ? "Détails" : "Details"}</TabsTrigger><TabsTrigger value="trace">{fr ? "Traçabilité" : "Traceability"}</TabsTrigger></TabsList>
        <TabsContent value="details" className="mt-4 space-y-4">
          <RefiningPanel icon={FileText} title={<>{fr ? "Bon de commande et lot source" : "Source purchase order & lot"} <span className="text-destructive">*</span></>}>
            {!selected ? (
              <div className="flex flex-col gap-4 rounded-lg border border-dashed bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{fr ? "Aucun bon de commande sélectionné" : "No purchase order selected"}</p><p className="mt-1 text-xs text-muted-foreground">{fr ? "Choisissez un bon de commande parmi tous ceux enregistrés dans le système." : "Choose from all purchase orders registered in the system."}</p></div><Button onClick={() => setPickerOpen(true)}><Search className="mr-2 h-4 w-4" />{fr ? "Sélectionner PO / lot" : "Select PO / lot"}</Button></div>
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 lg:flex-row lg:items-center"><div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><InfoCell label={fr ? "Bon de commande" : "Purchase order"}><span className="text-primary">{selected.po}</span></InfoCell><InfoCell label={fr ? "Contrepartie" : "Counterparty"}>{selected.counterparty}</InfoCell><InfoCell label={fr ? "Lot doré" : "Doré lot"}>{selected.lot}</InfoCell><InfoCell label={fr ? "Or fin disponible" : "Fine gold available"}>{fmt(fineKg)} kg · {fmt(fineOz, 2)} oz</InfoCell></div><Button variant="outline" onClick={() => setPickerOpen(true)}>{fr ? "Changer" : "Change"}</Button></div>
            )}
          </RefiningPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <RefiningPanel icon={FileText} title={fr ? "Référence interne" : "Internal reference"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "N° ordre de raffinage" : "Refining Order No."}>{displayedReference}</InfoCell><InfoCell label={fr ? "Créé" : "Created"}>{displayedDate}</InfoCell><InfoCell label={fr ? "Bureau initiateur" : "Initiating desk"}>Bullion Desk · Trade Manager</InfoCell><InfoCell label={fr ? "Statut" : "Status"}><StatusPill tone="warning">{fr ? "Brouillon" : "Draft"}</StatusPill></InfoCell><InfoCell label="Source PO"><span className={selected ? "text-primary" : "text-muted-foreground"}>{selected?.po || (fr ? "— non sélectionné —" : "— not selected —")}</span></InfoCell><InfoCell label={fr ? "Lot doré" : "Doré lot"}>{selected?.lot || "—"}</InfoCell></div></RefiningPanel>
            <RefiningPanel icon={Factory} title={<span className="flex flex-wrap items-center gap-2">{fr ? "Raffinerie affectée" : "Assigned refiner"}<span className="text-destructive" aria-hidden="true">*</span>{selectedRefiner && <StatusPill tone="success">KYC valid</StatusPill>}{refinerLockedFromPO && <StatusPill>{fr ? "Préremplie depuis le BC" : "Pre-filled from PO"}</StatusPill>}</span>}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={fr ? "Raffinerie" : "Refiner"}>
                  <Select value={selectedRefinerId} onValueChange={setSelectedRefinerId} disabled={refinerLockedFromPO}>
                    <SelectTrigger>
                      <SelectValue placeholder={fr ? "Choisir une raffinerie..." : "Choose a refiner..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedRefiners.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          {fr ? "Aucune raffinerie approuvée" : "No approved refinery"}
                        </div>
                      ) : (
                        approvedRefiners.map((refiner) => (
                          <SelectItem key={refiner.id} value={refiner.id}>
                            {refiner.legalName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <InfoCell label="LBMA Good Delivery">{!selectedRefiner ? <StatusPill>{fr ? "À choisir" : "To select"}</StatusPill> : currentChannel.gd ? <StatusPill tone="success">LBMA GD accredited</StatusPill> : <StatusPill tone="warning">{fr ? "Demande en cours" : "Application in progress"}</StatusPill>}</InfoCell>
                <InfoCell label={fr ? "Localisation" : "Location"}>{selectedRefiner ? currentChannel.location : "-"}</InfoCell>
                <InfoCell label={fr ? "Titre maximal" : "Maximum fineness"}>{selectedRefiner?.maxOutputFineness ? `${selectedRefiner.maxOutputFineness} ‰` : "-"}</InfoCell>
              </div>
              {refinerLockedFromPO && <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">{fr ? "BC de lingots : la raffinerie source encodée dans le système est reprise automatiquement." : "Refined-bars PO: the source refiner encoded in the system is filled automatically."}</p>}
              {!refinerLockedFromPO && <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">{fr ? "Choisissez la raffinerie approuvée pour cet ordre. Son accréditation détermine si la production peut entrer dans les réserves monétaires." : "Choose the approved refiner for this order. Its accreditation determines whether output can enter monetary reserves."}</p>}
              {counterpartiesLoading && <p className="mt-2 text-xs text-muted-foreground">{fr ? "Chargement des raffineries..." : "Loading refiners..."}</p>}
              {counterpartiesError && <p className="mt-2 text-xs text-destructive">{fr ? "Impossible de charger les raffineries." : "Unable to load refiners."}</p>}
            </RefiningPanel>
          </div>

          <RefiningPanel icon={Box} title={<span className="flex flex-wrap items-center gap-2">{fr ? "Or entrant" : "Input gold"} — {selected ? selected.lot : (fr ? "aucun lot" : "no lot selected")}<StatusPill>{fr ? "depuis le PO" : "from PO"}</StatusPill></span>}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><InfoCell label={fr ? "Type d’or" : "Gold type"}>{selected?.type || "—"}</InfoCell><InfoCell label={fr ? "Poids brut" : "Gross weight"}>{selected ? `${fmt(selected.gross)} kg` : "—"}</InfoCell><InfoCell label={fr ? "Essai / pureté" : "Assay / purity"}>{selected ? `${selected.purity.toFixed(2)} %` : "—"}</InfoCell><InfoCell label={fr ? "Teneur en or fin" : "Fine gold content"}>{selected ? `${fmt(fineKg)} kg · ${fmt(fineOz, 2)} oz` : "—"}</InfoCell></div></RefiningPanel>

          <RefiningPanel icon={Clock3} title={fr ? "Conditions de raffinage" : "Refining terms"}>
            <Field label={<>{fr ? "Raffinerie affectée" : "Assigned refiner"} <span className="text-destructive" aria-hidden="true">*</span></>}>
              <Select value={selectedRefinerId} onValueChange={setSelectedRefinerId} disabled={refinerLockedFromPO}>
                <SelectTrigger>
                  <SelectValue placeholder={fr ? "Choisir une raffinerie..." : "Choose a refiner..."} />
                </SelectTrigger>
                <SelectContent>
                  {approvedRefiners.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      {fr ? "Aucune raffinerie approuvee" : "No approved refinery"}
                    </div>
                  ) : (
                    approvedRefiners.map((refiner) => (
                      <SelectItem key={refiner.id} value={refiner.id}>
                        {refiner.legalName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {refinerLockedFromPO && (
                <p className="text-xs text-muted-foreground">
                  {fr
                    ? "BC de lingots: la raffinerie source encodee dans le systeme est reprise automatiquement."
                    : "Refined-bars PO: the source refiner encoded in the system is filled automatically."}
                </p>
              )}
              {counterpartiesLoading && <p className="text-xs text-muted-foreground">{fr ? "Chargement des raffineries..." : "Loading refiners..."}</p>}
              {counterpartiesError && <p className="text-xs text-destructive">{fr ? "Impossible de charger les raffineries." : "Unable to load refiners."}</p>}
            </Field>
            <Label>{fr ? "Canal de raffinage" : "Refining channel"} <span className="text-destructive">*</span></Label>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <ChannelCard selected={channel === "domestic"} title={fr ? "Raffinage à façon national" : "Domestic toll refining"} description={fr ? "Kinshasa Refinery SA · pas encore GD · délai plus court" : "Kinshasa Refinery SA · not yet GD-accredited · faster turnaround"} onClick={() => chooseChannel("domestic")} />
              <ChannelCard selected={channel === "export"} title={fr ? "Export vers une raffinerie accréditée" : "Export to accredited refiner"} description={fr ? "Rand Refinery, Afrique du Sud · LBMA GD · logistique et assurance" : "Rand Refinery, South Africa · LBMA GD accredited · logistics + insurance"} onClick={() => chooseChannel("export")} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label={fr ? "Base de rendement" : "Yield basis"}><Select defaultValue="assayed"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assayed">{fr ? "Outturn sur teneur en or fin analysée" : "Outturn on assayed fine content"}</SelectItem><SelectItem value="fixed">{fr ? "Retour fixe (%)" : "Fixed return %"}</SelectItem></SelectContent></Select></Field>
              <Field label={fr ? "Titre cible" : "Target output fineness"}><Select value={fineness} onValueChange={setFineness}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="995">995.0 ‰</SelectItem><SelectItem value="9999">999.9 ‰</SelectItem></SelectContent></Select></Field>
              <Field label={fr ? "Délai (jours ouvrés)" : "Turnaround (business days)"}><Input type="number" value={turnaround} onChange={(event) => setTurnaround(event.target.value)} /></Field>
              <Field label={fr ? "Frais de raffinage" : "Refining fee"}><div className="flex gap-2"><Input type="number" step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} /><Select value={feeUnit} onValueChange={(value) => setFeeUnit(value as "oz" | "g")}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oz">USD / fine oz</SelectItem><SelectItem value="g">USD / fine g</SelectItem></SelectContent></Select></div></Field>
              <Field label={fr ? "Perte attendue (%)" : "Expected refining loss (%)"}><Input type="number" step="0.01" value={loss} onChange={(event) => setLoss(event.target.value)} /><p className="text-xs text-muted-foreground"></p></Field>
              <Field label={fr ? "Or fin attendu en sortie" : "Expected outturn fine gold"}><Input readOnly value={selected ? `${fmt(outturnKg)} kg` : ""} className="bg-muted/50" /></Field>
            </div>
          </RefiningPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <RefiningPanel icon={BarChart3} title={fr ? "Coût estimatif du raffinage" : "Estimated refining cost"}><div className="space-y-3 text-sm"><EstimateLine label={fr ? "Teneur en or fin" : "Fine gold content"} value={selected ? `${fmt(fineKg)} kg · ${fmt(fineOz, 2)} oz` : "—"} /><EstimateLine label={fr ? "Perte attendue" : "Expected loss"} value={selected ? `−${fmt(lossKg)} kg (${Number(loss).toFixed(2)}%)` : "—"} /><EstimateLine label={fr ? "Or fin attendu" : "Expected outturn fine gold"} value={selected ? `${fmt(outturnKg)} kg · ${fmt(outturnKg * OZ_PER_KG, 2)} oz` : "—"} /><EstimateLine label={fr ? "Base tarifaire" : "Refining fee basis"} value={selected ? `${Number(fee).toFixed(2)} USD/${feeUnit} × ${feeUnit === "oz" ? `${fmt(fineOz, 2)} oz` : `${Math.round(fineKg * 1000).toLocaleString()} g`}` : "—"} /><EstimateLine label={fr ? "Délai" : "Turnaround"} value={selected ? `${turnaround} ${fr ? "jours ouvrés" : "business days"}` : "—"} /><div className="flex justify-between border-t pt-3 font-semibold"><span>{fr ? "Total des frais" : "Total refining charge"}</span><span className="text-primary">{selected ? money(totalCharge) : "—"}</span></div></div></RefiningPanel>
            <RefiningPanel icon={ShieldCheck} title={fr ? "Aperçu de l’éligibilité aux réserves" : "Reserve eligibility preview"}><div className="rounded-lg border border-l-4 border-l-primary bg-muted/30 p-4 text-sm"><p className="text-muted-foreground">{fr ? "Selon la raffinerie et le titre cible, l’outturn sera classé comme :" : "Based on the assigned refiner and target fineness, the outturn will be classified as:"}</p><div className="my-3">{!selected ? <StatusPill>{fr ? "Sélectionnez d’abord un PO" : "Select a PO first"}</StatusPill> : reserveEligible ? <StatusPill tone="success">{fr ? "Or monétaire — éligible aux réserves" : "Monetary gold — reserve-eligible"}</StatusPill> : <StatusPill tone="warning">{fr ? "Or non monétaire" : "Non-monetary gold"}</StatusPill>}</div><p className="border-t pt-3 text-xs text-muted-foreground">{!selected ? (fr ? "Choisissez le lot source pour évaluer l’outturn." : "Pick a source lot to evaluate the outturn.") : reserveEligible ? (fr ? "La raffinerie est LBMA Good Delivery et le titre cible est ≥ 995 ‰. Après rapprochement, les lingots pourront être alloués aux réserves." : "The refiner is LBMA Good Delivery accredited and target fineness is ≥ 995‰. After reconciliation, bars can be allocated to reserves.") : (fr ? "La raffinerie n’est pas GD : l’outturn restera non monétaire jusqu’à un nouveau raffinage ou une accréditation. Utilisez le canal export pour produire des lingots éligibles." : "The refiner is not GD-accredited, so outturn remains non-monetary pending re-refining or accreditation. Switch to export for reserve-eligible bullion.")}</p></div></RefiningPanel>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{fr ? "Les champs marqués d’un * sont obligatoires avant soumission." : "Fields marked with * are required before submission."}</p><div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => router.back()}>{fr ? "Annuler" : "Cancel"}</Button><Button variant="outline" onClick={saveDraft} disabled={saving}>{saving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer" : "Save Draft")}</Button><Button onClick={submit} disabled={saving}><Send className="mr-2 h-4 w-4" />{fr ? "Soumettre" : "Submit for Approval"}</Button></div></div>
        </TabsContent>
        <TabsContent value="trace" className="mt-4"><RefiningPanel icon={Box} title={fr ? "Chaîne de garde et de provenance" : "Custody & provenance chain"}><Timeline items={[
          { state: "done", title: "Purchase order accepted — GAC-TRK-MRUYZ7EK", meta: "21/07/2026 · Wolo · 50.000 kg doré, 88.50% assay" },
          { state: "done", title: "Vault intake — DORE-2026-0421", meta: "BCC Vault Kinshasa · fine gold 44.250 kg" },
          { state: "current", title: `Refining order created — ${displayedReference}`, meta: fr ? "En attente d’approbation et d’expédition" : "Awaiting approval & dispatch" },
          { state: "pending", title: fr ? "Expédition vers la raffinerie" : "Dispatch to refiner", meta: "Pending — seals, weights & transport docs" },
          { state: "pending", title: "Outturn & reconciliation", meta: "Pending — refined bars vs fine gold in" },
          { state: "pending", title: fr ? "Éligibilité et allocation aux réserves" : "Reserve eligibility & allocation", meta: fr ? "En attente de classification" : "Pending classification" },
        ]} /></RefiningPanel></TabsContent>
      </Tabs>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-[96vw] sm:max-w-[96vw] xl:max-w-[1500px]">
          <DialogHeader>
            <DialogTitle>{fr ? "Sélectionner un bon de commande à raffiner" : "Select a purchase order to refine"}</DialogTitle>
            <DialogDescription>
              {fr
                ? "Tous les bons de commande enregistrés dans le système."
                : "All purchase orders registered in the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={fr ? "Rechercher par PO, contrepartie, lot ou type d'or…" : "Search by PO, counterparty, lot or gold type…"}
            />
          </div>
          <div className="max-h-[65vh] overflow-y-auto rounded-lg border">
            <table className="w-full table-fixed text-xs 2xl:text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  {["PO", fr ? "Contrepartie" : "Counterparty", fr ? "Type d'or" : "Gold type", "Lot", fr ? "Livré" : "Delivered", fr ? "Brut" : "Gross", fr ? "Pureté" : "Purity", fr ? "Or fin" : "Fine gold", fr ? "Statut" : "Status", ""].map((heading) => (
                    <th key={heading} className="px-2 py-3 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLots.map((lot) => {
                  const fine = lot.gross * lot.purity / 100;
                  const statusLabel = STATUS_LABELS[lot.status]?.[fr ? "fr" : "en"] || lot.status.replace(/_/g, " ");
                  const statusTone = ["approved", "accepted", "manifest_validated", "delivered"].includes(lot.status) ? "success" : lot.status === "cancelled" || lot.status === "declined" ? "danger" : "warning";

                  return (
                    <tr key={lot.po} className="border-t hover:bg-muted/30">
                      <td className="break-words px-2 py-3 font-mono text-xs">{lot.po}</td>
                      <td className="break-words px-2 py-3">{lot.counterparty}</td>
                      <td className="break-words px-2 py-3">{lot.type}</td>
                      <td className="break-words px-2 py-3">{lot.lot}</td>
                      <td className="px-2 py-3">{lot.delivered}</td>
                      <td className="px-2 py-3">{fmt(lot.gross)} kg</td>
                      <td className="px-2 py-3">{lot.purity > 0 ? `${lot.purity.toFixed(2)}%` : "—"}</td>
                      <td className="px-2 py-3">{lot.purity > 0 ? `${fmt(fine)} kg` : "—"}</td>
                      <td className="px-2 py-3"><StatusPill tone={statusTone}>{statusLabel}</StatusPill></td>
                      <td className="px-2 py-3"><Button size="sm" variant="outline" onClick={() => selectLot(lot)}>{fr ? "Choisir" : "Select"}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {purchaseOrdersLoading && <p className="p-8 text-center text-sm text-muted-foreground">{fr ? "Chargement des bons de commande…" : "Loading purchase orders…"}</p>}
            {purchaseOrdersError && <p className="p-8 text-center text-sm text-destructive">{fr ? "Impossible de charger les bons de commande." : "Unable to load purchase orders."}</p>}
            {!purchaseOrdersLoading && !purchaseOrdersError && filteredLots.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{fr ? "Aucun bon de commande ne correspond à la recherche." : "No purchase order matches your search."}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelCard({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${selected ? "border-primary bg-primary/5" : "bg-muted/20"}`}><span className="flex items-center gap-2 text-sm font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-muted-foreground"}`}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span>{title}</span><span className="mt-1.5 block pl-6 text-xs text-muted-foreground">{description}</span></button>;
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function EstimateLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
