"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Search,
  Plus,
  ArrowRight,
  Shield,
  Filter,
  XCircle,
} from "lucide-react";
import Link from "next/link";

interface Dispatch {
  id: string;
  poId: string;
  counterpartyName: string;
  status: string;
  estimatedWeight: number;
  carrier: string | null;
  trackingId: string | null;
  createdAt: string;
}

export default function DispatchPage() {
  const { language } = useLanguage();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_active");
  const [isLoading, setIsLoading] = useState(true);
  const [hasApprovedPOs, setHasApprovedPOs] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    fetchDispatches();
    fetchApprovedPOs();
  }, []);

  const fetchDispatches = async () => {
    try {
      const response = await fetch("/api/dispatch");
      if (response.ok) {
        const data = await response.json();
        setDispatches(data);
      }
    } catch (error) {
      console.error("Error fetching dispatches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApprovedPOs = async () => {
    try {
      const response = await fetch("/api/purchase-orders?status=approved");
      if (response.ok) {
        const data = await response.json();
        setHasApprovedPOs(data && data.length > 0);
      }
    } catch (error) {
      console.error("Error fetching approved POs:", error);
    }
  };

  const content = {
    title: language === "fr" ? "Expédition & Documentation" : "Dispatch & Documentation",
    subtitle: language === "fr" 
      ? "Validation des documents pré-expédition et autorisation de dispatch (US-04)"
      : "Pre-shipment document validation and dispatch authorization (US-04)",
    newDispatch: language === "fr" ? "Nouvelle Validation" : "New Validation",
    search: language === "fr" ? "Rechercher par PO ou ID..." : "Search by PO or ID...",
    stats: {
      pending: language === "fr" ? "En Attente" : "Pending",
      validated: language === "fr" ? "Validés" : "Validated",
      dispatched: language === "fr" ? "Expédiés" : "Dispatched",
      inTransit: language === "fr" ? "En Transit" : "In Transit",
    },
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_docs":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
          <Clock className="mr-1 h-3 w-3" /> {language === "fr" ? "Documents Requis" : "Docs Required"}
        </Badge>;
      case "docs_validated":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
          <FileText className="mr-1 h-3 w-3" /> {language === "fr" ? "Docs Validés" : "Docs Validated"}
        </Badge>;
      case "pending_authorization":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
          <Shield className="mr-1 h-3 w-3" /> {language === "fr" ? "Autorisation Requise" : "Auth Required"}
        </Badge>;
      case "dispatched":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" /> {language === "fr" ? "Expédié" : "Dispatched"}
        </Badge>;
      case "in_transit":
        return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500 border-cyan-500/30">
          <Truck className="mr-1 h-3 w-3" /> {language === "fr" ? "En Transit" : "In Transit"}
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDispatches = dispatches.filter(d => {
    // Text search filter
    const matchesSearch = 
      d.poId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.counterpartyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.trackingId && d.trackingId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Status filter
    let matchesStatus = true;
    if (statusFilter === "all_active") {
      // Show all except dispatched (those that still need validation)
      matchesStatus = d.status !== "dispatched" && d.status !== "in_transit";
    } else if (statusFilter !== "all") {
      matchesStatus = d.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: dispatches.filter(d => d.status === "pending_docs" || d.status === "pending_authorization").length,
    validated: dispatches.filter(d => d.status === "docs_validated").length,
    dispatched: dispatches.filter(d => d.status === "dispatched").length,
    inTransit: dispatches.filter(d => d.status === "in_transit").length,
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={content.title}
            subtitle={content.subtitle}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{content.stats.pending}</CardTitle>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{content.stats.validated}</CardTitle>
                    <FileText className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.validated}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{content.stats.dispatched}</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.dispatched}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{content.stats.inTransit}</CardTitle>
                    <Truck className="h-4 w-4 text-cyan-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.inTransit}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={content.search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={language === "fr" ? "Filtrer par statut" : "Filter by status"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_active">
                        {language === "fr" ? "En cours de validation" : "Active Validations"}
                      </SelectItem>
                      <SelectItem value="all">
                        {language === "fr" ? "Tous les statuts" : "All Statuses"}
                      </SelectItem>
                      <SelectItem value="pending_docs">
                        {language === "fr" ? "Documents Requis" : "Docs Required"}
                      </SelectItem>
                      <SelectItem value="docs_validated">
                        {language === "fr" ? "Docs Validés" : "Docs Validated"}
                      </SelectItem>
                      <SelectItem value="pending_authorization">
                        {language === "fr" ? "Autorisation Requise" : "Auth Required"}
                      </SelectItem>
                      <SelectItem value="dispatched">
                        {language === "fr" ? "Expédié" : "Dispatched"}
                      </SelectItem>
                      <SelectItem value="in_transit">
                        {language === "fr" ? "En Transit" : "In Transit"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Button
                    onClick={() => {
                      if (hasApprovedPOs) {
                        window.location.href = "/dispatch/new";
                      } else {
                        setShowErrorModal(true);
                      }
                    }}
                    disabled={!hasApprovedPOs}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {content.newDispatch}
                  </Button>
                  {!hasApprovedPOs && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {language === "fr"
                        ? "Veuillez créer et approuver un bon de commande avant de créer une validation d'expédition"
                        : "Please create and approve a purchase order before creating a dispatch validation"}
                    </p>
                  )}
                </div>
              </div>

              {/* Dispatch List */}
              <Card>
                <CardHeader>
                  <CardTitle>{language === "fr" ? "Validations en Cours" : "Active Validations"}</CardTitle>
                  <CardDescription>
                    {language === "fr" 
                      ? "Gérez les documents d'expédition et autorisations de dispatch"
                      : "Manage shipping documents and dispatch authorizations"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : filteredDispatches.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {language === "fr" 
                        ? "Aucune validation trouvée. Créez-en une nouvelle depuis un PO approuvé."
                        : "No validations found. Create one from an approved PO."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDispatches.map((dispatch) => (
                        <div 
                          key={dispatch.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-primary/10">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{dispatch.poId}</p>
                              <p className="text-sm text-muted-foreground">{dispatch.counterpartyName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-medium">{dispatch.estimatedWeight} kg</p>
                              <p className="text-xs text-muted-foreground">
                                {dispatch.carrier || (language === "fr" ? "Transporteur non assigné" : "Carrier not assigned")}
                              </p>
                            </div>
                            {getStatusBadge(dispatch.status)}
                            <Link href={`/dispatch/${dispatch.id}`}>
                              <Button variant="ghost" size="sm">
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Error Modal for missing approved POs */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              {language === "fr" ? "Aucun Bon de Commande Approuvé" : "No Approved Purchase Order"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Vous ne pouvez pas créer une nouvelle validation d'expédition sans un bon de commande approuvé."
                : "You cannot create a new dispatch validation without an approved purchase order."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm text-muted-foreground">
            <p>
              {language === "fr"
                ? "Étapes à suivre :"
                : "Steps to follow:"}
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                {language === "fr"
                  ? "Créer un nouveau bon de commande"
                  : "Create a new purchase order"}
              </li>
              <li>
                {language === "fr"
                  ? "Remplir tous les champs obligatoires"
                  : "Fill in all required fields"}
              </li>
              <li>
                {language === "fr"
                  ? "Approuver le bon de commande"
                  : "Approve the purchase order"}
              </li>
              <li>
                {language === "fr"
                  ? "Revenir ici pour créer une validation d'expédition"
                  : "Return here to create a dispatch validation"}
              </li>
            </ol>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowErrorModal(false)}>
              {language === "fr" ? "Fermer" : "Close"}
            </Button>
            <Link href="/purchase-orders/new">
              <Button>
                {language === "fr" ? "Créer un Bon de Commande" : "Create Purchase Order"}
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
