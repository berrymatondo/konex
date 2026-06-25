"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import {
  Warehouse,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Scale,
  FlaskConical,
  Package,
  ArrowRight,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface VaultIntake {
  id: string;
  poReference: string;
  trackingId: string;
  counterpartyName: string;
  grossWeightKg: number;
  netWeightKg: number | null;
  weightVariance: number | null;
  status: string;
  sealVerified: boolean;
  manifestMatch: boolean;
  receivedAt: string;
  operatorId: string;
  vaultLocation: string;
}

export default function VaultIntakePage() {
  const { language } = useLanguage();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: intakesData, isLoading } = useSWR<VaultIntake[]>("/api/vault-intake", fetcher);

  // Mock data for display
  const mockIntakes: VaultIntake[] = [
    {
      id: "vlt_001",
      poReference: "PO-2026-0891",
      trackingId: "TRK-990",
      counterpartyName: "Kibali Gold Mines",
      grossWeightKg: 327.5,
      netWeightKg: 324.85,
      weightVariance: -0.8,
      status: "received",
      sealVerified: true,
      manifestMatch: true,
      receivedAt: "2026-05-10T09:22:00Z",
      operatorId: "J. Smith",
      vaultLocation: "LON-VLT-07B",
    },
    {
      id: "vlt_002",
      poReference: "PO-2026-0892",
      trackingId: "TRK-991",
      counterpartyName: "Geita Gold Mine",
      grossWeightKg: 450.2,
      netWeightKg: 445.8,
      weightVariance: -1.2,
      status: "assay_scheduled",
      sealVerified: true,
      manifestMatch: true,
      receivedAt: "2026-05-09T14:15:00Z",
      operatorId: "M. Johnson",
      vaultLocation: "LON-VLT-03A",
    },
    {
      id: "vlt_003",
      poReference: "PO-2026-0893",
      trackingId: "TRK-992",
      counterpartyName: "Barrick Lumwana",
      grossWeightKg: 215.0,
      netWeightKg: 212.5,
      weightVariance: 2.1,
      status: "assayed",
      sealVerified: true,
      manifestMatch: true,
      receivedAt: "2026-05-08T11:30:00Z",
      operatorId: "A. Williams",
      vaultLocation: "LON-VLT-05C",
    },
    {
      id: "vlt_004",
      poReference: "PO-2026-0894",
      trackingId: "TRK-993",
      counterpartyName: "AngloGold Ashanti",
      grossWeightKg: 520.0,
      netWeightKg: 515.2,
      weightVariance: -0.3,
      status: "pending_settlement",
      sealVerified: true,
      manifestMatch: true,
      receivedAt: "2026-05-07T08:45:00Z",
      operatorId: "J. Smith",
      vaultLocation: "LON-VLT-01A",
    },
    {
      id: "vlt_005",
      poReference: "PO-2026-0895",
      trackingId: "TRK-994",
      counterpartyName: "Newmont Ghana",
      grossWeightKg: 180.5,
      netWeightKg: null,
      weightVariance: null,
      status: "pending_intake",
      sealVerified: false,
      manifestMatch: false,
      receivedAt: "2026-05-13T10:00:00Z",
      operatorId: "Pending",
      vaultLocation: "LON-VLT-RB",
    },
  ];

  const intakes = Array.isArray(intakesData) ? intakesData : mockIntakes;

  const filteredIntakes = intakes.filter((intake) => {
    const matchesSearch =
      intake.poReference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      intake.trackingId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      intake.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || intake.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pendingIntake: intakes.filter((i) => i.status === "pending_intake").length,
    received: intakes.filter((i) => i.status === "received").length,
    assayScheduled: intakes.filter((i) => i.status === "assay_scheduled").length,
    assayed: intakes.filter((i) => i.status === "assayed").length,
    pendingSettlement: intakes.filter((i) => i.status === "pending_settlement").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_intake":
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            <Clock className="mr-1 h-3 w-3" />
            {language === "fr" ? "En attente" : "Pending Intake"}
          </Badge>
        );
      case "received":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Package className="mr-1 h-3 w-3" />
            {language === "fr" ? "Reçu" : "Received"}
          </Badge>
        );
      case "assay_scheduled":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            <FlaskConical className="mr-1 h-3 w-3" />
            {language === "fr" ? "Essai planifié" : "Assay Scheduled"}
          </Badge>
        );
      case "assayed":
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {language === "fr" ? "Essayé" : "Assayed"}
          </Badge>
        );
      case "pending_settlement":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <ArrowRight className="mr-1 h-3 w-3" />
            {language === "fr" ? "Règlement en attente" : "Pending Settlement"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVarianceBadge = (variance: number | null) => {
    if (variance === null) return "-";
    const absVariance = Math.abs(variance);
    if (absVariance <= 2) {
      return (
        <span className="text-emerald-600 font-medium">
          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
        </span>
      );
    } else if (absVariance <= 5) {
      return (
        <span className="text-amber-600 font-medium">
          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
        </span>
      );
    } else {
      return (
        <span className="text-red-600 font-medium">
          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
        </span>
      );
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Réception Coffre" : "Vault Intake"}
            subtitle={language === "fr" ? "Réception physique et vérification des expéditions d'or (US-05)" : "Physical receipt and verification of gold shipments (US-05)"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "En attente" : "Pending"}
                    </CardTitle>
                    <Clock className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-500">{stats.pendingIntake}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Reçus" : "Received"}
                    </CardTitle>
                    <Package className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-500">{stats.received}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Essai planifié" : "Assay Scheduled"}
                    </CardTitle>
                    <FlaskConical className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">{stats.assayScheduled}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "Essayés" : "Assayed"}
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-500">{stats.assayed}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language === "fr" ? "→ Règlement" : "→ Settlement"}
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{stats.pendingSettlement}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Workflow Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    {language === "fr" ? "Workflow US-05: Réception Coffre & Essai" : "US-05 Workflow: Vault Intake & Assay"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr" 
                      ? "Processus en 4 étapes: Réception → Planification Essai → Vérification Pureté → Transfert Règlement"
                      : "4-stage process: Intake → Assay Scheduling → Purity Verification → Settlement Handoff"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    {[
                      { step: 1, label: language === "fr" ? "Réception & Scellés" : "Receipt & Seals", icon: Package },
                      { step: 2, label: language === "fr" ? "Planif. Essai" : "Assay Scheduling", icon: FlaskConical },
                      { step: 3, label: language === "fr" ? "Vérif. Pureté" : "Purity Verification", icon: Scale },
                      { step: 4, label: language === "fr" ? "Transfert US-06" : "US-06 Handoff", icon: ArrowRight },
                    ].map((stage, idx) => (
                      <div key={stage.step} className="flex items-center gap-4 flex-1">
                        <div className="flex flex-col items-center text-center flex-1">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <stage.icon className="h-6 w-6 text-primary" />
                          </div>
                          <span className="text-xs font-medium">{stage.label}</span>
                        </div>
                        {idx < 3 && (
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Filters & Actions */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={language === "fr" ? "Rechercher PO ou tracking..." : "Search PO or tracking..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                      <SelectItem value="pending_intake">{language === "fr" ? "En attente" : "Pending Intake"}</SelectItem>
                      <SelectItem value="received">{language === "fr" ? "Reçu" : "Received"}</SelectItem>
                      <SelectItem value="assay_scheduled">{language === "fr" ? "Essai planifié" : "Assay Scheduled"}</SelectItem>
                      <SelectItem value="assayed">{language === "fr" ? "Essayé" : "Assayed"}</SelectItem>
                      <SelectItem value="pending_settlement">{language === "fr" ? "Règlement" : "Settlement"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Link href="/vault-intake/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Nouvelle Réception" : "New Intake"}
                  </Button>
                </Link>
              </div>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "fr" ? "Réf. PO" : "PO Ref"}</TableHead>
                        <TableHead>{language === "fr" ? "Tracking" : "Tracking"}</TableHead>
                        <TableHead>{language === "fr" ? "Contrepartie" : "Counterparty"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Poids net" : "Net Weight"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Variance" : "Variance"}</TableHead>
                        <TableHead>{language === "fr" ? "Scellés" : "Seals"}</TableHead>
                        <TableHead>{language === "fr" ? "Coffre" : "Vault"}</TableHead>
                        <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="animate-pulse">
                              {language === "fr" ? "Chargement..." : "Loading..."}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredIntakes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            {language === "fr" ? "Aucune réception trouvée" : "No intakes found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredIntakes.map((intake) => (
                          <TableRow key={intake.id}>
                            <TableCell className="font-mono text-sm font-medium">{intake.poReference}</TableCell>
                            <TableCell className="font-mono text-sm">{intake.trackingId}</TableCell>
                            <TableCell>{intake.counterpartyName}</TableCell>
                            <TableCell className="text-right">
                              {intake.netWeightKg ? `${intake.netWeightKg.toFixed(2)} kg` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {getVarianceBadge(intake.weightVariance)}
                            </TableCell>
                            <TableCell>
                              {intake.sealVerified ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{intake.vaultLocation}</TableCell>
                            <TableCell>{getStatusBadge(intake.status)}</TableCell>
                            <TableCell>
                              <Link href={`/vault-intake/${intake.id}`}>
                                <Button variant="ghost" size="sm">
                                  {language === "fr" ? "Voir" : "View"}
                                </Button>
                              </Link>
                            </TableCell>
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
