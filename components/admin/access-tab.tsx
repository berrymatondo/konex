"use client"

import { useEffect, useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Save } from "lucide-react"
import { ASSIGNABLE_PAGES, type PageGroup } from "@/lib/pages"
import { getAccessMatrix, saveRoleAccess, listRoles } from "@/app/admin/actions"
import type { AppRole } from "@/lib/roles-store"

const GROUP_LABELS: Record<PageGroup, string> = {
  main: "Principal",
  operations: "Opérations",
  system: "Système",
  admin: "Administration",
}

export function AccessTab() {
  const { data, isLoading, mutate } = useSWR("admin-access-matrix", () => getAccessMatrix())
  const { data: roles } = useSWR<AppRole[]>("admin-roles", () => listRoles())
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Record<string, Set<string>>>({})
  const [savedRole, setSavedRole] = useState<string | null>(null)

  // Configurable roles = every role except admin (admin always has full access).
  const configurableRoles = (roles ?? []).filter((r) => r.key !== "admin")
  const labelFor = (key: string) => (roles ?? []).find((r) => r.key === key)?.label ?? key

  useEffect(() => {
    if (data) {
      const next: Record<string, Set<string>> = {}
      for (const role of Object.keys(data)) {
        next[role] = new Set(data[role] ?? [])
      }
      setDraft(next)
    }
  }, [data])

  function toggle(role: string, pageKey: string, checked: boolean) {
    setDraft((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) }
      if (checked) next[role].add(pageKey)
      else next[role].delete(pageKey)
      return next
    })
  }

  function handleSave(role: string) {
    setSavedRole(null)
    startTransition(async () => {
      await saveRoleAccess(role, Array.from(draft[role] ?? []))
      await mutate()
      setSavedRole(role)
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const groups = Array.from(new Set(ASSIGNABLE_PAGES.map((p) => p.group))) as PageGroup[]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Accès par profil</CardTitle>
          <CardDescription>
            Cochez les pages accessibles à chaque profil. Le profil Admin a toujours accès à
            l&apos;ensemble de l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Page</th>
                  {configurableRoles.map((role) => (
                    <th key={role.key} className="px-3 py-2 text-center font-medium">
                      {role.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">
                    <span className="flex items-center justify-center gap-1">
                      Admin <Badge variant="default">Tout</Badge>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <FragmentGroup
                    key={group}
                    group={group}
                    label={GROUP_LABELS[group]}
                    roles={configurableRoles}
                    draft={draft}
                    onToggle={toggle}
                    disabled={isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {configurableRoles.map((role) => (
              <Button key={role.key} onClick={() => handleSave(role.key)} disabled={isPending} variant="outline">
                {isPending ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                Enregistrer — {role.label}
              </Button>
            ))}
            {savedRole && (
              <span className="flex items-center text-sm text-muted-foreground">
                Accès du profil « {labelFor(savedRole)} » enregistrés.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FragmentGroup({
  group,
  label,
  roles,
  draft,
  onToggle,
  disabled,
}: {
  group: PageGroup
  label: string
  roles: AppRole[]
  draft: Record<string, Set<string>>
  onToggle: (role: string, pageKey: string, checked: boolean) => void
  disabled: boolean
}) {
  const pages = ASSIGNABLE_PAGES.filter((p) => p.group === group)
  // +2 columns: the page label column and the always-on Admin column.
  const colSpan = roles.length + 2
  return (
    <>
      <tr className="bg-muted/50">
        <td colSpan={colSpan} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </td>
      </tr>
      {pages.map((page) => (
        <tr key={page.key} className="border-b last:border-0">
          <td className="px-3 py-2">{page.labelFr}</td>
          {roles.map((role) => (
            <td key={role.key} className="px-3 py-2 text-center">
              <div className="flex justify-center">
                <Checkbox
                  checked={draft[role.key]?.has(page.key) ?? false}
                  onCheckedChange={(c) => onToggle(role.key, page.key, c === true)}
                  disabled={disabled}
                  aria-label={`${page.labelFr} — ${role.label}`}
                />
              </div>
            </td>
          ))}
          <td className="px-3 py-2 text-center">
            <Checkbox checked disabled aria-label={`${page.labelFr} — Admin`} />
          </td>
        </tr>
      ))}
    </>
  )
}
