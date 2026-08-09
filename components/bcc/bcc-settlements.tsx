"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { FilePlus2, Loader2, Search } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { useLanguage } from "@/lib/i18n/language-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Settlement={id:string;reference:string;purchase_order_id:string|null;status:string;data:Record<string,unknown>;created_at:string}
const fetcher=(url:string)=>fetch(url,{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error("Unable to load settlements");return response.json()})
const number=(value:unknown)=>Number(value||0)

export function BccSettlementsSummary(){
  const {language}=useLanguage(),fr=language==="fr"
  const {data=[],error,isLoading,mutate}=useSWR<Settlement[]>("/api/bcc/pricing-settlement",fetcher,{revalidateOnMount:true,revalidateOnFocus:true,dedupingInterval:0})
  const [search,setSearch]=useState("")
  const rows=useMemo(()=>data.filter(row=>`${row.reference} ${row.purchase_order_id} ${row.status} ${JSON.stringify(row.data)}`.toLowerCase().includes(search.toLowerCase())),[data,search])
  return <SidebarProvider><div className="flex h-screen"><AppSidebar/><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppHeader title={fr?"Règlements":"Settlements"} subtitle={fr?"Liste des tarifications et règlements BCC":"BCC pricing and settlement records"}/><main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">{fr?"Règlements":"Settlements"}</h1><p className="text-sm text-muted-foreground">{fr?"Consulter les tarifications et règlements liés aux réceptions BCC.":"Review pricing and settlements linked to BCC receipts."}</p></div><Button asChild><Link href="/central-bank/pricing-settlement?new=1"><FilePlus2 className="mr-2 h-4 w-4"/>{fr?"Nouveau règlement":"New settlement"}</Link></Button></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={event=>setSearch(event.target.value)} placeholder={fr?"Rechercher…":"Search…"}/></div>
    <Card className="overflow-hidden py-0"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{fr?"Référence":"Reference"}</TableHead><TableHead>{fr?"Ordre / réception":"Order / receipt"}</TableHead><TableHead>{fr?"Prix exécuté":"Executed price"}</TableHead><TableHead>{fr?"Prime / décote":"Premium / discount"}</TableHead><TableHead>{fr?"Taux de change":"Exchange rate"}</TableHead><TableHead>{fr?"Statut":"Status"}</TableHead></TableRow></TableHeader><TableBody>
      {isLoading?<TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow>:error?<TableRow><TableCell colSpan={6} className="h-32 text-center text-destructive"><p>{fr?"Impossible de charger les règlements.":"Unable to load settlements."}</p><Button className="mt-3" variant="outline" onClick={()=>mutate()}>{fr?"Réessayer":"Retry"}</Button></TableCell></TableRow>:rows.length===0?<TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">{fr?"Aucun règlement enregistré.":"No settlement recorded."}</TableCell></TableRow>:rows.map(row=>{const d=row.data||{},confirmed=["confirmed","completed","received"].includes(row.status);return <TableRow key={row.id}><TableCell className="font-mono font-semibold">{row.reference}</TableCell><TableCell className="font-mono">{row.purchase_order_id||"—"}</TableCell><TableCell>{number(d.executedPrice).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})} USD/oz</TableCell><TableCell>{number(d.premiumDiscount??d.settlementPremium).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})} USD</TableCell><TableCell>{number(d.fxRate??d.tradeFx).toLocaleString(fr?"fr-FR":"en-GB",{minimumFractionDigits:2})}</TableCell><TableCell><Badge variant={confirmed?"default":"secondary"}>{fr?(confirmed?"Confirmé":"Enregistré"):(confirmed?"Confirmed":"Saved")}</Badge></TableCell></TableRow>})}
    </TableBody></Table></CardContent></Card>
  </div></main></div></div></SidebarProvider>
}
