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
import { Plus, Trash2 } from "lucide-react"
import { listRoles, createRole, deleteRole } from "@/app/admin/actions"
import type { AppRole } from "@/lib/roles-store"
import { mutate as globalMutate } from "swr"

export function RolesTab() {
  const { data: roles, isLoading, mutate } = useSWR<AppRole[]>("admin-roles", () => listRoles())
  const [isPending, startTransition] = useTransition()

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function refreshAll() {
    mutate()
    // Keep the access matrix and user role selectors in sync.
    globalMutate("admin-access-matrix")
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createRole(label)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setLabel("")
      setOpen(false)
      refreshAll()
    })
  }

  function handleDelete(key: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await deleteRole(key)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      refreshAll()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Profils</CardTitle>
          <CardDescription>
            Créez de nouveaux types de profil. Chaque profil ajouté apparaît automatiquement dans
            l&apos;onglet « Accès par profil » pour y définir ses pages.
          </CardDescription>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) {
              setLabel("")
              setError(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Créer un profil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un profil</DialogTitle>
              <DialogDescription>
                Donnez un nom au profil. Il sera créé sans aucun accès — définissez ensuite ses
                pages dans l&apos;onglet « Accès par profil ».
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-role-label">Nom du profil</Label>
                <Input
                  id="new-role-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ex : Auditeur externe"
                />
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
        {actionError && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profil</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(roles ?? []).map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell>
                    {r.isSystem ? (
                      <Badge variant="secondary">Système</Badge>
                    ) : (
                      <Badge variant="outline">Personnalisé</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.isSystem ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Supprimer {r.label}</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce profil ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Le profil « {r.label} » et ses accès seront définitivement supprimés.
                              Cette action est impossible si des utilisateurs y sont encore associés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(r.key)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
