"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Upload, FileText, AlertCircle, Save, Send, X } from "lucide-react";
import { jurisdictions } from "@/lib/mock-data";
import type { SourceType, UBO } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n/language-context";

interface FormUBO {
  id: string;
  name: string;
  nationality: string;
  ownershipPercentage: string;
  isPEP: boolean;
  position: string;
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
}

type DocumentType = "businessLicense" | "amlPolicy" | "uboDeclaration";

interface DocumentFiles {
  businessLicense: UploadedFile | null;
  amlPolicy: UploadedFile | null;
  uboDeclaration: UploadedFile | null;
}

// Generate a unique sequence number (in production, this would come from the database)
function generateSequenceNumber(): string {
  // Simulate fetching the next sequence from database
  // In production: SELECT MAX(sequence) + 1 FROM counterparties WHERE year = current_year
  const randomSequence = Math.floor(Math.random() * 99999) + 1;
  return randomSequence.toString().padStart(5, "0");
}

// Generate registration number: ISO_CODE-YEAR-SEQUENCE
function generateRegistrationNumber(countryCode: string): string {
  const currentYear = new Date().getFullYear();
  const sequence = generateSequenceNumber();
  return `${countryCode}-${currentYear}-${sequence}`;
}

export function OnboardingForm() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState({
    legalName: "",
    registrationNumber: "",
    jurisdiction: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
  });
  
  // Auto-generate registration number when jurisdiction changes
  useEffect(() => {
    if (formData.jurisdiction) {
      const newRegNumber = generateRegistrationNumber(formData.jurisdiction);
      setFormData((prev) => ({ ...prev, registrationNumber: newRegNumber }));
    } else {
      setFormData((prev) => ({ ...prev, registrationNumber: "" }));
    }
  }, [formData.jurisdiction]);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType | "">("");
  const [ubos, setUbos] = useState<FormUBO[]>([
    { id: "1", name: "", nationality: "", ownershipPercentage: "", isPEP: false, position: "" },
  ]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFiles>({
    businessLicense: null,
    amlPolicy: null,
    uboDeclaration: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      { id: Date.now().toString(), name: "", nationality: "", ownershipPercentage: "", isPEP: false, position: "" },
    ]);
  };

  const removeUBO = (index: number) => {
    if (ubos.length > 1) {
      setUbos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleDocumentUpload = (docType: DocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (uploadedFiles && uploadedFiles[0]) {
      const file = uploadedFiles[0];
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        file: file,
      };
      setDocumentFiles((prev) => ({ ...prev, [docType]: newFile }));
    }
  };

  const removeDocument = (docType: DocumentType) => {
    setDocumentFiles((prev) => ({ ...prev, [docType]: null }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const totalOwnership = ubos.reduce(
    (sum, ubo) => sum + (parseFloat(ubo.ownershipPercentage) || 0),
    0
  );

  // Submit for Review is only allowed when every required (*) field is filled.
  const companyInfoComplete =
    formData.legalName.trim() !== "" &&
    formData.jurisdiction.trim() !== "" &&
    formData.registrationNumber.trim() !== "" &&
    formData.address.trim() !== "" &&
    formData.contactEmail.trim() !== "" &&
    formData.contactPhone.trim() !== "";

  const ubosComplete =
    ubos.length > 0 &&
    ubos.every(
      (ubo) =>
        ubo.name.trim() !== "" &&
        ubo.nationality.trim() !== "" &&
        ubo.ownershipPercentage.trim() !== ""
    ) &&
    totalOwnership === 100;

  const documentsComplete =
    documentFiles.businessLicense !== null &&
    documentFiles.amlPolicy !== null &&
    documentFiles.uboDeclaration !== null;

  const isFormValid = companyInfoComplete && ubosComplete && documentsComplete;

const handleSubmit = async (action: "draft" | "submit") => {
    setIsSubmitting(true);
    try {
      // First, create the counterparty
      const response = await fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: formData.legalName,
          tradingName: null,
          registrationNumber: formData.registrationNumber,
          taxId: null,
          legalForm: "Corporation",
          countryOfIncorporation: jurisdictions.find((j) => j.code === formData.jurisdiction)?.name || formData.jurisdiction,
          registeredAddress: formData.address,
          primaryContact: formData.legalName,
          primaryEmail: formData.contactEmail,
          primaryPhone: formData.contactPhone,
          goldSourceTypes: selectedSourceType ? [selectedSourceType] : [],
          status: action === "draft" ? "draft" : "pending_review",
          ubos: ubos.filter((u) => u.name).map((ubo) => ({
            fullName: ubo.name,
            nationality: jurisdictions.find((j) => j.code === ubo.nationality)?.name || ubo.nationality,
            ownershipPercent: parseFloat(ubo.ownershipPercentage) || 0,
            isPEP: ubo.isPEP,
            pepDetails: ubo.position || undefined,
          })),
          documents: [],
        }),
      });

      if (!response.ok) {
        // Surface a hard failure instead of silently leaving the user on the page.
        console.error("Error creating counterparty:", await response.text());
        alert(
          language === "fr"
            ? "Échec de l'enregistrement. Veuillez réessayer."
            : "Save failed. Please try again."
        );
        setIsSubmitting(false);
        return;
      }

      const newCounterparty = await response.json();

      // Upload any attached documents. A failed upload must NOT block saving a
      // draft, so each upload is isolated and errors are only logged.
      const documentEntries = Object.entries(documentFiles).filter(([, file]) => file !== null);
      for (const [docType, uploadedFile] of documentEntries) {
        if (uploadedFile) {
          try {
            const docFormData = new FormData();
            docFormData.append("file", uploadedFile.file);
            docFormData.append("counterpartyId", newCounterparty.id);
            docFormData.append("documentType", docType);

            await fetch("/api/documents", {
              method: "POST",
              body: docFormData,
            });
          } catch (uploadError) {
            console.error(`Error uploading document ${docType}:`, uploadError);
          }
        }
      }

      if (action === "submit") {
        router.push(`/screening/${newCounterparty.id}?submitted=true`);
      } else {
        router.push("/counterparties");
      }
    } catch (error) {
      console.error("Error creating counterparty:", error);
      alert(
        language === "fr"
          ? "Échec de l'enregistrement. Veuillez réessayer."
          : "Save failed. Please try again."
      );
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t.counterparties.companyInfo}</CardTitle>
          <CardDescription>
            {t.onboarding.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">
                {t.counterparties.legalName} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="legalName"
                placeholder={t.counterparties.legalName}
                value={formData.legalName}
                onChange={(e) => handleInputChange("legalName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">
                {t.counterparties.registrationNumber} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="registrationNumber"
                  placeholder={formData.jurisdiction ? "" : "Sélectionnez d'abord le pays de constitution"}
                  value={formData.registrationNumber}
                  readOnly
                  disabled={!formData.jurisdiction}
                  className="pr-10 bg-muted/50 font-mono"
                />
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-généré: CODE_ISO-ANNÉE-SÉQUENCE (ex: GH-2026-00034)
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">
                {t.counterparties.countryOfIncorporation} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.jurisdiction}
                onValueChange={(value) => handleInputChange("jurisdiction", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.onboarding.selectJurisdiction} />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.code} value={j.code}>
                      <div className="flex items-center gap-2">
                        <span>{j.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            j.riskLevel === "LOW"
                              ? "border-success text-success"
                              : j.riskLevel === "MEDIUM"
                              ? "border-warning text-warning"
                              : "border-destructive text-destructive"
                          }
                        >
                          {j.riskLevel}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">
                {t.counterparties.registeredAddress} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder={t.counterparties.registeredAddress}
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                {t.counterparties.primaryEmail} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="compliance@company.com"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange("contactEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">
                {t.counterparties.primaryPhone} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.contactPhone}
                onChange={(e) => handleInputChange("contactPhone", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Types */}
      <Card>
        <CardHeader>
          <CardTitle>{t.counterparties.goldSourceTypes}</CardTitle>
          <CardDescription>
            {t.onboarding.selectSourceType}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedSourceType}
            onValueChange={(value) => setSelectedSourceType(value as SourceType)}
            className="flex flex-col gap-4 sm:flex-row sm:flex-wrap"
          >
            {(["ASM", "LSM", "RECYCLED"] as SourceType[]).map((type) => (
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
                    {type === "ASM"
                      ? t.risk.high
                      : type === "LSM"
                      ? t.risk.low
                      : t.risk.low}
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

      {/* Ultimate Beneficial Owners */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.counterparties.ubos}</CardTitle>
              <CardDescription>
                {t.onboarding.beneficialOwners}
              </CardDescription>
            </div>
            <Button onClick={addUBO} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t.onboarding.addUbo}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {totalOwnership !== 100 && ubos.some((u) => u.ownershipPercentage) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Total ownership must equal 100%. Current total: {totalOwnership.toFixed(1)}%
              </AlertDescription>
            </Alert>
          )}

          {ubos.map((ubo, index) => (
            <div key={ubo.id} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">UBO {index + 1}</h4>
                {ubos.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUBO(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.onboarding.fullName} <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder={t.onboarding.fullName}
                    value={ubo.name}
                    onChange={(e) => handleUBOChange(index, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.onboarding.selectNationality} <span className="text-destructive">*</span></Label>
                  <Select
                    value={ubo.nationality}
                    onValueChange={(value) => handleUBOChange(index, "nationality", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.common.country} />
                    </SelectTrigger>
                    <SelectContent>
                      {jurisdictions.map((j) => (
                        <SelectItem key={j.code} value={j.code}>
                          {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.onboarding.ownershipPercentage} <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g., 25"
                    value={ubo.ownershipPercentage}
                    onChange={(e) => handleUBOChange(index, "ownershipPercentage", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.onboarding.pepPosition}</Label>
                  <Input
                    placeholder={t.onboarding.pepPosition}
                    value={ubo.position}
                    onChange={(e) => handleUBOChange(index, "position", e.target.value)}
                    disabled={!ubo.isPEP}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <Checkbox
                  id={`pep-${ubo.id}`}
                  checked={ubo.isPEP}
                  onCheckedChange={(checked) => handleUBOChange(index, "isPEP", !!checked)}
                />
                <div>
                  <Label htmlFor={`pep-${ubo.id}`} className="cursor-pointer font-medium">
                    {t.onboarding.isPEP}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.screening.pepCheck}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Document Upload */}
      <Card>
        <CardHeader>
          <CardTitle>{t.counterparties.documents}</CardTitle>
          <CardDescription>
            {t.onboarding.supportedFormats}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(["businessLicense", "amlPolicy", "uboDeclaration"] as DocumentType[]).map((docType) => (
              <div key={docType} className="space-y-3">
                <Label className="font-medium">
                  {t.onboarding.documentTypes[docType]} <span className="text-destructive">*</span>
                </Label>
                {documentFiles[docType] ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{documentFiles[docType]!.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(documentFiles[docType]!.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeDocument(docType)} className="shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.onboarding.dragDropFiles}
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          {t.onboarding.requiredFields}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="outline" onClick={() => router.back()} className="order-3 sm:order-1">
            {t.common.cancel}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("draft")}
            disabled={isSubmitting}
            className="order-2"
          >
            <Save className="mr-2 h-4 w-4" />
            {t.onboarding.saveDraft}
          </Button>
          <Button
            onClick={() => handleSubmit("submit")}
            disabled={isSubmitting || !isFormValid}
            className="order-1 sm:order-3"
          >
            <Send className="mr-2 h-4 w-4" />
            {t.onboarding.submitForReview}
          </Button>
        </div>
      </div>
    </div>
  );
}
