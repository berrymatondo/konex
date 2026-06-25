"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Save,
  X,
  Building2,
  Users,
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  FileText,
  Send,
  AlertCircle,
  Download,
  FileEdit,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

interface UBO {
  id: string;
  fullName: string;
  nationality: string;
  ownershipPercent: number;
  isPEP: boolean;
  pepDetails?: string;
  dateOfBirth?: string;
}

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: string;
}

type DocumentType = "businessLicense" | "amlPolicy" | "uboDeclaration";

interface Counterparty {
  id: string;
  legalName: string;
  tradingName: string | null;
  registrationNumber: string;
  taxId: string | null;
  legalForm: string;
  countryOfIncorporation: string;
  dateOfIncorporation: string | null;
  registeredAddress: string;
  operationalAddress: string | null;
  primaryContact: string;
  primaryEmail: string;
  primaryPhone: string;
  goldSourceTypes: string[];
  estimatedAnnualVolume: number | null;
  primarySourceCountries: string[];
  status: string;
  riskLevel: string | null;
  createdAt: string;
  updatedAt: string;
  ubos: UBO[];
  documents: Document[];
  screeningResults?: Array<{
    id?: string;
    checkType: string;
    result: string;
    details?: Record<string, unknown> | null;
    checkedAt?: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getStatusConfig = (t: ReturnType<typeof useLanguage>["t"]): Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> => ({
  draft: { label: t.status.draft, className: "border-muted-foreground text-muted-foreground", icon: FileEdit },
  active: { label: t.status.active, className: "border-success text-success", icon: CheckCircle2 },
  pending_review: { label: t.status.pending_review, className: "border-warning text-warning", icon: Clock },
  pending_screening: { label: t.status.pending_screening, className: "border-info text-info", icon: Clock },
  pending_risk_review: { label: t.status.pending_risk_review, className: "border-primary text-primary", icon: Shield },
  blocked: { label: t.status.blocked, className: "border-destructive text-destructive bg-destructive/10", icon: XCircle },
});

const countries = [
  { code: "Ghana", name: "Ghana" },
  { code: "Mali", name: "Mali" },
  { code: "Democratic Republic of Congo", name: "Democratic Republic of Congo" },
  { code: "Burkina Faso", name: "Burkina Faso" },
  { code: "Switzerland", name: "Switzerland" },
  { code: "Germany", name: "Germany" },
  { code: "South Africa", name: "South Africa" },
  { code: "United Kingdom", name: "United Kingdom" },
  { code: "United States", name: "United States" },
];

interface FormUBO {
  id: string;
  fullName: string;
  nationality: string;
  ownershipPercent: string;
  isPEP: boolean;
  pepDetails: string;
}

export default function CounterpartyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { t, language } = useLanguage();
  const statusConfig = getStatusConfig(t);

  const { data: counterparty, error, isLoading, mutate } = useSWR<Counterparty>(
    `/api/counterparties/${id}`,
    fetcher
  );

  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "true");
  const [formData, setFormData] = useState({
    legalName: "",
    tradingName: "",
    registrationNumber: "",
    taxId: "",
    legalForm: "",
    countryOfIncorporation: "",
    registeredAddress: "",
    operationalAddress: "",
    primaryContact: "",
    primaryEmail: "",
    primaryPhone: "",
  });
  const [goldSourceTypes, setGoldSourceTypes] = useState<string[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string>("");
  const [ubos, setUbos] = useState<FormUBO[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newDocuments, setNewDocuments] = useState<{ [key in DocumentType]?: File }>({});
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Calculate total UBO ownership
  const totalOwnership = ubos.reduce(
    (sum, ubo) => sum + (parseFloat(ubo.ownershipPercent) || 0),
    0
  );

  const handleDocumentUpload = (docType: DocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setNewDocuments((prev) => ({ ...prev, [docType]: files[0] }));
    }
  };

  const removeNewDocument = (docType: DocumentType) => {
    setNewDocuments((prev) => {
      const updated = { ...prev };
      delete updated[docType];
      return updated;
    });
  };

  const markDocumentForDeletion = (docId: string) => {
    setDocumentsToDelete((prev) => [...prev, docId]);
  };

  const cancelDocumentDeletion = (docId: string) => {
    setDocumentsToDelete((prev) => prev.filter((id) => id !== docId));
  };

