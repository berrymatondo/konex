"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarProvider } from "@/components/sidebar-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, ShieldCheck, BadgePlus } from "lucide-react"
import { UsersTab } from "@/components/admin/users-tab"
import { AccessTab } from "@/components/admin/access-tab"
import { RolesTab } from "@/components/admin/roles-tab"

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
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                  <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Utilisateurs
                  </TabsTrigger>
                  <TabsTrigger value="access" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Accès par profil
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="flex items-center gap-2">
                    <BadgePlus className="h-4 w-4" />
                    Profils
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
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
