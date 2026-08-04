"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, PackageCheck, ShieldCheck, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, RefiningPanel, StatusPill, WorkflowStepper } from "./refining-shared";

type ScenarioKey = "domestic" | "export";
type Decision = "confirmed" | "returned" | "rejected" | null;

interface Gate {
  title: string;
  description: string;
  evidence: string;
  value: string;
  pass: boolean;
}

const SCENARIOS: Record<ScenarioKey, { refiner: string; gates: Gate[] }> = {
  domestic: {
    refiner: "Kinshasa Refinery SA",
    gates: [
      { title: "Output fineness ≥ 995‰", description: "All accepted bars meet the minimum monetary-gold fineness", evidence: "Verified assay · US-R04", value: "≥ 995‰", pass: true },
      { title: "LBMA Good Delivery accredited refiner", description: "Produced by a refiner on the current LBMA GD list", evidence: "Counterparty record · US-R01", value: "Not accredited", pass: false },
      { title: "Responsible sourcing verified", description: "OECD Due Diligence / LBMA Responsible Gold on file", evidence: "Counterparty record · US-R01", value: "On file", pass: true },
    ],
  },
  export: {
    refiner: "Rand Refinery (South Africa)",
    gates: [
      { title: "Output fineness ≥ 995‰", description: "All accepted bars meet the minimum monetary-gold fineness", evidence: "Verified assay · US-R04", value: "999.9‰", pass: true },
      { title: "LBMA Good Delivery accredited refiner", description: "Produced by a refiner on the current LBMA GD list", evidence: "Counterparty record · US-R01", value: "GD accredited", pass: true },
      { title: "Responsible sourcing verified", description: "OECD Due Diligence / LBMA Responsible Gold on file", evidence: "Counterparty record · US-R01", value: "On file", pass: true },
    ],
  },
};

