"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Download, FilePlus2, Loader2, Pencil, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { useLanguage } from "@/lib/i18n/language-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BccPager, BccStatusFilter, useBccPage } from "@/components/bcc/bcc-list-controls"

type Settlement={id:string;reference:string;purchase_order_id:string|null;status:string;data:Record<string,unknown>;created_at:string}
const fetcher=(url:string)=>fetch(url,{cache:"no-store"}).then(async response=>{if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||"Unable to load settlements")}return response.json()})
const number=(value:unknown)=>Number(value||0)

export function BccSettlementsSummary(){
  const {language}=useLanguage(),fr=language==="fr",router=useRouter()
  const {data=[],error,isLoading,mutate}=useSWR<Settlement[]>("/api/bcc/pricing-settlement",fetcher,{revalidateOnMount:true,revalidateOnFocus:true,dedupingInterval:0})
  const [search,setSearch]=useState("")
  const [statusFilter,setStatusFilter]=useState("all")
  const [remove,setRemove]=useState<Settlement|null>(null)
  const [deleting,setDeleting]=useState(false)
  const statuses=useMemo(()=>Array.from(new Set(data.map(row=>row.status))).sort(),[data])
  const rows=useMemo(()=>data.filter(row=>(statusFilter==="all"||row.status===statusFilter)&&`${row.reference} ${row.purchase_order_id} ${row.status} ${JSON.stringify(row.data)}`.toLowerCase().includes(search.toLowerCase())),[data,search,statusFilter])
  const {page,setPage,pageCount,paged,total,pageSize}=useBccPage(rows)
  async function confirmDelete(){if(!remove)return;setDeleting(true);try{const response=await fetch(`/api/bcc/pricing-settlement/${remove.id}`,{method:"DELETE"});if(!response.ok)throw new Error();await mutate();setRemove(null);toast.success(fr?"Règlement supprimé.":"Settlement deleted.")}catch{toast.error(fr?"Un règlement réglé ne peut pas être supprimé.":"A settled record cannot be deleted.")}finally{setDeleting(false)}}
  return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={fr?"Liste des règlements":"Settlement List"} subtitle={fr?"Sommaire des tarifications et règlements":"Pricing and settlement summary"}/><main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">{fr?"Liste des règlements":"Settlement List"}</h1><p className="text-sm text-muted-foreground">{fr?"Consulter les règlements liés aux réceptions confirmées.":"Review settlements linked to confirmed receipts."}</p></div><Button asChild><Link href="/central-bank/settlements/pricing-settlement?new=1"><FilePlus2 className="mr-2 h-4 w-4"/>{fr?"Nouveau règlement":"New settlement"}</Link></Button></div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}} placeholder={fr?"Rechercher…":"Search…"}/></div><BccStatusFilter value={statusFilter} onChange={v=>{setStatusFilter(v);setPage(1)}} statuses={statuses} fr={fr}/></div>
    <Card className="overflow-hidden py-0"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{fr?"Référence":"Reference"}</TableHead><TableHead>{fr?"Ordre d’achat":"Purchase order"}</TableHead><TableHead>{fr?"Prix exécuté":"Executed price"}</TableHead><TableHead>{fr?"Prime / décote":"Premium / discount"}</TableHead><TableHead>{fr?"Taux de change":"Exchange rate"}</TableHead><TableHead>{fr?"Statut":"Status"}</TableHead><TableHead className="w-28"/></TableRow></TableHeader><TableBody>
      {isLoading?<TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow>:error?<TableRow><TableCell colSpan={7} className="h-32 text-center text-destructive"><p>{fr?"Impossible de charger les règlements.":"Unable to load settlements."}</p><Button className="mt-3" variant="outline" onClick={()=>mutate()}>{fr?"Réessayer":"Retry"}</Button></TableCell></TableRow>:rows.length===0?<TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{fr?"Aucun règlement enregistré.":"No settlement recorded."}</TableCell></TableRow>:paged.map(row=>{const d=row.data||{},settled=["settled","confirmed","completed"].includes(row.status);return <TableRow key={row.id} className="cursor-pointer" onClick={()=>router.push(`/central-bank/settlements/pricing-settlement?recordId=${row.id}&view=1`)}><TableCell className="font-mono font-semibold">{row.reference}</TableCell><TableCell className="font-mono">{String(d.purchaseOrderReference||row.purchase_order_id||"—")}</TableCell><TableCell>{number(d.executedPrice).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})} USD/oz</TableCell><TableCell>{number(d.settlementPremium).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})} USD</TableCell><TableCell>{number(d.tradeFx).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})}</TableCell><TableCell><Badge variant={settled?"default":"secondary"}>{fr?(settled?"Réglé":"Enregistré"):(settled?"Settled":"Saved")}</Badge></TableCell><TableCell><div className="flex" onClick={event=>event.stopPropagation()}>{settled?<Button asChild variant="ghost" size="icon" title={fr?"Télécharger le règlement":"Download settlement"}><a href={`/api/bcc/pricing-settlement/${row.id}/pdf?lang=${fr?"fr":"en"}`} download><Download className="h-4 w-4"/></a></Button>:<><Button asChild variant="ghost" size="icon" title={fr?"Modifier":"Edit"}><Link href={`/central-bank/settlements/pricing-settlement?recordId=${row.id}`}><Pencil className="h-4 w-4"/></Link></Button><Button variant="ghost" size="icon" className="text-destructive" title={fr?"Supprimer":"Delete"} onClick={()=>setRemove(row)}><Trash2 className="h-4 w-4"/></Button></>}</div></TableCell></TableRow>})}
    </TableBody></Table><BccPager page={page} pageCount={pageCount} setPage={setPage} total={total} pageSize={pageSize} fr={fr}/></CardContent></Card>
    <AlertDialog open={!!remove} onOpenChange={open=>!open&&!deleting&&setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{fr?"Supprimer ce règlement ?":"Delete this settlement?"}</AlertDialogTitle><AlertDialogDescription>{fr?"Cette action est définitive.":"This action cannot be undone."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>{fr?"Annuler":"Cancel"}</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={event=>{event.preventDefault();confirmDelete()}} className="bg-destructive text-white">{deleting?<Loader2 className="h-4 w-4 animate-spin"/>:(fr?"Supprimer":"Delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></main></div></div></SidebarProvider>
}
