"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/sidebar-provider"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Scale,
  FlaskConical,
  Plus,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Settings,
  Award,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Equipment {
  id: string
  name: string
  type: string
  method: string | null
  location: string | null
  status: string
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  created_at: string
}

interface Accreditation {
  id: string
  equipment_id: string
  body: string
  accreditation_number: string | null
  valid_from: string | null
  valid_to: string | null
}

interface Calibration {
  id: string
  equipment_id: string
  calibrated_at: string | null
  calibration_interval_days: number
  cert_number: string | null
  certified_by: string | null
  next_due_at: string | null
}

const EMPTY_EQUIPMENT = { name: "", type: "scale", method: "", location: "", status: "active", serialNumber: "", manufacturer: "", model: "" }

export default function AdminEquipmentPage() {
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState("scales")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAccreditationDialog, setShowAccreditationDialog] = useState(false)
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [newEquipment, setNewEquipment] = useState(EMPTY_EQUIPMENT)
  const [newAccreditation, setNewAccreditation] = useState({ body: "LBMA", accreditationNumber: "", validFrom: "", validTo: "" })
  const [newCalibration, setNewCalibration] = useState({ calibratedAt: "", intervalDays: 365, certNumber: "", certifiedBy: "" })

  const { data, mutate } = useSWR<{ equipment: Equipment[]; accreditations: Accreditation[]; calibrations: Calibration[] }>(
    "/api/equipment",
    fetcher,
    { refreshInterval: 60_000 }
  )

  const equipment = data?.equipment ?? []
  const accreditations = data?.accreditations ?? []
  const calibrations = data?.calibrations ?? []

  const scales = equipment.filter((e) => e.type === "scale")
  const labs = equipment.filter((e) => e.type === "lab")

  const getEquipmentName = (id: string) => equipment.find((e) => e.id === id)?.name ?? id

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days < 90
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const handleSaveEquipment = async () => {
    setIsSaving(true)
    try {
      await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEquipment),
      })
      await mutate()
      setShowAddDialog(false)
      setNewEquipment(EMPTY_EQUIPMENT)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAccreditation = async () => {
    if (!selectedEquipmentId) return
    setIsSaving(true)
    try {
      await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_accreditation", equipmentId: selectedEquipmentId, ...newAccreditation }),
      })
      await mutate()
      setShowAccreditationDialog(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCalibration = async () => {
    if (!selectedEquipmentId) return
    setIsSaving(true)
    try {
      await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_calibration", equipmentId: selectedEquipmentId, ...newCalibration }),
      })
      await mutate()
      setShowCalibrationDialog(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const EquipmentTable = ({ items, type }: { items: Equipment[]; type: "scale" | "lab" }) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          {language === "fr"
            ? `Aucun ${type === "scale" ? "appareil de pesée" : "laboratoire"} enregistré.`
            : `No ${type === "scale" ? "weighing equipment" : "labs"} registered.`}
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{language === "fr" ? "Nom / Modèle" : "Name / Model"}</TableHead>
            <TableHead>{language === "fr" ? "Emplacement" : "Location"}</TableHead>
            <TableHead>{language === "fr" ? "N° Série" : "Serial #"}</TableHead>
            <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
            <TableHead>{language === "fr" ? "Prochaine Calibration" : "Next Calibration"}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((eq) => {
            const eqCalibrations = calibrations.filter((c) => c.equipment_id === eq.id)
            const latestCal = eqCalibrations.sort((a, b) =>
              new Date(b.calibrated_at ?? 0).getTime() - new Date(a.calibrated_at ?? 0).getTime()
            )[0]
            const nextDue = latestCal?.next_due_at ?? null
            const calExpiring = isExpiringSoon(nextDue)
            const calExpired = isExpired(nextDue)

            const eqAccreds = accreditations.filter((a) => a.equipment_id === eq.id)
            const latestAccred = eqAccreds[0]
            const accredExpiring = isExpiringSoon(latestAccred?.valid_to ?? null)
            const accredExpired = isExpired(latestAccred?.valid_to ?? null)

            return (
              <TableRow key={eq.id}>
                <TableCell>
                  <p className="font-medium">{eq.name}</p>
                  {eq.model && <p className="text-xs text-muted-foreground">{eq.manufacturer} {eq.model}</p>}
                </TableCell>
                <TableCell>{eq.location ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">{eq.serial_number ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={eq.status === "active" ? "default" : "secondary"} className="text-xs">
                    {eq.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {nextDue ? (
                    <div className="flex items-center gap-1">
                      {(calExpired || calExpiring) && (
                        <AlertTriangle className={`h-3 w-3 ${calExpired ? "text-red-500" : "text-amber-500"}`} />
                      )}
                      <span className={`text-sm ${calExpired ? "text-red-600 font-medium" : calExpiring ? "text-amber-600" : ""}`}>
                        {new Date(nextDue).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                  {(accredExpired || accredExpiring) && latestAccred && (
                    <p className={`text-xs mt-0.5 ${accredExpired ? "text-red-600" : "text-amber-600"}`}>
                      {language === "fr" ? "Accréditation" : "Accreditation"} {accredExpired ? (language === "fr" ? "expirée" : "expired") : (language === "fr" ? "expire bientôt" : "expiring soon")}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={language === "fr" ? "Calibration" : "Calibration"}
                      onClick={() => { setSelectedEquipmentId(eq.id); setShowCalibrationDialog(true) }}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    {type === "lab" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={language === "fr" ? "Accréditation" : "Accreditation"}
                        onClick={() => { setSelectedEquipmentId(eq.id); setShowAccreditationDialog(true) }}
                      >
                        <Award className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={language === "fr" ? "Registre Équipements — Administration" : "Equipment Register — Administration"}
            subtitle={language === "fr" ? "Balances & Laboratoires d'Essai" : "Vault Scales & Assay Laboratories"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: Scale, label: language === "fr" ? "Balances" : "Scales", value: scales.length, color: "text-blue-600" },
                  { icon: FlaskConical, label: language === "fr" ? "Laboratoires" : "Labs", value: labs.length, color: "text-purple-600" },
                  {
                    icon: AlertTriangle,
                    label: language === "fr" ? "Calibrations dues" : "Calibrations due",
                    value: calibrations.filter((c) => isExpiringSoon(c.next_due_at)).length,
                    color: "text-amber-600",
                  },
                  {
                    icon: Award,
                    label: language === "fr" ? "Accréditations à renouveler" : "Accreditations to renew",
                    value: accreditations.filter((a) => isExpiringSoon(a.valid_to)).length,
                    color: "text-red-600",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <Card key={label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Icon className={`h-8 w-8 ${color}`} />
                      <div>
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="scales" className="gap-2">
                      <Scale className="h-4 w-4" />
                      {language === "fr" ? "Balances de Pesée" : "Vault Scales"}
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="gap-2">
                      <FlaskConical className="h-4 w-4" />
                      {language === "fr" ? "Laboratoires d'Essai" : "Assay Laboratories"}
                    </TabsTrigger>
                    <TabsTrigger value="calibrations" className="gap-2">
                      <Settings className="h-4 w-4" />
                      {language === "fr" ? "Calibrations" : "Calibrations"}
                    </TabsTrigger>
                    <TabsTrigger value="accreditations" className="gap-2">
                      <Award className="h-4 w-4" />
                      {language === "fr" ? "Accréditations" : "Accreditations"}
                    </TabsTrigger>
                  </TabsList>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Ajouter Équipement" : "Add Equipment"}
                  </Button>
                </div>

                <TabsContent value="scales">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        {language === "fr" ? "Balances Coffre Enregistrées" : "Registered Vault Scales"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Toutes les balances doivent être calibrées selon OIML R 111 et vérifiées chaque semaine."
                          : "All scales must be calibrated per OIML R 111 and verified weekly."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EquipmentTable items={scales} type="scale" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="labs">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5" />
                        {language === "fr" ? "Laboratoires d'Essai Accrédités" : "Accredited Assay Laboratories"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Accréditation ISO 17025 requise. Renouvellement annuel obligatoire."
                          : "ISO 17025 accreditation required. Annual renewal mandatory."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EquipmentTable items={labs} type="lab" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="calibrations">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {language === "fr" ? "Registre des Calibrations" : "Calibration Register"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {calibrations.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                          {language === "fr" ? "Aucune calibration enregistrée." : "No calibrations recorded."}
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "fr" ? "Équipement" : "Equipment"}</TableHead>
                              <TableHead>{language === "fr" ? "Calibré le" : "Calibrated At"}</TableHead>
                              <TableHead>{language === "fr" ? "N° Certificat" : "Cert #"}</TableHead>
                              <TableHead>{language === "fr" ? "Certifié par" : "Certified By"}</TableHead>
                              <TableHead>{language === "fr" ? "Prochaine Échéance" : "Next Due"}</TableHead>
                              <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {calibrations.map((cal) => {
                              const expired = isExpired(cal.next_due_at)
                              const expiring = isExpiringSoon(cal.next_due_at)
                              return (
                                <TableRow key={cal.id}>
                                  <TableCell className="font-medium">{getEquipmentName(cal.equipment_id)}</TableCell>
                                  <TableCell>{cal.calibrated_at ? new Date(cal.calibrated_at).toLocaleDateString() : "—"}</TableCell>
                                  <TableCell className="font-mono text-sm">{cal.cert_number ?? "—"}</TableCell>
                                  <TableCell>{cal.certified_by ?? "—"}</TableCell>
                                  <TableCell className={expired ? "text-red-600 font-medium" : expiring ? "text-amber-600" : ""}>
                                    {cal.next_due_at ? new Date(cal.next_due_at).toLocaleDateString() : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {expired ? (
                                      <Badge variant="destructive" className="text-xs">{language === "fr" ? "Expirée" : "Expired"}</Badge>
                                    ) : expiring ? (
                                      <Badge className="bg-amber-500 text-xs">{language === "fr" ? "Bientôt" : "Due Soon"}</Badge>
                                    ) : (
                                      <Badge className="bg-emerald-500 text-xs">{language === "fr" ? "Valide" : "Valid"}</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="accreditations">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        {language === "fr" ? "Registre des Accréditations" : "Accreditation Register"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {accreditations.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                          {language === "fr" ? "Aucune accréditation enregistrée." : "No accreditations recorded."}
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "fr" ? "Laboratoire" : "Laboratory"}</TableHead>
                              <TableHead>{language === "fr" ? "Organisme" : "Body"}</TableHead>
                              <TableHead>{language === "fr" ? "N° Accréditation" : "Accreditation #"}</TableHead>
                              <TableHead>{language === "fr" ? "Valide Du" : "Valid From"}</TableHead>
                              <TableHead>{language === "fr" ? "Valide Jusqu'au" : "Valid To"}</TableHead>
                              <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {accreditations.map((acc) => {
                              const expired = isExpired(acc.valid_to)
                              const expiring = isExpiringSoon(acc.valid_to)
                              return (
                                <TableRow key={acc.id}>
                                  <TableCell className="font-medium">{getEquipmentName(acc.equipment_id)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{acc.body}</Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{acc.accreditation_number ?? "—"}</TableCell>
                                  <TableCell>{acc.valid_from ? new Date(acc.valid_from).toLocaleDateString() : "—"}</TableCell>
                                  <TableCell className={expired ? "text-red-600 font-medium" : expiring ? "text-amber-600" : ""}>
                                    {acc.valid_to ? new Date(acc.valid_to).toLocaleDateString() : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {expired ? (
                                      <Badge variant="destructive" className="text-xs">{language === "fr" ? "Expirée" : "Expired"}</Badge>
                                    ) : expiring ? (
                                      <Badge className="bg-amber-500 text-xs">{language === "fr" ? "Bientôt" : "Due Soon"}</Badge>
                                    ) : (
                                      <Badge className="bg-emerald-500 text-xs">{language === "fr" ? "Valide" : "Valid"}</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Ajouter un Équipement" : "Add Equipment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Type" : "Type"} *</Label>
                <Select value={newEquipment.type} onValueChange={(v) => setNewEquipment((p) => ({ ...p, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scale">{language === "fr" ? "Balance de pesée" : "Vault Scale"}</SelectItem>
                    <SelectItem value="lab">{language === "fr" ? "Laboratoire" : "Assay Lab"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Statut" : "Status"}</Label>
                <Select value={newEquipment.status} onValueChange={(v) => setNewEquipment((p) => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{language === "fr" ? "Actif" : "Active"}</SelectItem>
                    <SelectItem value="maintenance">{language === "fr" ? "En maintenance" : "Maintenance"}</SelectItem>
                    <SelectItem value="retired">{language === "fr" ? "Retiré" : "Retired"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "fr" ? "Nom" : "Name"} *</Label>
              <Input value={newEquipment.name} onChange={(e) => setNewEquipment((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Fabricant" : "Manufacturer"}</Label>
                <Input value={newEquipment.manufacturer} onChange={(e) => setNewEquipment((p) => ({ ...p, manufacturer: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Modèle" : "Model"}</Label>
                <Input value={newEquipment.model} onChange={(e) => setNewEquipment((p) => ({ ...p, model: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "N° Série" : "Serial #"}</Label>
                <Input value={newEquipment.serialNumber} onChange={(e) => setNewEquipment((p) => ({ ...p, serialNumber: e.target.value }))} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Emplacement" : "Location"}</Label>
                <Input value={newEquipment.location} onChange={(e) => setNewEquipment((p) => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{language === "fr" ? "Annuler" : "Cancel"}</Button>
            <Button onClick={handleSaveEquipment} disabled={!newEquipment.name || isSaving}>
              {isSaving ? (language === "fr" ? "Enregistrement..." : "Saving...") : (language === "fr" ? "Enregistrer" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accreditation Dialog */}
      <Dialog open={showAccreditationDialog} onOpenChange={setShowAccreditationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Ajouter Accréditation" : "Add Accreditation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Organisme" : "Body"} *</Label>
                <Select value={newAccreditation.body} onValueChange={(v) => setNewAccreditation((p) => ({ ...p, body: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LBMA">LBMA Good Delivery</SelectItem>
                    <SelectItem value="ISO 17025">ISO 17025</SelectItem>
                    <SelectItem value="OIML">OIML</SelectItem>
                    <SelectItem value="Other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "N° Accréditation" : "Accreditation #"}</Label>
                <Input value={newAccreditation.accreditationNumber} onChange={(e) => setNewAccreditation((p) => ({ ...p, accreditationNumber: e.target.value }))} className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Date Début" : "Valid From"}</Label>
                <Input type="date" value={newAccreditation.validFrom} onChange={(e) => setNewAccreditation((p) => ({ ...p, validFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Date Fin" : "Valid To"} *</Label>
                <Input type="date" value={newAccreditation.validTo} onChange={(e) => setNewAccreditation((p) => ({ ...p, validTo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccreditationDialog(false)}>{language === "fr" ? "Annuler" : "Cancel"}</Button>
            <Button onClick={handleSaveAccreditation} disabled={!newAccreditation.body || !newAccreditation.validTo || isSaving}>
              {isSaving ? (language === "fr" ? "Enregistrement..." : "Saving...") : (language === "fr" ? "Enregistrer" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calibration Dialog */}
      <Dialog open={showCalibrationDialog} onOpenChange={setShowCalibrationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Enregistrer Calibration" : "Record Calibration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Date Calibration" : "Calibration Date"} *</Label>
                <Input type="datetime-local" value={newCalibration.calibratedAt} onChange={(e) => setNewCalibration((p) => ({ ...p, calibratedAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Intervalle (jours)" : "Interval (days)"}</Label>
                <Input type="number" value={newCalibration.intervalDays} onChange={(e) => setNewCalibration((p) => ({ ...p, intervalDays: parseInt(e.target.value, 10) || 365 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "N° Certificat" : "Cert #"}</Label>
                <Input value={newCalibration.certNumber} onChange={(e) => setNewCalibration((p) => ({ ...p, certNumber: e.target.value }))} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>{language === "fr" ? "Certifié par" : "Certified By"}</Label>
                <Input value={newCalibration.certifiedBy} onChange={(e) => setNewCalibration((p) => ({ ...p, certifiedBy: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCalibrationDialog(false)}>{language === "fr" ? "Annuler" : "Cancel"}</Button>
            <Button onClick={handleSaveCalibration} disabled={!newCalibration.calibratedAt || isSaving}>
              {isSaving ? (language === "fr" ? "Enregistrement..." : "Saving...") : (language === "fr" ? "Enregistrer" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
