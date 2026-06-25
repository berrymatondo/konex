"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Globe,
  Pickaxe,
  Users,
  TrendingUp,
  ArrowLeft,
  Save,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function calculateRiskTier(score: number): { tier: string; color: string; bgColor: string } {
  if (score >= 80) return { tier: "critical", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" };
  if (score >= 60) return { tier: "high", color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30" };
  if (score >= 40) return { tier: "medium", color: "text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" };
  return { tier: "low", color: "text-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" };
}

export default function RiskAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { language } = useLanguage();
  
  const { data: counterparty } = useSWR(`/api/counterparties/${id}`, fetcher);

  const [scores, setScores] = useState({
    country: 50,
    source: 50,
    pep: 30,
    volume: 25,
  });
  const [sourceType, setSourceType] = useState<"ASM" | "LSM" | "RECYCLED">("LSM");
  const [isCAHRA, setIsCAHRA] = useState(false);
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [eddAcknowledged, setEddAcknowledged] = useState(false);
  const [mercuryAcknowledged, setMercuryAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flags based on US-02 requirements
  const mercuryFlag = sourceType === "ASM";
  const cahraFlag = isCAHRA;

  // Calculate weighted overall score according to US-02 algorithm
  // Country Risk (30%), Source Type (25%), UBO/PEP (20%), Transaction History (15%), Feed Confidence (10%)
  let rawScore = 
    scores.country * 0.30 + 
    scores.source * 0.25 + 
    scores.pep * 0.20 + 
    scores.volume * 0.15 +
    50 * 0.10; // Feed confidence assumed 50% for now
  
  // Add bonuses per US-02 algorithm
  if (mercuryFlag) rawScore += 15;
  if (cahraFlag) rawScore += 20;
  
  const overallScore = Math.min(100, Math.round(rawScore));
  const riskResult = calculateRiskTier(overallScore);
  
  // EDD required for HIGH or CRITICAL per US-02
  const eddRequired = riskResult.tier === "high" || riskResult.tier === "critical" || mercuryFlag;
  
  // All acknowledgments required for submission
  const allAcknowledged = acknowledged && (!eddRequired || eddAcknowledged) && (!mercuryFlag || mercuryAcknowledged);

  // Validate counterparty has all required fields before activation (Issue #7)
  const validateCounterpartyForActivation = () => {
    if (!counterparty) return { isValid: false, missingFields: ["counterparty"] };
    
    const required = {
      legalName: counterparty.legalName?.trim(),
      registrationNumber: counterparty.registrationNumber?.trim(),
      countryOfIncorporation: counterparty.countryOfIncorporation?.trim(),
      registeredAddress: counterparty.registeredAddress?.trim(),
      primaryContact: counterparty.primaryContact?.trim(),
      primaryEmail: counterparty.primaryEmail?.trim(),
    };
    
    const missingFields = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    
    // Check if at least one UBO exists
    const hasUbo = counterparty.ubos && counterparty.ubos.length > 0 && 
      counterparty.ubos.some((ubo: { fullName?: string; nationality?: string; ownershipPercent?: number }) => 
        ubo.fullName?.trim() && ubo.nationality?.trim() && (ubo.ownershipPercent || 0) > 0
      );
    
    if (!hasUbo) {
      missingFields.push("UBO (beneficiary owner)");
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  };

  const counterpartyValidation = validateCounterpartyForActivation();

  const handleSubmit = async () => {
    if (!allAcknowledged) {
      return;
    }

    setIsSubmitting(true);
    try {
      // The risk assessment is always saved so the pending request is assessed,
      // regardless of whether the counterparty record is complete enough to be
      // activated.
      const response = await fetch("/api/risk-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterpartyId: id,
          countryRiskScore: scores.country,
          sourceRiskScore: scores.source,
          pepRiskScore: scores.pep,
          volumeRiskScore: scores.volume,
          sourceType,
          isCAHRA,
          mercuryFlag,
          eddRequired,
          policyAcknowledged: acknowledged,
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        alert(
          errorData?.error ||
            (language === "fr"
              ? "Échec de l'enregistrement de l'évaluation. Veuillez réessayer."
              : "Failed to save the assessment. Please try again.")
        );
        setIsSubmitting(false);
        return;
      }

      // Activation (status → active) only happens when the counterparty record
      // is complete; otherwise the assessment is recorded but activation waits.
      if (counterpartyValidation.isValid) {
        await fetch(`/api/counterparties/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "active",
            eddCompleted: true,
            poCreationBlocked: false,
          }),
        });
      }
      router.push("/risk-management");
    } catch (error) {
      console.error("Error creating risk assessment:", error);
      alert(
        language === "fr"
          ? "Erreur de connexion. Veuillez réessayer."
          : "Connection error. Please try again."
      );
    }
    setIsSubmitting(false);
  };

  if (!counterparty) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex h-full items-center justify-center">
              <div className="animate-pulse">Loading...</div>
            </div>
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
            title={language === "fr" ? "Nouvelle Évaluation des Risques" : "New Risk Assessment"}
            subtitle={counterparty.legalName}
          />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Back button */}
            <Link href="/risk-management">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "fr" ? "Retour" : "Back"}
              </Button>
            </Link>

            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold">
                {language === "fr" ? "Évaluation des Risques" : "Risk Assessment"}
              </h1>
              <p className="text-muted-foreground">
                {counterparty.legalName} - {counterparty.countryOfIncorporation}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Risk Scoring Panel */}
              <div className="md:col-span-2 space-y-6">
                {/* Country Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      {language === "fr" ? "Risque Pays" : "Country Risk"}
                      <Badge variant="outline" className="ml-auto">30%</Badge>
                    </CardTitle>
                    <CardDescription>
                      {language === "fr" 
                        ? "Basé sur les indices de corruption, stabilité politique et sanctions"
                        : "Based on corruption indices, political stability, and sanctions"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Faible" : "Low"}</span>
                      <span className="text-2xl font-bold">{scores.country}</span>
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Élevé" : "High"}</span>
                    </div>
                    <Slider
                      value={[scores.country]}
                      onValueChange={([value]) => setScores({ ...scores, country: value })}
                      max={100}
                      step={1}
                    />
                  </CardContent>
                </Card>

                {/* Source Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Pickaxe className="h-5 w-5" />
                      {language === "fr" ? "Risque Source" : "Source Risk"}
                      <Badge variant="outline" className="ml-auto">35%</Badge>
                    </CardTitle>
                    <CardDescription>
                      {language === "fr" 
                        ? "Type de source d'or (ASM vs LSM vs Recyclé)"
                        : "Gold source type (ASM vs LSM vs Recycled)"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Faible" : "Low"}</span>
                      <span className="text-2xl font-bold">{scores.source}</span>
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Élevé" : "High"}</span>
                    </div>
                    <Slider
                      value={[scores.source]}
                      onValueChange={([value]) => setScores({ ...scores, source: value })}
                      max={100}
                      step={1}
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant={sourceType === "ASM" ? "default" : "outline"} 
                        size="sm"
                        onClick={() => { setSourceType("ASM"); setScores({ ...scores, source: 80 }); }}
                        className={sourceType === "ASM" ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        ASM (80)
                      </Button>
                      <Button 
                        variant={sourceType === "LSM" ? "default" : "outline"} 
                        size="sm"
                        onClick={() => { setSourceType("LSM"); setScores({ ...scores, source: 40 }); }}
                      >
                        LSM (40)
                      </Button>
                      <Button 
                        variant={sourceType === "RECYCLED" ? "default" : "outline"} 
                        size="sm"
                        onClick={() => { setSourceType("RECYCLED"); setScores({ ...scores, source: 20 }); }}
                      >
                        {language === "fr" ? "Recyclé (20)" : "Recycled (20)"}
                      </Button>
                    </div>
                    
                    {/* CAHRA Flag */}
                    <div className="flex items-center space-x-3 pt-2">
                      <Checkbox
                        id="cahra"
                        checked={isCAHRA}
                        onCheckedChange={(checked) => setIsCAHRA(checked === true)}
                      />
                      <Label htmlFor="cahra" className="text-sm cursor-pointer">
                        {language === "fr" 
                          ? "Zone CAHRA (Conflit / Haut Risque) - Ajoute +20 au score"
                          : "CAHRA Zone (Conflict-Affected / High-Risk Area) - Adds +20 to score"}
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {/* PEP Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {language === "fr" ? "Risque PEP" : "PEP Risk"}
                      <Badge variant="outline" className="ml-auto">20%</Badge>
                    </CardTitle>
                    <CardDescription>
                      {language === "fr" 
                        ? "Exposition aux personnes politiquement exposées"
                        : "Politically Exposed Persons exposure"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Faible" : "Low"}</span>
                      <span className="text-2xl font-bold">{scores.pep}</span>
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Élevé" : "High"}</span>
                    </div>
                    <Slider
                      value={[scores.pep]}
                      onValueChange={([value]) => setScores({ ...scores, pep: value })}
                      max={100}
                      step={1}
                    />
                  </CardContent>
                </Card>

                {/* Volume Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {language === "fr" ? "Risque Volume" : "Volume Risk"}
                      <Badge variant="outline" className="ml-auto">15%</Badge>
                    </CardTitle>
                    <CardDescription>
                      {language === "fr" 
                        ? "Basé sur le volume de transactions attendu"
                        : "Based on expected transaction volume"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Faible" : "Low"}</span>
                      <span className="text-2xl font-bold">{scores.volume}</span>
                      <span className="text-sm text-muted-foreground">{language === "fr" ? "Élevé" : "High"}</span>
                    </div>
                    <Slider
                      value={[scores.volume]}
                      onValueChange={([value]) => setScores({ ...scores, volume: value })}
                      max={100}
                      step={1}
                    />
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>{language === "fr" ? "Notes d'évaluation" : "Assessment Notes"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={language === "fr" 
                        ? "Ajoutez des notes ou justifications pour cette évaluation..."
                        : "Add notes or justifications for this assessment..."}
                      rows={4}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Summary Panel */}
              <div className="space-y-6">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle>{language === "fr" ? "Score Global" : "Overall Score"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className={`flex flex-col items-center justify-center p-6 rounded-lg ${riskResult.bgColor}`}>
                      <span className={`text-5xl font-bold ${riskResult.color}`}>
                        {overallScore}
                      </span>
                      <Badge 
                        variant={riskResult.tier === "critical" || riskResult.tier === "high" ? "destructive" : "secondary"}
                        className="mt-2"
                      >
                        {riskResult.tier.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>{language === "fr" ? "Pays" : "Country"}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={scores.country} className="w-16 h-2" />
                          <span className="w-8 text-right">{scores.country}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Source</span>
                        <div className="flex items-center gap-2">
                          <Progress value={scores.source} className="w-16 h-2" />
                          <span className="w-8 text-right">{scores.source}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>PEP</span>
                        <div className="flex items-center gap-2">
                          <Progress value={scores.pep} className="w-16 h-2" />
                          <span className="w-8 text-right">{scores.pep}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Volume</span>
                        <div className="flex items-center gap-2">
                          <Progress value={scores.volume} className="w-16 h-2" />
                          <span className="w-8 text-right">{scores.volume}</span>
                        </div>
                      </div>
                    </div>

                    {/* ASM/Mercury Flag */}
                    {mercuryFlag && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-700 dark:text-red-400">
                            {language === "fr" ? "Exposition ASM/Mercure détectée" : "ASM/Mercury Exposure Detected"}
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-500">
                            {language === "fr" 
                              ? "Vérification de conformité Convention Minamata requise"
                              : "Minamata Convention compliance check required"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* CAHRA Flag */}
                    {cahraFlag && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800">
                        <Globe className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            {language === "fr" ? "Zone CAHRA identifiée" : "CAHRA Zone Identified"}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-500">
                            {language === "fr" 
                              ? "Vérification renforcée obligatoire"
                              : "Mandatory enhanced due diligence"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* EDD Warning */}
                    {eddRequired && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{language === "fr" ? "EDD Requis" : "EDD Required"}</AlertTitle>
                        <AlertDescription>
                          {language === "fr" 
                            ? "Une vérification renforcée sera déclenchée. La création de PO est bloquée jusqu'à l'achèvement."
                            : "Enhanced Due Diligence will be triggered. PO creation is blocked until completion."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Policy Acknowledgments - US-02 Screen 3 */}
                    <div className="space-y-4 pt-4 border-t">
                      <p className="font-semibold text-sm">
                        {language === "fr" ? "Reconnaissances obligatoires" : "Mandatory Acknowledgments"}
                      </p>
                      
                      {/* Tier Confirmation */}
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="acknowledge"
                          checked={acknowledged}
                          onCheckedChange={(checked) => setAcknowledged(checked === true)}
                        />
                        <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                          {language === "fr" 
                            ? `Je reconnais que cette contrepartie est classée comme risque ${riskResult.tier.toUpperCase()} et j'ai examiné toutes les informations disponibles.`
                            : `I acknowledge this counterparty is classified as ${riskResult.tier.toUpperCase()} risk and I have reviewed all available information.`}
                        </Label>
                      </div>

                      {/* EDD Acknowledgment - Required for HIGH/CRITICAL */}
                      {eddRequired && (
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="edd-acknowledge"
                            checked={eddAcknowledged}
                            onCheckedChange={(checked) => setEddAcknowledged(checked === true)}
                          />
                          <Label htmlFor="edd-acknowledge" className="text-sm leading-relaxed cursor-pointer">
                            {language === "fr" 
                              ? "Je confirme que les exigences EDD sont comprises: visite sur site programmée, rapport d'assurance indépendant requis, approbation du conseil enregistrée."
                              : "I confirm EDD requirements are understood: on-site visit scheduled, independent assurance report required, board approval logged."}
                          </Label>
                        </div>
                      )}

                      {/* Mercury Declaration - Required for ASM */}
                      {mercuryFlag && (
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="mercury-acknowledge"
                            checked={mercuryAcknowledged}
                            onCheckedChange={(checked) => setMercuryAcknowledged(checked === true)}
                          />
                          <Label htmlFor="mercury-acknowledge" className="text-sm leading-relaxed cursor-pointer">
                            {language === "fr" 
                              ? "Je confirme avoir initié le protocole d'évaluation du mercure conformément à la Convention de Minamata."
                              : "I confirm mercury assessment protocol has been initiated per Minamata Convention requirements."}
                          </Label>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3 border-t pt-6">
                    {!counterpartyValidation.isValid && (
                      <div className="w-full rounded-lg bg-amber-50 dark:bg-amber-900/30 p-3 border border-amber-200 dark:border-amber-700">
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                          {language === "fr" 
                            ? "L'évaluation sera enregistrée, mais la contrepartie ne sera pas activée. Informations manquantes:"
                            : "The assessment will be saved, but the counterparty will not be activated. Missing information:"}
                        </p>
                        <ul className="text-xs text-amber-700 dark:text-amber-400 mt-2 ml-4 list-disc">
                          {counterpartyValidation.missingFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          {language === "fr" 
                            ? "Complétez la fiche contrepartie pour permettre l'activation."
                            : "Complete the counterparty record to enable activation."}
                        </p>
                      </div>
                    )}
                    {!allAcknowledged && (
                      <div className="w-full rounded-lg bg-yellow-50 dark:bg-yellow-900/30 p-3 border border-yellow-200 dark:border-yellow-700">
                        <p className="text-xs text-yellow-800 dark:text-yellow-300">
                          {language === "fr" 
                            ? "Veuillez cocher toutes les reconnaissances obligatoires pour procéder."
                            : "Please check all mandatory acknowledgments to proceed."}
                        </p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 ml-4 space-y-1">
                          <li>✓ {language === "fr" ? "Classification de risque" : "Risk classification"}: {acknowledged ? "✓" : "✗"}</li>
                          {eddRequired && <li>✓ {language === "fr" ? "Exigences EDD" : "EDD requirements"}: {eddAcknowledged ? "✓" : "✗"}</li>}
                          {mercuryFlag && <li>✓ {language === "fr" ? "Protocole Mercure" : "Mercury protocol"}: {mercuryAcknowledged ? "✓" : "✗"}</li>}
                        </ul>
                      </div>
                    )}
                    <Button 
                      className="w-full" 
                      disabled={!allAcknowledged || isSubmitting}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                      type="button"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting 
                        ? (language === "fr" ? "Enregistrement..." : "Saving...") 
                        : (language === "fr" ? "Enregistrer l'évaluation" : "Save Assessment")}
                    </Button>
                  </CardFooter>
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
