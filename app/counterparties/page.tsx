"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Search,
  Filter,
  Plus,
  Eye,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

interface Counterparty {
  id: string;
  legalName: string;
  tradingName: string | null;
  registrationNumber: string;
  countryOfIncorporation: string;
  goldSourceTypes: string[];
  status: string;
  riskLevel: string | null;
  createdAt: string;
  updatedAt: string;
  ubos: Array<{ isPEP: boolean }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

const getStatusConfig = (t: ReturnType<typeof useLanguage>["t"]): Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> => ({
  draft: { label: t.status.draft, className: "border-muted-foreground text-muted-foreground", icon: FileEdit },
  active: { label: t.status.active, className: "border-success text-success", icon: CheckCircle2 },
  pending_review: { label: t.status.pending_review, className: "border-warning text-warning", icon: Clock },
  pending_screening: { label: t.status.pending_screening, className: "border-info text-info", icon: Clock },
  pending_risk_review: { label: t.status.pending_risk_review, className: "border-primary text-primary", icon: Shield },
  blocked: { label: t.status.blocked, className: "border-destructive text-destructive bg-destructive/10", icon: XCircle },
});

export default function CounterpartiesPage() {
  const { data: counterparties, error, isLoading, mutate } = useSWR<Counterparty[]>(
    "/api/counterparties",
    fetcher
  );
  // Counterparty-profile users have read-only access (no create/delete).
  const { data: access } = useSWR<{ role: string | null }>(
    "/api/access/me",
    (url: string) => fetch(url).then((r) => r.json())
  );
  const isReadOnly = access?.role === "counterparty";
  const { t } = useLanguage();
  const statusConfig = getStatusConfig(t);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [counterpartyToDelete, setCounterpartyToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredCounterparties = (counterparties || []).filter((cp) => {
    const matchesSearch =
      cp.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cp.registrationNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || cp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const handleDeleteClick = (id: string, name: string) => {
    setCounterpartyToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (counterpartyToDelete) {
      await fetch(`/api/counterparties/${counterpartyToDelete.id}`, {
        method: "DELETE",
      });
      mutate();
    }
    setDeleteDialogOpen(false);
    setCounterpartyToDelete(null);
  };

  const stats = {
    total: counterparties?.length || 0,
    active: counterparties?.filter((cp) => cp.status === "active").length || 0,
    pending: counterparties?.filter((cp) => cp.status === "pending_review" || cp.status === "draft").length || 0,
    blocked: counterparties?.filter((cp) => cp.status === "blocked").length || 0,
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={t.counterparties.title}
            subtitle={t.counterparties.subtitle}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Stats */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="rounded-lg bg-primary/10 p-3 hidden sm:block">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="rounded-lg bg-success/10 p-3 hidden sm:block">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.active}</div>
                      <p className="text-sm text-muted-foreground">Active</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="rounded-lg bg-warning/10 p-3 hidden sm:block">
                      <Clock className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.pending}</div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="rounded-lg bg-destructive/10 p-3 hidden sm:block">
                      <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.blocked}</div>
                      <p className="text-sm text-muted-foreground">Blocked</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>All Counterparties</CardTitle>
                      <CardDescription className="hidden sm:block">
                        View and manage registered gold trading entities
                      </CardDescription>
                    </div>
                    {!isReadOnly && (
                      <Link href="/onboarding">
                        <Button className="w-full sm:w-auto">
                          <Plus className="mr-2 h-4 w-4" />
                          {t.counterparties.addNew}
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={t.counterparties.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder={t.counterparties.filterByStatus} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.common.all}</SelectItem>
                        <SelectItem value="draft">{t.status.draft}</SelectItem>
                        <SelectItem value="active">{t.status.active}</SelectItem>
                        <SelectItem value="pending_review">{t.status.pending_review}</SelectItem>
                        <SelectItem value="pending_screening">{t.status.pending_screening}</SelectItem>
                        <SelectItem value="pending_risk_review">{t.status.pending_risk_review}</SelectItem>
                        <SelectItem value="blocked">{t.status.blocked}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Loading State */}
                  {isLoading && (
                    <div className="flex items-center justify-center py-12">
                      <Spinner className="h-8 w-8" />
                    </div>
                  )}

                  {/* Error State */}
                  {error && (
                    <div className="py-12 text-center">
                      <p className="text-muted-foreground">Failed to load counterparties</p>
                    </div>
                  )}

                  {/* Mobile Cards */}
                  {!isLoading && !error && (
                    <div className="space-y-4 lg:hidden">
                      {filteredCounterparties.map((cp) => {
                        const status = statusConfig[cp.status] || statusConfig.pending_review;
                        const StatusIcon = status.icon;
                        return (
                          <Card key={cp.id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/counterparties/${cp.id}`}
                                    className="font-medium hover:text-primary hover:underline"
                                  >
                                    {cp.legalName}
                                  </Link>
                                  <p className="text-sm text-muted-foreground">
                                    {cp.registrationNumber}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {cp.countryOfIncorporation}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/counterparties/${cp.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        {t.common.view}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link href={`/counterparties/${cp.id}?edit=true`}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        {t.common.edit}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link href={`/screening/${cp.id}`}>
                                        <Shield className="mr-2 h-4 w-4" />
                                        {t.counterparties.viewScreening}
                                      </Link>
                                    </DropdownMenuItem>
                                    {!isReadOnly && (
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => handleDeleteClick(cp.id, cp.legalName)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {t.common.delete}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn(status.className)}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {status.label}
                                </Badge>
                                {cp.goldSourceTypes.map((type) => (
                                  <Badge
                                    key={type}
                                    variant="secondary"
                                    className={cn(
                                      "text-xs",
                                      type === "ASM" && "bg-destructive/10 text-destructive"
                                    )}
                                  >
                                    {type}
                                  </Badge>
                                ))}
                                {cp.ubos?.some((u) => u.isPEP) && (
                                  <Badge variant="outline" className="border-warning text-warning text-xs">
                                    PEP
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Desktop Table */}
                  {!isLoading && !error && (
                    <div className="rounded-lg border border-border hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.counterparties.title}</TableHead>
                            <TableHead>{t.common.country}</TableHead>
                            <TableHead>{t.counterparties.goldSourceTypes}</TableHead>
                            <TableHead>{t.counterparties.ubos}</TableHead>
                            <TableHead>{t.common.status}</TableHead>
                            <TableHead>{t.counterparties.updatedAt}</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCounterparties.map((cp) => {
                            const status = statusConfig[cp.status] || statusConfig.pending_review;
                            const StatusIcon = status.icon;
                            return (
                              <TableRow key={cp.id}>
                                <TableCell>
                                  <div>
                                    <Link
                                      href={`/counterparties/${cp.id}`}
                                      className="font-medium hover:text-primary hover:underline"
                                    >
                                      {cp.legalName}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                      {cp.registrationNumber}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{cp.countryOfIncorporation}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {cp.goldSourceTypes.map((type) => (
                                      <Badge
                                        key={type}
                                        variant="secondary"
                                        className={cn(
                                          "text-xs",
                                          type === "ASM" && "bg-destructive/10 text-destructive"
                                        )}
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span>{cp.ubos?.length || 0}</span>
                                    {cp.ubos?.some((u) => u.isPEP) && (
                                      <Badge variant="outline" className="border-warning text-warning text-xs">
                                        PEP
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn(status.className)}>
                                    <StatusIcon className="mr-1 h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(cp.updatedAt)}
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/counterparties/${cp.id}`}>
                                          <Eye className="mr-2 h-4 w-4" />
                                          {t.common.view}
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/counterparties/${cp.id}?edit=true`}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          {t.common.edit}
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/screening/${cp.id}`}>
                                          <Shield className="mr-2 h-4 w-4" />
                                          {t.counterparties.viewScreening}
                                        </Link>
                                      </DropdownMenuItem>
                                      {!isReadOnly && (
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => handleDeleteClick(cp.id, cp.legalName)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          {t.common.delete}
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {!isLoading && !error && filteredCounterparties.length === 0 && (
                    <div className="py-12 text-center">
                      <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 font-medium">{t.counterparties.noCounterparties}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.counterparties.noCounterpartiesDesc}
                      </p>
                      {!isReadOnly && !searchQuery && statusFilter === "all" && (
                        <Link href="/onboarding" className="mt-4 inline-block">
                          <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t.counterparties.addNew}
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.counterparties.deleteConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.counterparties.deleteConfirmMessage} &quot;{counterpartyToDelete?.name}&quot;? {t.counterparties.deleteConfirmWarning}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t.common.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
