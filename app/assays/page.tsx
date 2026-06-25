"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { translations } from "@/lib/i18n/translations";
import {
  FlaskConical,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Scale,
  Percent,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Assay {
  id: string;
  purchaseOrderId: string | null;
  poTrackingId: string | null;
  counterpartyId: string;
  counterpartyName: string;
  batchNumber: string;
  grossWeightKg: number;
  netWeightKg: number | null;
  purityPercentage: number | null;
  fineGoldWeightKg: number | null;
  assayMethod: string | null;
  laboratory: string | null;
  assayDate: string | null;
  status: string;
  certificateUrl: string | null;
  notes: string | null;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

interface Counterparty {
  id: string;
  legalName: string;
}

export default function AssaysPage() {
  const { language } = useLanguage();
  const t = translations[language];
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: assaysData, isLoading, mutate } = useSWR<Assay[]>("/api/assays", fetcher);
  const { data: counterpartiesData } = useSWR("/api/counterparties", fetcher);

  const assays = Array.isArray(assaysData) ? assaysData : [];
  const counterparties: Counterparty[] = Array.isArray(counterpartiesData) ? counterpartiesData : [];

  const [formData, setFormData] = useState({
    counterpartyId: "",
    grossWeightKg: "",
    netWeightKg: "",
    purityPercentage: "",
    assayMethod: "",
    laboratory: "",
    assayDate: "",
    notes: "",
  });

  const filteredAssays = assays.filter((a) => {
    const matchesSearch =
      a.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.laboratory?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: assays.length,
    pending: assays.filter((a) => a.status === "pending").length,
    verified: assays.filter((a) => a.status === "verified").length,
    totalFineGold: assays
      .filter((a) => a.fineGoldWeightKg)
      .reduce((sum, a) => sum + (a.fineGoldWeightKg || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {language === "fr" ? "Vérifié" : "Verified"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            <Clock className="mr-1 h-3 w-3" />
            {language === "fr" ? "En attente" : "Pending"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {language === "fr" ? "Rejeté" : "Rejected"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSubmit = async () => {
    if (!formData.counterpartyId || !formData.grossWeightKg) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterpartyId: formData.counterpartyId,
          grossWeightKg: parseFloat(formData.grossWeightKg),
          netWeightKg: formData.netWeightKg ? parseFloat(formData.netWeightKg) : null,
          purityPercentage: formData.purityPercentage ? parseFloat(formData.purityPercentage) / 100 : null,
          assayMethod: formData.assayMethod || null,
          laboratory: formData.laboratory || null,
          assayDate: formData.assayDate || null,
          notes: formData.notes || null,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setFormData({
          counterpartyId: "",
          grossWeightKg: "",
          netWeightKg: "",
          purityPercentage: "",
          assayMethod: "",
          laboratory: "",
          assayDate: "",
          notes: "",
        });
        mutate();
      }
    } catch (error) {
      console.error("Error creating assay:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={t.nav.assays}
            subtitle={language === "fr" ? "Résultats d'analyse et certificats d'or" : "Gold analysis results and certificates"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Total Essais" : "Total Assays"}
                    </CardTitle>
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "En attente" : "Pending"}
                    </CardTitle>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Vérifiés" : "Verified"}
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{stats.verified}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Or fin total" : "Total Fine Gold"}
                    </CardTitle>
                    <Scale className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalFineGold.toFixed(3)} kg</div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters & Actions */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                      <SelectItem value="pending">{language === "fr" ? "En attente" : "Pending"}</SelectItem>
                      <SelectItem value="verified">{language === "fr" ? "Vérifié" : "Verified"}</SelectItem>
                      <SelectItem value="rejected">{language === "fr" ? "Rejeté" : "Rejected"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Nouvel Essai" : "New Assay"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {language === "fr" ? "Enregistrer un Essai" : "Record Assay"}
                      </DialogTitle>
                      <DialogDescription>
                        {language === "fr"
                          ? "Entrez les résultats de l'analyse d'or"
                          : "Enter the gold analysis results"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Contrepartie" : "Counterparty"}</Label>
                        <Select
                          value={formData.counterpartyId}
                          onValueChange={(v) => setFormData({ ...formData, counterpartyId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {counterparties.map((cp) => (
                              <SelectItem key={cp.id} value={cp.id}>
                                {cp.legalName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Poids brut (kg)" : "Gross Weight (kg)"}</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={formData.grossWeightKg}
                            onChange={(e) => setFormData({ ...formData, grossWeightKg: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Poids net (kg)" : "Net Weight (kg)"}</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={formData.netWeightKg}
                            onChange={(e) => setFormData({ ...formData, netWeightKg: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Pureté (%)" : "Purity (%)"}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            max="100"
                            value={formData.purityPercentage}
                            onChange={(e) => setFormData({ ...formData, purityPercentage: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Méthode" : "Method"}</Label>
                          <Select
                            value={formData.assayMethod}
                            onValueChange={(v) => setFormData({ ...formData, assayMethod: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fire_assay">Fire Assay</SelectItem>
                              <SelectItem value="xrf">XRF</SelectItem>
                              <SelectItem value="icp">ICP-OES</SelectItem>
                              <SelectItem value="gravimetric">Gravimetric</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Laboratoire" : "Laboratory"}</Label>
                          <Input
                            value={formData.laboratory}
                            onChange={(e) => setFormData({ ...formData, laboratory: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "fr" ? "Date d'essai" : "Assay Date"}</Label>
                          <Input
                            type="date"
                            value={formData.assayDate}
                            onChange={(e) => setFormData({ ...formData, assayDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "fr" ? "Notes" : "Notes"}</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        {t.common.cancel}
                      </Button>
                      <Button onClick={handleSubmit} disabled={isSubmitting || !formData.counterpartyId || !formData.grossWeightKg}>
                        {isSubmitting ? (language === "fr" ? "Enregistrement..." : "Saving...") : t.common.save}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "fr" ? "N° Lot" : "Batch #"}</TableHead>
                        <TableHead>{language === "fr" ? "Contrepartie" : "Counterparty"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Poids brut" : "Gross Weight"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Pureté" : "Purity"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Or fin" : "Fine Gold"}</TableHead>
                        <TableHead>{language === "fr" ? "Laboratoire" : "Laboratory"}</TableHead>
                        <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="animate-pulse">
                              {language === "fr" ? "Chargement..." : "Loading..."}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredAssays.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {language === "fr" ? "Aucun essai trouvé" : "No assays found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAssays.map((assay) => (
                          <TableRow 
                            key={assay.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/assays/${assay.id}`)}
                          >
                            <TableCell className="font-mono text-sm">{assay.batchNumber}</TableCell>
                            <TableCell>{assay.counterpartyName}</TableCell>
                            <TableCell className="text-right">{assay.grossWeightKg.toFixed(3)} kg</TableCell>
                            <TableCell className="text-right">
                              {assay.purityPercentage
                                ? `${(assay.purityPercentage * 100).toFixed(2)}%`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {assay.fineGoldWeightKg
                                ? `${assay.fineGoldWeightKg.toFixed(3)} kg`
                                : "-"}
                            </TableCell>
                            <TableCell>{assay.laboratory || "-"}</TableCell>
                            <TableCell>{getStatusBadge(assay.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
