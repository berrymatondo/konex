"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Factory,
  FileText,
  Landmark,
  Lock,
  PackageOpen,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { jurisdictions } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SourceType } from "@/lib/types";

type CounterpartyType = "trading_house" | "refinery";
type DocumentType =
  | "businessLicense"
  | "amlPolicy"
  | "uboDeclaration"
  | "lbmaCertificate"
  | "responsibleSourcingCertificate";

interface FormUBO {
  id: string;
  name: string;
  nationality: string;
  residenceCountry: string;
  ownershipPercentage: string;
  isPEP: boolean;
  position: string;
}

interface UploadedFile {
  name: string;
  size: number;
  file: File;
}

const emptyDocuments: Record<DocumentType, UploadedFile | null> = {
  businessLicense: null,
  amlPolicy: null,
  uboDeclaration: null,
  lbmaCertificate: null,
  responsibleSourcingCertificate: null,
};

function generateRegistrationNumber(countryCode: string, type: CounterpartyType): string {
  const prefix = type === "refinery" ? "REF" : countryCode;
  const sequence = Math.floor(Math.random() * 99999) + 1;
  return `${prefix}-${new Date().getFullYear()}-${sequence.toString().padStart(5, "0")}`;
}

function createUbo(id = crypto.randomUUID()): FormUBO {
  return {
    id,
    name: "",
    nationality: "",
    residenceCountry: "",
    ownershipPercentage: "",
    isPEP: false,
    position: "",
  };
}

