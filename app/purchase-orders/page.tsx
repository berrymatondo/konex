"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  FileText,
  ChevronRight,
  RefreshCw,
  DollarSign,
  Scale,
  Truck,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PurchaseOrder {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyRiskLevel: string | null;
  status: string;
  estimatedWeightKg: number;
  goldType: string;
  incoterms: string;
  deliveryVaultId: string;
  expectedDispatchDate: string | null;
  totalEstimatedValue: number | null;
  currency: string;
  trackingId: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  lbmaPricePerOz: number | null;
  priceLockExpiry: string | null;
  approvals: Array<{
    approverRole: string;
    decision: string;
  }>;
}

function getStatusBadge(status: string, language: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string; label: { en: string; fr: string } }> = {
    draft: { variant: "outline", label: { en: "Draft", fr: "Brouillon" } },
    submitted: { variant: "secondary", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: { en: "Submitted", fr: "Soumis" } },
    pending_compliance: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: { en: "Pending Compliance", fr: "En attente Conformité" } },
    pending_finance: { variant: "secondary", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", label: { en: "Pending Finance", fr: "En attente Finance" } },
    approved: { variant: "default", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: { en: "Approved", fr: "Approuvé" } },
    rejected: { variant: "destructive", label: { en: "Rejected", fr: "Rejeté" } },
    sent_to_counterparty: { variant: "secondary", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400", label: { en: "Sent to Counterparty", fr: "Transmis à la contrepartie" } },
    accepted: { variant: "default", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: { en: "Accepted", fr: "Accepté" } },
    negotiating: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: { en: "Negotiating", fr: "En négociation" } },
    declined: { variant: "destructive", label: { en: "Declined", fr: "Décliné" } },
    dispatched: { variant: "default", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", label: { en: "Dispatched", fr: "Expédié" } },
    in_transit: { variant: "default", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", label: { en: "In Transit", fr: "En Transit" } },
    delivered: { variant: "default", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: { en: "Delivered", fr: "Livré" } },
    pending_settlement: { variant: "secondary", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: { en: "Pending Settlement", fr: "En attente de règlement" } },
    settled: { variant: "default", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: { en: "Settled", fr: "Réglé" } },
    completed: { variant: "default", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: { en: "Completed", fr: "Terminé" } },
    cancelled: { variant: "destructive", label: { en: "Cancelled", fr: "Annulé" } },
  };
  
  const config = statusConfig[status] || { variant: "outline" as const, label: { en: status, fr: status } };
  return (
    <Badge variant={config.variant} className={config.className}>
      {language === "fr" ? config.label.fr : config.label.en}
    </Badge>
  );
}

function formatCurrency(value: number | null, currency: string = "USD"): string {
  if (!value) return "-";
  // Some purchase orders use non-ISO currency labels (e.g. "Mixte" for a
  // USD/CDF split), which Intl.NumberFormat rejects. Fall back to a plain
  // number followed by the label in that case.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} ${currency}`;
  }
}

