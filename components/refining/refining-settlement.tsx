"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  CircleDollarSign,
  FileText,
  Landmark,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { InfoCell, RefiningPanel, StatusPill, WorkflowStepper } from "./refining-shared";

const AGREED_FEE = 20_628.72;
const FEE_TOLERANCE = 0.005;
const ANCILLARY_CAP = 800;
const OUTTURN_OZ = 1_416.36;
const GOLD_PRICE = 2_351.2;

type Decision = "issued" | "queried" | null;

function asNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number, digits = 2) {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} USD`;
}

function addDays(date: string, days: number) {
  if (!date) return "—";
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function RefiningSettlement() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [invoiceNumber, setInvoiceNumber] = useState("KRS-INV-2026-0091");
  const [invoiceDate, setInvoiceDate] = useState("2026-08-05");
  const [feeRate, setFeeRate] = useState("14.50");
  const [feeQuantity, setFeeQuantity] = useState("1422.67");
  const [assayFee, setAssayFee] = useState("350.00");
  const [handlingFee, setHandlingFee] = useState("400.00");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const calculation = useMemo(() => {
    const refiningFee = asNumber(feeRate) * asNumber(feeQuantity);
    const ancillary = asNumber(assayFee) + asNumber(handlingFee);
    const total = refiningFee + ancillary;
    const variance = refiningFee - AGREED_FEE;
    const feeWithinTolerance = Math.abs(variance) <= AGREED_FEE * FEE_TOLERANCE;
    const ancillaryWithinCap = ancillary <= ANCILLARY_CAP;
    return {
      refiningFee,
      ancillary,
      total,
      variance,
      feeWithinTolerance,
      ancillaryWithinCap,
      reconciled: feeWithinTolerance && ancillaryWithinCap,
      landedPerOz: total / OUTTURN_OZ,
      landedTotal: OUTTURN_OZ * GOLD_PRICE + total,
    };
  }, [assayFee, feeQuantity, feeRate, handlingFee]);

  const locked = decision !== null;

  const queryInvoice = () => {
    if (!note.trim()) {
      setError(fr ? "Une note est obligatoire pour contester la facture." : "A note is required to query the invoice.");
      return;
    }
    setError("");
    setDecision("queried");
  };

  const issueInstruction = () => {
    if (!calculation.reconciled) return;
    setError("");
    setDecision("issued");
  };

  const banner = decision === "issued"
    ? {
        tone: "success" as const,
        title: fr ? "Instruction de règlement transmise à la Trésorerie" : "Settlement instruction issued to Treasury",
        description: fr
          ? "Les frais ont été rapprochés et incorporés au coût du lot . Le paiement suit désormais les contrôles propres à la Trésorerie."
          : "Charges were reconciled and capitalised into the  lot cost basis. Payment now proceeds under Treasury controls.",
      }
    : decision === "queried"
      ? {
          tone: "warning" as const,
          title: fr ? "Facture contestée auprès de la raffinerie" : "Invoice queried with refiner",
          description: fr ? `Règlement suspendu dans l’attente d’une réponse. Motif : ${note}` : `Settlement held pending a response. Reason: ${note}`,
        }
      : {
          tone: "info" as const,
          title: fr ? "Outturn accepté — saisir les frais et instruire le règlement" : "Outturn accepted — capture charges and instruct settlement",
          description: fr
            ? "Rapprochez la facture de Kinshasa Refinery SA avec les conditions convenues, puis transmettez l’instruction à la Trésorerie."
            : "Reconcile Kinshasa Refinery SA’s invoice against the agreed terms, then issue the instruction to Treasury.",
        };

  return (
    <div className="space-y-5">
      <Link href="/refining-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {fr ? "Retour à l’ordre de raffinage GAC-REF-2026-014" : "Back to refining order GAC-REF-2026-014"}
      </Link>

      <div className={`flex gap-3 rounded-lg border border-l-4 p-4 ${banner.tone === "success" ? "border-l-emerald-500 bg-emerald-500/5" : banner.tone === "warning" ? "border-l-amber-500 bg-amber-500/5" : "border-l-sky-500 bg-sky-500/5"}`}>
        {banner.tone === "success" ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : banner.tone === "warning" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /> : <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />}
        <div><p className="text-sm font-semibold">{banner.title}</p><p className="mt-1 text-xs text-muted-foreground">{banner.description}</p></div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl font-semibold">{fr ? "Règlement de raffinage" : "Refining settlement"} · GAC-REF-2026-014</h1><StatusPill tone={decision === "issued" ? "success" : decision === "queried" ? "warning" : "info"}>{decision === "issued" ? (fr ? "Instruction transmise" : "Settlement instructed") : decision === "queried" ? (fr ? "Contestée" : "Queried") : (fr ? "Règlement en attente" : "Awaiting settlement")}</StatusPill></div>
        <p className="mt-1 text-xs text-muted-foreground">Kinshasa Refinery SA · {invoiceNumber || "—"} · toll refining (domestic)</p>
      </div>

      <WorkflowStepper active={decision === "issued" ? 3 : 2} labels={fr ? ["Outturn accepté", "Facture reçue", "Rapprochée", "Instruction transmise", "Payée (Trésorerie)"] : ["Outturn accepted", "Invoice received", "Reconciled", "Settlement instructed", "Paid (Treasury)"]} />

      <RefiningPanel icon={FileText} title={<span className="flex flex-wrap items-center gap-2">{fr ? "Conditions convenues" : "Agreed terms"}<StatusPill>{fr ? "Ordre de raffinage" : "Refining order"}</StatusPill></span>}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><InfoCell label={fr ? "Base des frais" : "Fee basis"}>{fr ? "Par once fine (intrant)" : "Per fine ounce (input)"}</InfoCell><InfoCell label={fr ? "Taux convenu" : "Agreed rate"}>14.50 USD/oz</InfoCell><InfoCell label={fr ? "Base d’or fin" : "Fine gold basis"}>1,422.67 oz</InfoCell><InfoCell label={fr ? "Frais de raffinage convenus" : "Agreed refining fee"}>{money(AGREED_FEE)}</InfoCell></div>
        <div className="my-4 border-t" />
        <div className="grid gap-4 sm:grid-cols-3"><InfoCell label={fr ? "Plafond des frais accessoires" : "Ancillary allowance (cap)"}>{money(ANCILLARY_CAP)}</InfoCell><InfoCell label={fr ? "Devise" : "Currency"}>USD</InfoCell><InfoCell label={fr ? "Conditions de paiement" : "Payment terms"}>T+2 {fr ? "après facture" : "from invoice"}</InfoCell></div>
      </RefiningPanel>

      <RefiningPanel icon={FileText} title={fr ? "Facture de la raffinerie" : "Refiner invoice"}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2"><Field label={fr ? "Numéro de facture" : "Invoice number"}><Input value={invoiceNumber} disabled={locked} onChange={(event) => setInvoiceNumber(event.target.value)} /></Field><Field label={fr ? "Date de facture" : "Invoice date"}><Input type="date" value={invoiceDate} disabled={locked} onChange={(event) => setInvoiceDate(event.target.value)} /></Field></div>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">{fr ? "Frais" : "Charge"}</th><th className="px-4 py-3 font-medium">{fr ? "Taux (USD/oz)" : "Rate (USD/oz)"}</th><th className="px-4 py-3 font-medium">{fr ? "Quantité (oz)" : "Qty (oz)"}</th><th className="px-4 py-3 text-right font-medium">{fr ? "Montant (USD)" : "Amount (USD)"}</th></tr></thead><tbody>
          <tr className="border-t"><td className="px-4 py-3">{fr ? "Frais de raffinage" : "Refining fee"}</td><td className="px-4 py-3"><Input className="w-32" type="number" step="0.01" value={feeRate} disabled={locked} onChange={(event) => setFeeRate(event.target.value)} /></td><td className="px-4 py-3"><Input className="w-32" type="number" step="0.01" value={feeQuantity} disabled={locked} onChange={(event) => setFeeQuantity(event.target.value)} /></td><td className="px-4 py-3 text-right font-medium">{money(calculation.refiningFee)}</td></tr>
          <tr className="border-t"><td className="px-4 py-3">{fr ? "Frais d’essai" : "Assay fee"}</td><td className="px-4 py-3 text-muted-foreground">—</td><td className="px-4 py-3 text-muted-foreground">forfait</td><td className="px-4 py-3"><Input className="ml-auto w-32" type="number" step="0.01" value={assayFee} disabled={locked} onChange={(event) => setAssayFee(event.target.value)} /></td></tr>
          <tr className="border-t"><td className="px-4 py-3">{fr ? "Manutention et sécurité" : "Handling & security"}</td><td className="px-4 py-3 text-muted-foreground">—</td><td className="px-4 py-3 text-muted-foreground">forfait</td><td className="px-4 py-3"><Input className="ml-auto w-32" type="number" step="0.01" value={handlingFee} disabled={locked} onChange={(event) => setHandlingFee(event.target.value)} /></td></tr>
        </tbody><tfoot className="border-t bg-muted/30 font-semibold"><tr><td className="px-4 py-3" colSpan={3}>{fr ? "Total facturé" : "Invoiced total"}</td><td className="px-4 py-3 text-right text-primary">{money(calculation.total)}</td></tr></tfoot></table></div>
      </RefiningPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <RefiningPanel icon={Calculator} title={fr ? "Rapprochement des frais" : "Fee reconciliation"}>
          <SummaryLine label={fr ? "Frais de raffinage convenus" : "Agreed refining fee"} value={money(AGREED_FEE)} />
          <SummaryLine label={fr ? "Frais de raffinage facturés" : "Invoiced refining fee"} value={money(calculation.refiningFee)} />
          <SummaryLine label={fr ? "Écart sur les frais" : "Fee variance"} value={`${calculation.variance >= 0 ? "+" : "−"}${money(Math.abs(calculation.variance))}`} tone={calculation.feeWithinTolerance ? "success" : "danger"} />
          <SummaryLine label={`${fr ? "Frais accessoires" : "Ancillary charges"} (${fr ? "plafond" : "cap"} 800)`} value={`${money(calculation.ancillary)}${calculation.ancillaryWithinCap ? "" : fr ? " · plafond dépassé" : " · over cap"}`} tone={calculation.ancillaryWithinCap ? "success" : "danger"} />
          <div className="mt-3 flex items-center justify-between border-t pt-4 text-sm font-semibold"><span>{fr ? "Total à régler" : "Total to settle"}</span><span className="text-primary">{money(calculation.total)}</span></div>
          <div className="mt-4"><StatusPill tone={calculation.reconciled ? "success" : "danger"}>{calculation.reconciled ? (fr ? "✓ Conforme aux conditions convenues" : "✓ Reconciled to agreed terms") : (fr ? "⚠ Écart avec les conditions convenues" : "⚠ Variance vs agreed terms")}</StatusPill>{!calculation.reconciled && <p className="mt-2 text-xs text-destructive">{fr ? "La facture doit être contestée avant règlement." : "Query the invoice before settlement."}</p>}</div>
        </RefiningPanel>

        <RefiningPanel icon={Calculator} title={fr ? "Impact sur le coût de revient" : "Landed-cost impact"}>
          <SummaryLine label={fr ? "Raffinage et frais connexes" : "Refining & related charges"} value={money(calculation.total)} />
          <SummaryLine label={fr ? "Or fin vérifié (outturn)" : "Verified fine gold (outturn)"} value={`${OUTTURN_OZ.toLocaleString("en-US")} oz`} />
          <SummaryLine label={fr ? "Ajout au coût de revient" : "Added to cost basis"} value={`${calculation.landedPerOz.toFixed(2)} USD/oz`} />
          <div className="mt-3 flex items-center justify-between border-t pt-4 text-sm font-semibold"><span>{fr ? "Valeur de l’or + frais" : "Gold value + charges"}</span><span className="text-primary">{money(Math.round(calculation.landedTotal), 0)}</span></div>
          <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">{fr ? "Les frais sont incorporés au coût du lot. Ce lot étant non monétaire, le coût complet est porté dans le sous-livre  ; pour l’or monétaire, il alimenterait le coût des réserves." : "Charges are capitalised into the lot cost basis. As this lot is non-monetary, landed cost is carried in ; for monetary gold it would feed the reserve cost basis."}</p>
        </RefiningPanel>
      </div>

      <RefiningPanel icon={Landmark} title={fr ? "Instruction de règlement" : "Settlement instruction"}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><InfoCell label={fr ? "Bénéficiaire" : "Beneficiary"}>Kinshasa Refinery SA</InfoCell><InfoCell label={fr ? "Compte bénéficiaire" : "Beneficiary account"}>•••• 4471 · SWIFT ••••CDKI</InfoCell><InfoCell label={fr ? "Devise" : "Currency"}>USD</InfoCell><InfoCell label={fr ? "Montant" : "Amount"}><span className="text-primary">{money(calculation.total)}</span></InfoCell><InfoCell label={fr ? "Date de valeur (T+2)" : "Value date (T+2)"}>{addDays(invoiceDate, 2)}</InfoCell><InfoCell label={fr ? "Référence" : "Reference"}>GAC-REF-2026-014 · {invoiceNumber || "—"}</InfoCell></div>
        <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">{fr ? "L’émission transmet l’instruction à Règlements (Trésorerie), où le paiement suit ses propres contrôles d’approbation. Cette étape rapproche et comptabilise les frais ; elle ne déplace pas elle-même les fonds." : "On issue, the instruction routes to Settlements (Treasury), where payment follows its own approval controls. This step reconciles and records the charge; it does not itself move funds."}</p>
        <div className="mt-4"><Label htmlFor="settlement-note">{fr ? "Note" : "Note"} <span className="font-normal text-muted-foreground">({fr ? "obligatoire pour contester" : "required to query"})</span></Label><Textarea id="settlement-note" className="mt-2" value={note} disabled={locked} onChange={(event) => setNote(event.target.value)} placeholder={fr ? "Note à la Trésorerie ou motif de contestation…" : "Note for Treasury or reason for querying the invoice…"} />{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</div>
        <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row"><Button variant="outline" disabled={locked} onClick={() => setSaved(true)}><Save className="mr-2 h-4 w-4" />{saved ? (fr ? "Brouillon enregistré" : "Draft saved") : (fr ? "Enregistrer le brouillon" : "Save draft")}</Button><Button variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10" disabled={locked} onClick={queryInvoice}><AlertTriangle className="mr-2 h-4 w-4" />{fr ? "Contester la facture" : "Query invoice"}</Button><Button disabled={locked || !calculation.reconciled} onClick={issueInstruction}><Send className="mr-2 h-4 w-4" />{fr ? "Approuver et transmettre l’instruction" : "Approve & issue settlement instruction"}</Button></div>
      </RefiningPanel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-2">{children}</div></div>;
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return <div className="flex items-start justify-between gap-4 border-b py-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className={`text-right font-medium ${tone === "success" ? "text-emerald-500" : tone === "danger" ? "text-destructive" : ""}`}>{value}</span></div>;
}