export function OnboardingForm() {
  const router = useRouter();
  const { language } = useLanguage();
  const fr = language === "fr";
  const [counterpartyType, setCounterpartyType] = useState<CounterpartyType>("trading_house");
  const [formData, setFormData] = useState({
    legalName: "",
    registrationNumber: "",
    jurisdiction: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    iban: "",
    swiftBic: "",
  });
  const [sourceType, setSourceType] = useState<SourceType | "">("");
  const [refinery, setRefinery] = useState({
    lbmaStatus: "",
    maxFineness: "",
    gdListReference: "",
    firstListedAt: "",
    monitoringAt: "",
    annualCapacity: "",
  });
  const [certifications, setCertifications] = useState<string[]>([]);
  const [refiningChannels, setRefiningChannels] = useState<string[]>([]);
  const [ubos, setUbos] = useState<FormUBO[]>([createUbo("initial-ubo")]);
  const [documentFiles, setDocumentFiles] = useState(emptyDocuments);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      registrationNumber: previous.jurisdiction
        ? generateRegistrationNumber(previous.jurisdiction, counterpartyType)
        : "",
    }));
  }, [formData.jurisdiction, counterpartyType]);

  const copy = useMemo(
    () => ({
      description:
        counterpartyType === "refinery"
          ? fr
            ? "Enregistrer une nouvelle raffinerie et documenter son accréditation"
            : "Register a new refinery and capture its accreditation"
          : fr
            ? "Enregistrer une nouvelle contrepartie pour l’acquisition d’or"
            : "Register a new counterparty for gold acquisition",
      sourceDescription:
        counterpartyType === "refinery"
          ? fr
            ? "Types d’or acceptés par cette raffinerie"
            : "Gold source types this refinery accepts for refining"
          : fr
            ? "Types d’or fournis par cette contrepartie"
            : "Types of gold this counterparty supplies",
    }),
    [counterpartyType, fr],
  );

  const activeDocumentTypes: DocumentType[] =
    counterpartyType === "refinery"
      ? ["businessLicense", "amlPolicy", "uboDeclaration", "lbmaCertificate", "responsibleSourcingCertificate"]
      : ["businessLicense", "amlPolicy", "uboDeclaration"];

  const documentLabels: Record<DocumentType, string> = {
    businessLicense: fr ? "Licence commerciale" : "Business License",
    amlPolicy: fr ? "Politique LBC/FT" : "AML Policy",
    uboDeclaration: fr ? "Déclaration des bénéficiaires effectifs" : "UBO Declaration",
    lbmaCertificate: fr ? "Certificat LBMA Good Delivery" : "LBMA GD Certificate",
    responsibleSourcingCertificate: fr
      ? "Certificat d’approvisionnement responsable"
      : "Responsible Sourcing Certificate",
  };

  const totalOwnership = ubos.reduce(
    (total, ubo) => total + (Number.parseFloat(ubo.ownershipPercentage) || 0),
    0,
  );
  const finenessEligible = ["995", "999", "9999"].includes(refinery.maxFineness);
  const refineryInputsReady = Boolean(refinery.lbmaStatus && refinery.maxFineness);
  const reserveEligible =
    refinery.lbmaStatus === "accredited" && finenessEligible && certifications.length > 0;

  const companyComplete = Boolean(
    formData.legalName.trim() &&
    formData.registrationNumber.trim() &&
    formData.jurisdiction.trim() &&
    formData.address.trim() &&
    formData.contactEmail.trim() &&
    formData.contactPhone.trim(),
  );
  const ubosComplete =
    ubos.length > 0 &&
    ubos.every(
      (ubo) => ubo.name.trim() && ubo.nationality.trim() && ubo.ownershipPercentage.trim(),
    ) &&
    totalOwnership === 100;
  const documentsComplete = activeDocumentTypes.every((type) => documentFiles[type] !== null);
  const refineryComplete =
    counterpartyType !== "refinery" ||
    Boolean(refinery.lbmaStatus && refinery.maxFineness && certifications.length > 0);
  const isFormValid = companyComplete && ubosComplete && documentsComplete && refineryComplete;

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const toggleValue = (
    value: string,
    values: string[],
    setter: (next: string[]) => void,
  ) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const updateUbo = (index: number, field: keyof FormUBO, value: string | boolean) => {
    setUbos((previous) =>
      previous.map((ubo, currentIndex) => (currentIndex === index ? { ...ubo, [field]: value } : ubo)),
    );
  };

  const handleDocumentUpload = (type: DocumentType, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDocumentFiles((previous) => ({ ...previous, [type]: { name: file.name, size: file.size, file } }));
  };

  const formatFileSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const handleSubmit = async (action: "draft" | "submit") => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: formData.legalName,
          registrationNumber: formData.registrationNumber,
          legalForm: counterpartyType === "refinery" ? "Refinery" : "Gold Trading House",
          countryOfIncorporation:
            jurisdictions.find((jurisdiction) => jurisdiction.code === formData.jurisdiction)?.name ||
            formData.jurisdiction,
          registeredAddress: formData.address,
          primaryContact: formData.legalName,
          primaryEmail: formData.contactEmail,
          primaryPhone: formData.contactPhone,
          iban: formData.iban.trim().toUpperCase() || null,
          swiftBic: formData.swiftBic.trim().toUpperCase() || null,
          counterpartyType,
          goldSourceTypes: sourceType ? [sourceType] : [],
          lbmaGoodDeliveryStatus: counterpartyType === "refinery" ? refinery.lbmaStatus : null,
          maxOutputFineness: counterpartyType === "refinery" ? refinery.maxFineness : null,
          gdListReference: counterpartyType === "refinery" ? refinery.gdListReference : null,
          gdFirstListedAt: counterpartyType === "refinery" ? refinery.firstListedAt : null,
          accreditationMonitoringAt: counterpartyType === "refinery" ? refinery.monitoringAt : null,
          annualRefiningCapacityTons: counterpartyType === "refinery" ? Number(refinery.annualCapacity) || null : null,
          responsibleSourcingCertifications: counterpartyType === "refinery" ? certifications : [],
          refiningChannels: counterpartyType === "refinery" ? refiningChannels : [],
          status: action === "draft" ? "draft" : "pending_review",
          ubos: ubos.filter((ubo) => ubo.name).map((ubo) => ({
            fullName: ubo.name,
            nationality:
              jurisdictions.find((jurisdiction) => jurisdiction.code === ubo.nationality)?.name || ubo.nationality,
            residenceCountry: ubo.residenceCountry,
            ownershipPercent: Number.parseFloat(ubo.ownershipPercentage) || 0,
            isPEP: ubo.isPEP,
            pepDetails: ubo.position || undefined,
          })),
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      const newCounterparty = await response.json();

      for (const type of activeDocumentTypes) {
        const uploadedFile = documentFiles[type];
        if (!uploadedFile) continue;
        const payload = new FormData();
        payload.append("file", uploadedFile.file);
        payload.append("counterpartyId", newCounterparty.id);
        payload.append("documentType", type);
        const uploadResponse = await fetch("/api/documents", { method: "POST", body: payload });
        if (!uploadResponse.ok && action === "submit") throw new Error(await uploadResponse.text());
      }

      router.push(action === "submit" ? `/screening/${newCounterparty.id}?submitted=true` : "/counterparties");
    } catch (error) {
      console.error("Error creating counterparty:", error);
      alert(fr ? "Échec de l’enregistrement. Veuillez réessayer." : "Save failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>{fr ? "Informations sur l’entreprise" : "Company Information"}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-5 md:p-6">
        <FormSection icon={Landmark} title={fr ? "Type de contrepartie" : "Counterparty type"} required>
          <div className="grid gap-3 md:grid-cols-2">
            <TypeCard
              selected={counterpartyType === "trading_house"}
              icon={Building2}
              title={fr ? "Maison de négoce d’or" : "Gold Trading House"}
              description={
                fr
                  ? "Achète l’or artisanal ou minier auprès de producteurs locaux"
                  : "Buys artisanal or mined gold from local producers"
              }
              onClick={() => setCounterpartyType("trading_house")}
            />
            <TypeCard
              selected={counterpartyType === "refinery"}
              icon={Factory}
              title={fr ? "Raffinerie" : "Refinery"}
              description={
                fr
                  ? "Transforme le doré en lingots et fait l’objet de contrôles d’accréditation"
                  : "Transforms doré into bullion and is subject to accreditation checks"
              }
              onClick={() => setCounterpartyType("refinery")}
            />
          </div>
        </FormSection>

        <Separator />

        <FormSection icon={Building2} title={fr ? "Informations sur l’entreprise" : "Company information"}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={fr ? "Raison sociale" : "Legal Name"} required>
              <Input value={formData.legalName} onChange={(event) => setField("legalName", event.target.value)} placeholder={fr ? "Nom légal enregistré" : "Registered legal entity name"} />
            </Field>
            <Field label={fr ? "Numéro d’enregistrement" : "Registration Number"} required>
              <div className="relative">
                <Input value={formData.registrationNumber} readOnly disabled={!formData.jurisdiction} className="bg-muted/50 pr-10 font-mono" placeholder={fr ? "Sélectionnez d’abord le pays" : "Select jurisdiction first"} />
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">{fr ? "Généré automatiquement : CODE_ISO-ANNÉE-SÉQUENCE" : "Auto-generated: ISO_CODE-YEAR-SEQUENCE"}</p>
            </Field>
            <Field label={fr ? "Pays de constitution" : "Country of Incorporation"} required>
              <Select value={formData.jurisdiction} onValueChange={(value) => setField("jurisdiction", value)}>
                <SelectTrigger><SelectValue placeholder={fr ? "Sélectionner une juridiction" : "Select jurisdiction"} /></SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((jurisdiction) => <SelectItem key={jurisdiction.code} value={jurisdiction.code}>{jurisdiction.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={fr ? "Adresse du siège social" : "Registered Address"} required className="md:col-span-2">
              <Textarea value={formData.address} onChange={(event) => setField("address", event.target.value)} placeholder={fr ? "Rue, ville, province, code postal" : "Street, city, province, postal code"} />
            </Field>
            <Field label={fr ? "E-mail principal" : "Primary Email"} required>
              <Input type="email" value={formData.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} placeholder="contact@company.com" />
            </Field>
            <Field label={fr ? "Téléphone principal" : "Primary Phone"} required>
              <Input type="tel" value={formData.contactPhone} onChange={(event) => setField("contactPhone", event.target.value)} placeholder="+243 ..." />
            </Field>
            <Field label={`${fr ? "IBAN" : "IBAN"} (${fr ? "facultatif" : "optional"})`}>
              <Input value={formData.iban} onChange={(event) => setField("iban", event.target.value.toUpperCase())} className="font-mono uppercase" placeholder="CD12 1234 5678 9012 3456 7890" autoComplete="off" />
            </Field>
            <Field label={`${fr ? "SWIFT / BIC" : "SWIFT / BIC"} (${fr ? "facultatif" : "optional"})`}>
              <Input value={formData.swiftBic} onChange={(event) => setField("swiftBic", event.target.value.toUpperCase())} className="font-mono uppercase" placeholder="BCDCCDKIXXX" autoComplete="off" />
            </Field>
          </div>
        </FormSection>

        <Separator />

        <FormSection icon={PackageOpen} title={fr ? "Types de sources d’or" : "Gold source types"} description={copy.sourceDescription}>
          <div className="max-w-md space-y-2">
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
              <SelectTrigger><SelectValue placeholder={fr ? "Sélectionner un type de source" : "Select a gold source type"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ASM">{fr ? "Exploitation artisanale et à petite échelle (ASM)" : "Artisanal & Small-scale Mining (ASM)"}</SelectItem>
                <SelectItem value="LSM">{fr ? "Exploitation minière à grande échelle (LSM)" : "Large-scale Mining (LSM)"}</SelectItem>
                <SelectItem value="RECYCLED">{fr ? "Or recyclé" : "Recycled Gold"}</SelectItem>
              </SelectContent>
            </Select>
            {sourceType && (
              <Badge variant="outline" className={sourceType === "ASM" ? "border-destructive text-destructive" : "border-emerald-500/50 text-emerald-500"}>
                {sourceType === "ASM" ? (fr ? "Risque élevé" : "High Risk") : (fr ? "Risque faible" : "Low Risk")}
              </Badge>
            )}
          </div>
        </FormSection>

        {counterpartyType === "refinery" && (
          <>
            <Separator />
            <FormSection
              icon={Factory}
              title={fr ? "Raffinage et accréditation" : "Refining & accreditation"}
              description={fr ? "Ces données déterminent l’éligibilité de l’or raffiné aux réserves (US-R05)." : "These fields drive reserve eligibility of gold refined by this counterparty (US-R05)."}
              badge="US-R01"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="LBMA Good Delivery status" required>
                  <Select value={refinery.lbmaStatus} onValueChange={(value) => setRefinery((previous) => ({ ...previous, lbmaStatus: value }))}>
                    <SelectTrigger><SelectValue placeholder={fr ? "Sélectionner un statut" : "Select status"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accredited">{fr ? "Accréditée (liste GD actuelle)" : "Accredited (on current GD List)"}</SelectItem>
                      <SelectItem value="application">{fr ? "Demande en cours" : "Application in progress"}</SelectItem>
                      <SelectItem value="none">{fr ? "Non accréditée" : "Not accredited"}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={fr ? "Titre maximal en sortie" : "Max output fineness"} required>
                  <Select value={refinery.maxFineness} onValueChange={(value) => setRefinery((previous) => ({ ...previous, maxFineness: value }))}>
                    <SelectTrigger><SelectValue placeholder={fr ? "Sélectionner le titre" : "Select fineness"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="995">995,0 ‰ (minimum Good Delivery)</SelectItem>
                      <SelectItem value="999">999,0 ‰</SelectItem>
                      <SelectItem value="9999">999,9 ‰</SelectItem>
                      <SelectItem value="lt995">{fr ? "Inférieur à 995 ‰" : "Below 995 ‰"}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {refinery.lbmaStatus === "accredited" && (
                  <>
                    <Field label={fr ? "Référence de la liste GD" : "GD List reference"}><Input value={refinery.gdListReference} onChange={(event) => setRefinery((previous) => ({ ...previous, gdListReference: event.target.value }))} placeholder="GDL-GOLD-2021-014" /></Field>
                    <Field label={fr ? "Date de première inscription" : "Date first listed"}><Input type="date" value={refinery.firstListedAt} onChange={(event) => setRefinery((previous) => ({ ...previous, firstListedAt: event.target.value }))} /></Field>
                    <Field label={fr ? "Expiration / prochain contrôle" : "Accreditation expiry / next monitoring"}><Input type="date" value={refinery.monitoringAt} onChange={(event) => setRefinery((previous) => ({ ...previous, monitoringAt: event.target.value }))} /></Field>
                  </>
                )}
                <Field label={fr ? "Capacité annuelle de raffinage (t/an)" : "Annual refining capacity (t/yr)"}>
                  <Input type="number" min="0" step="0.1" value={refinery.annualCapacity} onChange={(event) => setRefinery((previous) => ({ ...previous, annualCapacity: event.target.value }))} placeholder="12" />
                  <p className="text-xs text-muted-foreground">{fr ? "L’accréditation GD requiert une production raffinée ≥ 10 t/an." : "GD accreditation requires ≥ 10 t/yr refined production."}</p>
                </Field>
              </div>

              <ChoiceList
                title={fr ? "Certification d’approvisionnement responsable" : "Responsible sourcing certification"}
                required
                options={[
                  ["lbma_rgg", "LBMA Responsible Gold Guidance"],
                  ["oecd_due_diligence", fr ? "Guide OCDE sur le devoir de diligence" : "OECD Due Diligence Guidance"],
                  ["rjc_chain_of_custody", "Responsible Jewellery Council — Chain of Custody"],
                ]}
                values={certifications}
                onToggle={(value) => toggleValue(value, certifications, setCertifications)}
              />
              <ChoiceList
                title={fr ? "Canal de raffinage" : "Refining channel"}
                options={[
                  ["domestic_toll_refining", fr ? "Raffinage à façon national" : "Domestic toll refining"],
                  ["export_accredited_refiner", fr ? "Export vers une raffinerie accréditée" : "Export to accredited refiner"],
                ]}
                values={refiningChannels}
                onToggle={(value) => toggleValue(value, refiningChannels, setRefiningChannels)}
              />

              <div className="rounded-lg border border-l-4 border-l-primary bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground"><strong className="text-foreground">{fr ? "Éligibilité aux réserves (US-R05)." : "Reserve eligibility (US-R05)."}</strong> {fr ? "L’or peut être classé comme or monétaire si la raffinerie est LBMA Good Delivery, si le titre est ≥ 995 ‰ et si une certification d’approvisionnement responsable est détenue." : "Gold can be classified as monetary gold when the refiner is LBMA Good Delivery accredited, fineness is ≥ 995 ‰, and a responsible-sourcing certification is held."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!refineryInputsReady ? (
                    <><Badge variant="outline" className="border-amber-500/50 text-amber-500">{fr ? "En attente" : "Awaiting inputs"}</Badge><span className="text-muted-foreground">{fr ? "Complétez les champs pour lancer l’évaluation." : "Complete the fields to evaluate."}</span></>
                  ) : reserveEligible ? (
                    <><Badge variant="outline" className="border-emerald-500/50 text-emerald-500">{fr ? "Éligible aux réserves" : "Reserve-eligible"}</Badge><span className="text-muted-foreground">{fr ? "La production peut être classée comme or monétaire." : "Refined output can be classified as monetary gold."}</span></>
                  ) : (
                    <><Badge variant="outline" className="border-amber-500/50 text-amber-500">{fr ? "Non monétaire" : "Non-monetary"}</Badge><span className="text-muted-foreground">{fr ? "Les critères d’éligibilité ne sont pas tous satisfaits." : "Not all eligibility criteria are met."}</span></>
                  )}
                </div>
              </div>
            </FormSection>
          </>
        )}

        <Separator />

        <FormSection icon={Users} title={fr ? "Bénéficiaires effectifs ultimes" : "Ultimate beneficial owners"}>
          {ubos.some((ubo) => ubo.ownershipPercentage) && totalOwnership !== 100 && (
            <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{fr ? `Le total des participations doit être égal à 100 % (actuellement ${totalOwnership.toFixed(1)} %).` : `Total ownership must equal 100% (currently ${totalOwnership.toFixed(1)}%).`}</AlertDescription></Alert>
          )}
          <div className="space-y-3">
            {ubos.map((ubo, index) => (
              <div key={ubo.id} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">UBO {index + 1}</h4>
                  {ubos.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setUbos((previous) => previous.filter((_, currentIndex) => currentIndex !== index))} className="text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">{fr ? "Supprimer" : "Remove"}</span></Button>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={fr ? "Nom complet" : "Full Name"} required><Input value={ubo.name} onChange={(event) => updateUbo(index, "name", event.target.value)} placeholder={fr ? "Nom légal complet" : "Full legal name"} /></Field>
                  <Field label={fr ? "Nationalité" : "Nationality"} required>
                    <Select value={ubo.nationality} onValueChange={(value) => updateUbo(index, "nationality", value)}><SelectTrigger><SelectValue placeholder={fr ? "Sélectionner" : "Select nationality"} /></SelectTrigger><SelectContent>{jurisdictions.map((jurisdiction) => <SelectItem key={jurisdiction.code} value={jurisdiction.code}>{jurisdiction.name}</SelectItem>)}</SelectContent></Select>
                  </Field>
                  <Field label={fr ? "Pays de résidence" : "Country"}><Input value={ubo.residenceCountry} onChange={(event) => updateUbo(index, "residenceCountry", event.target.value)} placeholder={fr ? "Pays de résidence" : "Country of residence"} /></Field>
                  <Field label={fr ? "Participation (%)" : "Ownership %"} required><Input type="number" min="0" max="100" value={ubo.ownershipPercentage} onChange={(event) => updateUbo(index, "ownershipPercentage", event.target.value)} placeholder="0" /></Field>
                  <Field label={fr ? "Fonction / rôle PEP" : "PEP Position / Role"}><Input value={ubo.position} onChange={(event) => updateUbo(index, "position", event.target.value)} disabled={!ubo.isPEP} placeholder={fr ? "Le cas échéant" : "If applicable"} /></Field>
                  <div className="flex items-end gap-3 pb-1">
                    <Checkbox id={`pep-${ubo.id}`} checked={ubo.isPEP} onCheckedChange={(checked) => updateUbo(index, "isPEP", Boolean(checked))} />
                    <Label htmlFor={`pep-${ubo.id}`}>{fr ? "Est une personne politiquement exposée (PEP)" : "Is a politically exposed person (PEP)"}</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setUbos((previous) => [...previous, createUbo()])} className="mt-3 text-primary"><Plus className="mr-2 h-4 w-4" />{fr ? "Ajouter un bénéficiaire effectif" : "Add beneficial owner"}</Button>
        </FormSection>

        <Separator />

        <FormSection icon={FileText} title={fr ? "Documents" : "Documents"} description={fr ? "Formats acceptés : PDF, JPG, PNG (10 Mo maximum)" : "Supported formats: PDF, JPG, PNG (Max 10MB)"}>
          <div className="grid gap-4 md:grid-cols-2">
            {activeDocumentTypes.map((type) => {
              const uploadedFile = documentFiles[type];
              return (
                <Field key={type} label={documentLabels[type]} required>
                  {uploadedFile ? (
                    <div className="flex min-h-24 items-center justify-between rounded-lg border border-emerald-500/50 bg-emerald-500/5 p-4">
                      <div className="flex min-w-0 items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /><div className="min-w-0"><p className="truncate text-sm font-medium">{uploadedFile.name}</p><p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p></div></div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDocumentFiles((previous) => ({ ...previous, [type]: null }))}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <Upload className="mb-2 h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{fr ? "Glissez un fichier ici ou cliquez pour parcourir" : "Drag and drop files here, or click to browse"}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(event) => handleDocumentUpload(type, event)} />
                    </label>
                  )}
                </Field>
              );
            })}
          </div>
        </FormSection>

        <Separator />

        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{fr ? "Tous les champs marqués d’un * sont obligatoires." : "All fields marked with * are required."}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>{fr ? "Annuler" : "Cancel"}</Button>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleSubmit("draft")}><Save className="mr-2 h-4 w-4" />{fr ? "Enregistrer le brouillon" : "Save Draft"}</Button>
            <Button type="button" disabled={isSubmitting || !isFormValid} onClick={() => handleSubmit("submit")}><Send className="mr-2 h-4 w-4" />{fr ? "Soumettre pour examen" : "Submit for Review"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormSection({ icon: Icon, title, description, required, badge, children }: { icon: typeof Building2; title: string; description?: string; required?: boolean; badge?: string; children: ReactNode }) {
  return <section className="py-6 first:pt-0 last:pb-0"><div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">{title}{required && <span className="ml-1 text-primary">*</span>}</h3>{badge && <Badge variant="outline" className="ml-1 border-amber-500/50 text-amber-500">{badge}</Badge>}</div>{description && <p className="-mt-2 mb-4 text-sm text-muted-foreground">{description}</p>}{children}</section>;
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}{required && <span className="ml-1 text-primary">*</span>}</Label>{children}</div>;
}

function TypeCard({ selected, icon: Icon, title, description, onClick }: { selected: boolean; icon: typeof Building2; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${selected ? "border-primary bg-primary/5" : "bg-muted/30"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-muted-foreground"}`}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span></button>;
}

function ChoiceList({ title, required, options, values, onToggle }: { title: string; required?: boolean; options: [string, string][]; values: string[]; onToggle: (value: string) => void }) {
  return <div className="mt-5"><Label>{title}{required && <span className="ml-1 text-primary">*</span>}</Label><div className="mt-2 space-y-2">{options.map(([value, label]) => <div key={value} className="flex items-center gap-3"><Checkbox id={value} checked={values.includes(value)} onCheckedChange={() => onToggle(value)} /><Label htmlFor={value} className="font-normal">{label}</Label></div>)}</div></div>;
}
