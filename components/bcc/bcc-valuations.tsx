"use client"

import {useMemo,useState} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import useSWR from "swr"
import {FilePlus2,Loader2,Pencil,Search,Trash2} from "lucide-react"
import {toast} from "sonner"
import {AppHeader} from "@/components/app-header"
import {AppSidebar} from "@/components/app-sidebar"
import {SidebarProvider} from "@/components/sidebar-provider"
import {useLanguage} from "@/lib/i18n/language-context"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table"

type Row={id:string;reference:string;purchase_order_id:string|null;status:string;data:Record<string,unknown>}
const fetcher=(url:string)=>fetch(url,{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error();return response.json()})
const value=(input:unknown)=>Number(input||0)
const money=(input:unknown)=>`${value(input).toLocaleString("en-US",{maximumFractionDigits:0})} USD`

export function BccValuationsSummary(){
 const {language}=useLanguage(),fr=language==="fr",router=useRouter()
 const {data=[],error,isLoading,mutate}=useSWR<Row[]>("/api/bcc/valuation",fetcher,{revalidateOnFocus:true})
 const [search,setSearch]=useState("")
 const rows=useMemo(()=>data.filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase())),[data,search])
 async function remove(row:Row){if(!confirm(fr?"Supprimer cette valorisation ?":"Delete this valuation?"))return;const response=await fetch(`/api/bcc/valuation/${row.id}`,{method:"DELETE"});if(response.ok){await mutate();toast.success(fr?"Valorisation supprimée.":"Valuation deleted.")}else toast.error(fr?"Suppression impossible.":"Unable to delete.")}
 return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={fr?"Valorisations":"Valuations"} subtitle={fr?"Liste des valorisations BCC":"BCC valuation records"}/><main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-[1600px] space-y-6">
  <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">{fr?"Valorisations":"Valuations"}</h1><p className="text-sm text-muted-foreground">{fr?"Consulter la contribution de chaque ordre au portefeuille.":"Review each order's portfolio contribution."}</p></div><Button asChild><Link href="/central-bank/valuation?new=1"><FilePlus2 className="mr-2 h-4 w-4"/>{fr?"Nouvelle valorisation":"New valuation"}</Link></Button></div>
  <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={event=>setSearch(event.target.value)} placeholder={fr?"Rechercher…":"Search…"}/></div>
  <Card className="overflow-hidden"><CardHeader className="flex flex-row items-start justify-between gap-4 border-b"><div><CardTitle>{fr?"Contribution du portefeuille par ordre":"Order-level portfolio contribution"}</CardTitle><CardDescription className="mt-2">{fr?"Données consolidées de l’ordre, de la réception, du règlement et de la conservation.":"Consolidated purchase order, receipt, settlement and custody data."}</CardDescription></div><Badge variant="outline" className="whitespace-nowrap font-mono">{fr?`TOTAL PORTEFEUILLE — ${rows.length} ORDRE${rows.length>1?"S":""}`:`PORTFOLIO TOTAL — ${rows.length} ORDER${rows.length===1?"":"S"}`}</Badge></CardHeader>
  <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="min-w-64">{fr?"Ordre / contrepartie":"Order / counterparty"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Or fin":"Fine gold"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Contrepartie d’achat":"Purchase consideration"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Coût comptable capitalisé":"Capitalized book cost"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Valeur brute de marché":"Gross market value"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Charges de la période":"Period expenses"}</TableHead><TableHead className="whitespace-nowrap text-right">{fr?"Résultat net":"Net result"}</TableHead><TableHead>{fr?"Éligibilité":"Eligibility"}</TableHead><TableHead/></TableRow></TableHeader>
  <TableBody>{isLoading?<TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="mx-auto animate-spin"/></TableCell></TableRow>:error||!rows.length?<TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">{fr?"Aucune valorisation.":"No valuation."}</TableCell></TableRow>:rows.map(row=>{const data=row.data||{},net=value(data.netResult),eligibility=String(data.eligibility||"");return <TableRow key={row.id} className="cursor-pointer bg-muted/20 hover:bg-muted/50" onClick={()=>router.push(`/central-bank/valuation?recordId=${row.id}&view=1`)}><TableCell><div className="font-semibold">{String(data.purchaseOrderReference||row.purchase_order_id||"—")}{data.lotReference?` · ${String(data.lotReference)}`:""}</div><div className="text-xs text-muted-foreground">{String(data.counterparty||row.reference)}</div></TableCell><TableCell className="whitespace-nowrap text-right font-mono">{value(data.fineGoldKg).toLocaleString(fr?"fr-FR":"en-US",{minimumFractionDigits:3,maximumFractionDigits:3})} kg</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{money(data.purchaseConsideration)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{money(data.bookCost)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{money(data.marketValue)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{money(data.periodExpenses)}</TableCell><TableCell className={`whitespace-nowrap text-right font-mono font-medium ${net>=0?"text-emerald-500":"text-destructive"}`}>{net>=0?"+":"−"}{money(Math.abs(net))}</TableCell><TableCell className="whitespace-nowrap"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${eligibility.toLowerCase()==="eligible"?"bg-emerald-500":"bg-amber-400"}`}/>{eligibility||(fr?"À confirmer":"Pending")}</TableCell><TableCell><div className="flex" onClick={event=>event.stopPropagation()}><Button asChild variant="ghost" size="icon"><Link href={`/central-bank/valuation?recordId=${row.id}`}><Pencil className="h-4 w-4"/></Link></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={()=>remove(row)}><Trash2 className="h-4 w-4"/></Button></div></TableCell></TableRow>})}</TableBody></Table></div></CardContent></Card>
 </div></main></div></div></SidebarProvider>
}
