"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Activity, BarChart3, Download, FilePlus2, Loader2, Pencil, Save, Search, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { useLanguage } from "@/lib/i18n/language-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Entity = "purchase-orders" | "receipt-assay" | "pricing-settlement" | "custody" | "valuation" | "monetary-impact" | "reports" | "refining-orders" | "audit"
type Field = { key: string; en: string; fr: string; type?: "number" | "date" | "textarea" | "select"; options?: string[]; required?: boolean }
type RecordRow = { id: string; reference: string; purchase_order_id: string | null; status: string; data: Record<string, string | number>; created_at: string; receipt_confirmed?: boolean; settlement_confirmed?: boolean; custody_confirmed?: boolean }

const FIELDS: Record<Exclude<Entity, "audit">, Field[]> = {
  "purchase-orders": [
    { key: "seller", en: "Approved counterparty", fr: "Contrepartie approuvée", required: true },
    { key: "contractReference", en: "Contract reference", fr: "Référence du contrat", required: true },
    { key: "sourceProvince", en: "Declared source province", fr: "Province d’origine déclarée", type: "select", options: ["Ituri", "South Kivu", "North Kivu", "Haut-Uélé", "Multiple"] },
    { key: "goldType", en: "Gold form", fr: "Forme de l’or", type: "select", options: ["Doré bars", "Refined bars"] },
    { key: "targetKg", en: "Target quantity (kg)", fr: "Quantité cible (kg)", type: "number", required: true },
    { key: "purity", en: "Central purity estimate (%)", fr: "Estimation centrale de pureté (%)", type: "number" },
    { key: "benchmark", en: "Benchmark price (USD/oz)", fr: "Prix de référence (USD/oz)", type: "number" },
    { key: "deliveryFrom", en: "Delivery window start", fr: "Début de livraison", type: "date" },
    { key: "deliveryTo", en: "Delivery window end", fr: "Fin de livraison", type: "date" },
    { key: "vault", en: "Initial receiving vault", fr: "Coffre de réception initial", type: "select", options: ["BCC Vault — Kinshasa", "BCC secure transit facility"] },
    { key: "notes", en: "Instructions / notes", fr: "Instructions / notes", type: "textarea" },
  ],
  "receipt-assay": [
    { key: "receiptDate", en: "Receipt date", fr: "Date de réception", type: "date", required: true },
    { key: "manifestReference", en: "Manifest reference", fr: "Référence du manifeste", required: true },
    { key: "grossWeightKg", en: "Gross weight (kg)", fr: "Poids brut (kg)", type: "number", required: true },
    { key: "netWeightKg", en: "Net weight (kg)", fr: "Poids net (kg)", type: "number" },
    { key: "finalAssay", en: "Final assay (%)", fr: "Titre final (%)", type: "number", required: true },
    { key: "laboratory", en: "Assay laboratory", fr: "Laboratoire d’essai" },
    { key: "certificate", en: "Certificate reference", fr: "Référence du certificat" },
    { key: "varianceReason", en: "Variance explanation", fr: "Explication de l’écart", type: "textarea" },
  ],
  "pricing-settlement": [
    { key: "pricingDate", en: "Pricing date", fr: "Date de fixation", type: "date", required: true },
    { key: "fineGoldKg", en: "Fine gold quantity (kg)", fr: "Quantité d’or fin (kg)", type: "number", required: true },
    { key: "executedPrice", en: "Executed price (USD/oz)", fr: "Prix exécuté (USD/oz)", type: "number", required: true },
    { key: "premiumDiscount", en: "Premium / discount (USD)", fr: "Prime / décote (USD)", type: "number" },
    { key: "fxRate", en: "USD/CDF exchange rate", fr: "Taux de change USD/CDF", type: "number" },
    { key: "paymentMethod", en: "Payment method", fr: "Mode de paiement", type: "select", options: ["SWIFT transfer", "RTGS", "Mixed USD/CDF"] },
    { key: "bankReference", en: "Bank reference", fr: "Référence bancaire" },
    { key: "costs", en: "Controlled costs (USD)", fr: "Coûts contrôlés (USD)", type: "number" },
  ],
  custody: [
    { key: "depositary", en: "Current depositary bank", fr: "Banque dépositaire actuelle", required: true },
    { key: "vaultLocation", en: "Vault / location", fr: "Coffre / emplacement", required: true },
    { key: "custodyAccount", en: "Custody account / portfolio", fr: "Compte de conservation / portefeuille" },
    { key: "custodyModel", en: "Custody model", fr: "Modèle de conservation", type: "select", options: ["Allocated physical custody", "Segregated transit holding", "Unallocated account"] },
    { key: "warehouseReceipt", en: "Warehouse receipt", fr: "Récépissé d’entrepôt" },
    { key: "storageStart", en: "Storage start date", fr: "Début de conservation", type: "date" },
    { key: "legalOwner", en: "Legal owner", fr: "Propriétaire légal" },
    { key: "insurancePolicy", en: "Insurance policy", fr: "Police d’assurance" },
  ],
  valuation: [
    { key: "valuationDate", en: "Valuation date", fr: "Date de valorisation", type: "date", required: true },
    { key: "fineGoldKg", en: "Fine gold held (kg)", fr: "Or fin détenu (kg)", type: "number", required: true },
    { key: "marketPrice", en: "Market price (USD/oz)", fr: "Prix de marché (USD/oz)", type: "number", required: true },
    { key: "bookCost", en: "Book cost (USD)", fr: "Coût comptable (USD)", type: "number" },
    { key: "periodExpenses", en: "Period expenses (USD)", fr: "Charges de la période (USD)", type: "number" },
    { key: "currency", en: "Reporting currency", fr: "Devise de reporting", type: "select", options: ["USD", "CDF"] },
    { key: "treatment", en: "Revaluation posting", fr: "Comptabilisation de la réévaluation", type: "select", options: ["Gold revaluation reserve", "Income statement", "Management view only"] },
  ],
  "monetary-impact": [
    { key: "scenario", en: "Scenario name", fr: "Nom du scénario", required: true },
    { key: "purchaseProgrammeUsd", en: "Purchase programme (USD)", fr: "Programme d’achat (USD)", type: "number", required: true },
    { key: "sterilisationRate", en: "Sterilisation rate (%)", fr: "Taux de stérilisation (%)", type: "number" },
    { key: "reserveRatio", en: "Reserve adequacy ratio (%)", fr: "Ratio d’adéquation des réserves (%)", type: "number" },
    { key: "cdfLiquidity", en: "CDF liquidity impact", fr: "Impact sur la liquidité CDF", type: "number" },
    { key: "notes", en: "Assumptions", fr: "Hypothèses", type: "textarea" },
  ],
  reports: [
    { key: "reportType", en: "Report pack", fr: "Dossier de rapport", type: "select", options: ["Governor pack", "Gold reserve committee", "Operations service", "Finance service", "Risk & compliance", "Audit service"] },
    { key: "reportDate", en: "Reporting date", fr: "Date de reporting", type: "date", required: true },
    { key: "period", en: "Reporting period", fr: "Période", type: "select", options: ["Month-end", "Weekly executive brief", "Quarter-end", "Year-to-date", "Ad hoc"] },
    { key: "currency", en: "Reporting currency", fr: "Devise", type: "select", options: ["USD", "CDF"] },
    { key: "scope", en: "Portfolio scope", fr: "Périmètre du portefeuille" },
    { key: "confidentiality", en: "Confidentiality", fr: "Confidentialité", type: "select", options: ["Restricted", "Confidential", "Internal"] },
  ],
  "refining-orders": [
    { key: "refinery", en: "Approved refinery", fr: "Raffinerie approuvée", required: true },
    { key: "inputWeightKg", en: "Input weight (kg)", fr: "Poids d’entrée (kg)", type: "number", required: true },
    { key: "inputFineness", en: "Input fineness (‰)", fr: "Titre d’entrée (‰)", type: "number" },
    { key: "targetFineness", en: "Target fineness (‰)", fr: "Titre cible (‰)", type: "number", required: true },
    { key: "dispatchDate", en: "Dispatch date", fr: "Date d’expédition", type: "date" },
    { key: "expectedOutturn", en: "Expected outturn (kg)", fr: "Production attendue (kg)", type: "number" },
    { key: "instructions", en: "Refining instructions", fr: "Instructions de raffinage", type: "textarea" },
  ],
}

