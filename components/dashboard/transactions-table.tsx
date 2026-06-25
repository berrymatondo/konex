"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import { Filter } from "lucide-react";

interface Transaction {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  type: string;
  referenceNumber: string;
  goldWeight: number;
  goldPurity: number;
  totalValue: number;
  status: string;
  createdAt: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  showingAll?: boolean;
  onShowAll?: () => void;
}

export function TransactionsTable({ transactions, showingAll, onShowAll }: TransactionsTableProps) {
  const { t, language } = useLanguage();
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusConfig: Record<string, { label: { en: string; fr: string }; className: string }> = {
    draft: { label: { en: "Draft", fr: "Brouillon" }, className: "border-muted-foreground text-muted-foreground" },
    submitted: { label: { en: "Submitted", fr: "Soumis" }, className: "border-blue-500 text-blue-500" },
    pending_compliance: { label: { en: "Pending Compliance", fr: "Attente Conformité" }, className: "border-yellow-500 text-yellow-500" },
    pending_finance: { label: { en: "Pending Finance", fr: "Attente Finance" }, className: "border-orange-500 text-orange-500" },
    approved: { label: { en: "Approved", fr: "Approuvé" }, className: "border-emerald-500 text-emerald-500" },
    rejected: { label: { en: "Rejected", fr: "Rejeté" }, className: "border-destructive text-destructive" },
    dispatched: { label: { en: "Dispatched", fr: "Expédié" }, className: "border-purple-500 text-purple-500" },
    in_transit: { label: { en: "In Transit", fr: "En Transit" }, className: "border-indigo-500 text-indigo-500" },
    delivered: { label: { en: "Delivered", fr: "Livré" }, className: "border-success text-success" },
    completed: { label: { en: "Completed", fr: "Terminé" }, className: "border-success text-success" },
    cancelled: { label: { en: "Cancelled", fr: "Annulé" }, className: "border-destructive text-destructive" },
  };

  const getStatusLabel = (status: string) => {
    const config = statusConfig[status];
    if (!config) return status;
    return language === "fr" ? config.label.fr : config.label.en;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  // Get unique counterparties for filter dropdown
  const uniqueCounterparties = useMemo(() => {
    const counterparties = new Map<string, string>();
    transactions.forEach(t => {
      if (t.counterpartyId && t.counterpartyName) {
        counterparties.set(t.counterpartyId, t.counterpartyName);
      }
    });
    return Array.from(counterparties.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [transactions]);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    transactions.forEach(t => {
      if (t.status) statuses.add(t.status);
    });
    return Array.from(statuses).sort();
  }, [transactions]);

  // Filter transactions based on selected filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesCounterparty = counterpartyFilter === "all" || t.counterpartyId === counterpartyFilter;
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesCounterparty && matchesStatus;
    });
  }, [transactions, counterpartyFilter, statusFilter]);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.recentTransactions}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            {t.counterparties.noTransactions}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>
          {showingAll 
            ? (language === "fr" ? "Toutes les transactions" : "All Transactions")
            : t.dashboard.recentTransactions}
          {showingAll && <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredTransactions.length})</span>}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          {/* Counterparty Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={counterpartyFilter} onValueChange={setCounterpartyFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder={language === "fr" ? "Contrepartie" : "Counterparty"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "fr" ? "Toutes les contreparties" : "All Counterparties"}
                </SelectItem>
                {uniqueCounterparties.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder={language === "fr" ? "Statut" : "Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === "fr" ? "Tous les statuts" : "All Statuses"}
              </SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {onShowAll && (
            <button 
              onClick={onShowAll}
              className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
            >
              {showingAll 
                ? (language === "fr" ? "Voir moins" : "Show less")
                : t.dashboard.viewAllTransactions}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Mobile Cards */}
        <div className="space-y-4 md:hidden">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {language === "fr" ? "Aucune transaction trouvée" : "No transactions found"}
            </p>
          ) : filteredTransactions.map((transaction) => {
            const status = statusConfig[transaction.status] || { className: "border-muted-foreground text-muted-foreground" };
            return (
              <div key={transaction.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link 
                      href={`/counterparties/${transaction.counterpartyId}`}
                      className="font-medium hover:underline hover:text-primary"
                    >
                      {transaction.counterpartyName}
                    </Link>
                    <Link 
                      href={`/purchase-orders/${transaction.id}`}
                      className="block text-sm font-mono text-muted-foreground hover:underline hover:text-primary"
                    >
                      {transaction.referenceNumber}
                    </Link>
                  </div>
                  <Badge variant="outline" className={cn(status.className)}>
                    {getStatusLabel(transaction.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {transaction.goldWeight.toFixed(1)} kg @ {transaction.goldPurity.toFixed(1)}%
                  </span>
                  <span className="font-mono font-medium">
                    {formatCurrency(transaction.totalValue)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(transaction.createdAt)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.transactions.id}</TableHead>
                <TableHead>{t.transactions.counterparty}</TableHead>
                <TableHead className="text-right">{t.transactions.weight}</TableHead>
                <TableHead className="text-right">{t.transactions.purity}</TableHead>
                <TableHead>{t.transactions.status}</TableHead>
                <TableHead className="text-right">{t.transactions.totalValue}</TableHead>
                <TableHead>{t.common.date}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {language === "fr" ? "Aucune transaction trouvée" : "No transactions found"}
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.map((transaction) => {
                const status = statusConfig[transaction.status] || { className: "border-muted-foreground text-muted-foreground" };
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      <Link 
                        href={`/purchase-orders/${transaction.id}`}
                        className="hover:underline hover:text-primary"
                      >
                        {transaction.referenceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/counterparties/${transaction.counterpartyId}`}
                        className="hover:underline hover:text-primary"
                      >
                        {transaction.counterpartyName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {transaction.goldWeight.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {transaction.goldPurity.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(status.className)}>
                        {getStatusLabel(transaction.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(transaction.totalValue)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(transaction.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
