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

type Row={id:string;reference:string;purchase_order_id:string|null;status:string;data:Record<string,any>;created_at:string}
const fetcher=(url:string)=>fetch(url).then(r=>{if(!r.ok)throw new Error();return r.json()})

export function BccReceiptAssaySummary(){
  const {language}=useLanguage(),fr=language==="fr",router=useRouter()
  const {data=[],isLoading,mutate}=useSWR<Row[]>("/api/bcc/receipt-assay",fetcher,{revalidateOnFocus:false})
  const [search,setSearch]=useState("")
  const [remove,setRemove]=useState<Row|null>(null)
  const [deleting,setDeleting]=useState(false)
  const rows=useMemo(()=>data.filter(r=>`${r.reference} ${r.purchase_order_id} ${JSON.stringify(r.data)}`.toLowerCase().includes(search.toLowerCase())),[data,search])
  async function confirmDelete(){if(!remove)return;setDeleting(true);try{const response=await fetch(`/api/bcc/receipt-assay/${remove.id}`,{method:"DELETE"});if(!response.ok)throw new Error();await mutate();setRemove(null);toast.success(fr?"Réception supprimée.":"Receipt deleted.")}catch{toast.error(fr?"Une réception reçue ne peut pas être supprimée.":"A received receipt cannot be deleted.")}finally{setDeleting(false)}}
  return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={fr?"Liste des réceptions":"Receipt List"} subtitle={fr?"Sommaire des réceptions physiques et résultats d’essai":"Physical receipts and assay summary"}/><main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">{fr?"Liste des réceptions":"Receipt List"}</h1><p className="text-sm text-muted-foreground">{fr?"Consulter les réceptions liées aux ordres d’achat approuvés.":"Review receipts linked to approved purchase orders."}</p></div><Button asChild><Link href="/central-bank/receipt-assay?new=1"><FilePlus2 className="mr-2 h-4 w-4"/>{fr?"Nouvelle réception":"New receipt"}</Link></Button></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={fr?"Rechercher…":"Search…"}/></div>
    <Card className="overflow-hidden py-0"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{fr?"Référence":"Reference"}</TableHead><TableHead>{fr?"Ordre d’achat":"Purchase order"}</TableHead><TableHead>{fr?"Réception":"Receipt"}</TableHead><TableHead>{fr?"Poids net":"Net weight"}</TableHead><TableHead>{fr?"Pureté finale":"Final purity"}</TableHead><TableHead>{fr?"Statut":"Status"}</TableHead><TableHead className="w-28"/></TableRow></TableHeader><TableBody>
      {isLoading?<TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow>:rows.length===0?<TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{fr?"Aucune réception enregistrée.":"No receipt recorded."}</TableCell></TableRow>:rows.map(r=>{const d=r.data||{},received=["received","confirmed"].includes(r.status),net=Number(d.netWeightKg??(Number(d.grossWeightKg||0)-Number(d.tareWeightKg||0)));return <TableRow key={r.id} className="cursor-pointer" onClick={()=>router.push(`/central-bank/receipt-assay?recordId=${r.id}&view=1`)}><TableCell className="font-mono font-semibold">{r.reference}</TableCell><TableCell className="font-mono">{r.purchase_order_id||"—"}</TableCell><TableCell>{d.receiptDate||"—"}<div className="text-xs text-muted-foreground">{d.manifestReference||"—"}</div></TableCell><TableCell>{net.toFixed(3)} kg</TableCell><TableCell>{Number(d.finalPurityPercent||0).toFixed(3)} %</TableCell><TableCell><Badge variant={received?"default":"secondary"}>{fr?(received?"Reçu":"Enregistré"):(received?"Received":"Saved")}</Badge></TableCell><TableCell><div className="flex" onClick={e=>e.stopPropagation()}>{received?<Button asChild variant="ghost" size="icon" title={fr?"Télécharger le certificat":"Download certificate"}><a href={`/api/bcc/receipt-assay/${r.id}/pdf?lang=${fr?"fr":"en"}`} download><Download className="h-4 w-4"/></a></Button>:<><Button asChild variant="ghost" size="icon" title={fr?"Modifier":"Edit"}><Link href={`/central-bank/receipt-assay?recordId=${r.id}`}><Pencil className="h-4 w-4"/></Link></Button><Button variant="ghost" size="icon" className="text-destructive" title={fr?"Supprimer":"Delete"} onClick={()=>setRemove(r)}><Trash2 className="h-4 w-4"/></Button></>}</div></TableCell></TableRow>})}
    </TableBody></Table></CardContent></Card>
    <AlertDialog open={!!remove} onOpenChange={open=>!open&&!deleting&&setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{fr?"Supprimer cette réception ?":"Delete this receipt?"}</AlertDialogTitle><AlertDialogDescription>{fr?"Cette action est définitive.":"This action cannot be undone."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>{fr?"Annuler":"Cancel"}</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={event=>{event.preventDefault();confirmDelete()}} className="bg-destructive text-white">{deleting?<Loader2 className="h-4 w-4 animate-spin"/>:(fr?"Supprimer":"Delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></main></div></div></SidebarProvider>
}