const TITLES: Record<Entity, [string, string, string, string]> = {
  "purchase-orders": ["Purchase Orders", "Ordres d’achat", "Create and approve central-bank gold purchase orders", "Créer et approuver les ordres d’achat d’or de la banque centrale"],
  "receipt-assay": ["Receipt & Assay", "Réception et essai", "Confirm intake, weight and final purity", "Confirmer la réception, le poids et la pureté finale"],
  "pricing-settlement": ["Pricing & Settlement", "Tarification et règlement", "Record executed price, payment and controlled costs", "Enregistrer le prix exécuté, le paiement et les coûts contrôlés"],
  custody: ["Custody Confirmation", "Confirmation de conservation", "Confirm title, allocation and reserve eligibility", "Confirmer le titre, l’allocation et l’éligibilité aux réserves"],
  valuation: ["Valuation & P&L", "Valorisation et résultat", "Measure market value and performance attribution", "Mesurer la valeur de marché et l’attribution de performance"],
  "monetary-impact": ["Monetary impact", "Impact monétaire", "Model liquidity and reserve adequacy scenarios", "Modéliser la liquidité et l’adéquation des réserves"],
  reports: ["Management reports", "Rapports de gestion", "Generate governed reporting packs", "Produire des dossiers de reporting gouvernés"],
  "refining-orders": ["Refining Orders", "Ordres de raffinage", "Manage refining routes linked to BCC orders", "Gérer les parcours de raffinage liés aux ordres BCC"],
  audit: ["Audit Log", "Journal d’audit", "Trace every BCC lifecycle write", "Tracer chaque écriture du cycle de vie BCC"],
}

