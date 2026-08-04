"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Box,
  Building2,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Plus,
  Printer,
  Save,
  Shield,
  Truck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, OZ_PER_KG, RefiningPanel, StatusPill, Timeline, WorkflowStepper } from "./refining-shared";

interface DispatchOrderDetail {
  reference: string;
  status: string;
  purchaseOrderReference: string | null;
  lotReference: string | null;
  counterpartyName: string | null;
  refineryName: string | null;
  lbmaGoodDeliveryStatus: string | null;
  inputGrossWeightKg: number;
  inputFineGoldKg: number;
  expectedOutturnKg: number;
  goldPricePerOz: number;
  approvals: Array<{ decision: string }>;
}

type DocumentKey = "manifest" | "sealCertificate" | "insuranceCertificate";

export function RefiningOrderDispatch() {
  const params = useParams<{ id: string }>();
  const { language } = useLanguage();
  const fr = language === "fr";
  const orderReference = typeof params.id === "string" ? params.id : "";
  const { data: order, error: orderError, isLoading: orderLoading } = useSWR<DispatchOrderDetail>(
    orderReference ? `/api/refining-orders/${encodeURIComponent(orderReference)}` : null,
    (url: string) => fetch(url).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load refining order");
      return result;
    }),
  );
  const [pieces, setPieces] = useState("42");
  const [dispatchWeight, setDispatchWeight] = useState("");
  const [packaging, setPackaging] = useState("case");
  const [scaleReference, setScaleReference] = useState("SCALE-KIN-VLT-02");
  const [seals, setSeals] = useState(["SEAL-KIN-88213", "SEAL-KIN-88214", "SEAL-KIN-88215"]);
  const [carrier, setCarrier] = useState("G4S Secure Transport");
  const [vehicle, setVehicle] = useState("CONVOY-2026-0714");
  const [transportMode, setTransportMode] = useState("armoured");
  const [dispatchAt, setDispatchAt] = useState("2026-07-23T09:15");
  const [arrivalAt, setArrivalAt] = useState("2026-07-23T11:00");
  const [insurer, setInsurer] = useState("SONAS / Lloyd's syndicate");
  const [policyNumber, setPolicyNumber] = useState("POL-AU-2026-3391");
  const [coverage, setCoverage] = useState("all-risk");
  const [validThrough, setValidThrough] = useState("2026-08-31");
  const [documents, setDocuments] = useState<Record<DocumentKey, File | null>>({ manifest: null, sealCertificate: null, insuranceCertificate: null });
  const [dispatchingSigned, setDispatchingSigned] = useState(false);
  const [witnessSigned, setWitnessSigned] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (order && !dispatchWeight) setDispatchWeight(order.inputGrossWeightKg.toFixed(3));
  }, [dispatchWeight, order]);

  const lotGross = order?.inputGrossWeightKg ?? 0;
  const fineKg = order?.inputFineGoldKg ?? 0;
  const purity = lotGross > 0 ? fineKg / lotGross * 100 : 0;
  const dispatchReference = order?.reference ? order.reference.replace("GAC-REF-", "GAC-DSP-") : "—";
  const variance = (Number(dispatchWeight) || 0) - lotGross;
  const weightMatches = Math.abs(variance) < 0.0005;
  const dualControlComplete = dispatchingSigned && witnessSigned;
  const orderApproved = order?.status === "approved";
  const canConfirm = dualControlComplete && !confirmed && orderApproved;
  const insuredValue = fineKg * OZ_PER_KG * (order?.goldPricePerOz ?? 0);

  const updateSeal = (index: number, value: string) => setSeals((previous) => previous.map((seal, current) => current === index ? value : seal));
  const upload = (key: DocumentKey, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDocuments((previous) => ({ ...previous, [key]: file }));
  };

  const confirmDispatch = () => {
    if (!canConfirm) return;
    setConfirmed(true);
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <Link href={`/refining-orders/${orderReference}/approval`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{fr ? `Retour à l’ordre de raffinage ${orderReference}` : `Back to refining order ${orderReference}`}</Link>

      {orderLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">{fr ? "Chargement de l’ordre…" : "Loading refining order…"}</div>}
      {orderError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{fr ? "Impossible de charger cet ordre." : "Unable to load this order."}</div>}
      {order && !orderApproved && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">{fr ? "Le quorum d’approbation n’est pas encore atteint. L’expédition reste verrouillée." : "The approval quorum has not been reached. Dispatch remains locked."}</div>}

      <div className={`flex gap-3 rounded-lg border border-l-4 p-4 ${confirmed ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-primary bg-primary/5"}`}>
        <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${confirmed ? "text-emerald-500" : "text-primary"}`} />
        <div><p className="text-sm font-semibold">{confirmed ? (fr ? "Expédition confirmée — garde ouverte avec la raffinerie" : "Dispatch confirmed — custody opened with the refiner") : (fr ? "Ordre de raffinage approuvé — prêt pour expédition" : "Refining order approved — ready for dispatch")}</p><p className="mt-1 text-xs text-muted-foreground">{confirmed ? (fr ? "Les scellés, le poids et la remise ont été enregistrés. La confirmation de réception par la raffinerie est maintenant attendue." : "Seals, weight and handover are recorded. Refiner receipt confirmation is now pending.") : (fr ? "Le double contrôle est terminé. Enregistrez les scellés, le poids, le transport et l’assurance, puis confirmez l’expédition." : "Dual approval is complete. Record seals, verified weight, transport and insurance, then confirm dispatch.")}</p></div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">{dispatchReference}</h1><StatusPill tone={confirmed ? "success" : orderApproved ? "info" : "warning"}>{confirmed ? (fr ? "Expédié" : "Dispatched") : orderApproved ? (fr ? "Approuvé · prêt à expédier" : "Approved · ready to dispatch") : (fr ? "Approbations en attente" : "Pending approvals")}</StatusPill><StatusPill>{fr ? "Double contrôle" : "Dual control"}</StatusPill>{saved && <StatusPill tone="success">{fr ? "Enregistré" : "Saved"}</StatusPill>}</div><p className="mt-1 text-xs text-muted-foreground">{order?.reference || orderReference}{order?.purchaseOrderReference ? ` · PO ${order.purchaseOrderReference}` : ""}{order?.lotReference ? ` · Lot ${order.lotReference}` : ""}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{fr ? "Bordereau PDF" : "Print dispatch note"}</Button><Button variant="outline" onClick={() => setSaved(true)} disabled={confirmed}><Save className="mr-2 h-4 w-4" />{fr ? "Enregistrer" : "Save Draft"}</Button><Button onClick={confirmDispatch} disabled={!canConfirm}><Truck className="mr-2 h-4 w-4" />{fr ? "Confirmer l’expédition" : "Confirm dispatch"}</Button></div>
      </div>

      <WorkflowStepper active={confirmed ? 3 : 2} hrefs={["/refining-orders", `/refining-orders/${orderReference}/approval`, `/refining-orders/${orderReference}/dispatch`, undefined, undefined, undefined, `/refining-orders/${orderReference}/reserve-eligibility`]} labels={fr ? ["Brouillon", "Approuvé", "Expédition", "En raffinage", "Outturn reçu", "Rapproché", "Classification"] : ["Draft", "Approved", "Dispatch", "In refining", "Outturn received", "Reconciled", "Classification"]} />

      <Tabs defaultValue="details">
        <TabsList><TabsTrigger value="details">{fr ? "Détails d’expédition" : "Dispatch details"}</TabsTrigger><TabsTrigger value="trace">{fr ? "Traçabilité" : "Traceability"}</TabsTrigger></TabsList>
        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <RefiningPanel icon={Box} title={fr ? "Départ — coffre" : "From — vault"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell className="sm:col-span-2" label={fr ? "Coffre d’origine" : "Origin vault"}>BCC Vault – Kinshasa</InfoCell><InfoCell label={fr ? "Libéré par" : "Released by"}>Vault & Assay Officer</InfoCell><InfoCell label={fr ? "Bordereau" : "Dispatch note"}>{dispatchReference}</InfoCell></div></RefiningPanel>
            <RefiningPanel icon={Building2} title={<span className="flex items-center gap-2">{fr ? "Destination — raffinerie" : "To — refiner"}<StatusPill tone="success">KYC valid</StatusPill></span>}><div className="grid gap-4 sm:grid-cols-2"><InfoCell className="sm:col-span-2" label={fr ? "Raffinerie affectée" : "Assigned refiner"}>{order?.refineryName || "—"}</InfoCell><InfoCell label={fr ? "Canal" : "Channel"}>{order?.lbmaGoodDeliveryStatus === "accredited" ? (fr ? "Export vers une raffinerie accréditée" : "Export to an accredited refinery") : (fr ? "Export vers une raffinerie non accréditée" : "Export to a non-accredited refinery")}</InfoCell><InfoCell label="LBMA Good Delivery"><StatusPill tone={order?.lbmaGoodDeliveryStatus === "accredited" ? "success" : "warning"}>{order?.lbmaGoodDeliveryStatus === "accredited" ? (fr ? "Accréditée" : "Accredited") : (fr ? "Non accréditée" : "Not accredited")}</StatusPill></InfoCell></div></RefiningPanel>
          </div>

          <RefiningPanel icon={FileText} title={fr ? "Contenu de l’envoi et contrôle du poids" : "Consignment contents & weight verification"}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><InfoCell label={fr ? "Type d’or" : "Gold type"}>Doré bars</InfoCell><Field label={fr ? "Nombre de pièces" : "Number of pieces"} required><Input type="number" value={pieces} disabled={confirmed} onChange={(event) => setPieces(event.target.value)} /></Field><InfoCell label={fr ? "Poids brut du lot" : "Lot record — gross"}>{order ? `${lotGross.toFixed(3)} kg` : "—"}</InfoCell><Field label={fr ? "Poids brut vérifié à l’expédition (kg)" : "Verified gross weight at dispatch (kg)"} required><Input type="number" step="0.001" value={dispatchWeight} disabled={confirmed} onChange={(event) => setDispatchWeight(event.target.value)} /></Field><InfoCell label={fr ? "Essai / pureté" : "Assay / purity"}>{order ? `${purity.toFixed(2)} %` : "—"}</InfoCell><InfoCell label={fr ? "Teneur en or fin" : "Fine gold content"}>{order ? `${fineKg.toFixed(3)} kg · ${(fineKg * OZ_PER_KG).toLocaleString("en-US", { maximumFractionDigits: 2 })} oz` : "—"}</InfoCell></div>
            <div className={`mt-4 rounded-lg border p-3 text-xs ${weightMatches ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>{weightMatches ? (fr ? `✓ Correspond au registre du lot (${lotGross.toFixed(3)} kg)` : `✓ Matches lot record (${lotGross.toFixed(3)} kg)`) : `${fr ? "⚠ Écart" : "⚠ Variance"} ${variance > 0 ? "+" : ""}${variance.toFixed(3)} kg — ${fr ? "ouvrir une exception de garde avant expédition" : "raise a custody exception before dispatch"}`}</div>
          </RefiningPanel>

          <RefiningPanel icon={LockKeyhole} title={fr ? "Sécurité et scellés inviolables" : "Security & tamper-evident seals"}>
            <div className="mb-4 grid gap-4 md:grid-cols-2"><Field label={fr ? "Type d’emballage" : "Packaging type"}><Select value={packaging} disabled={confirmed} onValueChange={setPackaging}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="case">{fr ? "Caisse de sécurité scellée" : "Sealed security case"}</SelectItem><SelectItem value="pouch">{fr ? "Pochette inviolable" : "Tamper-evident pouch"}</SelectItem><SelectItem value="pallet">{fr ? "Palette cerclée" : "Strapped pallet"}</SelectItem></SelectContent></Select></Field><Field label={fr ? "Référence balance" : "Weighbridge / scale reference"}><Input value={scaleReference} disabled={confirmed} onChange={(event) => setScaleReference(event.target.value)} /></Field></div>
            <Label>{fr ? "Numéros de scellés" : "Seal numbers"} <span className="text-destructive">*</span></Label>
            <div className="mt-2 space-y-2">{seals.map((seal, index) => <div key={index} className="flex gap-2"><Input value={seal} disabled={confirmed} onChange={(event) => updateSeal(index, event.target.value)} placeholder={fr ? "Numéro du scellé" : "Seal number"} /><Button type="button" size="icon" variant="ghost" disabled={confirmed || seals.length === 1} onClick={() => setSeals((previous) => previous.filter((_, current) => current !== index))}><X className="h-4 w-4" /></Button></div>)}</div>
            <Button type="button" variant="ghost" size="sm" disabled={confirmed} onClick={() => setSeals((previous) => [...previous, ""])} className="mt-2 text-primary"><Plus className="mr-2 h-4 w-4" />{fr ? "Ajouter un scellé" : "Add seal"}</Button>
          </RefiningPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <RefiningPanel icon={Truck} title={fr ? "Transport et convoyeur" : "Transport & carrier"}><div className="space-y-4"><Field label={fr ? "Transporteur de sécurité" : "Security carrier"} required><Input value={carrier} disabled={confirmed} onChange={(event) => setCarrier(event.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={fr ? "Référence convoi / véhicule" : "Convoy / vehicle ref"}><Input value={vehicle} disabled={confirmed} onChange={(event) => setVehicle(event.target.value)} /></Field><Field label={fr ? "Mode" : "Mode"}><Select value={transportMode} disabled={confirmed} onValueChange={setTransportMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="armoured">{fr ? "Convoi routier blindé" : "Armoured road convoy"}</SelectItem><SelectItem value="air">{fr ? "Fret aérien sécurisé" : "Secured air freight"}</SelectItem></SelectContent></Select></Field><Field label={fr ? "Date et heure d’expédition" : "Dispatch date & time"} required><Input type="datetime-local" value={dispatchAt} disabled={confirmed} onChange={(event) => setDispatchAt(event.target.value)} /></Field><Field label={fr ? "Arrivée prévue" : "Expected arrival"}><Input type="datetime-local" value={arrivalAt} disabled={confirmed} onChange={(event) => setArrivalAt(event.target.value)} /></Field></div></div></RefiningPanel>
            <RefiningPanel icon={Shield} title={fr ? "Assurance en transit" : "In-transit insurance"}><div className="grid gap-4 sm:grid-cols-2"><Field label={fr ? "Assureur" : "Insurer"} required><Input value={insurer} disabled={confirmed} onChange={(event) => setInsurer(event.target.value)} /></Field><Field label={fr ? "Numéro de police" : "Policy number"}><Input value={policyNumber} disabled={confirmed} onChange={(event) => setPolicyNumber(event.target.value)} /></Field><Field label={fr ? "Couverture" : "Coverage"}><Select value={coverage} disabled={confirmed} onValueChange={setCoverage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-risk">{fr ? "Tous risques, transit" : "All-risk, in-transit"}</SelectItem><SelectItem value="named">{fr ? "Risques désignés" : "Named-perils"}</SelectItem></SelectContent></Select></Field><Field label={fr ? "Valide jusqu’au" : "Valid through"}><Input type="date" value={validThrough} disabled={confirmed} onChange={(event) => setValidThrough(event.target.value)} /></Field></div><div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2"><InfoCell label={fr ? "Référence marché (LBMA)" : "Market reference (LBMA)"}>{order ? `${order.goldPricePerOz.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/oz` : "—"}</InfoCell><InfoCell label={fr ? "Valeur assurée (or fin)" : "Insured value (fine gold)"}><span className="text-primary">{order ? `${Math.round(insuredValue).toLocaleString("en-US")} USD` : "—"}</span></InfoCell></div></RefiningPanel>
          </div>

          <RefiningPanel icon={FileText} title={fr ? "Documents de garde" : "Custody documents"}><div className="grid gap-4 md:grid-cols-3"><UploadField label={fr ? "Bordereau / manifeste" : "Dispatch note / manifest"} required file={documents.manifest} disabled={confirmed} onChange={(event) => upload("manifest", event)} /><UploadField label={fr ? "Certificat de scellés" : "Seal certificate"} required file={documents.sealCertificate} disabled={confirmed} onChange={(event) => upload("sealCertificate", event)} /><UploadField label={fr ? "Certificat d’assurance" : "Insurance certificate"} file={documents.insuranceCertificate} disabled={confirmed} onChange={(event) => upload("insuranceCertificate", event)} /></div></RefiningPanel>

          <RefiningPanel icon={Users} title={<>{fr ? "Signature en double contrôle" : "Dual-control sign-off"} <span className="text-destructive">*</span></>}>
            <SignoffRow title={fr ? "Agent expéditeur" : "Dispatching officer"} description={fr ? "Confirme les scellés et le poids vérifié" : "Confirms seals applied & weight verified"} checked={dispatchingSigned} disabled={confirmed} onCheckedChange={setDispatchingSigned} />
            <SignoffRow title={fr ? "Agent témoin" : "Witnessing officer"} description={fr ? "Témoigne indépendamment de la pose des scellés et de la remise" : "Independently witnesses seal & handover"} checked={witnessSigned} disabled={confirmed} onCheckedChange={setWitnessSigned} />
            <div className="mt-4 flex gap-3 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground"><ClockIcon /><div><strong className="text-foreground">{fr ? "Réception raffinerie — confirmation attendue." : "Refiner receipt — awaiting confirmation."}</strong> {fr ? "Après l’expédition, la raffinerie confirme le poids reçu et l’intégrité des scellés. Une correspondance fait passer l’ordre à « En raffinage » ; tout écart ouvre une exception de garde." : "After dispatch, the refiner confirms received weight and seal integrity. A match advances the order to In refining; any mismatch raises a custody exception."}</div></div>
            <div className="mt-3 rounded-lg border border-l-4 border-l-primary bg-primary/5 p-4 text-xs text-muted-foreground"><strong className="text-foreground">{fr ? "Chaîne de garde." : "Chain of custody."}</strong> {fr ? `Chaque remise est documentée : poids de sortie vérifié, scellés posés et constatés sous double contrôle, transit assuré, puis rapprochement à la réception. Les ${fineKg.toFixed(3)} kg d’or fin constituent la référence de l’outturn.` : `Every handoff is evidenced: verified weight out, seals witnessed under dual control, insured transit, then matched receipt. The ${fineKg.toFixed(3)} kg fine gold becomes the outturn baseline.`}</div>
          </RefiningPanel>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className={`text-xs ${dualControlComplete ? "text-emerald-500" : "text-muted-foreground"}`}>{confirmed ? (fr ? "Expédition confirmée. Réception de la raffinerie en attente." : "Dispatch confirmed. Refiner receipt is pending.") : dualControlComplete ? (fr ? "Double contrôle terminé — prêt à confirmer." : "Dual control complete — ready to confirm dispatch.") : (fr ? "Les deux signatures sont nécessaires pour confirmer l’expédition." : "Both sign-offs are required to confirm dispatch.")}</p><div className="flex justify-end gap-2"><Button variant="ghost" asChild><Link href={`/refining-orders/${orderReference}/approval`}>{fr ? "Annuler" : "Cancel"}</Link></Button><Button variant="outline" onClick={() => setSaved(true)} disabled={confirmed}>{fr ? "Enregistrer" : "Save Draft"}</Button><Button onClick={confirmDispatch} disabled={!canConfirm}><Truck className="mr-2 h-4 w-4" />{fr ? "Confirmer l’expédition" : "Confirm dispatch"}</Button></div></div>
        </TabsContent>
        <TabsContent value="trace" className="mt-4"><RefiningPanel icon={Box} title={fr ? "Chaîne de garde et de provenance" : "Custody & provenance chain"}><Timeline items={[
          { state: "done", title: `${fr ? "Bon de commande accepté" : "Purchase order accepted"} — ${order?.purchaseOrderReference || "—"}`, meta: `${order?.counterpartyName || "—"} · ${lotGross.toFixed(3)} kg doré, ${purity.toFixed(2)}% assay` },
          { state: "done", title: `${fr ? "Réception coffre" : "Vault intake"} — ${order?.lotReference || "—"}`, meta: `BCC Vault – Kinshasa · fine gold ${fineKg.toFixed(3)} kg` },
          { state: "done", title: `${fr ? "Ordre de raffinage créé et approuvé" : "Refining order created & approved"} — ${order?.reference || orderReference}`, meta: `${order?.approvals.filter((approval) => approval.decision === "approved").length || 0} ${fr ? "approbation(s) enregistrée(s)" : "approval(s) recorded"}` },
          { state: confirmed ? "done" : "current", title: `${fr ? "Expédition et chaîne de garde" : "Dispatch & chain of custody"} — ${dispatchReference}`, meta: confirmed ? (fr ? "Expédition confirmée" : "Dispatch confirmed") : (fr ? "Cette étape · scellés, poids, transport et assurance" : "This step · seals, weight, transport & insurance") },
          { state: confirmed ? "current" : "pending", title: fr ? "Confirmation de réception par la raffinerie" : "Refiner receipt confirmation", meta: fr ? "En attente · poids reçu et intégrité des scellés" : "Pending · received weight & seal integrity" },
          { state: "pending", title: "Outturn & reconciliation", meta: "Pending · refined bars vs fine gold in" },
        ]} /></RefiningPanel></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{children}</div>;
}

function UploadField({ label, required, file, disabled, onChange }: { label: string; required?: boolean; file: File | null; disabled: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <Field label={label} required={required}><label className={`flex min-h-24 flex-col items-center justify-center rounded-lg border-2 p-4 text-center ${file ? "border-emerald-500/50 bg-emerald-500/5" : "border-dashed hover:border-primary/50"} ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}>{file ? <><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-500" /><span className="max-w-full truncate text-xs">{file.name}</span></> : <><Upload className="mb-2 h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{disabled ? "—" : "PDF, JPG, PNG"}</span></>}<input type="file" className="hidden" disabled={disabled} accept=".pdf,.jpg,.jpeg,.png" onChange={onChange} /></label></Field>;
}

function SignoffRow({ title, description, checked, disabled, onCheckedChange }: { title: string; description: string; checked: boolean; disabled: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="mb-2 flex items-center justify-between rounded-lg border p-4"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} /></div>;
}

function ClockIcon() {
  return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]">◷</span>;
}
