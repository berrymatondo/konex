"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BarChart3, Clock3, Download, Factory, PackageOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, OZ_PER_KG, RefiningPanel, StatusPill } from "./refining-shared";

const PRICE = 2351.2;
const TODAY = new Date("2026-08-05T00:00:00Z");

type HoldingStatus = "held" | "re-refining" | "awaiting-accreditation" | "remediated";

interface Holding {
  reference: string;
  order: string;
  lot: string;
  po: string;
  refiner: string;
  gdStatus: string;
  fineKg: number;
  reason: string;
  since: string;
  status: HoldingStatus;
  newOrder?: string;
}

const REASON_STYLES: Record<string, string> = {
  "Refiner not GD-accredited": "bg-amber-500",
  "Sub-995 fineness": "bg-destructive",
  "Sourcing verification pending": "bg-sky-500",
};

const format = (value: number, digits = 3) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (value: number) => `${Math.round(value).toLocaleString("en-US")} USD`;
const ageInDays = (since: string) => Math.round((TODAY.getTime() - new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000);

export function NonMonetaryHoldings() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedReference, setSelectedReference] = useState("");
  const { data: classifiedHoldings } = useSWR<Holding[]>("/api/non-monetary-holdings", async (url: string) => { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed"); return data; });

  useEffect(() => {
    if (!classifiedHoldings) return;
    setHoldings(classifiedHoldings);
    setSelectedReference(classifiedHoldings[0]?.reference || "");
  }, [classifiedHoldings]);

  const selected = holdings.find((holding) => holding.reference === selectedReference) ?? holdings[0] ?? { reference: "", order: "", lot: "", po: "", refiner: "", gdStatus: "", fineKg: 0, reason: "", since: "", status: "held" as const };
  const active = holdings.filter((holding) => holding.status !== "remediated");
  const totalFine = active.reduce((sum, holding) => sum + holding.fineKg, 0);
  const totalOz = totalFine * OZ_PER_KG;
  const inRemediation = active.filter((holding) => holding.status !== "held").length;
  const oldestAge = active.length ? Math.max(...active.map((holding) => ageInDays(holding.since))) : 0;

  const byReason = active.reduce<Record<string, number>>((totals, holding) => {
    totals[holding.reason] = (totals[holding.reason] ?? 0) + holding.fineKg;
    return totals;
  }, {});

  const updateSelected = (changes: Partial<Holding>) => {
    setHoldings((previous) => previous.map((holding) => holding.reference === selected.reference ? { ...holding, ...changes } : holding));
  };

  const exportLedger = () => {
    const header = "Holding,Source order,Refiner,Fine gold kg,Reason,Held since,Status";
    const rows = holdings.map((holding) => [holding.reference, holding.order, holding.refiner, holding.fineKg, holding.reason, holding.since, holding.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "non-monetary-gold-holdings.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-semibold">{fr ? "Sous-livre de détention non monétaire" : "Non-monetary holding sub-ledger"}</h1><p className="mt-1 text-xs text-muted-foreground">{fr ? "Or classé non monétaire à l’étape  · autres actifs en devises · suivi de la remédiation vers l’éligibilité aux réserves" : "Gold classified non-monetary at  · held as other foreign currency assets · tracked for remediation to reserve eligibility"}</p></div><Button variant="outline" size="sm" onClick={exportLedger}><Download className="mr-2 h-4 w-4" />{fr ? "Exporter le sous-livre" : "Export sub-ledger"}</Button></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={fr ? "Total d’or non monétaire" : "Total non-monetary gold"} value={`${format(totalFine)} kg`} sub={`${format(totalOz, 2)} oz fine`} />
        <KpiCard label={fr ? "Valeur indicative" : "Indicative value"} value={money(totalOz * PRICE)} sub="LBMA 2,351.20 USD/oz" />
        <KpiCard label={fr ? "Détentions" : "Holdings"} value={String(active.length)} sub={fr ? `${inRemediation} en remédiation · ${active.length - inRemediation} en attente` : `${inRemediation} in remediation · ${active.length - inRemediation} awaiting action`} />
        <KpiCard label={fr ? "Détention la plus ancienne" : "Oldest holding"} value={`${oldestAge} ${fr ? "jours" : "days"}`} sub={fr ? "durée en attente de remédiation" : "time held pending remediation"} />
      </div>

      <RefiningPanel icon={BarChart3} title={fr ? "Répartition par motif" : "Held by reason"}>
        <div className="flex h-4 overflow-hidden rounded-full bg-muted">{Object.entries(byReason).map(([reason, value]) => <span key={reason} className={REASON_STYLES[reason] ?? "bg-muted-foreground"} style={{ width: `${value / totalFine * 100}%` }} />)}</div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{Object.entries(byReason).map(([reason, value]) => <span key={reason} className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-sm ${REASON_STYLES[reason] ?? "bg-muted-foreground"}`} />{translateReason(reason, fr)} — {format(value)} kg</span>)}</div>
      </RefiningPanel>

      <Card className="overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{[fr ? "Détention" : "Holding", fr ? "Ordre source" : "Source order", fr ? "Raffinerie" : "Refiner", fr ? "Or fin" : "Fine gold", fr ? "Motif" : "Reason held", fr ? "Détenu depuis" : "Held since", fr ? "Âge" : "Age", fr ? "Statut" : "Status"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{holdings.map((holding) => { const selectedRow = holding.reference === selected.reference; const age = ageInDays(holding.since); return <tr key={holding.reference} onClick={() => setSelectedReference(holding.reference)} className={`cursor-pointer border-t transition-colors hover:bg-muted/40 ${selectedRow ? "bg-primary/5" : ""}`}><td className="px-4 py-3 font-mono text-xs">{holding.reference}</td><td className="px-4 py-3 text-primary">{holding.order}</td><td className="px-4 py-3">{holding.refiner}</td><td className="px-4 py-3 font-medium">{format(holding.fineKg)} kg</td><td className="px-4 py-3">{translateReason(holding.reason, fr)}</td><td className="px-4 py-3">{holding.since}</td><td className={`px-4 py-3 ${age > 45 ? "font-semibold text-destructive" : ""}`}>{age} d</td><td className="px-4 py-3"><HoldingStatusPill holding={holding} fr={fr} /></td></tr>; })}</tbody></table></div></CardContent></Card>

      {holdings.length > 0 ? <RefiningPanel icon={PackageOpen} title={<span className="flex w-full flex-wrap items-center gap-2">{fr ? `Détention ${selected.reference}` : `Holding ${selected.reference}`}<span className="ml-auto"><StatusPill tone="warning">{fr ? "Non monétaire · autres actifs en devises" : "Non-monetary · other FX assets"}</StatusPill></span></span>}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div><div className="grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "Référence de détention" : "Holding reference"}>{selected.reference}</InfoCell><InfoCell label={fr ? "Or fin détenu" : "Fine gold held"}>{format(selected.fineKg)} kg · {format(selected.fineKg * OZ_PER_KG, 2)} oz</InfoCell><InfoCell label={fr ? "Ordre de raffinage source" : "Source refining order"}><Link href="/refining-orders" className="text-primary hover:underline">{selected.order}</Link></InfoCell><InfoCell label={fr ? "Lot doré / PO" : "Doré lot / PO"}>{selected.lot} · {selected.po}</InfoCell><InfoCell label={fr ? "Raffinerie" : "Refiner"}>{selected.refiner}</InfoCell><InfoCell label={fr ? "Statut GD de la raffinerie" : "Refiner GD status"}><StatusPill tone="warning">{translateGd(selected.gdStatus, fr)}</StatusPill></InfoCell><InfoCell className="sm:col-span-2" label={fr ? "Motif de détention" : "Reason held"}>{translateReason(selected.reason, fr)}</InfoCell><InfoCell label={fr ? "Détenu depuis" : "Held since"}>{selected.since} · {ageInDays(selected.since)} {fr ? "jours" : "days"}</InfoCell><InfoCell label={fr ? "Valeur indicative" : "Indicative value"}>{money(selected.fineKg * OZ_PER_KG * PRICE)}</InfoCell></div><div className="mt-5 rounded-lg border border-l-4 border-l-primary bg-muted/30 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">{fr ? "Traitement BPM6." : "BPM6 treatment."}</strong> {fr ? "Enregistré parmi les autres actifs en devises (IRFCL section I.B), hors réserves monétaires. Le lot ne redevient éligible à  qu’après correction du critère défaillant." : "Recorded under other foreign currency assets (IRFCL Section I.B), not monetary reserves. It re-enters  only after remediation clears the failing gate."}</div></div>
          <Remediation holding={selected} fr={fr} onReRefine={() => updateSelected({ status: "re-refining", newOrder: "GAC-REF-2026-017" })} onWatch={() => updateSelected({ status: "awaiting-accreditation" })} onReEvaluate={() => updateSelected({ status: "remediated" })} />
        </div>
      </RefiningPanel> : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{fr ? "Aucune détention d’or non monétaire enregistrée." : "No non-monetary gold holding recorded."}</div>}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{sub}</p></CardContent></Card>;
}

function HoldingStatusPill({ holding, fr }: { holding: Holding; fr: boolean }) {
  if (holding.status === "re-refining") return <StatusPill tone="info">{fr ? "Nouveau raffinage" : "Re-refining"} · {holding.newOrder}</StatusPill>;
  if (holding.status === "awaiting-accreditation") return <StatusPill tone="info">{fr ? "Accréditation attendue" : "Awaiting accreditation"}</StatusPill>;
  if (holding.status === "remediated") return <StatusPill tone="success">{fr ? "Réévaluation " : "Re-evaluating "}</StatusPill>;
  return <StatusPill tone="warning">{fr ? "Détenu · sans action" : "Held · no action"}</StatusPill>;
}

function Remediation({ holding, fr, onReRefine, onWatch, onReEvaluate }: { holding: Holding; fr: boolean; onReRefine: () => void; onWatch: () => void; onReEvaluate: () => void }) {
  return <div><p className="mb-3 text-sm font-semibold">{fr ? "Remédiation" : "Remediation"}</p>{holding.status === "held" && <div className="space-y-3"><div className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4 text-violet-500" />{fr ? "Raffiner via une raffinerie accréditée" : "Re-refine via accredited refiner"}</div><p className="my-3 text-xs leading-5 text-muted-foreground">{fr ? "Créer un nouvel ordre vers une raffinerie LBMA Good Delivery, par exemple Rand Refinery. L’outturn conforme reviendra à l’évaluation d’éligibilité." : "Create a new refining order routed to an LBMA Good Delivery refiner. Accepted GD-standard outturn re-enters reserve eligibility."}</p><Button size="sm" onClick={onReRefine}>{fr ? "Créer l’ordre de nouveau raffinage" : "Create re-refining order"}</Button></div><div className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-sky-500" />{fr ? "Attendre l’accréditation" : "Await refiner accreditation"}</div><p className="my-3 text-xs leading-5 text-muted-foreground">{fr ? "Surveiller le statut LBMA GD de la raffinerie. Une accréditation déclenche une nouvelle évaluation d’éligibilité." : "Watch the refiner’s LBMA GD status. Accreditation flags the holding for eligibility re-evaluation."}</p><Button size="sm" variant="outline" onClick={onWatch}>{fr ? "Ajouter à la surveillance" : "Add to accreditation watch"}</Button></div>{holding.reason === "Sourcing verification pending" && <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{fr ? "Ce lot échoue sur l’approvisionnement : compléter la vérification OCDE / approvisionnement responsable avant réévaluation de l’éligibilité." : "This holding fails sourcing: complete OECD / responsible-sourcing verification before eligibility re-evaluation."}</div>}</div>}
    {holding.status === "re-refining" && <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">{fr ? "Nouveau raffinage en cours." : "Re-refining in progress."}</strong> {fr ? `L’ordre ${holding.newOrder} a été créé vers une raffinerie accréditée. La détention reste ici jusqu’à acceptation et reclassification.` : `Order ${holding.newOrder} was created for an accredited refiner. The holding remains until accepted and reclassified.`}<Button asChild size="sm" variant="outline" className="mt-3"><Link href="/refining-orders">{fr ? `Ouvrir ${holding.newOrder}` : `Open ${holding.newOrder}`}</Link></Button></div>}
    {holding.status === "awaiting-accreditation" && <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">{fr ? "Accréditation attendue." : "Awaiting accreditation."}</strong> {fr ? `Surveillance active du statut LBMA Good Delivery de ${holding.refiner}.` : `Active watch on ${holding.refiner}’s LBMA Good Delivery status.`}<Button size="sm" className="mt-3" onClick={onReEvaluate}><RefreshCw className="mr-2 h-4 w-4" />{fr ? "Raffinerie accréditée → réévaluer" : "Refiner accredited → re-evaluate"}</Button></div>}
    {holding.status === "remediated" && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-muted-foreground"><strong className="text-foreground">{fr ? "Transmis pour réévaluation." : "Sent for re-evaluation."}</strong> {fr ? "Le lot retourne à l’évaluation d’éligibilité aux réserves." : "The holding is routed back to reserve eligibility."}</div>}
  </div>;
}

function translateReason(reason: string, fr: boolean) {
  if (!fr) return reason;
  return ({ "Refiner not GD-accredited": "Raffinerie non accréditée GD", "Sub-995 fineness": "Titre inférieur à 995 ‰", "Sourcing verification pending": "Vérification d’approvisionnement en attente" } as Record<string, string>)[reason] ?? reason;
}

function translateGd(status: string, fr: boolean) {
  if (!fr) return status;
  return status === "Not accredited" ? "Non accréditée" : status === "Application in progress" ? "Demande en cours" : status;
}