export function BccWorkspace({ entity, readOnly = false }: { entity: Entity; readOnly?: boolean }) {
  const { language } = useLanguage(); const fr = language === "fr"
  const { data = [], isLoading, mutate } = useSWR<RecordRow[]>(`/api/bcc/${entity}`, (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json() }))
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [search, setSearch] = useState("")
  const [status, setStatus] = useState("draft"); const [purchaseOrderId, setPurchaseOrderId] = useState(""); const [form, setForm] = useState<Record<string, string>>({})
  const title = TITLES[entity]
  const fields = entity === "audit" ? [] : FIELDS[entity]
  const filtered = useMemo(() => data.filter(r => `${r.reference} ${r.status} ${JSON.stringify(r.data)}`.toLowerCase().includes(search.toLowerCase())), [data, search])
  const kpis = useMemo(() => ({ total: data.length, approved: data.filter(r => ["approved", "confirmed", "completed", "generated"].includes(r.status)).length, drafts: data.filter(r => r.status === "draft").length }), [data])

  async function save() {
    if (fields.some(f => f.required && !form[f.key])) { toast.error(fr ? "Complétez les champs obligatoires." : "Complete all required fields."); return }
    setSaving(true)
    try {
      const response = await fetch(`/api/bcc/${entity}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, purchaseOrderId: purchaseOrderId || null, data: form }) })
      if (!response.ok) throw new Error()
      await mutate(); setOpen(false); setForm({}); setPurchaseOrderId(""); setStatus("draft")
      toast.success(fr ? "Écriture BCC enregistrée." : "BCC record saved.")
    } catch { toast.error(fr ? "Enregistrement impossible." : "Unable to save record.") } finally { setSaving(false) }
  }

  function exportCsv() {
    const csv = ["reference,status,purchase_order,created_at", ...filtered.map(r => [r.reference,r.status,r.purchase_order_id || "",r.created_at].join(","))].join("\n")
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`bcc-${entity}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={BarChart3} label={fr ? "Total" : "Total records"} value={kpis.total} />
      <Metric icon={ShieldCheck} label={fr ? "Finalisés" : "Finalised"} value={kpis.approved} />
      <Metric icon={Activity} label={fr ? "Brouillons" : "Drafts"} value={kpis.drafts} />
    </div>
    <Card><CardHeader className="gap-4 md:flex-row md:items-start md:justify-between"><div><CardTitle>{fr ? title[1] : title[0]}</CardTitle><CardDescription>{fr ? title[3] : title[2]}</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>{entity !== "audit" && !readOnly && <Button onClick={() => setOpen(true)}><FilePlus2 className="mr-2 h-4 w-4" />{fr ? "Nouvelle écriture" : "New record"}</Button>}</div></CardHeader>
      <CardContent><div className="relative mb-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={fr ? "Rechercher…" : "Search…"}/></div>
      <Table><TableHeader><TableRow><TableHead>{fr ? "Référence" : "Reference"}</TableHead><TableHead>{fr ? "Ordre BCC lié" : "Linked BCC order"}</TableHead><TableHead>{fr ? "Détail" : "Detail"}</TableHead><TableHead>{fr ? "Statut" : "Status"}</TableHead><TableHead>{fr ? "Créé le" : "Created"}</TableHead></TableRow></TableHeader><TableBody>
        {isLoading ? <TableRow><TableCell colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{fr ? "Aucune écriture BCC." : "No BCC records."}</TableCell></TableRow> : filtered.map(r => <TableRow key={r.id}><TableCell className="font-mono font-medium">{r.reference}</TableCell><TableCell>{r.purchase_order_id || "—"}</TableCell><TableCell className="max-w-[320px] truncate">{Object.values(r.data).filter(Boolean).slice(0,2).join(" · ") || "—"}</TableCell><TableCell><Badge variant={r.status === "draft" ? "secondary" : "default"}>{r.status}</Badge></TableCell><TableCell>{new Date(r.created_at).toLocaleDateString(fr ? "fr-FR" : "en-GB")}</TableCell></TableRow>)}
      </TableBody></Table></CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{fr ? `Nouvelle écriture — ${title[1]}` : `New record — ${title[0]}`}</DialogTitle><DialogDescription>{fr ? "Les données sont enregistrées dans le registre BCC dédié." : "Data is saved to the dedicated BCC ledger."}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>{fr ? "Référence du PO BCC lié" : "Linked BCC PO reference"}</Label><Input value={purchaseOrderId} onChange={e=>setPurchaseOrderId(e.target.value)} placeholder="BCC-PO-2026-…"/></div><div className="space-y-2"><Label>{fr ? "Statut" : "Status"}</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["draft","submitted","approved","confirmed","completed","generated"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      {fields.map(field => <div key={field.key} className={`space-y-2 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}><Label htmlFor={field.key}>{fr ? field.fr : field.en}{field.required ? " *" : ""}</Label>{field.type === "textarea" ? <Textarea id={field.key} value={form[field.key]||""} onChange={e=>setForm({...form,[field.key]:e.target.value})}/> : field.type === "select" ? <Select value={form[field.key]||""} onValueChange={v=>setForm({...form,[field.key]:v})}><SelectTrigger id={field.key}><SelectValue placeholder={fr ? "Sélectionner" : "Select"}/></SelectTrigger><SelectContent>{field.options?.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select> : <Input id={field.key} type={field.type || "text"} value={form[field.key]||""} onChange={e=>setForm({...form,[field.key]:e.target.value})}/>}</div>)}</div>
      <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>{fr ? "Annuler" : "Cancel"}</Button><Button onClick={save} disabled={saving}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}{fr ? "Enregistrer" : "Save"}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Metric({icon:Icon,label,value}:{icon:React.ElementType;label:string;value:number}) { return <Card><CardContent className="flex items-center gap-4 py-5"><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div></CardContent></Card> }

const SECTION_ENTITY = {
  transactions: "purchase-orders",
  "purchase-orders": "purchase-orders", "receipt-assay": "receipt-assay", "pricing-settlement": "pricing-settlement",
  custody: "custody", valuation: "valuation", "monetary-impact": "monetary-impact", reports: "reports",
  "refining-orders": "refining-orders", audit: "audit",
} as const

export function BccSectionPage({ section }: { section: "dashboard" | keyof typeof SECTION_ENTITY }) {
  const { language } = useLanguage(); const fr = language === "fr"
  const entity = section === "dashboard" ? null : SECTION_ENTITY[section]
  const heading = section === "transactions"
    ? ["Transactions", "Transactions", "List of BCC purchase orders", "Liste des ordres d’achat BCC"]
    : entity ? TITLES[entity] : ["Dashboard", "Tableau de bord", "BCC gold reserve lifecycle overview", "Vue d’ensemble du cycle de vie des réserves d’or BCC"]
  return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={fr ? heading[1] : heading[0]} subtitle={fr ? heading[3] : heading[2]}/><main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl">{section === "transactions" ? <BccTransactions/> : entity ? <BccWorkspace entity={entity}/> : <BccDashboard/>}</div></main></div></div></SidebarProvider>
}

function BccTransactions() {
  const { language } = useLanguage(); const fr = language === "fr"
  const router = useRouter()
  const fetcher = (url:string) => fetch(url).then(r => { if(!r.ok) throw new Error(); return r.json() })
  const { data: orders = [], isLoading, mutate } = useSWR<RecordRow[]>("/api/bcc/transactions", fetcher, { keepPreviousData: true, revalidateOnFocus: false, dedupingInterval: 15_000 })
  const [latestTransaction, setLatestTransaction] = useState<RecordRow | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<RecordRow | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<RecordRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const displayedOrders = useMemo(() => latestTransaction ? [latestTransaction, ...orders.filter(order => order.id !== latestTransaction.id)] : orders, [latestTransaction, orders])
  useEffect(() => {
    const message = window.sessionStorage.getItem("bcc-transaction-toast")
    if (message) {
      window.sessionStorage.removeItem("bcc-transaction-toast")
      toast.success(message)
    }
    const latest = window.sessionStorage.getItem("bcc-latest-transaction")
    if (latest) {
      window.sessionStorage.removeItem("bcc-latest-transaction")
      try { setLatestTransaction(JSON.parse(latest) as RecordRow) } catch { /* Ignore malformed transient data. */ }
    }
  }, [])
  const lifecycleBadge = (label:string, confirmed:boolean) => <Badge className={confirmed ? "border-0 bg-emerald-500/10 text-emerald-400" : "border-border bg-muted text-muted-foreground"} variant="outline">{label} · {confirmed ? (fr?"Confirmé":"Confirmed") : (fr?"En attente":"Pending")}</Badge>
  async function confirmDelete() { if(!deleteOrder)return; setDeleting(true); try { const response=await fetch(`/api/bcc/purchase-orders/${deleteOrder.id}`,{method:"DELETE"}); if(!response.ok)throw new Error(); setLatestTransaction(current=>current?.id===deleteOrder.id?null:current); await mutate(); toast.success(fr?"Ordre d’achat supprimé.":"Purchase order deleted."); setDeleteOrder(null) } catch { toast.error(fr?"Suppression impossible.":"Unable to delete the purchase order.") } finally { setDeleting(false) } }
  return <div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold sm:text-2xl">{fr?"Ordres d’achat":"Purchase orders"}</h1><p className="text-sm text-muted-foreground">{fr?"Consulter les transactions et leur progression dans le cycle de vie":"Review transactions and their lifecycle progress"}</p></div><Button asChild className="w-full sm:w-auto"><Link href="/central-bank/purchase-orders?new=1"><FilePlus2 className="mr-2 h-4 w-4"/>{fr?"Nouvel ordre d’achat":"New purchase order"}</Link></Button></div><Card className="gap-0 py-0 overflow-hidden"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Ordre d’achat":"Purchase order"}</TableHead>
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Contrepartie":"Counterparty"}</TableHead>
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Cible":"Target"}</TableHead>
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Fenêtre de livraison":"Delivery window"}</TableHead>
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Enregistrements du cycle":"Lifecycle records"}</TableHead>
    <TableHead className="h-14 px-4 uppercase tracking-wide">{fr?"Statut":"Status"}</TableHead><TableHead className="w-[110px]"/>
  </TableRow></TableHeader><TableBody>{isLoading && displayedOrders.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow> : displayedOrders.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{fr?"Aucun ordre d’achat enregistré.":"No purchase orders recorded."}</TableCell></TableRow> : displayedOrders.map(order => {
    const d=order.data||{}; const receipt=Boolean(order.receipt_confirmed), settlement=Boolean(order.settlement_confirmed), held=Boolean(order.custody_confirmed)
    return <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={()=>router.push(`/central-bank/purchase-orders?recordId=${encodeURIComponent(order.id)}&view=1`)}><TableCell className="px-4 py-5 align-top"><div className="font-mono font-semibold text-foreground">{order.reference}</div><div className="mt-1 max-w-[160px] whitespace-normal text-xs text-muted-foreground">{String(d.contractReference||"—")}</div></TableCell>
      <TableCell className="px-4 py-5 align-top"><div className="max-w-[240px] whitespace-normal font-medium">{String(d.seller||"—")}</div><div className="mt-1 text-sm text-muted-foreground">{String(d.sourceProvince||"—")}</div></TableCell>
      <TableCell className="px-4 py-5 align-top font-mono font-medium">{Number(d.targetKg||0).toFixed(3)}<div>kg</div></TableCell>
      <TableCell className="px-4 py-5 align-top"><span className="whitespace-normal">{String(d.deliveryFrom||"—")} → {String(d.deliveryTo||"—")}</span></TableCell>
      <TableCell className="px-4 py-5 align-top"><div className="flex max-w-[420px] flex-wrap gap-2">{lifecycleBadge("Receipt",receipt)}{lifecycleBadge("Settlement",settlement)}{lifecycleBadge("Custody",held)}</div></TableCell>
      <TableCell className="px-4 py-5 align-top"><Badge className={order.status === "approved" ? "border-0 bg-emerald-500/10 text-emerald-400" : "capitalize"} variant={order.status === "draft" ? "outline" : "secondary"}>{fr ? ({draft:"Brouillon",saved:"Enregistré",approved:"Approuvé"}[order.status]||order.status) : order.status}</Badge></TableCell>
      <TableCell className="px-4 py-5 align-top"><div className="flex gap-1" onClick={event=>event.stopPropagation()}>{order.status === "approved" ? <Button asChild variant="ghost" size="icon" title={fr?"Télécharger l’offre d’achat":"Download purchase offer"}><a href={`/api/bcc/purchase-orders/${encodeURIComponent(order.id)}/pdf?lang=${fr?"fr":"en"}`} download><Download className="h-4 w-4"/><span className="sr-only">{fr?"Télécharger l’offre d’achat":"Download purchase offer"}</span></a></Button> : <Button asChild variant="ghost" size="icon" title={fr?"Modifier":"Edit"}><Link href={`/central-bank/purchase-orders?recordId=${encodeURIComponent(order.id)}`}><Pencil className="h-4 w-4"/><span className="sr-only">{fr?"Modifier":"Edit"}</span></Link></Button>}{order.status !== "approved" && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={fr?"Supprimer":"Delete"} onClick={()=>setDeleteOrder(order)}><Trash2 className="h-4 w-4"/><span className="sr-only">{fr?"Supprimer":"Delete"}</span></Button>}</div></TableCell></TableRow>
  })}</TableBody></Table></Card>
  <Dialog open={Boolean(selectedOrder)} onOpenChange={open=>{if(!open)setSelectedOrder(null)}}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{selectedOrder?.reference}</DialogTitle><DialogDescription>{fr?"Détails de l’ordre d’achat BCC":"BCC purchase order details"}</DialogDescription></DialogHeader>{selectedOrder&&<div className="grid gap-4 sm:grid-cols-2">{Object.entries(selectedOrder.data||{}).filter(([,value])=>value!==""&&value!=null).map(([key,value])=><div key={key} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g," $1")}</p><p className="mt-1 break-words text-sm font-medium">{String(value)}</p></div>)}</div>}<DialogFooter><Button variant="outline" onClick={()=>setSelectedOrder(null)}>{fr?"Fermer":"Close"}</Button>{selectedOrder&&<Button asChild><Link href={`/central-bank/purchase-orders?recordId=${encodeURIComponent(selectedOrder.id)}`}>{fr?"Modifier":"Edit"}</Link></Button>}</DialogFooter></DialogContent></Dialog>
  <AlertDialog open={Boolean(deleteOrder)} onOpenChange={open=>{if(!open&&!deleting)setDeleteOrder(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{fr?"Supprimer cet ordre d’achat ?":"Delete this purchase order?"}</AlertDialogTitle><AlertDialogDescription>{fr?`L’ordre ${deleteOrder?.reference||""} et ses données de cycle associées seront définitivement supprimés.`:`Order ${deleteOrder?.reference||""} and its related lifecycle data will be permanently deleted.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>{fr?"Annuler":"Cancel"}</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={event=>{event.preventDefault();confirmDelete()}} className="bg-destructive text-white hover:bg-destructive/90">{deleting?(fr?"Suppression…":"Deleting…"):(fr?"Supprimer":"Delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function BccDashboard() {
  const { language } = useLanguage(); const fr = language === "fr"
  const entities: Entity[] = ["purchase-orders","receipt-assay","pricing-settlement","custody","valuation","refining-orders"]
  const { data: counts = {} } = useSWR<Record<string, number>>("bcc-dashboard-counts", async () => {
    const result = await Promise.all(entities.map(async entity => [entity, (await fetch(`/api/bcc/${entity}`).then(r => r.json())).length] as const))
    return Object.fromEntries(result)
  })
  const total = Object.values(counts).reduce((sum,value)=>sum+value,0)
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Metric icon={BarChart3} label={fr?"Écritures du portefeuille":"Portfolio records"} value={total}/><Metric icon={ShieldCheck} label={fr?"Étapes contrôlées":"Controlled stages"} value={5}/><Metric icon={Activity} label={fr?"Registres BCC":"BCC ledgers"} value={9}/></div><Card><CardHeader><CardTitle>{fr?"Cycle de vie de l’or":"Gold lifecycle"}</CardTitle><CardDescription>{fr?"Progression des écritures persistées par étape BCC":"Persisted BCC records by lifecycle stage"}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">{entities.map(entity=><div key={entity} className="rounded-lg border bg-muted/20 p-4"><p className="text-sm font-medium">{fr ? TITLES[entity][1] : TITLES[entity][0]}</p><p className="mt-2 text-3xl font-semibold text-primary">{counts[entity] ?? 0}</p><p className="text-xs text-muted-foreground">{fr?"écritures enregistrées":"saved records"}</p></div>)}</CardContent></Card></div>
}