  const uploadNewDocuments = async () => {
    const entries = Object.entries(newDocuments);
    for (const [docType, file] of entries) {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("counterpartyId", id);
        formData.append("documentType", docType);
        
        await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });
      }
    }
  };

  const deleteMarkedDocuments = async () => {
    for (const docId of documentsToDelete) {
      await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
    }
  };

  useEffect(() => {
    if (counterparty) {
      setFormData({
        legalName: counterparty.legalName,
        tradingName: counterparty.tradingName || "",
        registrationNumber: counterparty.registrationNumber,
        taxId: counterparty.taxId || "",
        legalForm: counterparty.legalForm,
        countryOfIncorporation: counterparty.countryOfIncorporation,
        registeredAddress: counterparty.registeredAddress,
        operationalAddress: counterparty.operationalAddress || "",
        primaryContact: counterparty.primaryContact,
        primaryEmail: counterparty.primaryEmail,
        primaryPhone: counterparty.primaryPhone,
      });
      setGoldSourceTypes(counterparty.goldSourceTypes);
      // Set selected source type (exclusive selection)
      setSelectedSourceType(counterparty.goldSourceTypes?.[0] || "");
      setUbos(
        counterparty.ubos.map((ubo) => ({
          id: ubo.id,
          fullName: ubo.fullName,
          nationality: ubo.nationality,
          ownershipPercent: ubo.ownershipPercent.toString(),
          isPEP: ubo.isPEP,
          pepDetails: ubo.pepDetails || "",
        }))
      );
    }
  }, [counterparty]);

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={t.common.loading} />
            <main className="flex flex-1 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (error || !counterparty) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={t.counterparties.noCounterparties} />
            <main className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold">{t.counterparties.noCounterparties}</h2>
                <p className="mt-2 text-muted-foreground">
                  {t.counterparties.noCounterpartiesDesc}
                </p>
                <Link href="/counterparties">
                  <Button className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t.common.back}
                  </Button>
                </Link>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUBOChange = (index: number, field: keyof FormUBO, value: string | boolean) => {
    setUbos((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addUBO = () => {
    setUbos((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, fullName: "", nationality: "", ownershipPercent: "", isPEP: false, pepDetails: "" },
    ]);
  };

  const removeUBO = (index: number) => {
    if (ubos.length > 1) {
      setUbos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Keep the current status - don't change it during regular save
      const currentStatus = counterparty?.status || "draft";
      
      // Update counterparty data
      const response = await fetch(`/api/counterparties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          goldSourceTypes: selectedSourceType ? [selectedSourceType] : [],
          status: currentStatus,
          ubos: ubos.map((ubo) => ({
            fullName: ubo.fullName,
            nationality: ubo.nationality,
            ownershipPercent: parseFloat(ubo.ownershipPercent) || 0,
            isPEP: ubo.isPEP,
            pepDetails: ubo.pepDetails || undefined,
          })),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }
      
      // Handle document changes
      await deleteMarkedDocuments();
      await uploadNewDocuments();
      
      // Reset document states
      setNewDocuments({});
      setDocumentsToDelete([]);
      
      await mutate();
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving counterparty:", error);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    if (counterparty) {
      setFormData({
        legalName: counterparty.legalName,
        tradingName: counterparty.tradingName || "",
        registrationNumber: counterparty.registrationNumber,
        taxId: counterparty.taxId || "",
        legalForm: counterparty.legalForm,
        countryOfIncorporation: counterparty.countryOfIncorporation,
        registeredAddress: counterparty.registeredAddress,
        operationalAddress: counterparty.operationalAddress || "",
        primaryContact: counterparty.primaryContact,
        primaryEmail: counterparty.primaryEmail,
        primaryPhone: counterparty.primaryPhone,
      });
      setGoldSourceTypes(counterparty.goldSourceTypes);
      setUbos(
        counterparty.ubos.map((ubo) => ({
          id: ubo.id,
          fullName: ubo.fullName,
          nationality: ubo.nationality,
          ownershipPercent: ubo.ownershipPercent.toString(),
          isPEP: ubo.isPEP,
          pepDetails: ubo.pepDetails || "",
        }))
      );
    }
    setIsEditing(false);
  };

  // Validation function for required fields (Issue #7)
  const validateRequiredFields = () => {
    const required = {
      legalName: formData.legalName?.trim(),
      registrationNumber: formData.registrationNumber?.trim(),
      countryOfIncorporation: formData.countryOfIncorporation?.trim(),
      registeredAddress: formData.registeredAddress?.trim(),
      primaryContact: formData.primaryContact?.trim(),
      primaryEmail: formData.primaryEmail?.trim(),
    };
    
    const missingFields = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    
    // Check if at least one UBO exists with required info
    const hasValidUbo = ubos.some(ubo => 
      ubo.fullName?.trim() && 
      ubo.nationality?.trim() && 
      parseFloat(ubo.ownershipPercent) > 0
    );
    
    if (!hasValidUbo) {
      missingFields.push("ubo");
    }
    
    // Check that total ownership doesn't exceed 100%
    if (totalOwnership > 100) {
      missingFields.push("ownership_exceeds_100");
    }
    
    // Check if at least one document is uploaded (excluding those marked for deletion)
    const existingDocuments = counterparty?.documents || [];
    const remainingDocuments = existingDocuments.filter(doc => !documentsToDelete.includes(doc.id));
    const newDocumentCount = Object.keys(newDocuments).length;
    const totalDocumentCount = remainingDocuments.length + newDocumentCount;
    
    if (totalDocumentCount === 0) {
      missingFields.push("documents");
    }
    
    // Check if gold source type is selected
    if (!selectedSourceType) {
      missingFields.push("goldSourceType");
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  };

  const isReadyForReview = () => {
    const validation = validateRequiredFields();
    return validation.isValid && totalOwnership <= 100;
  };

  // Submit for review function (Issue #4)
  const handleSubmitForReview = async () => {
    const validation = validateRequiredFields();
    if (!validation.isValid) {
      alert(language === "fr" 
        ? `Veuillez remplir tous les champs obligatoires: ${validation.missingFields.join(", ")}`
        : `Please fill all required fields: ${validation.missingFields.join(", ")}`
      );
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/counterparties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          goldSourceTypes: selectedSourceType ? [selectedSourceType] : [],
          status: "pending_review",
          ubos: ubos.map((ubo) => ({
            fullName: ubo.fullName,
            nationality: ubo.nationality,
            ownershipPercent: parseFloat(ubo.ownershipPercent) || 0,
            isPEP: ubo.isPEP,
            pepDetails: ubo.pepDetails || undefined,
          })),
        }),
      });
      
      if (response.ok) {
        await mutate();
        router.push(`/screening/${id}?submitted=true`);
      }
    } catch (error) {
      console.error("Error submitting for review:", error);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    await fetch(`/api/counterparties/${id}`, { method: "DELETE" });
    router.push("/counterparties");
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "N/A";
      return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch {
      return "N/A";
    }
  };

  const status = statusConfig[counterparty.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={counterparty.legalName}
            subtitle={`Registration: ${counterparty.registrationNumber}`}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/counterparties">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t.common.back}
                  </Button>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" />
                        {t.common.cancel}
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving || totalOwnership > 100}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? t.common.loading : t.common.save}
                      </Button>
                      {(counterparty.status === "draft" || counterparty.status === "pending_review") && isReadyForReview() && (
                        <Button variant="default" onClick={handleSubmitForReview} disabled={isSaving || totalOwnership > 100}>
                          <Send className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Soumettre pour revue" : "Submit for Review"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t.common.edit}
                      </Button>
                      {counterparty.status === "draft" && isReadyForReview() && (
                        <Button variant="default" onClick={handleSubmitForReview} disabled={isSaving}>
                          <Send className="mr-2 h-4 w-4" />
                          {language === "fr" ? "Soumettre pour revue" : "Submit for Review"}
                        </Button>
                      )}
                      <Link href={`/screening/${counterparty.id}`}>
                        <Button variant="secondary">
                          <Shield className="mr-2 h-4 w-4" />
                          <span className="hidden sm:inline">{t.counterparties.viewScreening}</span>
                          <span className="sm:hidden">{t.screening.title}</span>
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t.common.delete}</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.counterparties.deleteConfirmTitle}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.counterparties.deleteConfirmMessage} &quot;{counterparty.legalName}&quot;? {t.counterparties.deleteConfirmWarning}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t.common.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              {/* Status Card */}
              <Card>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn("text-sm py-1 px-3", status.className)}>
                      <StatusIcon className="mr-2 h-4 w-4" />
                      {status.label}
                    </Badge>
                    <Separator orientation="vertical" className="h-6 hidden sm:block" />
                    <div className="text-sm text-muted-foreground">
                      {t.counterparties.updatedAt}: {formatDate(counterparty.updatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {counterparty.goldSourceTypes.map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className={cn(type === "ASM" && "bg-destructive/10 text-destructive")}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {t.counterparties.companyInfo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.counterparties.legalName} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.legalName}
                          onChange={(e) => handleInputChange("legalName", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.legalName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.counterparties.tradingName}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.tradingName}
                          onChange={(e) => handleInputChange("tradingName", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.tradingName || "-"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.counterparties.registrationNumber} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.registrationNumber}
                          disabled
                          className="bg-muted cursor-not-allowed"
                        />
                      ) : (
                        <p className="text-sm font-mono">{counterparty.registrationNumber}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.counterparties.taxId}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.taxId}
                          onChange={(e) => handleInputChange("taxId", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.taxId || "-"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.common.country} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Select
                          value={formData.countryOfIncorporation}
                          onValueChange={(value) => handleInputChange("countryOfIncorporation", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{counterparty.countryOfIncorporation}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.counterparties.legalForm}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.legalForm}
                          onChange={(e) => handleInputChange("legalForm", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.legalForm}</p>
                      )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t.counterparties.registeredAddress} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.registeredAddress}
                          onChange={(e) => handleInputChange("registeredAddress", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.registeredAddress}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t.counterparties.primaryContact} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Input
                          value={formData.primaryContact}
                          onChange={(e) => handleInputChange("primaryContact", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.primaryContact}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.common.email} {isEditing && <span className="text-destructive">*</span>}</Label>
                      {isEditing ? (
                        <Input
                          type="email"
                          value={formData.primaryEmail}
                          onChange={(e) => handleInputChange("primaryEmail", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.primaryEmail}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t.common.phone}</Label>
                      {isEditing ? (
                        <Input
                          type="tel"
                          value={formData.primaryPhone}
                          onChange={(e) => handleInputChange("primaryPhone", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">{counterparty.primaryPhone}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Source Types */}
              {isEditing && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t.counterparties.goldSourceTypes}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={selectedSourceType}
                      onValueChange={(value) => setSelectedSourceType(value)}
                      className="flex flex-col gap-4 sm:flex-row sm:flex-wrap"
                    >
                      {["ASM", "LSM", "RECYCLED"].map((type) => (
                        <div
                          key={type}
                          className={`flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer ${
                            selectedSourceType === type ? "border-primary bg-primary/5" : "border-border"
                          }`}
                          onClick={() => setSelectedSourceType(type)}
                        >
                          <RadioGroupItem value={type} id={`source-${type}`} />
                          <div className="flex-1">
                            <Label htmlFor={`source-${type}`} className="cursor-pointer font-medium">
                              {type === "ASM"
                                ? t.onboarding.sourceTypes.ASM
                                : type === "LSM"
                                ? t.onboarding.sourceTypes.LSM
                                : t.onboarding.sourceTypes.Recycled}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {type === "ASM" ? t.risk.high : t.risk.low}
                            </p>
                          </div>
                          {type === "ASM" && (
                            <Badge variant="outline" className="border-destructive text-destructive">
                              {t.risk.high}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}

              {/* UBOs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t.counterparties.ubos}
                      {isEditing && <span className="text-destructive">*</span>}
                    </CardTitle>
                    {isEditing && (
                      <Button onClick={addUBO} variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t.onboarding.addUbo}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Ownership validation warning */}
                  {isEditing && totalOwnership > 100 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {language === "fr" 
                          ? `Le total des participations ne peut pas dépasser 100%. Total actuel: ${totalOwnership.toFixed(1)}%`
                          : `Total ownership cannot exceed 100%. Current total: ${totalOwnership.toFixed(1)}%`}
                      </AlertDescription>
                    </Alert>
                  )}
                  {isEditing ? (
                    ubos.map((ubo, index) => (
                      <div key={ubo.id} className="space-y-4 rounded-lg border border-border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">UBO {index + 1}</h4>
                          {ubos.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeUBO(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>{t.onboarding.fullName}</Label>
                            <Input
                              value={ubo.fullName}
                              onChange={(e) => handleUBOChange(index, "fullName", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.onboarding.selectNationality}</Label>
                            <Select
                              value={ubo.nationality}
                              onValueChange={(value) => handleUBOChange(index, "nationality", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t.onboarding.selectNationality} />
                              </SelectTrigger>
                              <SelectContent>
                                {countries.map((c) => (
                                  <SelectItem key={c.code} value={c.name}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t.onboarding.ownershipPercentage}</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={ubo.ownershipPercent}
                              onChange={(e) => handleUBOChange(index, "ownershipPercent", e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-3 pt-6">
                            <Checkbox
                              id={`pep-${index}`}
                              checked={ubo.isPEP}
                              onCheckedChange={(checked) => handleUBOChange(index, "isPEP", !!checked)}
                            />
                            <Label htmlFor={`pep-${index}`} className="cursor-pointer">
                              {t.onboarding.isPEP}
                            </Label>
                          </div>
                          {ubo.isPEP && (
                            <div className="space-y-2 sm:col-span-2">
                              <Label>{t.onboarding.pepPosition}</Label>
                              <Input
                                value={ubo.pepDetails}
                                onChange={(e) => handleUBOChange(index, "pepDetails", e.target.value)}
                                placeholder={t.onboarding.pepPosition}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-4">
                      {counterparty.ubos.map((ubo, index) => (
                        <div key={ubo.id} className="flex items-start justify-between rounded-lg border border-border p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{ubo.fullName}</span>
                              {ubo.isPEP && (
                                <Badge variant="outline" className="border-warning text-warning">
                                  PEP
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {ubo.nationality} &middot; {ubo.ownershipPercent}% {language === "fr" ? "de propriété" : "ownership"}
                            </p>
                            {ubo.isPEP && ubo.pepDetails && (
                              <p className="text-sm text-muted-foreground italic">{ubo.pepDetails}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {counterparty.ubos.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t.counterparties.noUbos}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t.counterparties.documents}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Existing Documents */}
                      {counterparty.documents && counterparty.documents.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">{language === "fr" ? "Documents existants" : "Existing Documents"}</Label>
                          {counterparty.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className={cn(
                                "flex items-center justify-between rounded-lg border p-3",
                                documentsToDelete.includes(doc.id)
                                  ? "border-destructive bg-destructive/10 opacity-50"
                                  : "border-border"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{doc.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {t.onboarding.documentTypes[doc.type as DocumentType] || doc.type}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <a href={doc.fileUrl} download={doc.fileName}>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                                {documentsToDelete.includes(doc.id) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelDocumentDeletion(doc.id)}
                                  >
                                    {t.common.cancel}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markDocumentForDeletion(doc.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload New Documents */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">{language === "fr" ? "Ajouter des documents" : "Add Documents"}</Label>
                        <div className="grid gap-4 md:grid-cols-3">
                          {(["businessLicense", "amlPolicy", "uboDeclaration"] as DocumentType[]).map((docType) => {
                            const existingDoc = counterparty.documents?.find((d) => d.type === docType);
                            const newDoc = newDocuments[docType];
                            const isExistingMarkedForDeletion = existingDoc && documentsToDelete.includes(existingDoc.id);
                            
                            // Show upload zone if no existing doc OR existing is marked for deletion
                            if (!existingDoc || isExistingMarkedForDeletion) {
                              return (
                                <div key={docType} className="space-y-2">
                                  <Label className="text-xs">{t.onboarding.documentTypes[docType]}</Label>
                                  {newDoc ? (
                                    <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-sm truncate">{newDoc.name}</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeNewDocument(docType)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <label className="block cursor-pointer">
                                      <div className="rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
                                        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {language === "fr" ? "Cliquez pour charger" : "Click to upload"}
                                        </p>
                                      </div>
                                      <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(docType, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {counterparty.documents && counterparty.documents.length > 0 ? (
                        counterparty.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-lg border border-border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-primary" />
                              <div>
                                <p className="text-sm font-medium">{doc.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.onboarding.documentTypes[doc.type as DocumentType] || doc.type}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.fileUrl} download={doc.fileName}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" ? "Aucun document attaché" : "No documents attached"}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compliance Officer Notes - Audit Trail */}
              {(() => {
                const complianceScoreResult = counterparty.screeningResults?.find(
                  (r) => r.checkType === "us01_compliance_score"
                );
                const complianceNotes = complianceScoreResult?.details?.compliance_officer_notes as string | undefined;
                const auditTimestamp = complianceScoreResult?.checkedAt;
                
                if (!complianceNotes) return null;
                
                return (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-600">
                        <MessageSquare className="h-5 w-5" />
                        {language === "fr" ? "Notes du Responsable de Conformité" : "Compliance Officer Notes"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-lg bg-background/80 p-4 border border-amber-500/20">
                        <p className="text-sm whitespace-pre-wrap">{complianceNotes}</p>
                      </div>
                      {auditTimestamp && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {language === "fr" ? "Enregistré le" : "Recorded on"}{" "}
                          {new Date(auditTimestamp).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
