"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Factory, Filter, PackageCheck, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, OZ_PER_KG, RefiningPanel, StatusPill, Timeline, WorkflowStepper } from "./refining-shared";

const FINE_KG = 44.25;
const PRICE = 2351.2;
const ACTUAL_VALUE = FINE_KG * OZ_PER_KG * PRICE;

const TIERS = [
  { name: "Tier 1", label: "≤ 500,000 USD", max: 500_000, count: 1 },
  { name: "Tier 2", label: "500,000 – 5,000,000 USD", max: 5_000_000, count: 2 },
  { name: "Tier 3", label: "> 5,000,000 USD", max: Number.POSITIVE_INFINITY, count: 3 },
];

const APPROVERS = [
  { initials: "HB", name: "Henri Bwana", role: "Head of Bullion Operations · Authorising Officer", approved: true, you: false, when: "22/07 · 10:40" },
  { initials: "MK", name: "Marie Kalala", role: "Reserve Risk Officer", approved: false, you: true, when: "" },
  { initials: "JM", name: "Jeanne Mbala", role: "Deputy Governor", approved: false, you: false, when: "" },
];

type Decision = "approved" | "returned" | "rejected" | null;

export function RefiningOrderApproval() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [previewValue, setPreviewValue] = useState("actual");
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [error, setError] = useState("");

  const value = previewValue === "actual" ? ACTUAL_VALUE : Number(previewValue);
  const tier = TIERS.find((candidate) => value <= candidate.max) ?? TIERS[2];
  const required = APPROVERS.slice(0, tier.count);
  const youRequired = required.some((approver) => approver.you);
  const allChecked = checks.every(Boolean);
  const approvedCount = required.filter((approver) => approver.approved || (approver.you && decision === "approved")).length;
  const fullyApproved = decision === "approved" && approvedCount === required.length;

  const banner = useMemo(() => {
    if (decision === "returned") return { tone: "warning", title: fr ? "Retourné au Trade Manager pour modification" : "Returned to the Trade Manager for changes", description: note };
    if (decision === "rejected") return { tone: "danger", title: fr ? "Ordre rejeté" : "Order rejected", description: note };
    if (decision === "approved" && fullyApproved) return { tone: "success", title: fr ? "Approuvé — libéré pour expédition" : "Approved — released for dispatch", description: fr ? "Toutes les approbations sont enregistrées. L’ordre est transmis au responsable Coffre & Essai." : "All approvals are recorded. The order is now with the Vault & Assay Officer." };
    if (decision === "approved") return { tone: "info", title: fr ? "Votre approbation est enregistrée" : "Your approval is recorded", description: fr ? "Une approbation supplémentaire est requise avant l’expédition." : "An additional approval is required before dispatch." };
    return { tone: "warning", title: fr ? "Votre approbation est requise — deuxième des deux signatures" : "Awaiting your approval — second of two required", description: fr ? "La première signature est enregistrée. Votre approbation complète le double contrôle et libère l’ordre pour expédition." : "The first approver has signed off. Your approval completes dual control and releases the order for dispatch." };
  }, [decision, fr, fullyApproved, note]);

  const makeDecision = (next: Exclude<Decision, null>) => {
    if ((next === "returned" || next === "rejected") && !note.trim()) {
      setError(fr ? "Une note de décision est obligatoire pour retourner ou rejeter l’ordre." : "A decision note is required to return or reject the order.");
      return;
    }
    setError("");
    setDecision(next);
  };

  return (
    <div className="space-y-5">
      <Link href="/approval-queue" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{fr ? "Retour à la file d’approbation" : "Back to approval queue"}</Link>

      <div className={`flex gap-3 rounded-lg border border-l-4 p-4 ${banner.tone === "success" ? "border-l-emerald-500 bg-emerald-500/5" : banner.tone === "danger" ? "border-l-destructive bg-destructive/5" : banner.tone === "info" ? "border-l-sky-500 bg-sky-500/5" : "border-l-amber-500 bg-amber-500/5"}`}>
        {banner.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : banner.tone === "danger" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
        <div><p className="text-sm font-semibold">{banner.title}</p><p className="mt-1 text-xs text-muted-foreground">{banner.description}</p></div>
      </div>

      <div><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">GAC-REF-2026-014</h1><StatusPill tone={decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning"}>{decision === "approved" ? (fr ? "Approuvé" : "Approved") : decision === "returned" ? (fr ? "Retourné" : "Returned") : decision === "rejected" ? (fr ? "Rejeté" : "Rejected") : (fr ? "Approbation en attente" : "Pending approval")}</StatusPill><StatusPill>{tier.count === 1 ? (fr ? "Approbation simple" : "Single approval") : tier.count === 2 ? (fr ? "Double approbation" : "Dual approval") : (fr ? "Triple approbation" : "Triple approval")}</StatusPill></div><p className="mt-1 text-xs text-muted-foreground">Bullion Desk · Trade Manager · 22/07/2026 09:05 · PO GAC-TRK-MRUYZ7EK · Lot DORE-2026-0421</p></div>

      <WorkflowStepper active={fullyApproved ? 2 : 1} hrefs={["/refining-orders", "/refining-orders/GAC-REF-2026-014/approval", "/refining-orders/GAC-REF-2026-014/dispatch", undefined, undefined, "/refining-orders/GAC-REF-2026-014/reserve-eligibility"]} labels={fr ? ["Brouillon", "Approbation", "Expédition", "En raffinage", "Outturn", "Classification"] : ["Draft", "Approval", "Dispatch", "In refining", "Outturn", "Classification"]} />

      <Tabs defaultValue="review">
        <TabsList><TabsTrigger value="review">{fr ? "Examen de l’ordre" : "Order review"}</TabsTrigger><TabsTrigger value="history">{fr ? "Historique d’approbation" : "Approval history"}</TabsTrigger></TabsList>
        <TabsContent value="review" className="mt-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <RefiningPanel icon={PackageCheck} title={fr ? "Ce que vous approuvez" : "What you are approving"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell label="Source PO"><span className="text-primary">GAC-TRK-MRUYZ7EK</span></InfoCell><InfoCell label={fr ? "Lot doré" : "Doré lot"}>DORE-2026-0421 · Wolo</InfoCell><InfoCell label={fr ? "Poids brut" : "Gross weight"}>50.000 kg · 88.50%</InfoCell><InfoCell label={fr ? "Teneur en or fin" : "Fine gold content"}>44.250 kg · 1,422.67 oz</InfoCell></div></RefiningPanel>

              <RefiningPanel icon={Factory} title={fr ? "Raffinerie et conditions" : "Refiner & refining terms"}><div className="grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "Raffinerie" : "Refiner"}>Kinshasa Refinery SA</InfoCell><InfoCell label="LBMA Good Delivery"><StatusPill tone="warning">{fr ? "Demande en cours" : "Application in progress"}</StatusPill></InfoCell><InfoCell label={fr ? "Canal" : "Refining channel"}>{fr ? "Raffinage à façon national" : "Domestic toll refining"}</InfoCell><InfoCell label={fr ? "Base de rendement" : "Yield basis"}>Outturn on assayed fine content</InfoCell><InfoCell label={fr ? "Titre cible" : "Target fineness"}>995.0 ‰</InfoCell><InfoCell label={fr ? "Perte attendue" : "Expected loss"}>0.50 % · −0.221 kg</InfoCell><InfoCell label={fr ? "Outturn attendu" : "Expected outturn"}>44.029 kg fine</InfoCell><InfoCell label={fr ? "Délai" : "Turnaround"}>10 {fr ? "jours ouvrés" : "business days"}</InfoCell><InfoCell label={fr ? "Frais" : "Refining fee"}>14.50 USD/oz</InfoCell><InfoCell label={fr ? "Total des frais" : "Total refining charge"}><span className="text-primary">20,629 USD</span></InfoCell></div></RefiningPanel>

              <RefiningPanel icon={ShieldAlert} title={fr ? "Traitement en réserves" : "Reserve-treatment flag"}><div className="rounded-lg border border-l-4 border-l-amber-500 bg-amber-500/5 p-4 text-sm text-muted-foreground"><strong className="text-foreground">{fr ? "Cet ordre produit de l’or non monétaire." : "This order produces non-monetary gold."}</strong> {fr ? "La raffinerie n’étant pas LBMA Good Delivery, l’outturn sera détenu comme or non monétaire jusqu’à un nouveau raffinage ou une accréditation (US-R06)." : "The refiner is not LBMA Good Delivery accredited, so outturn will be held as non-monetary gold pending re-refining or accreditation (US-R06)."}<p className="mt-3 border-t pt-3">{fr ? "Si des lingots éligibles sont requis, retournez l’ordre au Trade Manager pour choisir le canal export. Sinon, confirmez ce traitement dans la liste de validation." : "If reserve-eligible bullion is required, return the order to switch to the export channel. Otherwise confirm this outcome in the checklist."}</p></div></RefiningPanel>

              <RefiningPanel icon={Filter} title={<span className="flex w-full flex-wrap items-center gap-2">{fr ? "Circuit d’approbation" : "Approval routing"}<Select value={previewValue} onValueChange={setPreviewValue} disabled={decision !== null}><SelectTrigger className="ml-auto h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="actual">{fr ? "Cet ordre" : "This order"}</SelectItem><SelectItem value="250000">Preview · 250k USD</SelectItem><SelectItem value="3345182">Preview · 3.35M USD</SelectItem><SelectItem value="8500000">Preview · 8.5M USD</SelectItem></SelectContent></Select></span>}>
                <div className="mb-4 grid gap-4 sm:grid-cols-2"><InfoCell label={fr ? "Valeur de l’envoi" : "Consignment value"}>{Math.round(value).toLocaleString("en-US")} USD{previewValue !== "actual" && " (preview)"}</InfoCell><InfoCell label={fr ? "Dépense de raffinage" : "Refining charge"}>20,629 USD</InfoCell><InfoCell className="sm:col-span-2" label={fr ? "Palier applicable" : "Matched tier"}><StatusPill tone="info">{tier.name}</StatusPill> · {tier.count} {fr ? "approbateur(s) requis" : "approver(s) required"}</InfoCell></div>
                <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Tier</th><th className="px-3 py-2 font-medium">{fr ? "Valeur de l’envoi" : "Consignment value"}</th><th className="px-3 py-2 font-medium">{fr ? "Approbateurs" : "Approvers"}</th></tr></thead><tbody>{TIERS.map((candidate) => <tr key={candidate.name} className={`border-t ${candidate.name === tier.name ? "bg-primary/10" : ""}`}><td className={`px-3 py-2 ${candidate.name === tier.name ? "font-semibold text-primary" : ""}`}>{candidate.name}{candidate.name === tier.name && " ◄"}</td><td className="px-3 py-2 text-muted-foreground">{candidate.label}</td><td className="px-3 py-2">{candidate.count}</td></tr>)}</tbody></table></div>
                <p className="mt-3 text-xs text-muted-foreground">{fr ? "Le routage repose sur la valeur de marché de l’or sortant de garde, et non sur les seuls frais de raffinage." : "Routing is based on the market value of gold leaving custody, not the refining fee."}</p>
              </RefiningPanel>
            </div>

            <RefiningPanel icon={ShieldCheck} title={`${fr ? "Approbations" : "Approvals"} · ${approvedCount} / ${required.length}`} className="xl:sticky xl:top-20">
              <div className="space-y-3">{required.map((approver) => { const approved = approver.approved || (approver.you && decision === "approved"); return <div key={approver.name} className="flex items-center gap-3 rounded-lg border p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">{approver.initials}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{approver.name}{approver.you && <span className="font-normal text-muted-foreground"> ({fr ? "vous" : "you"})</span>}</p><p className="truncate text-[11px] text-muted-foreground">{approver.role}</p></div>{approved ? <StatusPill tone="success">{fr ? "Approuvé" : "Approved"}</StatusPill> : approver.you ? <StatusPill tone="warning">{fr ? "Votre décision" : "Your decision"}</StatusPill> : <StatusPill>{fr ? "En attente" : "Pending"}</StatusPill>}</div>; })}</div>

              {!youRequired && <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{fr ? "Aucune action n’est requise de votre part pour ce palier." : "No action is required from you at this tier."}</div>}

              <div className="my-5 border-t" />
              <p className="mb-3 text-sm font-semibold">{fr ? "Liste de validation" : "Validation checklist"}</p>
              <div className="space-y-3">{[
                [fr ? "KYC et onboarding de la raffinerie à jour" : "Refiner KYC & onboarding current", "US-R01"],
                [fr ? "L’or fin correspond au lot livré" : "Fine gold matches the delivered lot", "44.250 kg · DORE-2026-0421"],
                [fr ? "Frais dans le tarif approuvé" : "Refining fee within approved tariff", "20,629 USD"],
                [fr ? "Traitement en réserves examiné" : "Reserve-treatment outcome reviewed", "US-R05 / US-R06"],
                [fr ? "Séparation des tâches respectée" : "Segregation of duties respected", fr ? "L’approbateur n’est pas le créateur" : "Approver is not the maker"],
              ].map(([title, subtitle], index) => <label key={title} className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={checks[index]} disabled={decision !== null} onCheckedChange={(checked) => setChecks((previous) => previous.map((value, current) => current === index ? Boolean(checked) : value))} /><span><span className="block text-xs font-medium">{title}</span><span className="block text-[11px] text-muted-foreground">{subtitle}</span></span></label>)}</div>

              <div className="my-5 border-t" />
              <Label htmlFor="decision-note">{fr ? "Note de décision" : "Decision note"}</Label>
              <Textarea id="decision-note" className="mt-2" value={note} disabled={decision !== null} onChange={(event) => setNote(event.target.value)} placeholder={fr ? "Facultative pour approuver · obligatoire pour retourner ou rejeter" : "Optional for approval · required when returning or rejecting"} />
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
              <div className="mt-4 space-y-2"><Button className="w-full" disabled={!allChecked || !youRequired || decision !== null} onClick={() => makeDecision("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />{fr ? "Approuver et libérer pour expédition" : "Approve & release for dispatch"}</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={decision !== null} onClick={() => makeDecision("returned")}>{fr ? "Retourner" : "Return for changes"}</Button><Button variant="destructive" disabled={decision !== null} onClick={() => makeDecision("rejected")}>{fr ? "Rejeter" : "Reject"}</Button></div></div>
              <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">{fr ? "L’approbation complète le double contrôle. L’expédition US-R03 reste une étape distincte, effectuée par le responsable Coffre & Essai." : "Approval completes dual control. Dispatch US-R03 is a separate step performed by the Vault & Assay Officer."}</p>
            </RefiningPanel>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4"><RefiningPanel icon={Clock3} title={fr ? "Piste d’approbation" : "Approval trail"}><Timeline items={[
          { state: "done", title: fr ? "Ordre créé et soumis" : "Order created & submitted", meta: "22/07/2026 09:05 · Bullion Desk · Trade Manager" },
          { state: "done", title: fr ? "Première approbation — Henri Bwana" : "First approval — Henri Bwana", meta: "22/07/2026 10:40 · Head of Bullion Operations · Terms in line with mandate" },
          { state: decision === "approved" ? "done" : "current", title: fr ? "Deuxième approbation — Marie Kalala (vous)" : "Second approval — Marie Kalala (you)", meta: decision === "approved" ? (fr ? "Approuvé à l’instant" : "Approved just now") : decision === "returned" ? (fr ? "Ordre retourné" : "Order returned") : decision === "rejected" ? (fr ? "Ordre rejeté" : "Order rejected") : (fr ? "Votre décision est attendue · Reserve Risk Officer" : "Awaiting your decision · Reserve Risk Officer") },
          { state: fullyApproved ? "current" : "pending", title: fr ? "Expédition par le responsable Coffre & Essai" : "Dispatch by Vault & Assay Officer", meta: fullyApproved ? (fr ? "Prêt pour expédition (US-R03)" : "Ready for dispatch (US-R03)") : (fr ? "En attente d’approbation" : "Pending approval") },
        ]} /></RefiningPanel></TabsContent>
      </Tabs>
    </div>
  );
}
