"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarProvider } from "@/components/sidebar-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, ShieldCheck, BadgePlus, Wrench, CheckCircle, AlertTriangle, Loader2 } from "lucide-react"
import { UsersTab } from "@/components/admin/users-tab"
import { AccessTab } from "@/components/admin/access-tab"
import { RolesTab } from "@/components/admin/roles-tab"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function MaintenanceTab() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle")
  const [result, setResult] = useState<{ fixed: number; deduped: number; errors?: string[] } | null>(null)

  async function runMigration() {
    setStatus("running")
    setResult(null)
    try {
      const res = await fetch("/api/admin/fix-tracking-ids", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur inconnue")
      setResult(data)
      setStatus("done")
    } catch (err) {
      console.error(err)
      setStatus("error")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-amber-500" />
            Rattrapage des Transaction IDs
          </CardTitle>
          <CardDescription>
            Assigne un identifiant de suivi unique à tous les bons de commande qui n&apos;en ont pas,
            et corrige les doublons existants. Cette opération est idempotente et sans risque.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Les POs créés en mode brouillon peuvent ne pas avoir de <code className="font-mono text-xs">tracking_id</code>.
            Ce correctif leur attribue un identifiant au format <code className="font-mono text-xs">PO-YYYYMM-XXXXXXXX</code>.
          </div>

          <Button
            onClick={runMigration}
            disabled={status === "running"}
            variant={status === "error" ? "destructive" : "default"}
          >
            {status === "running" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Migration en cours…</>
            ) : (
              "Lancer le rattrapage"
            )}
          </Button>

          {status === "done" && result && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                Migration terminée
              </div>
              <div className="mt-2 flex gap-4 text-sm text-green-700 dark:text-green-400">
                <span><Badge variant="outline">{result.fixed}</Badge> IDs manquants corrigés</span>
                <span><Badge variant="outline">{result.deduped}</Badge> doublons dédupliqués</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Échec de la migration. Vérifiez la console serveur.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminPage() {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="Administration"
            subtitle="Gestion des utilisateurs et des accès par profil"
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl">
              <Tabs defaultValue="users" className="space-y-6">
                <TabsList className="grid w-full max-w-2xl grid-cols-4">
                  <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Utilisateurs
                  </TabsTrigger>
                  <TabsTrigger value="access" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Accès
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="flex items-center gap-2">
                    <BadgePlus className="h-4 w-4" />
                    Profils
                  </TabsTrigger>
                  <TabsTrigger value="maintenance" className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Maintenance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="users">
                  <UsersTab />
                </TabsContent>

                <TabsContent value="access">
                  <AccessTab />
                </TabsContent>

                <TabsContent value="roles">
                  <RolesTab />
                </TabsContent>

                <TabsContent value="maintenance">
                  <MaintenanceTab />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
