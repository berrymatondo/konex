"use client";

import Link from "next/link";
import useSWR from "swr";
import { Factory, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { StatusPill } from "./refining-shared";

interface RefiningOrder {
  id: string;
  reference: string;
  status: string;
  purchaseOrderReference: string | null;
  lotReference: string | null;
  counterpartyName: string | null;
  refineryName: string | null;
  targetFineness: string;
  inputFineGoldKg: number;
  expectedOutturnKg: number;
  createdAt: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load refining orders");
  return response.json();
};

export function RefiningOrdersList() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const { data = [], error, isLoading, mutate } = useSWR<RefiningOrder[]>("/api/refining-orders", fetcher);

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Factory className="h-5 w-5" /></div>
          <div className="space-y-1">
            <CardTitle>{fr ? "Ordres de raffinage" : "Refining orders"}</CardTitle>
            <CardDescription>{fr ? `${data.length} ordre${data.length > 1 ? "s" : ""} enregistré${data.length > 1 ? "s" : ""}` : `${data.length} saved order${data.length === 1 ? "" : "s"}`}</CardDescription>
          </div>
        </div>
        <CardAction className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => mutate()} disabled={isLoading} aria-label={fr ? "Actualiser la liste" : "Refresh list"}><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">{fr ? "Actualiser" : "Refresh"}</span></Button>
          <Button size="sm" asChild><Link href="/refining-orders/new"><Plus className="h-4 w-4" />{fr ? "Nouvel ordre" : "New order"}</Link></Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>
              {[fr ? "Ordre" : "Order", "PO / Lot", fr ? "Contrepartie" : "Counterparty", fr ? "Raffinerie" : "Refinery", fr ? "Or fin entrant" : "Fine gold in", fr ? "Sortie attendue" : "Expected outturn", fr ? "Créé le" : "Created", fr ? "Statut" : "Status"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}
            </tr></thead>
            <tbody>{data.map((order) => (
              <tr key={order.id} className="border-t transition-colors hover:bg-muted/30">
                <td className="px-4 py-4"><Link href={`/refining-orders/${order.reference}/approval`} className="inline-flex rounded-md bg-primary/10 px-2.5 py-1.5 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/15">{order.reference}</Link></td>
                <td className="px-4 py-3"><div>{order.purchaseOrderReference || "—"}</div>{order.lotReference && <div className="text-xs text-muted-foreground">{order.lotReference}</div>}</td>
                <td className="px-4 py-3">{order.counterpartyName || "—"}</td>
                <td className="px-4 py-3">{order.refineryName || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{order.inputFineGoldKg.toFixed(3)} kg</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{order.expectedOutturnKg.toFixed(3)} kg <span className="font-normal text-muted-foreground">· {order.targetFineness} ‰</span></td>
                <td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString(fr ? "fr-FR" : "en-GB")}</td>
                <td className="px-4 py-3"><StatusPill tone="warning">{order.status === "draft" ? (fr ? "Brouillon" : "Draft") : order.status}</StatusPill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {isLoading && <p className="p-8 text-center text-sm text-muted-foreground">{fr ? "Chargement des ordres…" : "Loading orders…"}</p>}
        {error && <p className="p-8 text-center text-sm text-destructive">{fr ? "Impossible de charger les ordres de raffinage." : "Unable to load refining orders."}</p>}
        {!isLoading && !error && data.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{fr ? "Aucun ordre de raffinage enregistré." : "No refining orders saved yet."}</p>}
      </CardContent>
    </Card>
  );
}
