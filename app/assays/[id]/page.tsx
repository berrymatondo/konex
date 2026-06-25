"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  FlaskConical,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Scale,
  Percent,
  Building2,
  Calendar,
  FileText,
  Edit,
  Trash2,
  Download,
  Shield,
  Beaker,
  Award,
  XCircle,
  Save,
  Printer,
} from "lucide-react";
import { generateAssayCertificatePDF } from "@/lib/pdf-generator";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Assay {
  id: string;
  purchaseOrderId: string | null;
  poTrackingId: string | null;
  poStatus: string | null;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyCountry: string | null;
  counterpartyStatus: string | null;
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

export default function AssayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { language } = useLanguage();

  const { data: assay, isLoading, error, mutate } = useSWR<Assay>(
    `/api/assays/${resolvedParams.id}`,
    fetcher
  );

  const [isEditing, setIsEditing] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [editData, setEditData] = useState({
    netWeightKg: "",
    purityPercentage: "",
    assayMethod: "",
    laboratory: "",
    assayDate: "",
    notes: "",
  });

  const initEditData = () => {
    if (assay) {
      setEditData({
        netWeightKg: assay.netWeightKg?.toString() || "",
        purityPercentage: assay.purityPercentage ? (assay.purityPercentage * 100).toString() : "",
        assayMethod: assay.assayMethod || "",
        laboratory: assay.laboratory || "",
        assayDate: assay.assayDate?.split("T")[0] || "",
        notes: assay.notes || "",
      });
    }
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

  const getMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      fire_assay: "Fire Assay",
      xrf: "XRF (X-Ray Fluorescence)",
      icp: "ICP-OES (Inductively Coupled Plasma)",
      gravimetric: "Gravimetric Analysis",
    };
    return method ? methods[method] || method : "-";
  };

  const handleSaveChanges = async () => {
    if (!assay) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assays/${assay.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          netWeightKg: editData.netWeightKg ? parseFloat(editData.netWeightKg) : null,
          purityPercentage: editData.purityPercentage ? parseFloat(editData.purityPercentage) / 100 : null,
          assayMethod: editData.assayMethod || null,
          laboratory: editData.laboratory || null,
          assayDate: editData.assayDate || null,
          notes: editData.notes || null,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        mutate();
      }
    } catch (error) {
      console.error("Error updating assay:", error);
    }
    setIsSubmitting(false);
  };

  const handleVerify = async () => {
    if (!assay) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assays/${assay.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "verified",
          verifiedBy: "Compliance Officer",
        }),
      });

      if (response.ok) {
        setShowVerifyDialog(false);
        mutate();
      }
    } catch (error) {
      console.error("Error verifying assay:", error);
    }
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (!assay) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assays/${assay.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          notes: rejectReason ? `${assay.notes || ""}\n\nRejection Reason: ${rejectReason}` : assay.notes,
        }),
      });

      if (response.ok) {
        setShowRejectDialog(false);
        setRejectReason("");
        mutate();
      }
    } catch (error) {
      console.error("Error rejecting assay:", error);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!assay) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assays/${assay.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/assays");
      }
    } catch (error) {
      console.error("Error deleting assay:", error);
    }
    setIsSubmitting(false);
  };

  const handlePrintCertificate = () => {
    if (!assay) return;
    
    generateAssayCertificatePDF({
      batchNumber: assay.batchNumber,
      counterpartyName: assay.counterpartyName,
      counterpartyCountry: assay.counterpartyCountry || "N/A",
      grossWeightKg: assay.grossWeightKg,
      netWeightKg: assay.netWeightKg || assay.grossWeightKg,
      purityPercentage: assay.purityPercentage || 0,
      fineGoldWeightKg: assay.fineGoldWeightKg || 0,
      assayMethod: getMethodLabel(assay.assayMethod),
      laboratory: assay.laboratory || "N/A",
      assayDate: assay.assayDate || new Date().toISOString(),
      status: assay.status,
      verifiedBy: assay.verifiedBy || undefined,
      verifiedAt: assay.verifiedAt || undefined,
    }, {
      title: language === "fr" ? "Certificat d'Essai" : "Assay Certificate",
      filename: `ASSAY-CERT-${assay.batchNumber}.pdf`,
    });
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={language === "fr" ? "Chargement..." : "Loading..."} />
            <main className="flex-1 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">
                {language === "fr" ? "Chargement des données..." : "Loading data..."}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (error || !assay) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={language === "fr" ? "Erreur" : "Error"} />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <p className="text-muted-foreground">
                  {language === "fr" ? "Essai non trouvé" : "Assay not found"}
                </p>
                <Button asChild>
                  <Link href="/assays">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Retour aux essais" : "Back to assays"}
                  </Link>
                </Button>
              </div>
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
            title={assay.batchNumber}
            subtitle={language === "fr" ? "Détails de l'essai" : "Assay Details"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Header Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button variant="outline" asChild>
                  <Link href="/assays">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Retour" : "Back"}
                  </Link>
                </Button>
                <div className="flex gap-2">
                  {assay.status === "verified" && (
                    <Button variant="outline" onClick={handlePrintCertificate}>
                      <Printer className="mr-2 h-4 w-4" />
                      {language === "fr" ? "Certificat PDF" : "PDF Certificate"}
                    </Button>
                  )}
                  {assay.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          initEditData();
                          setIsEditing(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Modifier" : "Edit"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowRejectDialog(true)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Rejeter" : "Reject"}
                      </Button>
                      <Button onClick={() => setShowVerifyDialog(true)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Vérifier" : "Verify"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {assay.status === "verified" && (
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Award className="h-8 w-8 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-emerald-600">
                        {language === "fr" ? "Essai Vérifié" : "Verified Assay"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Vérifié par" : "Verified by"} {assay.verifiedBy}{" "}
                        {language === "fr" ? "le" : "on"}{" "}
                        {assay.verifiedAt
                          ? new Date(assay.verifiedAt).toLocaleDateString(
                              language === "fr" ? "fr-FR" : "en-US"
                            )
                          : "-"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {assay.status === "rejected" && (
                <Card className="bg-red-500/5 border-red-500/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <XCircle className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="font-semibold text-red-600">
                        {language === "fr" ? "Essai Rejeté" : "Rejected Assay"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr"
                          ? "Cet essai a été rejeté et ne peut pas être utilisé."
                          : "This assay has been rejected and cannot be used."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="details" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="details">
                    {language === "fr" ? "Détails" : "Details"}
                  </TabsTrigger>
                  <TabsTrigger value="analysis">
                    {language === "fr" ? "Analyse" : "Analysis"}
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    {language === "fr" ? "Documents" : "Documents"}
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Batch Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FlaskConical className="h-5 w-5" />
                          {language === "fr" ? "Informations du Lot" : "Batch Information"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "N° de Lot" : "Batch Number"}
                          </span>
                          <span className="font-mono font-medium">{assay.batchNumber}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "Statut" : "Status"}
                          </span>
                          {getStatusBadge(assay.status)}
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "Date de création" : "Created"}
                          </span>
                          <span>
                            {new Date(assay.createdAt).toLocaleDateString(
                              language === "fr" ? "fr-FR" : "en-US"
                            )}
                          </span>
                        </div>
                        {assay.purchaseOrderId && (
                          <>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">
                                {language === "fr" ? "Ordre d'achat" : "Purchase Order"}
                              </span>
                              <Link
                                href={`/purchase-orders/${assay.purchaseOrderId}`}
                                className="text-primary hover:underline font-mono"
                              >
                                {assay.poTrackingId || assay.purchaseOrderId}
                              </Link>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Counterparty Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {language === "fr" ? "Contrepartie" : "Counterparty"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "Nom" : "Name"}
                          </span>
                          <Link
                            href={`/counterparties/${assay.counterpartyId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {assay.counterpartyName}
                          </Link>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "Pays" : "Country"}
                          </span>
                          <span>{assay.counterpartyCountry || "-"}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {language === "fr" ? "Statut KYC" : "KYC Status"}
                          </span>
                          <Badge
                            variant={
                              assay.counterpartyStatus === "active" ? "default" : "secondary"
                            }
                          >
                            {assay.counterpartyStatus || "-"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Weight & Purity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "Poids & Pureté" : "Weight & Purity"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {language === "fr" ? "Poids Brut" : "Gross Weight"}
                          </p>
                          <p className="text-2xl font-bold">
                            {assay.grossWeightKg.toFixed(3)} <span className="text-sm font-normal">kg</span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {language === "fr" ? "Poids Net" : "Net Weight"}
                          </p>
                          <p className="text-2xl font-bold">
                            {assay.netWeightKg?.toFixed(3) || "-"}{" "}
                            {assay.netWeightKg && <span className="text-sm font-normal">kg</span>}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {language === "fr" ? "Pureté" : "Purity"}
                          </p>
                          <p className="text-2xl font-bold text-amber-500">
                            {assay.purityPercentage
                              ? `${(assay.purityPercentage * 100).toFixed(2)}%`
                              : "-"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {language === "fr" ? "Or Fin" : "Fine Gold"}
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            {assay.fineGoldWeightKg?.toFixed(3) || "-"}{" "}
                            {assay.fineGoldWeightKg && <span className="text-sm font-normal">kg</span>}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  {assay.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{assay.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Analysis Tab */}
                <TabsContent value="analysis" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Beaker className="h-5 w-5" />
                        {language === "fr" ? "Détails de l'Analyse" : "Analysis Details"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {language === "fr" ? "Méthode d'Essai" : "Assay Method"}
                            </p>
                            <p className="font-medium">{getMethodLabel(assay.assayMethod)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {language === "fr" ? "Laboratoire" : "Laboratory"}
                            </p>
                            <p className="font-medium">{assay.laboratory || "-"}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {language === "fr" ? "Date d'Essai" : "Assay Date"}
                            </p>
                            <p className="font-medium">
                              {assay.assayDate
                                ? new Date(assay.assayDate).toLocaleDateString(
                                    language === "fr" ? "fr-FR" : "en-US"
                                  )
                                : "-"}
                            </p>
                          </div>
                          {assay.status === "verified" && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">
                                {language === "fr" ? "Vérifié par" : "Verified By"}
                              </p>
                              <p className="font-medium">{assay.verifiedBy || "-"}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Purity Analysis Visual */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Percent className="h-5 w-5" />
                        {language === "fr" ? "Analyse de Pureté" : "Purity Analysis"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {assay.purityPercentage ? (
                        <div className="space-y-4">
                          <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                              style={{ width: `${assay.purityPercentage * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                              {(assay.purityPercentage * 100).toFixed(2)}% Au
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">
                                {language === "fr" ? "Poids Net Entrant" : "Input Net Weight"}
                              </p>
                              <p className="font-semibold">{assay.netWeightKg?.toFixed(3) || "-"} kg</p>
                            </div>
                            <div className="p-3 bg-amber-500/10 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">
                                {language === "fr" ? "Facteur de Pureté" : "Purity Factor"}
                              </p>
                              <p className="font-semibold text-amber-600">
                                ×{assay.purityPercentage?.toFixed(4)}
                              </p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">
                                {language === "fr" ? "Or Fin Résultant" : "Resulting Fine Gold"}
                              </p>
                              <p className="font-semibold text-primary">
                                {assay.fineGoldWeightKg?.toFixed(3) || "-"} kg
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          {language === "fr"
                            ? "Données de pureté non disponibles"
                            : "Purity data not available"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {language === "fr" ? "Documents & Certificats" : "Documents & Certificates"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {assay.status === "verified" ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Award className="h-8 w-8 text-amber-500" />
                              <div>
                                <p className="font-medium">
                                  {language === "fr" ? "Certificat d'Essai" : "Assay Certificate"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {language === "fr" ? "Document officiel vérifié" : "Official verified document"}
                                </p>
                              </div>
                            </div>
                            <Button onClick={handlePrintCertificate}>
                              <Download className="mr-2 h-4 w-4" />
                              {language === "fr" ? "Télécharger" : "Download"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>
                            {language === "fr"
                              ? "Les certificats sont disponibles uniquement pour les essais vérifiés"
                              : "Certificates are only available for verified assays"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Delete Button */}
              {assay.status !== "verified" && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Supprimer l'essai" : "Delete Assay"}
                  </Button>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Modifier l'Essai" : "Edit Assay"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Mettez à jour les résultats de l'analyse"
                : "Update the analysis results"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Poids net (kg)" : "Net Weight (kg)"}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editData.netWeightKg}
                  onChange={(e) => setEditData({ ...editData, netWeightKg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Pureté (%)" : "Purity (%)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  max="100"
                  value={editData.purityPercentage}
                  onChange={(e) => setEditData({ ...editData, purityPercentage: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Méthode" : "Method"}</Label>
                <Select
                  value={editData.assayMethod}
                  onValueChange={(v) => setEditData({ ...editData, assayMethod: v })}
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
              <div className="space-y-2">
                <Label>{language === "fr" ? "Laboratoire" : "Laboratory"}</Label>
                <Input
                  value={editData.laboratory}
                  onChange={(e) => setEditData({ ...editData, laboratory: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "fr" ? "Date d'essai" : "Assay Date"}</Label>
              <Input
                type="date"
                value={editData.assayDate}
                onChange={(e) => setEditData({ ...editData, assayDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting
                ? language === "fr"
                  ? "Enregistrement..."
                  : "Saving..."
                : language === "fr"
                ? "Enregistrer"
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <AlertDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Vérifier l'Essai" : "Verify Assay"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? "Êtes-vous sûr de vouloir vérifier cet essai ? Cette action confirmera les résultats de l'analyse et permettra la génération du certificat."
                : "Are you sure you want to verify this assay? This will confirm the analysis results and enable certificate generation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleVerify} disabled={isSubmitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {language === "fr" ? "Vérifier" : "Verify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Rejeter l'Essai" : "Reject Assay"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Veuillez indiquer la raison du rejet"
                : "Please provide a reason for rejection"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={language === "fr" ? "Raison du rejet..." : "Rejection reason..."}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              <XCircle className="mr-2 h-4 w-4" />
              {language === "fr" ? "Rejeter" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer l'Essai" : "Delete Assay"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? "Êtes-vous sûr de vouloir supprimer cet essai ? Cette action est irréversible."
                : "Are you sure you want to delete this assay? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
