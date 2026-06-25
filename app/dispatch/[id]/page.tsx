"use client";

import { useState, useEffect, use, useRef } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Truck,
  Shield,
  Calendar,
  Package,
  Scale,
  Lock,
  QrCode,
  Printer,
  ArrowLeft,
  ArrowRight,
  Globe,
  Camera,
  X,
  Save,
  Plane,
  Download,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateDispatchPDF } from "@/lib/pdf-generator";

// Document types for US-04
const REQUIRED_DOCS = [
  { id: "export_license", name: { en: "Export License", fr: "Licence d'Exportation" }, icon: FileText },
  { id: "certificate_origin", name: { en: "Certificate of Origin", fr: "Certificat d'Origine" }, icon: Globe },
  { id: "transport_docs", name: { en: "Transport Documents", fr: "Documents de Transport" }, icon: Truck },
  { id: "insurance", name: { en: "Insurance Certificate", fr: "Certificat d'Assurance" }, icon: Shield },
  { id: "transportation", name: { en: "Transportation", fr: "Transport" }, icon: Plane },
];

// LBMA-approved carriers
const CARRIERS = [
  { id: "brinks", name: "Brinks Global Logistics", sla: "24-48h" },
  { id: "malca_amit", name: "Malca-Amit", sla: "24-72h" },
  { id: "g4s", name: "G4S International Logistics", sla: "48-72h" },
  { id: "loomis", name: "Loomis International", sla: "24-48h" },
];

interface DispatchData {
  id: string;
  poId: string;
  counterpartyId: string;
  counterpartyName: string;
  status: string;
  estimatedWeight: number;
  poValue: number;
  originCountry: string;
  destinationVault: string;
  documents: Record<string, { uploaded: boolean; valid: boolean | null; fileName?: string }>;
  manifest: {
    netWeight: number;
    seal1: string;
    seal2: string;
    customsOriginCleared: boolean;
    customsDestCleared: boolean;
  } | null;
  carrier: string | null;
  pickupDate: string | null;
  trackingId: string | null;
  dispatchId: string | null;
  approvals: { approver: string; timestamp: string; method: string }[];
}

