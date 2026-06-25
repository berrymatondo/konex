"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ArrowLeft,
  Clock,
  FileText,
  User,
  Building2,
  Globe,
  TrendingUp,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getRiskBadgeVariant(tier: string): "default" | "secondary" | "destructive" | "outline" {
  switch (tier) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "default";
  }
}

function getRiskColor(tier: string): string {
  switch (tier) {
    case "critical": return "text-red-600";
    case "high": return "text-orange-500";
    case "medium": return "text-yellow-500";
    case "low": return "text-emerald-500";
    default: return "text-muted-foreground";
  }
}

export default function RiskManagementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { language } = useLanguage();
  
  const { data: counterparty, isLoading: loadingCounterparty } = useSWR(`/api/counterparties/${id}`, fetcher);
  const { data: assessments = [], isLoading: loadingAssessments, mutate: mutateAssessments } = useSWR(
    `/api/risk-assessments?counterpartyId=${id}`, 
    fetcher
  );

  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const latestAssessment = Array.isArray(assessments) && assessments.length > 0 
    ? assessments[assessments.length - 1] 
    : null;

  const canApprove = latestAssessment && counterparty?.status !== "active" && counterparty?.status !== "rejected";
  const isApproved = counterparty?.status === "active";
  const isRejected = counterparty?.status === "rejected";

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await fetch(`/api/counterparties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          approvalNotes,
          approvedAt: new Date().toISOString(),
          approvedBy: "compliance_officer",
        }),
      });
      
      // Refresh data
      mutate(`/api/counterparties/${id}`);
      mutateAssessments();
    } catch (error) {
      console.error("Error approving counterparty:", error);
    }
    setIsApproving(false);
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await fetch(`/api/counterparties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejectionNotes: approvalNotes,
          rejectedAt: new Date().toISOString(),
          rejectedBy: "compliance_officer",
        }),
      });
      
      // Refresh data
      mutate(`/api/counterparties/${id}`);
      mutateAssessments();
    } catch (error) {
      console.error("Error rejecting counterparty:", error);
    }
    setIsRejecting(false);
  };

  if (loadingCounterparty || loadingAssessments) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader 
              title={language === "fr" ? "Gestion des Risques" : "Risk Management"}
              subtitle={language === "fr" ? "Chargement..." : "Loading..."}
            />
            <main className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={counterparty?.legalName || (language === "fr" ? "Détail Contrepartie" : "Counterparty Detail")}
            subtitle={language === "fr" ? "Évaluation et approbation des risques" : "Risk assessment and approval"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Back Button */}
              <Link href="/risk-management">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Retour" : "Back"}
                </Button>
              </Link>

              {/* Status Banner */}
              {isApproved && (
                <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <AlertTitle className="text-emerald-700 dark:text-emerald-400">
                    {language === "fr" ? "Contrepartie Approuvée" : "Counterparty Approved"}
                  </AlertTitle>
                  <AlertDescription className="text-emerald-600 dark:text-emerald-500">
                    {language === "fr" 
                      ? "Cette contrepartie a été approuvée et peut maintenant recevoir des ordres d'achat."
                      : "This counterparty has been approved and can now receive purchase orders."}
                  </AlertDescription>
                </Alert>
              )}

              {isRejected && (
                <Alert className="border-red-500 bg-red-50 dark:bg-red-950/20">
                  <Ban className="h-5 w-5 text-red-500" />
                  <AlertTitle className="text-red-700 dark:text-red-400">
                    {language === "fr" ? "Contrepartie Rejetée" : "Counterparty Rejected"}
                  </AlertTitle>
                  <AlertDescription className="text-red-600 dark:text-red-500">
                    {language === "fr" 
                      ? "Cette contrepartie a été rejetée et ne peut pas recevoir d'ordres d'achat."
                      : "This counterparty has been rejected and cannot receive purchase orders."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Counterparty Info */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {language === "fr" ? "Informations Contrepartie" : "Counterparty Information"}
                        </CardTitle>
                        <Badge variant={
                          counterparty?.status === "active" ? "default" :
                          counterparty?.status === "rejected" ? "destructive" :
                          "secondary"
                        }>
                          {counterparty?.status?.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">{language === "fr" ? "Nom Légal" : "Legal Name"}</Label>
                        <p className="font-medium">{counterparty?.legalName}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === "fr" ? "Pays" : "Country"}</Label>
                        <p className="font-medium flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {counterparty?.countryOfIncorporation}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === "fr" ? "N° Immatriculation" : "Registration No."}</Label>
                        <p className="font-mono">{counterparty?.registrationNumber || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === "fr" ? "Contact Principal" : "Primary Contact"}</Label>
                        <p className="font-medium">{counterparty?.primaryContact || "-"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Assessment */}
                  {latestAssessment ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            {language === "fr" ? "Évaluation des Risques" : "Risk Assessment"}
                          </CardTitle>
                          <Badge variant={getRiskBadgeVariant(latestAssessment.riskTier)}>
                            {latestAssessment.riskTier?.toUpperCase()}
                          </Badge>
                        </div>
                        <CardDescription>
                          {language === "fr" ? "Évalué le" : "Assessed on"} {new Date(latestAssessment.assessedAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Overall Score */}
                        <div className="flex items-center justify-center">
                          <div className={`flex h-24 w-24 items-center justify-center rounded-full ${
                            latestAssessment.riskTier === "critical" || latestAssessment.riskTier === "high" 
                              ? "bg-red-100 dark:bg-red-900/30" 
                              : latestAssessment.riskTier === "medium"
                              ? "bg-yellow-100 dark:bg-yellow-900/30"
                              : "bg-emerald-100 dark:bg-emerald-900/30"
                          }`}>
                            <span className={`text-3xl font-bold ${getRiskColor(latestAssessment.riskTier)}`}>
                              {latestAssessment.overallScore}
                            </span>
                          </div>
                        </div>

                        <Separator />

                        {/* Score Breakdown */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{language === "fr" ? "Risque Pays" : "Country Risk"}</span>
                              <span className="font-medium">{latestAssessment.countryRiskScore || 0}/100</span>
                            </div>
                            <Progress value={latestAssessment.countryRiskScore || 0} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{language === "fr" ? "Risque Source" : "Source Risk"}</span>
                              <span className="font-medium">{latestAssessment.sourceRiskScore || 0}/100</span>
                            </div>
                            <Progress value={latestAssessment.sourceRiskScore || 0} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{language === "fr" ? "Risque PEP" : "PEP Risk"}</span>
                              <span className="font-medium">{latestAssessment.pepRiskScore || 0}/100</span>
                            </div>
                            <Progress value={latestAssessment.pepRiskScore || 0} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{language === "fr" ? "Volume Risque" : "Volume Risk"}</span>
                              <span className="font-medium">{latestAssessment.volumeRiskScore || 0}/100</span>
                            </div>
                            <Progress value={latestAssessment.volumeRiskScore || 0} />
                          </div>
                        </div>

                        {/* Flags */}
                        {(latestAssessment.eddRequired) && (
                          <div className="flex flex-wrap gap-2">
                            {latestAssessment.eddRequired && (
                              <Badge variant="outline" className="border-orange-500 text-orange-500">
                                <FileText className="mr-1 h-3 w-3" />
                                EDD {latestAssessment.eddStatus === "completed" 
                                  ? (language === "fr" ? "Complété" : "Completed")
                                  : (language === "fr" ? "Requis" : "Required")}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Shield className="h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-4 text-lg font-medium">
                          {language === "fr" ? "Aucune évaluation" : "No Assessment"}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          {language === "fr" 
                            ? "Cette contrepartie n'a pas encore été évaluée."
                            : "This counterparty has not been assessed yet."}
                        </p>
                        <Link href={`/risk-management/${id}/assess`}>
                          <Button>
                            <Shield className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Évaluer Maintenant" : "Assess Now"}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Approval Panel */}
                <div className="space-y-6">
                  {/* Actions Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        {language === "fr" ? "Actions" : "Actions"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!latestAssessment ? (
                        <Link href={`/risk-management/${id}/assess`} className="w-full">
                          <Button className="w-full">
                            <Shield className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Évaluer les Risques" : "Assess Risks"}
                          </Button>
                        </Link>
                      ) : canApprove ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="approvalNotes">
                              {language === "fr" ? "Notes d'approbation (optionnel)" : "Approval Notes (optional)"}
                            </Label>
                            <Textarea
                              id="approvalNotes"
                              placeholder={language === "fr" 
                                ? "Ajoutez des commentaires..." 
                                : "Add comments..."}
                              value={approvalNotes}
                              onChange={(e) => setApprovalNotes(e.target.value)}
                              rows={3}
                            />
                          </div>
                          
                          <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700" 
                            onClick={handleApprove}
                            disabled={isApproving || isRejecting}
                          >
                            {isApproving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            {language === "fr" ? "Approuver la Contrepartie" : "Approve Counterparty"}
                          </Button>
                          
                          <Button 
                            variant="destructive" 
                            className="w-full" 
                            onClick={handleReject}
                            disabled={isApproving || isRejecting}
                          >
                            {isRejecting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="mr-2 h-4 w-4" />
                            )}
                            {language === "fr" ? "Rejeter" : "Reject"}
                          </Button>
                        </>
                      ) : isApproved ? (
                        <div className="text-center py-4">
                          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                          <p className="font-medium text-emerald-600">
                            {language === "fr" ? "Contrepartie Approuvée" : "Counterparty Approved"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {language === "fr" 
                              ? "Prête pour les ordres d'achat"
                              : "Ready for purchase orders"}
                          </p>
                        </div>
                      ) : isRejected ? (
                        <div className="text-center py-4">
                          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                          <p className="font-medium text-red-600">
                            {language === "fr" ? "Contrepartie Rejetée" : "Counterparty Rejected"}
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Quick Links */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {language === "fr" ? "Liens Rapides" : "Quick Links"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Link href={`/counterparties/${id}`} className="block">
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Building2 className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Voir Profil Complet" : "View Full Profile"}
                        </Button>
                      </Link>
                      {latestAssessment && (
                        <Link href={`/risk-management/${id}/assess`} className="block">
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Shield className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Réévaluer" : "Re-assess"}
                          </Button>
                        </Link>
                      )}
                      {isApproved && (
                        <Link href={`/purchase-orders/new?counterpartyId=${id}`} className="block">
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <FileText className="mr-2 h-4 w-4" />
                            {language === "fr" ? "Créer un Ordre d'Achat" : "Create Purchase Order"}
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
