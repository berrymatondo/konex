"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  User,
  Newspaper,
  ChevronRight,
  FileText,
  Building2,
  MapPin,
  TrendingUp,
  Save,
  Loader2,
} from "lucide-react";
import type { Counterparty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

interface ScreeningResultsProps {
  counterparty: Counterparty;
  onApprove: () => void;
  onReject: () => void;
  onRequestInfo: () => void;
  validationErrors?: string[];
}

type RiskLevelType = "low" | "medium" | "high";
type ClearStatusType = "clear" | "not_clear";

export function ScreeningResults({
  counterparty,
  onApprove,
  onReject,
  onRequestInfo,
  validationErrors = [],
}: ScreeningResultsProps) {
  const { t, language } = useLanguage();
  
  // State for the 4 screening criteria (US-01 Compliance Score)
  const [sanctionsStatus, setSanctionsStatus] = useState<ClearStatusType>("clear");
  const [pepStatus, setPepStatus] = useState<ClearStatusType>("clear");
  const [adverseMediaHits, setAdverseMediaHits] = useState<number>(0);
  const [jurisdictionRiskScore, setJurisdictionRiskScore] = useState<number>(20); // 0-100
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [complianceNotes, setComplianceNotes] = useState<string>("");

  // US-01 Policy Weights (externalized for configurability)
  const POLICY_WEIGHTS = {
    pep: 0.40,
    adverseMedia: 0.35,
    otherFactors: 0.25,
  };

  // US-01 Adverse Media Scoring Thresholds
  const getAdverseMediaScore = (hits: number): number => {
    if (hits === 0) return 0;
    if (hits <= 2) return 30;
    if (hits <= 5) return 60;
    return 100; // 6+ hits
  };

  // US-01 Preliminary Compliance Score Calculation
  const calculatePreliminaryScore = () => {
    // Sanctions Gate: Hit = 100 (auto-block)
    if (sanctionsStatus === "not_clear") {
      return { 
        score: 100, 
        classification: "BLOCKED" as const, 
        status: "AUTOMATIC_REJECTION" as const,
        breakdown: {
          pep: { raw: 0, weighted: 0 },
          media: { raw: 0, weighted: 0 },
          other: { raw: 0, weighted: 0 },
          sanctionsBlocked: true,
        }
      };
    }

    // Calculate weighted components
    const pepScore = pepStatus === "not_clear" ? 100 : 0;
    const mediaScore = getAdverseMediaScore(adverseMediaHits);
    const otherScore = jurisdictionRiskScore;

    // Weighted sum
    const rawScore = 
      (pepScore * POLICY_WEIGHTS.pep) +
      (mediaScore * POLICY_WEIGHTS.adverseMedia) +
      (otherScore * POLICY_WEIGHTS.otherFactors);

    const finalScore = Math.round(rawScore);

    // Risk Classification Bands (US-01 spec)
    let classification: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
    let status: "PENDING_STANDARD_REVIEW" | "PENDING_ENHANCED_REVIEW" | "PENDING_SENIOR_REVIEW" | "AUTOMATIC_REJECTION";

    if (finalScore <= 25) {
      classification = "LOW";
      status = "PENDING_STANDARD_REVIEW";
    } else if (finalScore <= 60) {
      classification = "MEDIUM";
      status = "PENDING_ENHANCED_REVIEW";
    } else if (finalScore <= 99) {
      classification = "HIGH";
      status = "PENDING_SENIOR_REVIEW";
    } else {
      classification = "BLOCKED";
      status = "AUTOMATIC_REJECTION";
    }

    return {
      score: finalScore,
      classification,
      status,
      breakdown: {
        pep: { raw: pepScore, weighted: pepScore * POLICY_WEIGHTS.pep },
        media: { raw: mediaScore, weighted: mediaScore * POLICY_WEIGHTS.adverseMedia },
        other: { raw: otherScore, weighted: otherScore * POLICY_WEIGHTS.otherFactors },
        sanctionsBlocked: false,
      }
    };
  };

  const preliminaryScore = calculatePreliminaryScore();
  
  // Map US-01 classification to legacy riskLevel for backward compatibility
  const riskLevel: RiskLevelType = 
    preliminaryScore.classification === "LOW" ? "low" :
    preliminaryScore.classification === "MEDIUM" ? "medium" : "high";

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      const response = await fetch(`/api/screening/${counterparty.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // US-01 Preliminary Compliance Score data
          sanctionsStatus,
          pepStatus,
          adverseMediaHits,
          jurisdictionRiskScore,
          // Calculated results
          preliminaryScore: preliminaryScore.score,
          classification: preliminaryScore.classification,
          systemStatus: preliminaryScore.status,
          breakdown: preliminaryScore.breakdown,
          // Compliance officer notes (for manual review)
          complianceNotes: complianceNotes || null,
          // Legacy compatibility
          riskLevel,
        }),
      });
      
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        setSaveSuccess(false);
      }
    } catch (error) {
      console.error("Error saving screening data:", error);
      setSaveSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved screening data from database
  useEffect(() => {
    const loadScreeningData = async () => {
      try {
        const response = await fetch(`/api/screening/${counterparty.id}`);
        if (response.ok) {
          const results = await response.json();
          if (Array.isArray(results) && results.length > 0) {
            // Load risk level
            const riskResult = results.find((r: { check_type: string }) => r.check_type === "risk_level");
            if (riskResult?.result) {
              setRiskLevel(riskResult.result as RiskLevelType);
            }
            
            // Load sanctions status
            const sanctionsResult = results.find((r: { check_type: string }) => r.check_type === "sanctions");
            if (sanctionsResult?.details?.status) {
              setSanctionsStatus(sanctionsResult.details.status as ClearStatusType);
            }
            
            // Load PEP status
            const pepResult = results.find((r: { check_type: string }) => r.check_type === "pep");
            if (pepResult?.details?.status) {
              setPepStatus(pepResult.details.status as ClearStatusType);
            }
            
            // Load adverse media hits
            const adverseResult = results.find((r: { check_type: string }) => r.check_type === "adverse_media");
            if (adverseResult?.details?.hits !== undefined) {
              setAdverseMediaHits(adverseResult.details.hits);
            }
            
            // Load compliance officer notes from US-01 compliance score
            const complianceScoreResult = results.find((r: { check_type: string }) => r.check_type === "us01_compliance_score");
            if (complianceScoreResult?.details?.compliance_officer_notes) {
              setComplianceNotes(complianceScoreResult.details.compliance_officer_notes);
            }
            return; // Data loaded from DB, skip default initialization
          }
        }
      } catch (error) {
        console.error("Error loading screening data:", error);
      }
      
      // Default initialization if no saved data
      const hasPEP = counterparty.ubos?.some(u => u.isPEP) || false;
      if (hasPEP) {
        setPepStatus("not_clear");
      }
      
      const screeningResults = counterparty.screeningResults || [];
      const hasHit = screeningResults.some(r => r.result === "hit");
      if (hasHit) {
        setSanctionsStatus("not_clear");
      }
    };
    
    loadScreeningData();
  }, [counterparty]);

  // US-01 Screening Result based on Preliminary Compliance Score
  type ScreeningResultType = "passed" | "failed" | "manual_review";
  
  const calculateScreeningResult = (): ScreeningResultType => {
    // BLOCKED (score = 100) => Automatic rejection
    if (preliminaryScore.classification === "BLOCKED") {
      return "failed";
    }
    
    // LOW RISK (0-25) => Auto-approve path
    if (preliminaryScore.classification === "LOW") {
      return "passed";
    }
    
    // MEDIUM RISK (26-60) => Enhanced review required
    if (preliminaryScore.classification === "MEDIUM") {
      return "manual_review";
    }
    
    // HIGH RISK (61-99) => Senior review + EDD trigger
    return "manual_review";
  };
  
  const screeningResult = calculateScreeningResult();
  const screeningPassed = screeningResult === "passed";

  const getRiskLevelLabel = (level: RiskLevelType) => {
    switch (level) {
      case "low": return language === "fr" ? "Faible" : "Low";
      case "medium": return language === "fr" ? "Moyen" : "Medium";
      case "high": return language === "fr" ? "Élevé" : "High";
    }
  };

  const getClearStatusLabel = (status: ClearStatusType) => {
    switch (status) {
      case "clear": return language === "fr" ? "Conforme" : "Clear";
      case "not_clear": return language === "fr" ? "Non conforme" : "Not Clear";
    }
  };

  // Reusable screening box component
  const ScreeningBox = ({
    icon: Icon,
    title,
    description,
    statusTitle,
    statusDescription,
    isPositive,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    statusTitle: string;
    statusDescription: string;
    isPositive: boolean;
  }) => (
    <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-5 w-5 text-slate-400" />
        <h3 className="font-semibold text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">{description}</p>
      <div className={cn(
        "rounded-lg border p-4",
        isPositive 
          ? "border-emerald-800/50 bg-emerald-950/50" 
          : "border-amber-800/50 bg-amber-950/50"
      )}>
        <p className={cn(
          "font-semibold mb-1",
          isPositive ? "text-slate-100" : "text-amber-200"
        )}>
          {statusTitle}
        </p>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          )}
          <span className={cn(
            "text-sm",
            isPositive ? "text-slate-300" : "text-amber-200/80"
          )}>
            {statusDescription}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Counterparty Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl">{counterparty.legalName}</CardTitle>
              <CardDescription className="mt-1">
                Registration: {counterparty.registrationNumber || "N/A"}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                counterparty.status === "blocked"
                  ? "border-destructive text-destructive"
                  : counterparty.status === "active"
                  ? "border-success text-success"
                  : "border-warning text-warning"
              )}
            >
              {(counterparty.status || "pending_review").replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Jurisdiction</p>
                <p className="font-medium">{counterparty.countryOfIncorporation}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Source Types</p>
                <div className="flex flex-wrap gap-1">
                  {counterparty.goldSourceTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="font-medium">{counterparty.documents?.length || 0} uploaded</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* US-01 Preliminary Compliance Score Panel */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {language === "fr" ? "Score de Conformité Préliminaire (US-01)" : "Preliminary Compliance Score (US-01)"}
          </CardTitle>
          <CardDescription>
            {language === "fr" 
              ? "Calcul automatisé selon les pondérations de la politique de conformité"
              : "Automated calculation based on compliance policy weights"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score Display */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {language === "fr" ? "Score Final" : "Final Score"}
              </p>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-4xl font-bold",
                  preliminaryScore.classification === "LOW" ? "text-emerald-500" :
                  preliminaryScore.classification === "MEDIUM" ? "text-amber-500" :
                  preliminaryScore.classification === "HIGH" ? "text-orange-500" :
                  "text-destructive"
                )}>
                  {preliminaryScore.score}
                </span>
                <span className="text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="text-right">
              <Badge className={cn(
                "text-sm px-3 py-1",
                preliminaryScore.classification === "LOW" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                preliminaryScore.classification === "MEDIUM" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                preliminaryScore.classification === "HIGH" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                "bg-destructive/20 text-destructive border-destructive/30"
              )}>
                {preliminaryScore.classification} RISK
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {preliminaryScore.status.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {language === "fr" ? "Décomposition du Score" : "Score Breakdown"}
            </p>
            
            {/* Sanctions Gate */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Sanctions Check</span>
              </div>
              <Badge variant={sanctionsStatus === "clear" ? "outline" : "destructive"}>
                {sanctionsStatus === "clear" ? "CLEAR" : "HIT (Blocking)"}
              </Badge>
            </div>

            {/* PEP Component */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">PEP Status (40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {preliminaryScore.breakdown.pep.raw} × 0.40 =
                </span>
                <Badge variant="secondary">
                  {preliminaryScore.breakdown.pep.weighted.toFixed(1)} pts
                </Badge>
              </div>
            </div>

            {/* Adverse Media Component */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Adverse Media (35%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {preliminaryScore.breakdown.media.raw} × 0.35 =
                </span>
                <Badge variant="secondary">
                  {preliminaryScore.breakdown.media.weighted.toFixed(1)} pts
                </Badge>
              </div>
            </div>

            {/* Other Factors Component */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Jurisdiction Risk (25%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {preliminaryScore.breakdown.other.raw} × 0.25 =
                </span>
                <Badge variant="secondary">
                  {preliminaryScore.breakdown.other.weighted.toFixed(1)} pts
                </Badge>
              </div>
            </div>
          </div>

          {/* Next Step */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm">
              <span className="font-medium">{language === "fr" ? "Prochaine étape:" : "Next Step:"}</span>{" "}
              {preliminaryScore.classification === "LOW" 
                ? (language === "fr" ? "Revue standard - Chemin d'approbation automatique" : "Standard Review - Auto-approve path")
                : preliminaryScore.classification === "MEDIUM"
                ? (language === "fr" ? "Revue renforcée par l'Officier de Conformité" : "Enhanced Review by Compliance Officer")
                : preliminaryScore.classification === "HIGH"
                ? (language === "fr" ? "Approbation Senior + Déclenchement EDD → Route vers US-02" : "Senior Approval + EDD Trigger → Route to US-02")
                : (language === "fr" ? "Rejet automatique - Correspondance sanctions" : "Automatic Rejection - Sanctions Hit")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Overall Status - Dynamic based on screening result */}
      {screeningResult === "passed" && (
        <div className="relative w-full rounded-lg border border-emerald-900/40 bg-gradient-to-r from-emerald-950 to-emerald-900 p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
          </div>
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-900/50">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-300 text-lg">
                {language === "fr" ? "Vérification des sanctions réussie" : "Sanctions Screening Passed"}
              </h3>
              <p className="mt-2 text-sm text-emerald-50/80 leading-relaxed">
                {language === "fr" 
                  ? "Aucune correspondance trouvée sur les listes de sanctions UN, EU ou OFAC. La contrepartie est éligible à l'intégration en attente de la revue de l'officier de conformité."
                  : "No matches found on UN, EU, or OFAC sanctions lists. Counterparty is eligible for onboarding pending compliance officer review."}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {screeningResult === "manual_review" && (
        <div className="relative w-full rounded-lg border border-amber-900/40 bg-gradient-to-r from-amber-950 to-amber-900 p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
          </div>
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-amber-900/50">
                <AlertTriangle className="h-6 w-6 text-amber-300" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-300 text-lg">
                  {language === "fr" ? "Revue manuelle requise" : "Manual Compliance Review Required"}
                </h3>
                <p className="mt-2 text-sm text-amber-50/80 leading-relaxed">
                  {language === "fr" 
                    ? "Les critères de conformité nécessitent une analyse approfondie. Cette contrepartie doit être examinée manuellement par le responsable de conformité avant toute décision."
                    : "Compliance criteria require further analysis. This counterparty must be manually reviewed by the compliance officer before any decision."}
                </p>
              </div>
            </div>
            
            {/* Compliance Officer Notes */}
            <div className="mt-2 space-y-2">
              <Label htmlFor="compliance-notes" className="text-amber-200 font-medium">
                {language === "fr" ? "Notes du responsable de conformité" : "Compliance Officer Notes"}
              </Label>
              <Textarea
                id="compliance-notes"
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                placeholder={language === "fr" 
                  ? "Documentez votre analyse et vos observations ici..."
                  : "Document your analysis and observations here..."}
                className="min-h-[100px] bg-amber-950/50 border-amber-700/50 text-amber-50 placeholder:text-amber-300/50 focus:border-amber-500 focus:ring-amber-500/20"
              />
              <p className="text-xs text-amber-300/60">
                {language === "fr" 
                  ? "Ces notes seront enregistrées dans le journal d'audit pour la traçabilité."
                  : "These notes will be saved in the audit log for traceability."}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {screeningResult === "failed" && (
        <div className="relative w-full rounded-lg border border-red-900/40 bg-gradient-to-r from-red-950 to-red-900 p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
          </div>
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-400/50 bg-red-900/50">
              <XCircle className="h-6 w-6 text-red-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-300 text-lg">
                {language === "fr" ? "Vérification des sanctions échouée" : "Sanctions Screening Failed"}
              </h3>
              <p className="mt-2 text-sm text-red-50/80 leading-relaxed">
                {language === "fr" 
                  ? "Un ou plusieurs critères de conformité critiques n'ont pas été satisfaits. Cette contrepartie ne peut pas être approuvée."
                  : "One or more critical compliance criteria have not been met. This counterparty cannot be approved."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Screening Criteria Boxes (US-01 Inputs) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Jurisdiction Risk Score Box (Other Factors - 25%) */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold text-slate-100">
              {language === "fr" ? "Risque Juridictionnel (25%)" : "Jurisdiction Risk (25%)"}
            </h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {language === "fr" 
              ? "Score combiné de la juridiction et du type d'activité"
              : "Combined jurisdiction and business type risk score"}
          </p>
          <div className={cn(
            "rounded-lg border p-4",
            jurisdictionRiskScore <= 25 
              ? "border-emerald-800/50 bg-emerald-950/50" 
              : jurisdictionRiskScore <= 60
              ? "border-amber-800/50 bg-amber-950/50"
              : "border-red-800/50 bg-red-950/50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn(
                "font-semibold",
                jurisdictionRiskScore <= 25 ? "text-slate-100" : jurisdictionRiskScore <= 60 ? "text-amber-200" : "text-red-200"
              )}>
                {language === "fr" ? "Score: " : "Score: "}{jurisdictionRiskScore}/100
              </p>
              <Select 
                value={jurisdictionRiskScore.toString()} 
                onValueChange={(v) => setJurisdictionRiskScore(parseInt(v))}
              >
                <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 - {language === "fr" ? "Très faible" : "Very Low"}</SelectItem>
                  <SelectItem value="20">20 - {language === "fr" ? "Faible" : "Low"}</SelectItem>
                  <SelectItem value="35">35 - {language === "fr" ? "Modéré" : "Moderate"}</SelectItem>
                  <SelectItem value="50">50 - {language === "fr" ? "Moyen" : "Medium"}</SelectItem>
                  <SelectItem value="70">70 - {language === "fr" ? "Élevé" : "High"}</SelectItem>
                  <SelectItem value="90">90 - {language === "fr" ? "Très élevé" : "Very High"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {jurisdictionRiskScore <= 25 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className={cn("h-5 w-5", jurisdictionRiskScore <= 60 ? "text-amber-400" : "text-red-400")} />
              )}
              <span className={cn(
                "text-sm",
                jurisdictionRiskScore <= 25 ? "text-slate-300" : jurisdictionRiskScore <= 60 ? "text-amber-200/80" : "text-red-200/80"
              )}>
                {counterparty.countryOfIncorporation} - {counterparty.goldSourceTypes?.join(", ") || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Sanctions Check Box */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold text-slate-100">
              {language === "fr" ? "Vérification des sanctions" : "Sanctions Check"}
            </h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {language === "fr" 
              ? "Vérification contre les listes de sanctions internationales (UN, EU, OFAC)"
              : "Screening against international sanctions lists (UN, EU, OFAC)"}
          </p>
          <div className={cn(
            "rounded-lg border p-4",
            sanctionsStatus === "clear" 
              ? "border-emerald-800/50 bg-emerald-950/50" 
              : "border-red-800/50 bg-red-950/50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn(
                "font-semibold",
                sanctionsStatus === "clear" ? "text-slate-100" : "text-red-200"
              )}>
                {language === "fr" ? "Statut des sanctions" : "Sanctions Status"}
              </p>
              <Select value={sanctionsStatus} onValueChange={(v) => setSanctionsStatus(v as ClearStatusType)}>
                <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">{language === "fr" ? "Conforme" : "Clear"}</SelectItem>
                  <SelectItem value="not_clear">{language === "fr" ? "Non conforme" : "Not Clear"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {sanctionsStatus === "clear" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <span className={cn(
                "text-sm",
                sanctionsStatus === "clear" ? "text-slate-300" : "text-red-200/80"
              )}>
                {sanctionsStatus === "clear" 
                  ? (language === "fr" ? "Aucune correspondance sur les listes de sanctions" : "No matches found on sanctions lists")
                  : (language === "fr" ? "Correspondance détectée - Revue manuelle requise" : "Match detected - Manual review required")}
              </span>
            </div>
          </div>
        </div>

        {/* PEP Check Box */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <User className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold text-slate-100">
              {language === "fr" ? "Vérification PPE" : "PEP Check"}
            </h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {language === "fr" 
              ? "Vérification des Personnes Politiquement Exposées pour tous les bénéficiaires effectifs"
              : "Politically Exposed Persons check for all UBOs"}
          </p>
          <div className={cn(
            "rounded-lg border p-4",
            pepStatus === "clear" 
              ? "border-emerald-800/50 bg-emerald-950/50" 
              : "border-amber-800/50 bg-amber-950/50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn(
                "font-semibold",
                pepStatus === "clear" ? "text-slate-100" : "text-amber-200"
              )}>
                {language === "fr" ? "Statut PPE" : "PEP Status"}
              </p>
              <Select value={pepStatus} onValueChange={(v) => setPepStatus(v as ClearStatusType)}>
                <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">{language === "fr" ? "Conforme" : "Clear"}</SelectItem>
                  <SelectItem value="not_clear">{language === "fr" ? "Non conforme" : "Not Clear"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {pepStatus === "clear" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <span className={cn(
                "text-sm",
                pepStatus === "clear" ? "text-slate-300" : "text-amber-200/80"
              )}>
                {pepStatus === "clear" 
                  ? (language === "fr" ? "Aucun UBO identifié comme PPE" : "No UBOs identified as Politically Exposed Persons")
                  : (language === "fr" ? "UBO(s) identifié(s) comme PPE - Revue requise" : "UBO(s) identified as PEP - Review required")}
              </span>
            </div>
          </div>
        </div>

        {/* Adverse Media Box */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold text-slate-100">
              {language === "fr" ? "Médias défavorables" : "Adverse Media"}
            </h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {language === "fr" 
              ? "Vérification automatique des sources d'actualités mondiales"
              : "Automated screening of global news sources"}
          </p>
          <div className={cn(
            "rounded-lg border p-4",
            adverseMediaHits === 0 
              ? "border-emerald-800/50 bg-emerald-950/50" 
              : "border-amber-800/50 bg-amber-950/50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn(
                "font-semibold",
                adverseMediaHits === 0 ? "text-slate-100" : "text-amber-200"
              )}>
                {language === "fr" ? "Articles trouvés" : "Articles Found"}
              </p>
              <Select value={adverseMediaHits.toString()} onValueChange={(v) => setAdverseMediaHits(parseInt(v))}>
                <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 Hits</SelectItem>
                  <SelectItem value="1">1 Hit</SelectItem>
                  <SelectItem value="2">2 Hits</SelectItem>
                  <SelectItem value="3">3 Hits</SelectItem>
                  <SelectItem value="4">4 Hits</SelectItem>
                  <SelectItem value="5">5+ Hits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {adverseMediaHits === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <span className={cn(
                "text-sm",
                adverseMediaHits === 0 ? "text-slate-300" : "text-amber-200/80"
              )}>
                {adverseMediaHits === 0 
                  ? (language === "fr" ? "Aucun article défavorable identifié" : "No adverse media articles identified")
                  : (language === "fr" ? `${adverseMediaHits} article(s) potentiellement pertinent(s)` : `${adverseMediaHits} potentially relevant article(s)`)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* UBO Summary */}
      {counterparty.ubos && counterparty.ubos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t.counterparties.ubos}
            </CardTitle>
            <CardDescription>
              {counterparty.ubos.length} {language === "fr" ? "bénéficiaire(s) effectif(s) déclaré(s)" : "UBO(s) declared"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {counterparty.ubos.map((ubo, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{ubo.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {ubo.nationality || "Unknown"} • {ubo.ownershipPercent || 0}% ownership
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {ubo.isPEP && (
                      <Badge variant="outline" className="border-warning text-warning">
                        PEP
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {language === "fr" ? "Enregistrer les résultats du screening" : "Save screening results"}
            </p>
            {saveSuccess === true && (
              <span className="text-sm text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {language === "fr" ? "Sauvegardé" : "Saved"}
              </span>
            )}
            {saveSuccess === false && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                {language === "fr" ? "Erreur" : "Error"}
              </span>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {language === "fr" ? "Sauvegarder" : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            {t.screening.reviewedBy}: {t.nav.complianceOfficer}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {/* Show info message if counterparty is already active */}
            {counterparty.status === "active" && (
              <div className="order-first w-full sm:order-last">
                <Alert className="text-left border-success/50 bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle className="text-success">{language === "fr" ? "Contrepartie Active" : "Counterparty Active"}</AlertTitle>
                  <AlertDescription>
                    {language === "fr" 
                      ? "Cette contrepartie est déjà active et ne peut plus être modifiée depuis cet écran."
                      : "This counterparty is already active and cannot be modified from this screen."}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            {/* Always show Reject & Block button - disabled for active counterparties */}
            <Button 
              variant="destructive" 
              onClick={onReject} 
              className="order-2 sm:order-1"
              disabled={counterparty.status === "active"}
            >
              {t.screening.rejectBlock}
            </Button>
            
            {/* Manual Review or Medium risk: show Request More Info button */}
            {(screeningResult === "manual_review" || riskLevel === "medium") && (
              <Button 
                variant="outline" 
                onClick={onRequestInfo} 
                className="order-1 sm:order-2"
                disabled={counterparty.status === "active"}
              >
                {t.screening.requestMoreInfo}
              </Button>
            )}
            
            {/* Validation warning for missing required fields (Issue #7) */}
            {validationErrors.length > 0 && (
              <div className="order-first w-full sm:order-last">
                <Alert variant="destructive" className="text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{language === "fr" ? "Informations manquantes" : "Missing Information"}</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1">
                      {validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            {/* Passed screening with Low risk: show Approve & Activate button */}
            {screeningResult === "passed" && riskLevel === "low" && counterparty.status !== "active" && (
              <Button 
                onClick={onApprove} 
                className="order-1 sm:order-2"
                disabled={validationErrors.length > 0}
              >
                {t.screening.approveActivate}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