export default function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("documents");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [dispatch, setDispatch] = useState<DispatchData | null>(null);
  const [documents, setDocuments] = useState<Record<string, { uploaded: boolean; valid: boolean | null; fileName?: string; file?: File; pathname?: string }>>({
    export_license: { uploaded: false, valid: null },
    certificate_origin: { uploaded: false, valid: null },
    transport_docs: { uploaded: false, valid: null },
    insurance: { uploaded: false, valid: null },
    transportation: { uploaded: false, valid: null },
  });
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [manifest, setManifest] = useState({
    netWeight: 0,
    seal1: "",
    seal2: "",
    customsOriginCleared: false,
    customsDestCleared: false,
  });
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [approver1Signed, setApprover1Signed] = useState(false);
  const [approver2OTP, setApprover2OTP] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  // When the dispatch is already authorized/shipped the fields are locked,
  // unless the user explicitly enters correction mode via "Request Changes".
  const [correctionMode, setCorrectionMode] = useState(false);

  useEffect(() => {
    fetchDispatchData();
  }, [id]);

  const fetchDispatchData = async () => {
    try {
      const response = await fetch(`/api/dispatch/${id}`);
      if (response.ok) {
        const data = await response.json();
        setDispatch(data);
        if (data.manifest) setManifest(data.manifest);
        if (data.carrier) setSelectedCarrier(data.carrier);
        if (data.pickupDate) setPickupDate(data.pickupDate);
        if (data.approver1Signed) setApprover1Signed(true);
        if (data.approver2Verified) setOtpVerified(true);
      }
      
      // Fetch saved documents from database
      const docsResponse = await fetch(`/api/dispatch/${id}/documents`);
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        if (docsData.documents && docsData.documents.length > 0) {
          // Initialize documents state with saved documents
          const savedDocs: Record<string, { uploaded: boolean; valid: boolean | null; fileName?: string; file?: File }> = {
            export_license: { uploaded: false, valid: null },
            certificate_origin: { uploaded: false, valid: null },
            transport_docs: { uploaded: false, valid: null },
            insurance: { uploaded: false, valid: null },
            transportation: { uploaded: false, valid: null },
          };
          
          docsData.documents.forEach((doc: { doc_type: string; file_name: string; status: string; blob_pathname?: string }) => {
            if (savedDocs[doc.doc_type]) {
              savedDocs[doc.doc_type] = {
                uploaded: true,
                valid: doc.status === 'validated' ? true : doc.status === 'rejected' ? false : true,
                fileName: doc.file_name,
                pathname: doc.blob_pathname,
                // No file object since it's already saved to Blob
              };
            }
          });
          
          setDocuments(savedDocs);
        }
      }
    } catch (error) {
      console.error("Error fetching dispatch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate weight tolerance
  const weightVariance = dispatch ? ((manifest.netWeight - dispatch.estimatedWeight) / dispatch.estimatedWeight) * 100 : 0;
  const weightStatus = Math.abs(weightVariance) <= 2 ? "ok" : Math.abs(weightVariance) <= 5 ? "warning" : "error";

  // Check if all documents are valid
  const allDocsValid = Object.values(documents).every(d => d.uploaded && d.valid === true);
  
  // Check if manifest is complete
  const manifestComplete = manifest.netWeight > 0 && manifest.seal1 && manifest.seal2 && 
    manifest.customsOriginCleared && manifest.customsDestCleared && weightStatus !== "error";

  // Check if authorization is complete
  const authorizationComplete = selectedCarrier && pickupDate && approver1Signed && otpVerified;

  // Dual approval required for >$1M or high-risk
  const dualApprovalRequired = dispatch && (dispatch.poValue > 1000000);

  // Once the dispatch is authorized (dispatched/in_transit), the authorization
  // fields become read-only until the user clicks "Request Changes".
  const isDispatched = dispatch?.status === "dispatched" || dispatch?.status === "in_transit";
  const fieldsLocked = isDispatched && !correctionMode;

  const handleDocumentUpload = (docId: string) => {
    // Trigger the hidden file input
    fileInputRefs.current[docId]?.click();
  };
  
  const handleFileSelected = (docId: string, file: File | null) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert(language === "fr" 
        ? "Type de fichier non valide. Veuillez télécharger un PDF ou une image (JPEG, PNG)."
        : "Invalid file type. Please upload a PDF or image (JPEG, PNG).");
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(language === "fr"
        ? "Le fichier est trop volumineux. Taille maximale: 10 Mo."
        : "File is too large. Maximum size: 10 MB.");
      return;
    }
    
    // Update state to show uploading
    setDocuments(prev => ({
      ...prev,
      [docId]: { uploaded: true, valid: null, fileName: file.name, file }
    }));
    
    // Simulate async validation (in real app, this would upload to server)
    setTimeout(() => {
      setDocuments(prev => ({
        ...prev,
        [docId]: { ...prev[docId], valid: true } // Always valid for now since user uploaded real file
      }));
    }, 1500);
  };
  
  const handleDragOver = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(docId);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(null);
  };
  
  const handleDrop = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(docId, file);
    }
  };
  
  const handleRemoveDocument = (docId: string) => {
    setDocuments(prev => ({
      ...prev,
      [docId]: { uploaded: false, valid: null }
    }));
  };
  
  const handleDownloadDocument = async (docId: string) => {
    const doc = documents[docId];
    if (!doc || !doc.pathname) {
      alert(language === "fr" ? "Document non disponible" : "Document not available");
      return;
    }
    
    try {
      // Fetch the file from our API that serves private blobs
      const response = await fetch(`/api/dispatch/${id}/documents/download?pathname=${encodeURIComponent(doc.pathname)}`);
      
      if (!response.ok) {
        throw new Error("Download failed");
      }
      
      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      alert(language === "fr" ? "Erreur lors du téléchargement" : "Error downloading document");
    }
  };
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const handleSaveDocuments = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Get all documents that have files to upload
      const docsToUpload = Object.entries(documents)
        .filter(([, doc]) => doc.uploaded && doc.file);
      
      if (docsToUpload.length === 0) {
        alert(language === "fr" ? "Aucun document à sauvegarder" : "No documents to save");
        setIsSaving(false);
        return;
      }
      
      // Upload each document to Vercel Blob
      const uploadResults = await Promise.all(
        docsToUpload.map(async ([docType, doc]) => {
          const formData = new FormData();
          formData.append('file', doc.file!);
          formData.append('docType', docType);
          
          const response = await fetch(`/api/dispatch/${id}/documents`, {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Failed to upload ${docType}`);
          }
          
          const result = await response.json();
          return {
            docType,
            pathname: result.pathname,
            fileName: doc.fileName,
          };
        })
      );
      
      // Update the dispatch record with document references
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: uploadResults,
          status: "documents_pending",
        }),
      });
      
      // Update local state to mark documents as saved (remove file reference since it's now in blob)
      setDocuments(prev => {
        const updated = { ...prev };
        uploadResults.forEach(({ docType }) => {
          if (updated[docType]) {
            updated[docType] = {
              ...updated[docType],
              file: undefined, // Clear file reference since it's uploaded
              valid: true, // Mark as valid since upload succeeded
            };
          }
        });
        return updated;
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving documents:", error);
      alert(language === "fr" ? "Erreur lors de la sauvegarde des documents" : "Error saving documents");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateDocuments = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          documents, 
          status: allDocsValid ? "docs_validated" : "pending_docs" 
        }),
      });
      if (allDocsValid) {
        setActiveTab("manifest");
      }
    } catch (error) {
      console.error("Error saving documents:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmManifest = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          manifest, 
          status: "pending_authorization" 
        }),
      });
      setActiveTab("authorization");
    } catch (error) {
      console.error("Error saving manifest:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Save the manifest tab data to the database without advancing the workflow
  const handleSaveManifest = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving manifest:", error);
      alert(language === "fr" ? "Erreur lors de la sauvegarde du manifeste" : "Error saving manifest");
    } finally {
      setIsSaving(false);
    }
  };

  // Save the authorization tab data (carrier + pickup date) to the database
  const handleSaveAuthorization = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: selectedCarrier || null,
          pickupDate: pickupDate || null,
          approver1Signed,
          approver2Verified: otpVerified,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving authorization:", error);
      alert(language === "fr" ? "Erreur lors de la sauvegarde de l'autorisation" : "Error saving authorization");
    } finally {
      setIsSaving(false);
    }
  };

  // Save the confirmation tab data (final manifest + carrier + pickup) to the database
  const handleSaveConfirmation = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/dispatch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifest,
          carrier: selectedCarrier || null,
          pickupDate: pickupDate || null,
          approver1Signed,
          approver2Verified: otpVerified,
          status: dispatch?.status,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving confirmation:", error);
      alert(language === "fr" ? "Erreur lors de la sauvegarde" : "Error saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyOTP = () => {
    // Simulate OTP verification
    if (approver2OTP.length === 6) {
      setOtpVerified(true);
    }
  };

  const handleAuthorizeDispatch = async () => {
    if (!authorizationComplete) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/dispatch/${id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          carrier: selectedCarrier, 
          pickupDate,
          approvals: [
            { approver: "compliance_officer_1", method: "signature" },
            { approver: "compliance_officer_2", method: "otp" },
          ]
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setDispatch(prev => prev ? { ...prev, ...data, status: "dispatched" } : null);
        setActiveTab("confirmation");
      } else {
        console.error("Error response:", await response.text());
      }
    } catch (error) {
      console.error("Error authorizing dispatch:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const content = {
    title: language === "fr" ? "Validation Pré-Expédition" : "Pre-Shipment Validation",
    tabs: {
      documents: language === "fr" ? "1. Documents" : "1. Documents",
      manifest: language === "fr" ? "2. Manifeste" : "2. Manifest",
      authorization: language === "fr" ? "3. Autorisation" : "3. Authorization",
      confirmation: language === "fr" ? "4. Confirmation" : "4. Confirmation",
    },
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader title={content.title} />
            <main className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
            title={content.title}
            subtitle={dispatch?.poId || ""}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Back Button */}
              <Link href="/dispatch">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === "fr" ? "Retour" : "Back"}
                </Button>
              </Link>

              {/* PO Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  {dispatch ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          {dispatch.poId}
                        </CardTitle>
                        <CardDescription>{dispatch.counterpartyName}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {dispatch.currency || "USD"} {dispatch.poValue?.toLocaleString() ?? "0"}
                        </p>
                        <p className="text-sm text-muted-foreground">{dispatch.estimatedWeight} kg</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base text-muted-foreground">
                          {language === "fr" ? "Bon de commande introuvable" : "Purchase order not found"}
                        </CardTitle>
                        <CardDescription>
                          {language === "fr"
                            ? "Les informations du PO ne peuvent pas être chargées. Vérifiez qu'un PO approuvé existe pour cette validation."
                            : "PO information could not be loaded. Make sure an approved PO exists for this validation."}
                        </CardDescription>
                      </div>
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Main Tabs - 4 Screens of US-04 */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="documents" className="text-xs sm:text-sm">
                    {content.tabs.documents}
                  </TabsTrigger>
                  <TabsTrigger value="manifest" disabled={!allDocsValid} className="text-xs sm:text-sm">
                    {content.tabs.manifest}
                  </TabsTrigger>
                  <TabsTrigger value="authorization" disabled={!manifestComplete} className="text-xs sm:text-sm">
                    {content.tabs.authorization}
                  </TabsTrigger>
                  <TabsTrigger value="confirmation" disabled={dispatch?.status !== "dispatched"} className="text-xs sm:text-sm">
                    {content.tabs.confirmation}
                  </TabsTrigger>
                </TabsList>

                {/* Screen 1: Document Upload & Validation */}
                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {language === "fr" ? "Upload & Validation des Documents" : "Document Upload & Validation"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Téléchargez les documents requis pour validation automatique"
                          : "Upload required documents for automated validation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Document Upload Grid */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {REQUIRED_DOCS.map((doc) => {
                          const docState = documents[doc.id] || { uploaded: false, valid: null };
                          const Icon = doc.icon;
                          const isDragOver = dragOverDocId === doc.id;
                          return (
                            <div 
                              key={doc.id}
                              className={`p-4 rounded-lg border-2 border-dashed transition-all ${
                                isDragOver ? "border-primary bg-primary/10 scale-[1.02]" :
                                docState.valid === true ? "border-emerald-500 bg-emerald-500/5" :
                                docState.valid === false ? "border-destructive bg-destructive/5" :
                                docState.uploaded ? "border-amber-500 bg-amber-500/5" :
                                "border-muted-foreground/25 hover:border-primary/50"
                              }`}
                              onDragOver={(e) => handleDragOver(e, doc.id)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, doc.id)}
                            >
                              {/* Hidden file input */}
                              <input
                                type="file"
                                ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileSelected(doc.id, e.target.files?.[0] || null)}
                              />
                              
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Icon className="h-5 w-5" />
                                  <span className="font-medium">{doc.name[language as "en" | "fr"]}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {docState.valid === true && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                                  {docState.valid === false && <XCircle className="h-5 w-5 text-destructive" />}
                                  {docState.uploaded && docState.valid === null && (
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                  )}
                                  {docState.uploaded && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRemoveDocument(doc.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {!docState.uploaded ? (
                                <div 
                                  className="flex flex-col items-center gap-2 py-4 cursor-pointer"
                                  onClick={() => handleDocumentUpload(doc.id)}
                                >
                                  <Upload className={`h-8 w-8 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                                  <p className="text-sm text-center text-muted-foreground">
                                    {isDragOver 
                                      ? (language === "fr" ? "Déposez le fichier ici" : "Drop file here")
                                      : (language === "fr" 
                                        ? "Glissez-déposez ou cliquez pour sélectionner"
                                        : "Drag & drop or click to select")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    PDF, JPEG, PNG (max 10 MB)
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate flex-1" title={docState.fileName}>
                                    {docState.fileName}
                                  </span>
                                  {docState.pathname && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={() => handleDownloadDocument(doc.id)}
                                      title={language === "fr" ? "Télécharger" : "Download"}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Compliance Checklist */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {language === "fr" ? "Checklist de Conformité" : "Compliance Checklist"}
                        </h4>
                        <div className="space-y-2">
                          {[
                            { label: language === "fr" ? "Licence valide" : "License Valid", checked: documents.export_license.valid },
                            { label: language === "fr" ? "Origine correspond" : "Origin Match", checked: documents.certificate_origin.valid },
                            { label: language === "fr" ? "Valeur assurée" : "Insured Value", checked: documents.insurance.valid },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {item.checked === true ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : item.checked === false ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="outline" onClick={() => router.push("/dispatch")}>
                        {language === "fr" ? "Annuler" : "Cancel"}
                      </Button>
                      <div className="flex items-center gap-3">
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button 
                          variant="outline"
                          onClick={handleSaveDocuments}
                          disabled={isSaving || !Object.values(documents).some(d => d.uploaded && d.file)}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        <Button 
                          onClick={handleValidateDocuments}
                          disabled={!allDocsValid || isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          ) : null}
                          {language === "fr" ? "Valider Documents" : "Validate Documents"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Screen 2: Manifest & Customs Check */}
                <TabsContent value="manifest" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "Manifeste & Vérification Douanes" : "Manifest & Customs Check"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Vérifiez les détails du manifeste et le statut douanier"
                          : "Verify manifest details and customs clearance status"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-3">
                        {/* Manifest Details */}
                        <div className="space-y-4">
                          <h4 className="font-semibold">{language === "fr" ? "Détails du Manifeste" : "Manifest Details"}</h4>
                          <div className="space-y-3">
                            <div>
                              <Label>{language === "fr" ? "Poids Net (kg)" : "Net Weight (kg)"}</Label>
                              <Input 
                                type="number" 
                                value={manifest.netWeight || ""} 
                                onChange={(e) => setManifest({ ...manifest, netWeight: parseFloat(e.target.value) || 0 })}
                                placeholder={dispatch?.estimatedWeight?.toString()}
                              />
                            </div>
                            <div>
                              <Label>{language === "fr" ? "Scellé #1" : "Seal #1"}</Label>
                              <Input 
                                value={manifest.seal1} 
                                onChange={(e) => setManifest({ ...manifest, seal1: e.target.value })}
                                placeholder="e.g., 78945"
                              />
                            </div>
                            <div>
                              <Label>{language === "fr" ? "Scellé #2" : "Seal #2"}</Label>
                              <Input 
                                value={manifest.seal2} 
                                onChange={(e) => setManifest({ ...manifest, seal2: e.target.value })}
                                placeholder="e.g., 78946"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Weight Tolerance Gauge */}
                        <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-muted/30">
                          <h4 className="font-semibold mb-4">{language === "fr" ? "Tolérance de Poids" : "Weight Tolerance"}</h4>
                          <div className="relative w-full max-w-[200px]">
                            {/* Semi-circle gauge */}
                            <svg viewBox="0 0 200 120" className="w-full">
                              {/* Background arc */}
                              <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="20"
                                className="text-muted"
                              />
                              {/* Colored arc based on variance */}
                              <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke={weightStatus === "ok" ? "#22c55e" : weightStatus === "warning" ? "#f59e0b" : "#ef4444"}
                                strokeWidth="20"
                                strokeDasharray={`${Math.min(Math.abs(weightVariance) * 5, 251)} 251`}
                              />
                              {/* Center text */}
                              <text x="100" y="85" textAnchor="middle" className="text-2xl font-bold fill-current">
                                {weightVariance > 0 ? "+" : ""}{weightVariance.toFixed(1)}%
                              </text>
                            </svg>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                              <span>-5%</span>
                              <span>0%</span>
                              <span>+5%</span>
                            </div>
                          </div>
                          {weightStatus === "error" && (
                            <Alert variant="destructive" className="mt-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                {language === "fr" 
                                  ? "Variance >5% - Investigation requise"
                                  : "Variance >5% - Investigation required"}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        {/* Customs Status */}
                        <div className="space-y-4">
                          <h4 className="font-semibold">{language === "fr" ? "Statut Douanier" : "Customs Status"}</h4>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                              <div>
                                <p className="font-medium">{language === "fr" ? "Origine" : "Origin"}</p>
                                <p className="text-sm text-muted-foreground">{dispatch?.originCountry}</p>
                              </div>
                              <div 
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  manifest.customsOriginCleared ? "bg-emerald-500" : "bg-muted"
                                }`}
                                onClick={() => setManifest({ ...manifest, customsOriginCleared: !manifest.customsOriginCleared })}
                                role="button"
                              >
                                {manifest.customsOriginCleared && <CheckCircle2 className="h-6 w-6 text-white" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                              <div>
                                <p className="font-medium">{language === "fr" ? "Destination" : "Destination"}</p>
                                <p className="text-sm text-muted-foreground">{dispatch?.destinationVault}</p>
                              </div>
                              <div 
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  manifest.customsDestCleared ? "bg-emerald-500" : "bg-muted"
                                }`}
                                onClick={() => setManifest({ ...manifest, customsDestCleared: !manifest.customsDestCleared })}
                                role="button"
                              >
                                {manifest.customsDestCleared && <CheckCircle2 className="h-6 w-6 text-white" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chain of Custody Timeline */}
                      <div className="pt-4 border-t">
                        <h4 className="font-semibold mb-4">{language === "fr" ? "Chaîne de Possession" : "Chain of Custody Timeline"}</h4>
                        <div className="flex items-center justify-between">
                          {[
                            { label: language === "fr" ? "Collecte" : "Pickup", done: false },
                            { label: language === "fr" ? "Départ" : "Departure", done: false },
                            { label: "Transit", done: false },
                            { label: language === "fr" ? "Arrivée" : "Arrival", done: false },
                            { label: language === "fr" ? "Livraison" : "Delivery", done: false },
                          ].map((step, i, arr) => (
                            <div key={i} className="flex items-center">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                                  step.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                                }`}>
                                  {i + 1}
                                </div>
                                <span className="text-xs mt-1">{step.label}</span>
                              </div>
                              {i < arr.length - 1 && (
                                <div className="w-12 md:w-24 h-0.5 bg-muted-foreground/30 mx-1" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="outline" onClick={() => setActiveTab("documents")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Retour" : "Back"}
                      </Button>
                      <div className="flex items-center gap-3">
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleSaveManifest}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        <Button 
                          onClick={handleConfirmManifest}
                          disabled={!manifestComplete || isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          ) : null}
                          {language === "fr" ? "Confirmer Manifeste" : "Confirm Manifest"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Screen 3: Dispatch Authorization */}
                <TabsContent value="authorization" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {language === "fr" ? "Autorisation de Dispatch" : "Dispatch Authorization"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr" 
                          ? "Assignez le transporteur et obtenez la double approbation"
                          : "Assign carrier and obtain dual approval"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Locked banner when the dispatch is already authorized */}
                      {fieldsLocked && (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-sm">
                          <Lock className="h-4 w-4 shrink-0" />
                          <span>
                            {language === "fr"
                              ? "Ce dispatch est déjà expédié. Les champs sont verrouillés. Cliquez sur « Demander Corrections » pour les modifier."
                              : "This dispatch is already shipped. Fields are locked. Click \"Request Changes\" to edit them."}
                          </span>
                        </div>
                      )}
                      {correctionMode && (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-500 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>
                            {language === "fr"
                              ? "Mode correction activé. Modifiez les champs puis sauvegardez."
                              : "Correction mode enabled. Edit the fields then save."}
                          </span>
                        </div>
                      )}
                      {/* Authorization Summary */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h4 className="font-semibold mb-3">{language === "fr" ? "Résumé d'Autorisation" : "Authorization Summary"}</h4>
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">PO Ref:</span>
                            <span className="font-medium">{dispatch?.poId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Valeur:" : "Value:"}</span>
                            <span className="font-medium">USD {dispatch?.poValue?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Poids:" : "Weight:"}</span>
                            <span className="font-medium">{manifest.netWeight} kg</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Carrier Assignment */}
                        <div className="space-y-3">
                          <Label>{language === "fr" ? "Assignation du Transporteur" : "Carrier Assignment"} <span className="text-destructive">*</span></Label>
                          <Select value={selectedCarrier} onValueChange={setSelectedCarrier} disabled={fieldsLocked}>
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner transporteur" : "Select carrier"} />
                            </SelectTrigger>
                            <SelectContent>
                              {CARRIERS.map((carrier) => (
                                <SelectItem key={carrier.id} value={carrier.id}>
                                  {carrier.name} ({carrier.sla})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Pickup Schedule */}
                        <div className="space-y-3">
                          <Label>{language === "fr" ? "Date de Collecte" : "Pickup Schedule"} <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="date" 
                              value={pickupDate} 
                              onChange={(e) => setPickupDate(e.target.value)}
                              className="pl-10"
                              disabled={fieldsLocked}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Dual Approval Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-5 w-5" />
                          <h4 className="font-semibold">{language === "fr" ? "Double Approbation" : "Dual Approval"}</h4>
                          {dualApprovalRequired && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                              {language === "fr" ? "Requis (>$1M)" : "Required (>$1M)"}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Approver 1 - Signature */}
                          <div className="p-4 rounded-lg border">
                            <p className="font-medium mb-2">Approver 1 [Signature] <span className="text-destructive">*</span></p>
                            <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                              {approver1Signed ? (
                                <div className="text-center">
                                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1" />
                                  <span className="text-sm text-emerald-500">{language === "fr" ? "Signé" : "Signed"}</span>
                                </div>
                              ) : (
                                <Button variant="outline" onClick={() => setApprover1Signed(true)} disabled={fieldsLocked}>
                                  {language === "fr" ? "Cliquer pour signer" : "Click to sign"}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Approver 2 - OTP */}
                          <div className="p-4 rounded-lg border">
                            <p className="font-medium mb-2">Approver 2 [OTP] <span className="text-destructive">*</span></p>
                            <div className="space-y-2">
                              <Input 
                                type="text" 
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={approver2OTP}
                                onChange={(e) => setApprover2OTP(e.target.value.replace(/\D/g, ""))}
                                disabled={otpVerified || fieldsLocked}
                              />
                              {otpVerified ? (
                                <div className="flex items-center gap-2 text-emerald-500">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-sm">{language === "fr" ? "OTP vérifié" : "OTP Verified"}</span>
                                </div>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={handleVerifyOTP}
                                  disabled={approver2OTP.length !== 6 || fieldsLocked}
                                >
                                  {language === "fr" ? "Vérifier OTP" : "Verify OTP"}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="outline" onClick={() => setActiveTab("manifest")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Retour" : "Back"}
                      </Button>
                      <div className="flex items-center gap-2">
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        {isDispatched && !correctionMode ? (
                          <Button variant="outline" onClick={() => setCorrectionMode(true)}>
                            {language === "fr" ? "Demander Corrections" : "Request Changes"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleSaveAuthorization}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                              ) : (
                                <Save className="mr-2 h-4 w-4" />
                              )}
                              {language === "fr" ? "Sauvegarder" : "Save"}
                            </Button>
                            <Button 
                              onClick={handleAuthorizeDispatch}
                              disabled={!authorizationComplete || isSaving}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {isSaving ? (
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                              ) : null}
                              {language === "fr" ? "Autoriser & Dispatcher" : "Authorize & Dispatch"}
                            </Button>
                          </>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Screen 4: Dispatch Confirmation */}
                <TabsContent value="confirmation" className="space-y-4">
                  <Card>
                    <CardHeader className="bg-emerald-500 text-white rounded-t-lg">
                      <CardTitle className="flex items-center gap-2 text-2xl">
                        <CheckCircle2 className="h-6 w-6" />
                        {language === "fr" ? "Dispatch Réussi" : "Dispatch Successful"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Details */}
                        <div className="space-y-4">
                          <h4 className="font-semibold">{language === "fr" ? "Détails" : "Details"}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{language === "fr" ? "Réf. Ordre d'Achat:" : "PO Reference:"}</span>
                              <span className="font-mono font-bold text-primary">{dispatch?.poId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Dispatch ID:</span>
                              <span className="font-mono font-medium">{dispatch?.dispatchId || `DISP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999)}`}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{language === "fr" ? "Transporteur:" : "Carrier:"}</span>
                              <span className="font-medium">{CARRIERS.find(c => c.id === selectedCarrier)?.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Tracking ID:</span>
                              <span className="font-mono font-medium">{dispatch?.trackingId || `TRK-${Math.floor(Math.random() * 999)}`}</span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-white">
                          <QrCode className="h-24 w-24 text-gray-800" />
                          <p className="text-sm text-muted-foreground mt-2">Tracking ID: {dispatch?.trackingId || "TRK-..."}</p>
                          <p className="text-xs text-muted-foreground">PO: {dispatch?.poId}</p>
                        </div>
                      </div>

                      {/* Progress Timeline */}
                      <div className="pt-4">
                        <div className="flex items-center justify-between">
                          {[
                            { label: language === "fr" ? "Dispatché" : "Dispatched", status: "done" },
                            { label: language === "fr" ? "En Transit" : "In Transit", status: "current" },
                            { label: language === "fr" ? "Réception Coffre" : "Vault Intake", status: "pending" },
                          ].map((step, i, arr) => (
                            <div key={i} className="flex items-center flex-1">
                              <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  step.status === "done" ? "bg-emerald-500 text-white" :
                                  step.status === "current" ? "bg-primary text-primary-foreground animate-pulse" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {step.status === "done" ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <span>{i + 1}</span>
                                  )}
                                </div>
                                <span className="text-sm mt-2 text-center">{step.label}</span>
                              </div>
                              {i < arr.length - 1 && (
                                <div className={`flex-1 h-1 mx-2 rounded ${
                                  step.status === "done" ? "bg-emerald-500" : "bg-muted"
                                }`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Next Steps */}
                      <Alert>
                        <ArrowRight className="h-4 w-4" />
                        <AlertTitle>{language === "fr" ? "Prochaines Étapes" : "Next Steps"}</AlertTitle>
                        <AlertDescription>
                          {language === "fr" 
                            ? "Le workflow Vault Intake & Assay sera automatiquement déclenché à la confirmation de collecte par le transporteur."
                            : "Vault Intake & Assay workflow will be automatically triggered upon carrier pickup confirmation."}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button 
                        variant="outline"
                        onClick={async () => {
                          if (dispatch) {
                            await generateDispatchPDF({
                              dispatchId: dispatch.dispatchId || `DISP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999)}`,
                              poReference: dispatch.poId,
                              trackingId: dispatch.trackingId || "TRK-...",
                              counterpartyName: dispatch.counterpartyName,
                              carrier: CARRIERS.find(c => c.id === selectedCarrier)?.name || "N/A",
                              pickupDate: pickupDate || new Date().toISOString().split("T")[0],
                              estimatedWeight: dispatch.estimatedWeight,
                              originCountry: dispatch.originCountry || "N/A",
                              destinationVault: dispatch.destinationVault || "N/A",
                              status: dispatch.status,
                            }, {
                              title: language === "fr" ? "Documents d'Expédition" : "Dispatch Documents",
                              filename: `DISPATCH-${dispatch.poId}.pdf`,
                            });
                          }
                        }}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Imprimer PDF" : "Print PDF"}
                      </Button>
                      <div className="flex items-center gap-2">
                        {saveSuccess && (
                          <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === "fr" ? "Sauvegardé" : "Saved"}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleSaveConfirmation}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {language === "fr" ? "Sauvegarder" : "Save"}
                        </Button>
                        <Link href="/dispatch">
                          <Button>
                            {language === "fr" ? "Voir Dashboard" : "View Dashboard"}
                          </Button>
                        </Link>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
