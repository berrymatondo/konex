"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  FileText,
  ArrowLeftRight,
  CheckCircle2,
  PieChart,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Shape returned by /api/purchase-orders (already scoped to the counterparty).
interface PurchaseOrder {
  id: string;
  counterpartyName: string;
  status: string;
  estimatedWeightKg: number | string;
  goldType: string;
  assayRange: string | null;
  incoterms: string;
  deliveryVaultId: string;
  expectedDispatchDate: string | null;
  totalEstimatedValue: number | string | null;
  currency: string;
  purityFactor: number | string | null;
  trackingId: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const numberFmt = new Intl.NumberFormat("fr-FR");

function formatCurrency(value: number | string | null, currency = "USD") {
  const n = Number(value || 0);
  return `${currency} ${numberFmt.format(Math.round(n))}`;
}

function formatWeight(value: number | string | null) {
  const n = Number(value || 0);
  return `${numberFmt.format(n)} kg`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Maps an internal PO status to a counterparty-facing label, tone and bucket.
type StatusTone = "toHandle" | "negotiation" | "sent" | "pending" | "closed" | "delivered" | "declined" | "draft";

function counterpartyStatus(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "submitted":
    case "pending_compliance":
    case "pending_finance":
      return { label: "À traiter", tone: "toHandle" };
    case "approved":
      return { label: "En attente BCC", tone: "pending" };
    case "in_transit":
      return { label: "Expédition", tone: "negotiation" };
    case "delivered":
      return { label: "Livrée", tone: "delivered" };
    case "completed":
      return { label: "Clôturée", tone: "closed" };
    case "rejected":
      return { label: "Déclinée", tone: "declined" };
    default:
      return { label: "Brouillon", tone: "draft" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = counterpartyStatus(status);
  const toneClass: Record<StatusTone, string> = {
    toHandle: "border-warning/30 bg-warning/10 text-warning",
    negotiation: "border-info/30 bg-info/10 text-info",
    sent: "border-accent/30 bg-accent/10 text-accent",
    pending: "border-success/30 bg-success/10 text-success",
    closed: "border-muted-foreground/30 bg-muted text-muted-foreground",
    delivered: "border-success/30 bg-success/10 text-success",
    declined: "border-destructive/30 bg-destructive/10 text-destructive",
    draft: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", toneClass[tone])}>
      {label}
    </Badge>
  );
}

function reference(po: PurchaseOrder) {
  return po.trackingId || `PO-${po.id.slice(0, 8).toUpperCase()}`;
}

function purityRange(po: PurchaseOrder) {
  if (po.assayRange) return po.assayRange;
  const p = Number(po.purityFactor || 0) * 100;
  return p > 0 ? `${p.toFixed(0)} %` : "—";
}

// Map raw gold-type keys (e.g. "dore_bars") to human-readable French labels.
const GOLD_TYPE_LABELS: Record<string, string> = {
  dore_bars: "Lingots Doré",
  refined_bars: "Lingots Raffinés",
  gold_dust: "Poudre d'Or",
  scrap_gold: "Or de Récupération",
};

function goldTypeLabel(goldType: string | null | undefined) {
  if (!goldType) return "—";
  return GOLD_TYPE_LABELS[goldType] || goldType;
}

const ACTIVE_STATUSES = ["submitted", "pending_compliance", "pending_finance", "approved", "in_transit"];
const HISTORY_STATUSES = ["delivered", "completed", "rejected"];

type HistoryFilter = "all" | "accepted" | "declined" | "closed" | "expired";

export function CounterpartyDashboard() {
  const { data, isLoading } = useSWR<PurchaseOrder[]>("/api/purchase-orders", fetcher);
  const orders = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 5;

  // Derived KPIs from real, counterparty-scoped purchase orders.
  const toHandle = orders.filter((o) =>
    ["submitted", "pending_compliance", "pending_finance"].includes(o.status)
  );
  const inProgress = orders.filter((o) => ["approved", "in_transit"].includes(o.status));
  const now = new Date();
  const acceptedThisMonth = orders.filter((o) => {
    if (!["approved", "delivered", "completed"].includes(o.status)) return false;
    const d = new Date(o.approvedAt || o.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const acceptedVolume = acceptedThisMonth.reduce((sum, o) => sum + Number(o.estimatedWeightKg || 0), 0);
  const respondedCount = orders.filter((o) => o.status !== "draft" && !toHandle.includes(o)).length;
  const responseRate = orders.length > 0 ? Math.round((respondedCount / orders.length) * 100) : 0;

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const priorityOrder = toHandle[0] || activeOrders[0];

  // Recent activity feed derived from the latest order updates.
  const recentActivity = [...orders]
    .sort(
      (a, b) =>
        new Date(b.approvedAt || b.submittedAt || b.createdAt).getTime() -
        new Date(a.approvedAt || a.submittedAt || a.createdAt).getTime()
    )
    .slice(0, 3);

  const historyOrders = orders.filter((o) => HISTORY_STATUSES.includes(o.status));
  const filteredHistory = historyOrders.filter((o) => {
    switch (historyFilter) {
      case "accepted":
        return o.status === "delivered" || o.status === "completed";
      case "declined":
        return o.status === "rejected";
      case "closed":
        return o.status === "completed";
      case "expired":
        return false;
      default:
        return true;
    }
  });
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const pagedHistory = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FileText}
          iconClass="text-warning"
          label="Demandes à traiter"
          value={toHandle.length}
          hint={
            toHandle.length > 0
              ? `${toHandle.length} en attente de votre traitement`
              : "Aucune demande en attente"
          }
        />
        <KpiCard
          icon={ArrowLeftRight}
          iconClass="text-info"
          label="En cours"
          value={inProgress.length}
          hint={`${inProgress.length} commande(s) en cours de traitement`}
        />
        <KpiCard
          icon={CheckCircle2}
          iconClass="text-success"
          label="Acceptées ce mois"
          value={acceptedThisMonth.length}
          hint={`Volume cumulé : ${formatWeight(acceptedVolume)}`}
        />
        <KpiCard
          icon={PieChart}
          iconClass="text-accent"
          label="Taux de réponse"
          value={`${responseRate} %`}
          hint={`${respondedCount} / ${orders.length} demandes traitées`}
        />
      </div>

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Commandes actuelles</h2>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {activeOrders.length} actives
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeOrders.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Aucune commande active pour le moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Demande</th>
                      <th className="px-4 py-3 font-medium">Quantité</th>
                      <th className="px-4 py-3 font-medium">Type / pureté</th>
                      <th className="px-4 py-3 font-medium">Livraison</th>
                      <th className="px-4 py-3 font-medium">Montant indicatif</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.map((po) => (
                      <tr key={po.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{reference(po)}</p>
                          <p className="text-xs text-muted-foreground">Reçue le {formatDate(po.createdAt)}</p>
                        </td>
                        <td className="px-4 py-4 font-medium text-foreground">
                          {formatWeight(po.estimatedWeightKg)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-foreground">{goldTypeLabel(po.goldType)}</p>
                          <p className="text-xs text-muted-foreground">{purityRange(po)}</p>
                        </td>
                        <td className="px-4 py-4 text-foreground">{formatDate(po.expectedDispatchDate)}</td>
                        <td className="px-4 py-4 font-medium text-foreground">
                          {formatCurrency(po.totalEstimatedValue, po.currency)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/purchase-orders/${po.id}`}>
                            <Button variant="secondary" size="sm">
                              Examiner
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Priority */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                <h2 className="text-base font-semibold text-foreground">À traiter en priorité</h2>
              </div>
              {priorityOrder && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  À traiter
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {priorityOrder ? (
                <>
                  <p className="text-lg font-semibold text-foreground">{reference(priorityOrder)}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <PriorityField label="Quantité demandée" value={formatWeight(priorityOrder.estimatedWeightKg)} />
                    <PriorityField label="Type d'or" value={`${goldTypeLabel(priorityOrder.goldType)} · ${purityRange(priorityOrder)}`} />
                    <PriorityField
                      label="Livraison"
                      value={`${priorityOrder.incoterms} · ${priorityOrder.deliveryVaultId}`}
                    />
                    <PriorityField
                      label="Montant indicatif"
                      value={formatCurrency(priorityOrder.totalEstimatedValue, priorityOrder.currency)}
                    />
                  </div>
                  <Link href={`/purchase-orders/${priorityOrder.id}`} className="block">
                    <Button className="w-full">Examiner la demande</Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune demande prioritaire.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 border-b">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Activité récente</h2>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
              ) : (
                <ul className="divide-y">
                  {recentActivity.map((po) => {
                    const { label } = counterpartyStatus(po.status);
                    return (
                      <li key={po.id} className="flex items-start gap-3 px-6 py-4">
                        <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            <span className="font-medium">{reference(po)}</span> — {label.toLowerCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(po.approvedAt || po.submittedAt || po.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Historique des commandes</h2>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "Toutes"],
                ["accepted", "Acceptées"],
                ["declined", "Déclinées"],
                ["closed", "Clôturées"],
                ["expired", "Expirées"],
              ] as [HistoryFilter, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={historyFilter === key ? "default" : "ghost"}
                onClick={() => {
                  setHistoryFilter(key);
                  setHistoryPage(1);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pagedHistory.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucune commande dans l&apos;historique.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 font-medium">N° de demande</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Quantité</th>
                    <th className="px-4 py-3 font-medium">Montant final</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Dernière mise à jour</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.map((po) => (
                    <tr key={po.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-4 font-medium text-foreground">{reference(po)}</td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(po.createdAt)}</td>
                      <td className="px-4 py-4 text-foreground">{formatWeight(po.estimatedWeightKg)}</td>
                      <td className="px-4 py-4 text-foreground">
                        {po.status === "rejected" ? "—" : formatCurrency(po.totalEstimatedValue, po.currency)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDateTime(po.approvedAt || po.submittedAt || po.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Voir le dossier ›
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {filteredHistory.length > pageSize && (
          <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-muted-foreground">
            <span>
              Page {historyPage} sur {totalPages} · {filteredHistory.length} commande(s)
            </span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Page précédente</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={historyPage >= totalPages}
                onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Page suivante</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-lg bg-muted p-2.5", iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