export function ReserveEligibility() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [scenario, setScenario] = useState<ScenarioKey>("domestic");
  const [attested, setAttested] = useState(false);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [error, setError] = useState("");

  const current = SCENARIOS[scenario];
  const eligible = current.gates.every((gate) => gate.pass);
  const failedGates = current.gates.filter((gate) => !gate.pass);

  const banner = useMemo(() => {
    if (decision === "returned") return { tone: "warning", title: fr ? "Classification retournée au rapprochement" : "Classification returned to reconciliation", description: note };
    if (decision === "rejected") return { tone: "danger", title: fr ? "Classification rejetée" : "Classification rejected", description: note };
    if (decision === "confirmed" && eligible) return { tone: "success", title: fr ? "Classé comme or monétaire — transmis à l’allocation des réserves" : "Classified as monetary gold — routed to reserve allocation", description: fr ? "Comptabilisé comme or monétaire conformément à l’IRFCL, section I.A." : "Booked as monetary gold under IRFCL Section I.A." };
    if (decision === "confirmed") return { tone: "warning", title: fr ? "Classé comme or non monétaire — transmis au compte de détention" : "Classified as non-monetary gold — routed to holding", description: fr ? "Comptabilisé dans le sous-livre non monétaire pour remédiation (US-R06)." : "Booked to the non-monetary holding sub-ledger for remediation (US-R06)." };
    return { tone: "info", title: fr ? "Outturn rapproché — classification d’éligibilité aux réserves" : "Outturn reconciled — classify for reserve eligibility", description: fr ? "Le système a évalué les critères à partir de la contrepartie et de l’essai vérifié. Examinez les preuves et attestez la classification." : "The system evaluated the gates from the counterparty record and verified assay. Review the evidence and attest the classification." };
  }, [decision, eligible, fr, note]);

  const decide = (next: Exclude<Decision, null>) => {
    if ((next === "returned" || next === "rejected") && !note.trim()) {
      setError(fr ? "Une note est obligatoire pour retourner ou rejeter la classification." : "A note is required to return or reject the classification.");
      return;
    }
    setError("");
    setDecision(next);
  };

  const locked = decision !== null;

  return (
    <div className="space-y-5">
      <Link href="/refining-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{fr ? "Retour à l’ordre de raffinage GAC-REF-2026-014" : "Back to refining order GAC-REF-2026-014"}</Link>

      <div className={`flex gap-3 rounded-lg border border-l-4 p-4 ${banner.tone === "success" ? "border-l-emerald-500 bg-emerald-500/5" : banner.tone === "danger" ? "border-l-destructive bg-destructive/5" : banner.tone === "warning" ? "border-l-amber-500 bg-amber-500/5" : "border-l-sky-500 bg-sky-500/5"}`}>
        {banner.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : banner.tone === "danger" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${banner.tone === "warning" ? "text-amber-500" : "text-sky-500"}`} />}
        <div><p className="text-sm font-semibold">{banner.title}</p><p className="mt-1 text-xs text-muted-foreground">{banner.description}</p></div>
      </div>

      <div><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">GAC-REF-2026-014</h1><StatusPill tone={decision === "confirmed" ? (eligible ? "success" : "warning") : decision === "rejected" ? "danger" : "info"}>{decision === "confirmed" ? (eligible ? (fr ? "Monétaire · allocation" : "Monetary · to allocation") : (fr ? "Non monétaire · détention" : "Non-monetary · to holding")) : decision === "returned" ? (fr ? "Retourné" : "Returned") : decision === "rejected" ? (fr ? "Rejeté" : "Rejected") : (fr ? "Classification en attente" : "Awaiting classification")}</StatusPill></div><p className="mt-1 text-xs text-muted-foreground">Lot DORE-2026-0421 · PO GAC-TRK-MRUYZ7EK · {fr ? "outturn rapproché" : "reconciled outturn"} 44.054 kg fine</p></div>

      <WorkflowStepper active={decision === "confirmed" ? 4 : 3} hrefs={[undefined, undefined, undefined, "/refining-orders/GAC-REF-2026-014/reserve-eligibility", decision === "confirmed" && !eligible ? "/non-monetary-holdings" : undefined]} labels={fr ? ["En raffinage", "Outturn accepté", "Rapproché", "Classification", decision === "confirmed" ? (eligible ? "Allocation des réserves" : "Détention non monétaire") : "Comptabilisation"] : ["In refining", "Outturn accepted", "Reconciled", "Classification", decision === "confirmed" ? (eligible ? "Reserve allocation" : "Non-monetary holding") : "Booked to ledger"]} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <RefiningPanel icon={PackageCheck} title={fr ? "Outturn rapproché à classifier" : "Reconciled outturn to classify"}><div className="grid gap-4 sm:grid-cols-3"><InfoCell label={fr ? "Raffinerie" : "Refiner"}>{current.refiner}</InfoCell><InfoCell label={fr ? "Lingots raffinés" : "Refined bars"}>3 · KRS-2026-1187/88/89</InfoCell><InfoCell label={fr ? "Or fin vérifié" : "Verified fine gold"}>44.054 kg · 1,416.36 oz</InfoCell></div></RefiningPanel>

          <RefiningPanel icon={CheckCircle2} title={<span className="flex flex-wrap items-center gap-2">{fr ? "Critères d’éligibilité" : "Eligibility gates"}<StatusPill>US-R05 · {fr ? "évaluation automatique" : "rule-evaluated"}</StatusPill></span>}>
            <div className="mb-4 flex justify-end"><div className="inline-flex rounded-lg border bg-muted/30 p-1"><button type="button" disabled={locked} onClick={() => { setScenario("domestic"); setAttested(false); }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${scenario === "domestic" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{fr ? "Cet ordre" : "This order"}</button><button type="button" disabled={locked} onClick={() => { setScenario("export"); setAttested(false); }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${scenario === "export" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{fr ? "Aperçu : export via Rand Refinery" : "Preview: export via Rand Refinery"}</button></div></div>
            <div className="space-y-3">{current.gates.map((gate) => <GateRow key={gate.title} gate={gate} fr={fr} />)}</div>
          </RefiningPanel>
        </div>

        <RefiningPanel icon={ShieldCheck} title={fr ? "Classification déterminée" : "Determined classification"} className="xl:sticky xl:top-20">
          <div className={`rounded-lg border p-5 ${eligible ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{fr ? "Classification" : "Classification"}</p><p className={`mt-2 text-xl font-semibold ${eligible ? "text-emerald-500" : "text-amber-500"}`}>{eligible ? (fr ? "✓ Or monétaire" : "✓ Monetary gold") : (fr ? "Or non monétaire" : "Non-monetary gold")}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{eligible ? (fr ? "Tous les critères sont satisfaits. Comptabilisation comme actif de réserve et transmission à l’allocation des réserves (US-06)." : "All gates pass. Book as a reserve asset and route to reserve allocation (US-06).") : (fr ? `Échec : ${failedGates.map((gate) => gate.title).join(", ")}. Comptabilisation comme or non monétaire et transmission au sous-livre de détention (US-R06).` : `Fails: ${failedGates.map((gate) => gate.title).join(", ")}. Book as non-monetary gold and route to the holding sub-ledger (US-R06).`)}</p></div>

          <div className="my-5 border-t" />
          <label className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={attested} disabled={locked} onCheckedChange={(checked) => setAttested(Boolean(checked))} /><span className="text-xs leading-5">{fr ? "J’ai examiné les preuves : accréditation (US-R01), essai vérifié (US-R04) et certifications d’approvisionnement, et j’atteste cette classification." : "I reviewed the gate evidence — accreditation (US-R01), verified assay (US-R04), and sourcing certifications — and attest this classification."}</span></label>
          <Label htmlFor="classification-note" className="mt-5">{fr ? "Note de classification" : "Classification note"}</Label><Textarea id="classification-note" className="mt-2" value={note} disabled={locked} onChange={(event) => setNote(event.target.value)} placeholder={fr ? "Facultative pour confirmer · obligatoire pour retourner ou rejeter" : "Optional for confirm · required to return or reject"} />
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-4 space-y-2"><Button className="w-full" disabled={!attested || locked} onClick={() => decide("confirmed")}><Check className="mr-2 h-4 w-4" />{eligible ? (fr ? "Confirmer et transmettre à l’allocation" : "Confirm & route to reserve allocation") : (fr ? "Confirmer et transmettre à la détention non monétaire" : "Confirm & route to non-monetary holding")}</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={locked} onClick={() => decide("returned")}>{fr ? "Retour au rapprochement" : "Return to reconciliation"}</Button><Button variant="destructive" disabled={locked} onClick={() => decide("rejected")}>{fr ? "Rejeter" : "Reject"}</Button></div></div>

          {decision === "confirmed" && !eligible && (
            <Button asChild className="mt-3 w-full bg-amber-700 text-white hover:bg-amber-800">
              <Link href="/non-monetary-holdings">
                {fr ? "Ouvrir la détention non monétaire" : "Open non-monetary holding"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}

          {decision === "confirmed" && (
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href="/refining-orders/GAC-REF-2026-014/settlement">
                {fr ? "Ouvrir le règlement du raffinage" : "Open refining settlement"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}

          <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-[11px] leading-4 text-muted-foreground">{eligible ? (fr ? "La classification découle automatiquement des preuves. Le gestionnaire des réserves l’atteste ; il ne s’agit pas d’un choix discrétionnaire." : "Classification is rule-determined from evidence. The Reserve Manager attests; it is not discretionary.") : (fr ? "La classification ne peut pas devenir monétaire tant qu’un critère échoue. La remédiation US-R06 exige un nouveau raffinage accrédité ou l’obtention de l’accréditation." : "Classification cannot be monetary while any gate fails. US-R06 remediation requires accredited re-refining or accreditation.")}</p>
        </RefiningPanel>
      </div>
    </div>
  );
}

function GateRow({ gate, fr }: { gate: Gate; fr: boolean }) {
  return <div className={`grid gap-3 rounded-lg border p-4 sm:grid-cols-[28px_minmax(0,1fr)_110px] ${gate.pass ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full ${gate.pass ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive"}`}>{gate.pass ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span><div><p className="text-sm font-semibold">{gate.title}</p><p className="mt-1 text-xs text-muted-foreground">{gate.description}</p><p className="mt-2 text-[11px] text-muted-foreground">{fr ? "Preuve" : "Evidence"}: {gate.evidence}</p></div><div className="text-left sm:text-right"><StatusPill tone={gate.pass ? "success" : "danger"}>{gate.pass ? (fr ? "Réussi" : "Pass") : (fr ? "Échec" : "Fail")}</StatusPill><p className="mt-2 text-[11px] text-muted-foreground">{gate.value}</p></div></div>;
}