export default function PurchaseOrdersPage() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );

  // Keep filter in sync if the user navigates back with a different ?status=
  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  
  const { data: purchaseOrdersData, isLoading, mutate: mutatePOs } = useSWR<PurchaseOrder[]>("/api/purchase-orders", fetcher);
  const { data: access } = useSWR<{ role: string | null }>("/api/access/me", fetcher);
  const isCounterparty = access?.role === "counterparty";

  const handleDeletePO = async () => {
    if (!poToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${poToDelete}`, {
        method: "DELETE",
      });
      if (response.ok) {
        mutatePOs();
      }
    } catch (error) {
      console.error("Error deleting PO:", error);
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setPoToDelete(null);
  };

  const handleSubmitDraft = async (poId: string) => {
    // Find the PO to validate
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;
    
    // Validate that pricing has been applied
    if (!po.lbmaPricePerOz || !po.priceLockExpiry) {
      alert(
        language === "fr"
          ? "Impossible de soumettre: le prix LBMA n'a pas été verrouillé. Veuillez modifier le BC et appliquer le prix."
          : "Cannot submit: LBMA price has not been locked. Please edit the PO and apply pricing."
      );
      return;
    }
    
    // Validate required fields
    const missingFields: string[] = [];
    if (!po.estimatedWeightKg || po.estimatedWeightKg <= 0) {
      missingFields.push(language === "fr" ? "Poids estimé" : "Estimated Weight");
    }
    if (!po.goldType) {
      missingFields.push(language === "fr" ? "Type d'or" : "Gold Type");
    }
    if (!po.deliveryVaultId) {
      missingFields.push(language === "fr" ? "Coffre de livraison" : "Delivery Vault");
    }
    if (!po.expectedDispatchDate) {
      missingFields.push(language === "fr" ? "Début de la fenêtre de livraison souhaitée" : "Desired Delivery Window Start");
    }
    if (!po.incoterms) {
      missingFields.push("Incoterms");
    }
    
    if (missingFields.length > 0) {
      alert(
        language === "fr"
          ? `Impossible de soumettre. Champs manquants:\n• ${missingFields.join("\n• ")}`
          : `Cannot submit. Missing fields:\n• ${missingFields.join("\n• ")}`
      );
      return;
    }
    
    setIsSubmitting(poId);
    try {
      const response = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (response.ok) {
        mutatePOs();
      } else {
        const errorData = await response.json();
        alert(errorData.error || (language === "fr" ? "Erreur lors de la soumission" : "Error submitting PO"));
      }
    } catch (error) {
      console.error("Error submitting PO:", error);
      alert(language === "fr" ? "Erreur lors de la soumission" : "Error submitting PO");
    }
    setIsSubmitting(null);
  };
  
  // Helper function to check if a draft PO can be submitted
  const canSubmitDraft = (po: PurchaseOrder): boolean => {
    // Must have price locked
    if (!po.lbmaPricePerOz || !po.priceLockExpiry) return false;
    // Must have required fields
    if (!po.estimatedWeightKg || po.estimatedWeightKg <= 0) return false;
    if (!po.goldType) return false;
    if (!po.deliveryVaultId) return false;
    if (!po.expectedDispatchDate) return false;
    if (!po.incoterms) return false;
    return true;
  };

  // Ensure purchaseOrders is always an array; hide drafts from counterparty users
  const purchaseOrders = (Array.isArray(purchaseOrdersData) ? purchaseOrdersData : [])
    .filter((po) => !(isCounterparty && po.status === "draft"));

  const filteredOrders = purchaseOrders.filter((po) => {
    const matchesSearch = 
      po.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.trackingId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const pendingStatuses = ["submitted", "pending_compliance", "pending_finance"];
  const approvedStatuses = ["approved", "dispatched", "in_transit", "delivered"];
  
  const stats = {
    total: purchaseOrders.length,
    draft: purchaseOrders.filter((po) => po.status === "draft").length,
    pending: purchaseOrders.filter((po) => pendingStatuses.includes(po.status)).length,
    approved: purchaseOrders.filter((po) => approvedStatuses.includes(po.status)).length,
    totalValue: purchaseOrders
      .filter((po) => approvedStatuses.includes(po.status))
      .reduce((acc, po) => {
        const value = Number(po.totalEstimatedValue);
        return acc + (isNaN(value) ? 0 : value);
      }, 0),
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={language === "fr" ? "Bons de Commande" : "Purchase Orders"}
            subtitle={language === "fr" ? "Créer et gérer les ordres d'achat d'or" : "Create and manage gold purchase orders"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Header with New PO Button */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {language === "fr" ? "Bons de Commande" : "Purchase Orders"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" ? "Gérer les ordres d'achat d'or" : "Manage gold purchase orders"}
                </p>
              </div>
              <Link href="/purchase-orders/new" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto gap-2">
                  <Plus className="h-4 w-4" />
                  {language === "fr" ? "Nouveau BC" : "New PO"}
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Total BCs" : "Total POs"}
                      </p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-3">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "En attente" : "Pending"}
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                    </div>
                    <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/30">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Approuvés" : "Approved"}
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
                    </div>
                    <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Valeur Totale" : "Total Value"}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                    </div>
                    <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={language === "fr" ? "Rechercher par contrepartie ou numéro BC..." : "Search by counterparty or PO number..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                  {!isCounterparty && <SelectItem value="draft">{language === "fr" ? "Brouillon" : "Draft"}</SelectItem>}
                  <SelectItem value="submitted">{language === "fr" ? "Soumis" : "Submitted"}</SelectItem>
                  <SelectItem value="pending_compliance">{language === "fr" ? "En attente Conformité" : "Pending Compliance"}</SelectItem>
                  <SelectItem value="pending_finance">{language === "fr" ? "En attente Finance" : "Pending Finance"}</SelectItem>
                  <SelectItem value="approved">{language === "fr" ? "Approuvé" : "Approved"}</SelectItem>
                  <SelectItem value="sent_to_counterparty">{language === "fr" ? "Transmis à la contrepartie" : "Sent to Counterparty"}</SelectItem>
                  <SelectItem value="accepted">{language === "fr" ? "Accepté" : "Accepted"}</SelectItem>
                  <SelectItem value="negotiating">{language === "fr" ? "En négociation" : "Negotiating"}</SelectItem>
                  <SelectItem value="declined">{language === "fr" ? "Décliné" : "Declined"}</SelectItem>
                  <SelectItem value="dispatched">{language === "fr" ? "Expédié" : "Dispatched"}</SelectItem>
                  <SelectItem value="in_transit">{language === "fr" ? "En Transit" : "In Transit"}</SelectItem>
                  <SelectItem value="delivered">{language === "fr" ? "Livré" : "Delivered"}</SelectItem>
                  <SelectItem value="pending_settlement">{language === "fr" ? "En attente de règlement" : "Pending Settlement"}</SelectItem>
                  <SelectItem value="settled">{language === "fr" ? "Réglé" : "Settled"}</SelectItem>
                  <SelectItem value="completed">{language === "fr" ? "Terminé" : "Completed"}</SelectItem>
                  <SelectItem value="rejected">{language === "fr" ? "Rejeté" : "Rejected"}</SelectItem>
                  <SelectItem value="cancelled">{language === "fr" ? "Annulé" : "Cancelled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-lg font-medium">
                      {language === "fr" ? "Aucun bon de commande trouvé" : "No purchase orders found"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "fr" 
                        ? "Créez votre premier bon de commande" 
                        : "Create your first purchase order"}
                    </p>
                    <Link href="/purchase-orders/new" className="mt-4">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Nouveau BC" : "New PO"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                filteredOrders.map((po) => (
                  <Card key={po.id} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs sm:text-sm text-muted-foreground">
                                {po.trackingId || po.id.slice(0, 12)}
                              </span>
                              {getStatusBadge(po.status, language)}
                            </div>
                            <Link 
                              href={`/counterparties/${po.counterpartyId}`}
                              className="font-medium hover:underline text-sm sm:text-base truncate block"
                            >
                              {po.counterpartyName}
                            </Link>
                            {/* Mobile: Show key info below name */}
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground sm:hidden">
                              <span>{po.estimatedWeightKg} kg</span>
                              <span>{formatCurrency(po.totalEstimatedValue, po.currency)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                          {/* Desktop: Show detailed info */}
                          <div className="hidden md:flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <Scale className="h-4 w-4 text-muted-foreground" />
                              <span>{po.estimatedWeightKg} kg</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>{formatCurrency(po.totalEstimatedValue, po.currency)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <span>{po.incoterms}</span>
                            </div>
                          </div>
                          {po.status === "draft" ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/purchase-orders/${po.id}/edit`} className="flex items-center">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {language === "fr" ? "Modifier" : "Edit"}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleSubmitDraft(po.id)}
                                  disabled={isSubmitting === po.id || !canSubmitDraft(po)}
                                  className={!canSubmitDraft(po) ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  {isSubmitting === po.id 
                                    ? (language === "fr" ? "Envoi..." : "Submitting...")
                                    : !canSubmitDraft(po)
                                      ? (language === "fr" ? "Soumettre (incomplet)" : "Submit (incomplete)")
                                      : (language === "fr" ? "Soumettre" : "Submit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => {
                                    setPoToDelete(po.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {language === "fr" ? "Supprimer" : "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Link href={`/purchase-orders/${po.id}`}>
                              <Button variant="ghost" size="sm">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
          </main>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer ce brouillon ?" : "Delete this draft?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Cette action est irréversible. Le brouillon sera définitivement supprimé."
                : "This action cannot be undone. The draft will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePO}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting 
                ? (language === "fr" ? "Suppression..." : "Deleting...")
                : (language === "fr" ? "Supprimer" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
