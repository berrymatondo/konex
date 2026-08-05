"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { CheckCircle2, FileUp, Plus, Send, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { InfoCell, RefiningPanel, StatusPill, WorkflowStepper } from "@/components/refining/refining-shared";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n/language-context";

interface Order { reference: string; status: string; purchaseOrderReference: string | null; lotReference: string | null; refineryName: string | null; targetFineness: string; inputGrossWeightKg: number; inputFineGoldKg: number; expectedOutturnKg: number; expectedLossPercent: number; }
interface Bar { serial: string; grossKg: string; fineness: string; }
interface Progress { receipt: { receivedWeightKg: number; receivedDate: string; sealsIntact: boolean } | null; outturn: { certificateNumber: string; outturnDate: string; certificateFileName: string | null; bars: Array<{ serial: string; grossKg: number; fineness: number }> } | null; status: string; }

const fetcher = async (url: string) => { const response = await fetch(url); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); return result; };

export default function RefiningInProgressPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { language } = useLanguage();
  const fr = language === "fr";
  const { data: order } = useSWR<Order>(id ? `/api/refining-orders/${encodeURIComponent(id)}` : null, fetcher);
  const { data: progress, mutate } = useSWR<Progress>(id ? `/api/refining-orders/${encodeURIComponent(id)}/outturn` : null, fetcher);
  const [receivedWeight, setReceivedWeight] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [sealsIntact, setSealsIntact] = useState(false);
  const [certificateNumber, setCertificateNumber] = useState("");
  const [outturnDate, setOutturnDate] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [bars, setBars] = useState<Bar[]>([{ serial: "", grossKg: "", fineness: "995" }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);

  const receiptDone = Boolean(progress?.receipt);
  const submitted = progress?.status === "submitted" || order?.status === "outturn_received";
  useEffect(() => { if (order && !receivedWeight) setReceivedWeight(order.inputGrossWeightKg.toFixed(3)); }, [order, receivedWeight]);
  useEffect(() => {
    if (!progress) return;
    if (progress.receipt) { setReceivedWeight(String(progress.receipt.receivedWeightKg)); setReceivedDate(progress.receipt.receivedDate); setSealsIntact(progress.receipt.sealsIntact); }
    if (progress.outturn) { setCertificateNumber(progress.outturn.certificateNumber || ""); setOutturnDate(progress.outturn.outturnDate || ""); setBars(progress.outturn.bars.length ? progress.outturn.bars.map((bar) => ({ serial: bar.serial, grossKg: String(bar.grossKg), fineness: String(bar.fineness) })) : [{ serial: "", grossKg: "", fineness: "995" }]); }
  }, [progress]);

  const totals = useMemo(() => bars.reduce((sum, bar) => { const gross = Number(bar.grossKg) || 0; const fine = gross * (Number(bar.fineness) || 0) / 1000; return { gross: sum.gross + gross, fine: sum.fine + fine }; }, { gross: 0, fine: 0 }), [bars]);
  const lossKg = (order?.inputFineGoldKg || 0) - totals.fine;
  const lossPct = order?.inputFineGoldKg ? lossKg / order.inputFineGoldKg * 100 : 0;
  const tolerance = order?.expectedLossPercent ?? 0.5;
  const withinTolerance = lossKg >= 0 && lossPct <= tolerance;

  const post = async (body: Record<string, unknown>) => {
    setSaving(true); setMessage(null);
    try { const response = await fetch(`/api/refining-orders/${encodeURIComponent(id)}/outturn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); await mutate(); setMessage({ text: fr ? "Informations enregistrées." : "Information saved." }); }
    catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Request failed" }); }
    finally { setSaving(false); }
  };
  const confirmReceipt = () => post({ action: "confirm_receipt", receivedWeightKg: Number(receivedWeight), receivedDate, sealsIntact });
  const saveOutturn = (submit: boolean) => post({ action: submit ? "submit_outturn" : "save_draft", certificateNumber, outturnDate, certificateFileName: certificateFile?.name || progress?.outturn?.certificateFileName || null, bars: bars.map((bar) => ({ serial: bar.serial, grossKg: Number(bar.grossKg), fineness: Number(bar.fineness) })) });
  const updateBar = (index: number, field: keyof Bar, value: string) => setBars((current) => current.map((bar, currentIndex) => currentIndex === index ? { ...bar, [field]: value } : bar));

  return <SidebarProvider><div className="flex h-screen"><AppSidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <AppHeader title={fr ? "Raffinage — réception et outturn" : "Refining — receipt and outturn"} subtitle={fr ? "Confirmer la réception puis déclarer les lingots produits" : "Confirm receipt, then report the bars produced"} />
    <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-5">
      <Link href="/refining-orders" className="text-sm text-muted-foreground hover:text-foreground">← {fr ? "Retour à mes ordres de raffinage" : "Back to my refining orders"}</Link>
      <div className={`rounded-lg border border-l-4 p-4 ${submitted ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-primary bg-primary/5"}`}><div className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 ${submitted ? "text-emerald-500" : "text-primary"}`} /><div><p className="font-semibold">{submitted ? (fr ? "Outturn transmis à la BCC" : "Outturn submitted to BCC") : receiptDone ? (fr ? "Réception confirmée — déclarez maintenant votre outturn" : "Receipt confirmed — now report your outturn") : (fr ? "Action requise — confirmez la réception du lot" : "Action required — confirm consignment receipt")}</p><p className="mt-1 text-xs text-muted-foreground">{fr ? `Ordre ${order?.reference || id} expédié vers ${order?.refineryName || "la raffinerie affectée"}.` : `Order ${order?.reference || id} dispatched to ${order?.refineryName || "the assigned refinery"}.`}</p></div></div></div>
      <div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">{order?.reference || id}</h1><StatusPill tone={submitted ? "success" : "warning"}>{submitted ? (fr ? "Soumis · vérification attendue" : "Submitted · awaiting verification") : (fr ? "Outturn attendu" : "Awaiting outturn")}</StatusPill></div>
      <WorkflowStepper active={submitted ? 4 : 3} hrefs={["/refining-orders", `/refining-orders/${id}/approval`, `/refining-orders/${id}/dispatch`, `/refining-orders/${id}/refining`, undefined, `/refining-orders/${id}/reserve-eligibility`]} labels={fr ? ["Brouillon", "Approuvé", "Expédition", "En raffinage", "Outturn reçu", "Classification"] : ["Draft", "Approved", "Dispatch", "In refining", "Outturn received", "Classification"]} />

      <RefiningPanel icon={CheckCircle2} title={fr ? "1 · Confirmer la réception du lot" : "1 · Confirm consignment receipt"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><InfoCell label={fr ? "Bordereau" : "Dispatch note"}>{order?.reference.replace("GAC-REF-", "GAC-DSP-") || "—"}</InfoCell><InfoCell label={fr ? "Poids brut déclaré" : "Declared gross"}>{order ? `${order.inputGrossWeightKg.toFixed(3)} kg` : "—"}</InfoCell><InfoCell label={fr ? "Teneur en or fin" : "Declared fine gold"}>{order ? `${order.inputFineGoldKg.toFixed(3)} kg` : "—"}</InfoCell><InfoCell label={fr ? "Scellés" : "Seals"}>{fr ? "Enregistrés au départ" : "Recorded at dispatch"}</InfoCell></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>{fr ? "Poids brut reçu (kg)" : "Gross weight received (kg)"} <span className="text-destructive">*</span></Label><Input type="number" step="0.001" value={receivedWeight} placeholder="50.000" required disabled={receiptDone} onChange={(event) => setReceivedWeight(event.target.value)} /></div><div className="space-y-2"><Label>{fr ? "Date de réception" : "Received date"} <span className="text-destructive">*</span></Label><Input type="date" value={receivedDate} required disabled={receiptDone} onChange={(event) => setReceivedDate(event.target.value)} /></div><label className="flex items-end gap-3 pb-2 text-sm"><Checkbox checked={sealsIntact} disabled={receiptDone} onCheckedChange={(checked) => setSealsIntact(checked === true)} />{fr ? "Scellés intacts à l’arrivée" : "Seals intact on arrival"} <span className="text-destructive">*</span></label></div>
        {!receiptDone && <Button className="mt-5" disabled={saving || !receivedWeight || !receivedDate || !sealsIntact} onClick={confirmReceipt}>{fr ? "Confirmer la réception" : "Confirm receipt"}</Button>}
      </RefiningPanel>

      <div className={!receiptDone ? "pointer-events-none opacity-50" : ""}><RefiningPanel icon={FileUp} title={fr ? "2 · Déclarer l’outturn" : "2 · Report your outturn"}>
        <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>{fr ? "N° du certificat d’outturn" : "Outturn certificate no."} <span className="text-destructive">*</span></Label><Input value={certificateNumber} placeholder="KRS-OTT-2026-0091" required disabled={submitted} onChange={(event) => setCertificateNumber(event.target.value)} /></div><div className="space-y-2"><Label>{fr ? "Date d’outturn" : "Outturn date"} <span className="text-destructive">*</span></Label><Input type="date" value={outturnDate} required disabled={submitted} onChange={(event) => setOutturnDate(event.target.value)} /></div><InfoCell label={fr ? "Titre cible convenu" : "Target fineness (agreed)"}>{order?.targetFineness || "995.0"} ‰</InfoCell></div>
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">#</th><th className="p-2">{fr ? "N° de barre" : "Bar serial"} <span className="text-destructive">*</span></th><th className="p-2">{fr ? "Brut (kg)" : "Gross (kg)"} <span className="text-destructive">*</span></th><th className="p-2">{fr ? "Titre (‰)" : "Fineness (‰)"} <span className="text-destructive">*</span></th><th className="p-2">{fr ? "Fin (kg)" : "Fine (kg)"}</th><th /></tr></thead><tbody>{bars.map((bar, index) => <tr key={index} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2"><Input value={bar.serial} placeholder={`KRS-2026-${1187 + index}`} required disabled={submitted} onChange={(event) => updateBar(index, "serial", event.target.value)} /></td><td className="p-2"><Input type="number" step="0.001" value={bar.grossKg} placeholder="15.000" required disabled={submitted} onChange={(event) => updateBar(index, "grossKg", event.target.value)} /></td><td className="p-2"><Input type="number" step="0.1" value={bar.fineness} placeholder="995.0" required disabled={submitted} onChange={(event) => updateBar(index, "fineness", event.target.value)} /></td><td className="p-2 font-medium tabular-nums">{((Number(bar.grossKg) || 0) * (Number(bar.fineness) || 0) / 1000).toFixed(3)}</td><td className="p-2"><Button size="icon" variant="ghost" disabled={submitted || bars.length === 1} onClick={() => setBars((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody><tfoot><tr className="font-semibold"><td /><td className="p-2">Total</td><td className="p-2">{totals.gross.toFixed(3)} kg</td><td /><td className="p-2 text-primary">{totals.fine.toFixed(3)} kg</td><td /></tr></tfoot></table></div>
        {!submitted && <Button variant="outline" size="sm" className="mt-3" onClick={() => setBars((current) => [...current, { serial: "", grossKg: "", fineness: order?.targetFineness || "995" }])}><Plus className="mr-2 h-4 w-4" />{fr ? "Ajouter une barre" : "Add bar"}</Button>}
        <div className="mt-6 space-y-2"><Label>{fr ? "Certificat d’analyse / d’outturn (PDF)" : "Assay / outturn certificate (PDF)"} <span className="text-destructive">*</span></Label><Input type="file" accept="application/pdf" required disabled={submitted} onChange={(event: ChangeEvent<HTMLInputElement>) => setCertificateFile(event.target.files?.[0] || null)} />{(certificateFile?.name || progress?.outturn?.certificateFileName) && <p className="text-xs text-emerald-500">✓ {certificateFile?.name || progress?.outturn?.certificateFileName}</p>}</div>
        <div className="mt-6 rounded-lg border bg-muted/30 p-4"><p className="mb-3 font-semibold">{fr ? "Contrôle de l’outturn par rapport aux conditions convenues" : "Your outturn vs agreed terms"}</p><div className="grid gap-2 text-sm sm:grid-cols-2"><span className="text-muted-foreground">{fr ? "Or fin entrant" : "Fine gold received"}</span><strong>{(order?.inputFineGoldKg || 0).toFixed(3)} kg</strong><span className="text-muted-foreground">{fr ? "Or fin produit" : "Fine gold out"}</span><strong>{totals.fine.toFixed(3)} kg</strong><span className="text-muted-foreground">{fr ? "Perte de raffinage" : "Refining loss"}</span><strong className={withinTolerance ? "text-emerald-500" : "text-amber-500"}>{lossKg >= 0 ? "−" : "+"}{Math.abs(lossKg).toFixed(3)} kg ({lossPct.toFixed(3)} %)</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${withinTolerance ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(Math.max(lossPct, 0) / Math.max(tolerance * 2, 0.01) * 100, 100)}%` }} /></div><p className={`mt-3 text-xs ${withinTolerance ? "text-emerald-500" : "text-amber-500"}`}>{totals.fine === 0 ? "" : lossKg < 0 ? (fr ? "L’or fin produit dépasse l’or fin reçu : vérifiez les valeurs." : "Fine out exceeds fine received: check the figures.") : withinTolerance ? (fr ? `Dans la tolérance convenue de ${tolerance.toFixed(2)} %.` : `Within the agreed ${tolerance.toFixed(2)}% tolerance.`) : (fr ? "Tolérance dépassée : la BCC examinera cette exception." : "Above tolerance: the BCC will review this exception.")}</p></div>
        {message && <p className={`mt-4 rounded-lg border p-3 text-sm ${message.error ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-500"}`}>{message.text}</p>}
        {!submitted && <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={saving} onClick={() => saveOutturn(false)}>{fr ? "Enregistrer le brouillon" : "Save draft"}</Button><Button disabled={saving || !certificateNumber || !outturnDate || !(certificateFile || progress?.outturn?.certificateFileName) || totals.fine <= 0} onClick={() => saveOutturn(true)}><Send className="mr-2 h-4 w-4" />{fr ? "Soumettre l’outturn à la BCC" : "Submit outturn to BCC"}</Button></div>}
      </RefiningPanel></div>
    </div></main>
  </div></div></SidebarProvider>;
}
