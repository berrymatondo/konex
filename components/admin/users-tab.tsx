"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { UserPlus, Trash2, KeyRound, Eye, EyeOff, Copy, Check, Mail, Pencil, Building2 } from "lucide-react"
import {
  createUser,
  deleteUser,
  listUsers,
  listRoles,
  listCounterpartyOptions,
  resetUserPassword,
  setUserCounterparty,
  updateUserProfile,
  updateUserRole,
  type AdminUser,
  type CounterpartyOption,
} from "@/app/admin/actions"
import type { AppRole } from "@/lib/roles-store"
import { isCounterpartyRole } from "@/lib/roles"

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "admin") return "default"
  if (role === "risk_manager") return "secondary"
  return "outline"
}

export function UsersTab() {
  const { data: users, isLoading, mutate } = useSWR<AdminUser[]>("admin-users", () => listUsers())
  const { data: roles } = useSWR<AppRole[]>("admin-roles", () => listRoles())
  const { data: counterparties } = useSWR<CounterpartyOption[]>(
    "admin-counterparty-options",
    () => listCounterpartyOptions(),
  )
  const [isPending, startTransition] = useTransition()

  const allRoles = roles ?? []
  const labelFor = (key: string) => allRoles.find((r) => r.key === key)?.label ?? key
  // A user holds a "counterparty profile" when its role key/label mentions counterparty.
  const isCounterpartyUser = (u: AdminUser) =>
    isCounterpartyRole({ key: u.role, label: allRoles.find((r) => r.key === u.role)?.label })

  // Create dialog state
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<string>("compliance_officer")
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName("")
    setEmail("")
    setPassword("")
    setRole("compliance_officer")
    setError(null)
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createUser({ name, email, password, role })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (!result.emailSent) {
        // Account created, but the credentials email failed. Keep the dialog
        // open and warn the admin so they can pass the password along manually.
        setError(
          `Compte créé, mais l'envoi de l'email a échoué${
            result.emailError ? ` (${result.emailError})` : ""
          }. Communiquez le mot de passe manuellement.`,
        )
        mutate()
        return
      }
      resetForm()
      setOpen(false)
      mutate()
    })
  }

  function handleRoleChange(userId: string, newRole: string) {
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole)
        mutate()
      } catch (e) {
        console.error("[v0] role update failed", e)
      }
    })
  }

  function handleDelete(userId: string) {
    startTransition(async () => {
      try {
        await deleteUser(userId)
        mutate()
      } catch (e) {
        console.error("[v0] delete failed", e)
      }
    })
  }

  // Reset password dialog state
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string } | null>(null)

  function openReset(user: AdminUser) {
    setResetUser(user)
    setResetPassword("")
    setShowResetPassword(true)
    setResetError(null)
    setResetDone(false)
    setCopied(false)
    setEmailStatus(null)
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
    const bytes = new Uint32Array(14)
    crypto.getRandomValues(bytes)
    setResetPassword(Array.from(bytes, (b) => chars[b % chars.length]).join(""))
    setShowResetPassword(true)
  }

  function copyPassword() {
    navigator.clipboard.writeText(resetPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    if (!resetUser) return
    setResetError(null)
    startTransition(async () => {
      const result = await resetUserPassword(resetUser.id, resetPassword)
      if (!result.ok) {
        setResetError(result.error)
        return
      }
      setEmailStatus({ sent: result.emailSent, error: result.emailError })
      setResetDone(true)
    })
  }

  // Edit profile (name + email) dialog state
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  function openEdit(user: AdminUser) {
    setEditUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditError(null)
  }

  function handleEdit() {
    if (!editUser) return
    setEditError(null)
    startTransition(async () => {
      const result = await updateUserProfile(editUser.id, { name: editName, email: editEmail })
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      setEditUser(null)
      mutate()
    })
  }

  // Counterparty association dialog state
  const NONE = "__none__"
  const [assocUser, setAssocUser] = useState<AdminUser | null>(null)
  const [assocCounterparty, setAssocCounterparty] = useState<string>(NONE)
  const [assocError, setAssocError] = useState<string | null>(null)

  function openAssoc(user: AdminUser) {
    setAssocUser(user)
    setAssocCounterparty(user.counterpartyId ?? NONE)
    setAssocError(null)
  }

  function handleAssoc() {
    if (!assocUser) return
    setAssocError(null)
    startTransition(async () => {
      const result = await setUserCounterparty(
        assocUser.id,
        assocCounterparty === NONE ? null : assocCounterparty,
      )
      if (!result.ok) {
        setAssocError(result.error)
        return
      }
      setAssocUser(null)
      mutate()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription>
            Créez des comptes, attribuez un profil et gérez les accès.
          </CardDescription>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Créer un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
              <DialogDescription>
                Définissez un mot de passe temporaire que l&apos;utilisateur pourra changer ensuite.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-name">Nom</Label>
                <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">Mot de passe temporaire</Label>
                <Input
                  id="new-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-role">Profil</Label>
                <Select value={role} onValueChange={(v) => setRole(v)}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={isPending}>
                {isPending && <Spinner className="mr-2 h-4 w-4" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Contrepartie</TableHead>
                <TableHead className="w-[180px]">Modifier le profil</TableHead>
                <TableHead className="w-[190px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(u.role)}>{labelFor(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {isCounterpartyUser(u) ? (
                      u.counterpartyName ? (
                        <span className="text-sm">{u.counterpartyName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Non associée</span>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(v) => handleRoleChange(u.id, v)}
                      disabled={isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allRoles.map((r) => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                    {isCounterpartyUser(u) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => openAssoc(u)}
                        title="Associer une contrepartie"
                      >
                        <Building2 className="h-4 w-4" />
                        <span className="sr-only">Associer une contrepartie à {u.name}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier {u.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => openReset(u)}
                    >
                      <KeyRound className="h-4 w-4" />
                      <span className="sr-only">Réinitialiser le mot de passe de {u.name}</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Supprimer {u.name}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Le compte de {u.name} sera définitivement supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(u.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(users ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Aucun utilisateur.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={resetUser !== null}
        onOpenChange={(o) => {
          if (!o) setResetUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {resetUser
                ? `Définissez un nouveau mot de passe temporaire pour ${resetUser.name} (${resetUser.email}). Il sera envoyé automatiquement par email à l'utilisateur, qui pourra le changer ensuite.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {resetDone ? (
            <div className="flex flex-col gap-3 py-2">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-green-600" />
                Mot de passe réinitialisé avec succès.
              </p>

              {emailStatus?.sent ? (
                <p className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-green-600" />
                  Le nouveau mot de passe a été envoyé par email à {resetUser?.email}.
                </p>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-destructive" />
                    L&apos;envoi de l&apos;email a échoué. Communiquez le mot de passe ci-dessous manuellement.
                  </p>
                  {emailStatus?.error && (
                    <p className="text-xs text-muted-foreground">{emailStatus.error}</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                <code className="flex-1 break-all text-sm">{resetPassword}</code>
                <Button variant="ghost" size="icon" onClick={copyPassword} aria-label="Copier">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copiez ce mot de passe maintenant : il ne sera plus affiché par la suite.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reset-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    aria-label={showResetPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={generatePassword}>
                  Générer un mot de passe
                </Button>
              </div>
              {resetError && (
                <p className="text-sm text-destructive" role="alert">
                  {resetError}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {resetDone ? (
              <Button onClick={() => setResetUser(null)}>Fermer</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetUser(null)} disabled={isPending}>
                  Annuler
                </Button>
                <Button onClick={handleReset} disabled={isPending || resetPassword.length < 8}>
                  {isPending && <Spinner className="mr-2 h-4 w-4" />}
                  Réinitialiser
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editUser !== null}
        onOpenChange={(o) => {
          if (!o) setEditUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              Mettez à jour le nom et l&apos;adresse email. L&apos;utilisateur se connectera avec la
              nouvelle adresse.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={isPending}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={isPending || !editName.trim() || !editEmail.trim()}>
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assocUser !== null}
        onOpenChange={(o) => {
          if (!o) setAssocUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associer une contrepartie</DialogTitle>
            <DialogDescription>
              {assocUser
                ? `Liez ${assocUser.name} à une contrepartie. Ce compte au profil contrepartie représentera l'organisation sélectionnée.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="assoc-counterparty">Contrepartie</Label>
              <Select value={assocCounterparty} onValueChange={setAssocCounterparty}>
                <SelectTrigger id="assoc-counterparty">
                  <SelectValue placeholder="Sélectionner une contrepartie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucune (dissocier)</SelectItem>
                  {(counterparties ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(counterparties ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune contrepartie disponible. Créez-en une dans le module Contreparties.
              </p>
            )}
            {assocError && (
              <p className="text-sm text-destructive" role="alert">
                {assocError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssocUser(null)} disabled={isPending}>
              Annuler
            </Button>
            <Button onClick={handleAssoc} disabled={isPending}>
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
