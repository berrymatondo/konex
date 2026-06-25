"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import type { Counterparty, CounterpartyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

interface ApprovalQueueProps {
  counterparties: Counterparty[];
}

const accessFetcher = (url: string) => fetch(url).then((res) => res.json());

export function ApprovalQueue({ counterparties }: ApprovalQueueProps) {
  const { t, language } = useLanguage();

  // Compliance officers review/approve applications; they cannot onboard
  // (create) new counterparties from the approval queue.
  const { data: access } = useSWR<{ role: string | null }>("/api/access/me", accessFetcher);
  const canOnboard = access?.role !== "compliance_officer";

  const statusConfig: Record<CounterpartyStatus, { label: string; className: string; icon: typeof Clock }> = {
    draft: { label: t.status.draft, className: "border-muted-foreground text-muted-foreground", icon: Clock },
    pending_review: { label: t.status.pending_review, className: "border-warning text-warning", icon: Clock },
    pending_screening: { label: t.status.pending_screening, className: "border-info text-info", icon: Clock },
    pending_risk_review: { label: t.status.pending_risk_review, className: "border-primary text-primary", icon: Clock },
    active: { label: t.status.active, className: "border-success text-success", icon: CheckCircle2 },
    blocked: { label: t.status.blocked, className: "border-destructive text-destructive bg-destructive/10", icon: XCircle },
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredCounterparties = counterparties.filter((cp) => {
    const matchesSearch =
      cp.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cp.registrationNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || cp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = counterparties.filter((cp) => cp.status === "pending_review").length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCounterparties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCounterparties.map((cp) => cp.id));
    }
  };

  const formatDate = (date: string | Date) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return "N/A";
      return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch {
      return "N/A";
    }
  };

  const getRiskLevelBadge = (score: number) => {
    if (score < 40) {
      return (
        <Badge variant="outline" className="border-success text-success">
          {t.risk.low} ({score})
        </Badge>
      );
    }
    if (score < 70) {
      return (
        <Badge variant="outline" className="border-warning text-warning">
          {t.risk.medium} ({score})
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        {t.risk.high} ({score})
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">{t.status.pending_review}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {counterparties.filter((cp) => cp.status === "active").length}
            </div>
            <p className="text-sm text-muted-foreground">{t.approvalQueue.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {counterparties.filter((cp) => cp.status === "blocked").length}
            </div>
            <p className="text-sm text-muted-foreground">{t.approvalQueue.blocked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-sm text-muted-foreground">{language === "fr" ? "Temps moy. de traitement" : "Avg. Processing Time"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t.approvalQueue.title}</CardTitle>
              <CardDescription className="hidden sm:block">
                {t.approvalQueue.subtitle}
              </CardDescription>
            </div>
            {canOnboard && (
              <Link href="/onboarding">
                <Button className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" />
                  {t.nav.onboarding}
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
                <SelectItem value="pending_review">{t.status.pending_review}</SelectItem>
                <SelectItem value="pending_screening">{t.status.pending_screening}</SelectItem>
                <SelectItem value="blocked">{t.status.blocked}</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} {t.approvalQueue.selectedItems}
                </span>
                <Button variant="outline" size="sm">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t.approvalQueue.approveSelected}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 lg:hidden">
            {filteredCounterparties.map((cp) => {
              const status = statusConfig[cp.status];
              const StatusIcon = status.icon;
              return (
                <Card key={cp.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/screening/${cp.id}`}
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
                            <Link href={`/screening/${cp.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              {t.common.view}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-success">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {t.screening.approveActivate}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            {t.screening.requestMoreInfo}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />
                            {t.screening.rejectBlock}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn(status.className)}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                      {cp.preliminaryScore && getRiskLevelBadge(cp.preliminaryScore)}
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
                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{t.counterparties.documents}: {(cp.documents || []).length}/3</span>
                      <span>{t.approvalQueue.dateSubmitted}: {formatDate(cp.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="rounded-lg border border-border hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredCounterparties.length &&
                        filteredCounterparties.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t.counterparties.title}</TableHead>
                  <TableHead>{t.common.country}</TableHead>
                  <TableHead>{t.counterparties.goldSourceTypes}</TableHead>
                  <TableHead>{t.counterparties.riskScore}</TableHead>
                  <TableHead>{t.counterparties.documents}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.approvalQueue.dateSubmitted}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCounterparties.map((cp) => {
                  const status = statusConfig[cp.status];
                  return (
                    <TableRow key={cp.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(cp.id)}
                          onCheckedChange={() => toggleSelect(cp.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <Link
                            href={`/screening/${cp.id}`}
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
                        {cp.preliminaryScore ? getRiskLevelBadge(cp.preliminaryScore) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{(cp.documents || []).length}/3</span>
                          {(cp.documents || []).length >= 3 ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <span className="text-xs text-warning">{language === "fr" ? "Incomplet" : "Incomplete"}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(status.className)}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(cp.createdAt)}
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
                              <Link href={`/screening/${cp.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t.common.view}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-success">
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {t.screening.approveActivate}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              {t.screening.requestMoreInfo}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              {t.screening.rejectBlock}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              {language === "fr" 
                ? `Affichage de ${filteredCounterparties.length} sur ${counterparties.length} contreparties`
                : `Showing ${filteredCounterparties.length} of ${counterparties.length} counterparties`}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">{language === "fr" ? "Précédent" : "Previous"}</span>
              </Button>
              <Button variant="outline" size="sm" disabled>
                <span className="hidden sm:inline mr-1">{language === "fr" ? "Suivant" : "Next"}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
