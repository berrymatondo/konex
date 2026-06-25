"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { translations } from "@/lib/i18n/translations";
import {
  Wallet,
  Plus,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Building2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Settlement {
  id: string;
  purchaseOrderId: string | null;
  assayId: string | null;
  counterpartyId: string;
  counterpartyName: string;
  poTrackingId: string | null;
  assayBatchNumber: string | null;
  settlementReference: string;
  fineGoldWeightKg: number;
  settlementPricePerOz: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string | null;
  bankReference: string | null;
  status: string;
  initiatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  completedAt: string | null;
  notes: string | null;
}

interface Counterparty {
  id: string;
  legalName: string;
}

export default function SettlementsPage() {
  const { language } = useLanguage();
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: settlementsData, isLoading, mutate } = useSWR<Settlement[]>("/api/settlements", fetcher);
  const { data: counterpartiesData } = useSWR<Counterparty[]>("/api/counterparties", fetcher);

  const settlements = Array.isArray(settlementsData) ? settlementsData : [];
  const counterparties = Array.isArray(counterpartiesData) ? counterpartiesData : [];

  const [formData, setFormData] = useState({
    counterpartyId: "",
    fineGoldWeightKg: "",
    settlementPricePerOz: "",
    currency: "USD",
    paymentMethod: "",
    notes: "",
  });

  const filteredSettlements = settlements.filter((s) => {
    const matchesSearch =
      s.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.settlementReference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.bankReference?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: settlements.length,
    pending: settlements.filter((s) => s.status === "pending").length,
    approved: settlements.filter((s) => s.status === "approved").length,
    completed: settlements.filter((s) => s.status === "completed").length,
    totalValue: settlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-amber-500 text-amber-500"><Clock className="mr-1 h-3 w-3" />{language === "fr" ? "En attente" : "Pending"}</Badge>;
      case "approved":
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><CheckCircle2 className="mr-1 h-3 w-3" />{language === "fr" ? "Approuvé" : "Approved"}</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />{language === "fr" ? "Complété" : "Completed"}</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />{language === "fr" ? "Rejeté" : "Rejected"}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmit = async () => {
    if (!formData.counterpartyId || !formData.fineGoldWeightKg || !formData.settlementPricePerOz) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterpartyId: formData.counterpartyId,
          fineGoldWeightKg: parseFloat(formData.fineGoldWeightKg),
          settlementPricePerOz: parseFloat(formData.settlementPricePerOz),
          currency: formData.currency,
          paymentMethod: formData.paymentMethod || null,
          notes: formData.notes || null,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setFormData({
          counterpartyId: "",
          fineGoldWeightKg: "",
          settlementPricePerOz: "",
          currency: "USD",
          paymentMethod: "",
          notes: "",
        });
        mutate();
      }
    } catch (error) {
      console.error("Error creating settlement:", error);
    }
    setIsSubmitting(false);
  };

  const calculatedTotal = formData.fineGoldWeightKg && formData.settlementPricePerOz
    ? parseFloat(formData.fineGoldWeightKg) * 32.1507 * parseFloat(formData.settlementPricePerOz)
    : 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={t.nav.settlements}
            subtitle={language === "fr" ? "Gérer les règlements de paiement pour les achats d'or" : "Manage payment settlements for gold purchases"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{language === "fr" ? "Total" : "Total"}</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{language === "fr" ? "En attente" : "Pending"}</CardTitle>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{language === "fr" ? "Approuvés" : "Approved"}</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-500">{stats.approved}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{language === "fr" ? "Complétés" : "Completed"}</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{stats.completed}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{language === "fr" ? "Valeur totale" : "Total Value"}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters and Actions */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      {t.nav.settlements}
                    </CardTitle>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Nouveau règlement" : "New Settlement"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{language === "fr" ? "Créer un règlement" : "Create Settlement"}</DialogTitle>
                          <DialogDescription>
                            {language === "fr" ? "Enregistrer un nouveau règlement de paiement" : "Record a new payment settlement"}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label>{language === "fr" ? "Contrepartie" : "Counterparty"}</Label>
                            <Select value={formData.counterpartyId} onValueChange={(v) => setFormData({ ...formData, counterpartyId: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {counterparties.map((cp) => (
                                  <SelectItem key={cp.id} value={cp.id}>
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      {cp.legalName}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Or fin (kg)" : "Fine Gold (kg)"}</Label>
                              <Input
                                type="number"
                                step="0.001"
                                value={formData.fineGoldWeightKg}
                                onChange={(e) => setFormData({ ...formData, fineGoldWeightKg: e.target.value })}
                                placeholder="0.000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Prix/oz" : "Price/oz"}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.settlementPricePerOz}
                                onChange={(e) => setFormData({ ...formData, settlementPricePerOz: e.target.value })}
                                placeholder="2000.00"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Devise" : "Currency"}</Label>
                              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="GBP">GBP</SelectItem>
                                  <SelectItem value="CHF">CHF</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{language === "fr" ? "Méthode" : "Method"}</Label>
                              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                                <SelectTrigger>
                                  <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="wire_transfer">{language === "fr" ? "Virement" : "Wire Transfer"}</SelectItem>
                                  <SelectItem value="swift">SWIFT</SelectItem>
                                  <SelectItem value="letter_of_credit">{language === "fr" ? "Lettre de crédit" : "Letter of Credit"}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {calculatedTotal > 0 && (
                            <div className="rounded-lg bg-muted p-4">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{language === "fr" ? "Montant estimé" : "Estimated Amount"}</span>
                                <span className="text-xl font-bold">${calculatedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>{language === "fr" ? "Notes" : "Notes"}</Label>
                            <Textarea
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              placeholder={language === "fr" ? "Notes optionnelles..." : "Optional notes..."}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            {t.common.cancel}
                          </Button>
                          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.counterpartyId}>
                            {isSubmitting ? (language === "fr" ? "Création..." : "Creating...") : (language === "fr" ? "Créer" : "Create")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-col gap-4 md:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={language === "fr" ? "Rechercher par référence, contrepartie..." : "Search by reference, counterparty..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{language === "fr" ? "Tous les statuts" : "All Statuses"}</SelectItem>
                        <SelectItem value="pending">{language === "fr" ? "En attente" : "Pending"}</SelectItem>
                        <SelectItem value="approved">{language === "fr" ? "Approuvé" : "Approved"}</SelectItem>
                        <SelectItem value="completed">{language === "fr" ? "Complété" : "Completed"}</SelectItem>
                        <SelectItem value="rejected">{language === "fr" ? "Rejeté" : "Rejected"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">{language === "fr" ? "Chargement..." : "Loading..."}</div>
                    </div>
                  ) : filteredSettlements.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                      <Wallet className="mb-2 h-8 w-8" />
                      <p>{language === "fr" ? "Aucun règlement trouvé" : "No settlements found"}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "fr" ? "Référence" : "Reference"}</TableHead>
                            <TableHead>{language === "fr" ? "Contrepartie" : "Counterparty"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Or fin (kg)" : "Fine Gold (kg)"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Prix/oz" : "Price/oz"}</TableHead>
                            <TableHead className="text-right">{language === "fr" ? "Montant" : "Amount"}</TableHead>
                            <TableHead>{language === "fr" ? "Méthode" : "Method"}</TableHead>
                            <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                            <TableHead>{language === "fr" ? "Date" : "Date"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSettlements.map((settlement) => (
                            <TableRow 
                              key={settlement.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => window.location.href = `/settlements/sett_001`}
                            >
                              <TableCell className="font-mono text-sm">{settlement.settlementReference}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {settlement.counterpartyName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{settlement.fineGoldWeightKg.toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono">${settlement.settlementPricePerOz.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                ${settlement.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                {settlement.paymentMethod ? (
                                  <Badge variant="outline">
                                    {settlement.paymentMethod === "wire_transfer" ? (language === "fr" ? "Virement" : "Wire") :
                                     settlement.paymentMethod === "swift" ? "SWIFT" :
                                     settlement.paymentMethod === "letter_of_credit" ? (language === "fr" ? "L/C" : "L/C") :
                                     settlement.paymentMethod}
                                  </Badge>
                                ) : "-"}
                              </TableCell>
                              <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(settlement.initiatedAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
