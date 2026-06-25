"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User,
  Bell,
  Shield,
  Globe,
  Building2,
  Mail,
  Save
} from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [notifications, setNotifications] = useState({
    email: true,
    screeningAlerts: true,
    approvalRequests: true,
    dailyDigest: false,
  });

  const translations = {
    en: {
      title: "Settings",
      subtitle: "Manage your account and application preferences",
      tabs: {
        profile: "Profile",
        notifications: "Notifications",
        security: "Security",
        organization: "Organization",
      },
      profile: {
        title: "Profile Information",
        description: "Update your personal information and preferences",
        name: "Full Name",
        email: "Email Address",
        role: "Role",
        language: "Language",
        timezone: "Timezone",
        save: "Save Changes",
      },
      notifications: {
        title: "Notification Preferences",
        description: "Configure how you receive notifications",
        email: "Email Notifications",
        emailDesc: "Receive notifications via email",
        screeningAlerts: "Screening Alerts",
        screeningAlertsDesc: "Get notified when screening results are ready",
        approvalRequests: "Approval Requests",
        approvalRequestsDesc: "Receive notifications for pending approvals",
        dailyDigest: "Daily Digest",
        dailyDigestDesc: "Receive a daily summary of activities",
      },
      security: {
        title: "Security Settings",
        description: "Manage your account security",
        currentPassword: "Current Password",
        newPassword: "New Password",
        confirmPassword: "Confirm Password",
        changePassword: "Change Password",
        twoFactor: "Two-Factor Authentication",
        twoFactorDesc: "Add an extra layer of security to your account",
        enable2FA: "Enable 2FA",
        sessions: "Active Sessions",
        sessionsDesc: "Manage your active login sessions",
        viewSessions: "View Sessions",
      },
      organization: {
        title: "Organization Settings",
        description: "Manage your organization details",
        orgName: "Organization Name",
        orgEmail: "Organization Email",
        address: "Address",
        country: "Country",
        save: "Save Organization",
      },
    },
    fr: {
      title: "Paramètres",
      subtitle: "Gérer votre compte et les préférences de l'application",
      tabs: {
        profile: "Profil",
        notifications: "Notifications",
        security: "Sécurité",
        organization: "Organisation",
      },
      profile: {
        title: "Informations du profil",
        description: "Mettre à jour vos informations personnelles et préférences",
        name: "Nom complet",
        email: "Adresse email",
        role: "Rôle",
        language: "Langue",
        timezone: "Fuseau horaire",
        save: "Enregistrer les modifications",
      },
      notifications: {
        title: "Préférences de notification",
        description: "Configurez comment vous recevez les notifications",
        email: "Notifications par email",
        emailDesc: "Recevoir des notifications par email",
        screeningAlerts: "Alertes de vérification",
        screeningAlertsDesc: "Être notifié quand les résultats sont prêts",
        approvalRequests: "Demandes d'approbation",
        approvalRequestsDesc: "Recevoir des notifications pour les approbations en attente",
        dailyDigest: "Résumé quotidien",
        dailyDigestDesc: "Recevoir un résumé quotidien des activités",
      },
      security: {
        title: "Paramètres de sécurité",
        description: "Gérer la sécurité de votre compte",
        currentPassword: "Mot de passe actuel",
        newPassword: "Nouveau mot de passe",
        confirmPassword: "Confirmer le mot de passe",
        changePassword: "Changer le mot de passe",
        twoFactor: "Authentification à deux facteurs",
        twoFactorDesc: "Ajouter une couche de sécurité supplémentaire",
        enable2FA: "Activer 2FA",
        sessions: "Sessions actives",
        sessionsDesc: "Gérer vos sessions de connexion actives",
        viewSessions: "Voir les sessions",
      },
      organization: {
        title: "Paramètres de l'organisation",
        description: "Gérer les détails de votre organisation",
        orgName: "Nom de l'organisation",
        orgEmail: "Email de l'organisation",
        address: "Adresse",
        country: "Pays",
        save: "Enregistrer l'organisation",
      },
    },
  };

  const t = translations[language];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={t.title}
            subtitle={t.subtitle}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl">
              <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.profile}</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.notifications}</span>
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.security}</span>
                  </TabsTrigger>
                  <TabsTrigger value="organization" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.tabs.organization}</span>
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.profile.title}</CardTitle>
                      <CardDescription>{t.profile.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">{t.profile.name}</Label>
                          <Input id="name" defaultValue="Compliance Officer" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{t.profile.email}</Label>
                          <Input id="email" type="email" defaultValue="compliance@centralbank.gov" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">{t.profile.role}</Label>
                          <Input id="role" defaultValue="Compliance Officer" disabled />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="language">{t.profile.language}</Label>
                          <Select value={language} onValueChange={(value: "en" | "fr") => setLanguage(value)}>
                            <SelectTrigger id="language">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="fr">Français</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="timezone">{t.profile.timezone}</Label>
                          <Select defaultValue="utc">
                            <SelectTrigger id="timezone">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
                              <SelectItem value="cet">CET (Central European Time)</SelectItem>
                              <SelectItem value="wat">WAT (West Africa Time)</SelectItem>
                              <SelectItem value="eat">EAT (East Africa Time)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button>
                        <Save className="mr-2 h-4 w-4" />
                        {t.profile.save}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.notifications.title}</CardTitle>
                      <CardDescription>{t.notifications.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>{t.notifications.email}</Label>
                            <p className="text-sm text-muted-foreground">{t.notifications.emailDesc}</p>
                          </div>
                          <Switch 
                            checked={notifications.email}
                            onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>{t.notifications.screeningAlerts}</Label>
                            <p className="text-sm text-muted-foreground">{t.notifications.screeningAlertsDesc}</p>
                          </div>
                          <Switch 
                            checked={notifications.screeningAlerts}
                            onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, screeningAlerts: checked }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>{t.notifications.approvalRequests}</Label>
                            <p className="text-sm text-muted-foreground">{t.notifications.approvalRequestsDesc}</p>
                          </div>
                          <Switch 
                            checked={notifications.approvalRequests}
                            onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, approvalRequests: checked }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>{t.notifications.dailyDigest}</Label>
                            <p className="text-sm text-muted-foreground">{t.notifications.dailyDigestDesc}</p>
                          </div>
                          <Switch 
                            checked={notifications.dailyDigest}
                            onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, dailyDigest: checked }))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t.security.title}</CardTitle>
                        <CardDescription>{t.security.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-password">{t.security.currentPassword}</Label>
                          <Input id="current-password" type="password" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="new-password">{t.security.newPassword}</Label>
                            <Input id="new-password" type="password" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirm-password">{t.security.confirmPassword}</Label>
                            <Input id="confirm-password" type="password" />
                          </div>
                        </div>
                        <Button>{t.security.changePassword}</Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="space-y-0.5">
                          <p className="font-medium">{t.security.twoFactor}</p>
                          <p className="text-sm text-muted-foreground">{t.security.twoFactorDesc}</p>
                        </div>
                        <Button variant="outline">{t.security.enable2FA}</Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="space-y-0.5">
                          <p className="font-medium">{t.security.sessions}</p>
                          <p className="text-sm text-muted-foreground">{t.security.sessionsDesc}</p>
                        </div>
                        <Button variant="outline">{t.security.viewSessions}</Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Organization Tab */}
                <TabsContent value="organization">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.organization.title}</CardTitle>
                      <CardDescription>{t.organization.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="org-name">{t.organization.orgName}</Label>
                          <Input id="org-name" defaultValue="Central Bank" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-email">{t.organization.orgEmail}</Label>
                          <Input id="org-email" type="email" defaultValue="gold@centralbank.gov" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="address">{t.organization.address}</Label>
                          <Input id="address" defaultValue="1 Central Bank Plaza" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">{t.organization.country}</Label>
                          <Select defaultValue="us">
                            <SelectTrigger id="country">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="us">United States</SelectItem>
                              <SelectItem value="gb">United Kingdom</SelectItem>
                              <SelectItem value="fr">France</SelectItem>
                              <SelectItem value="de">Germany</SelectItem>
                              <SelectItem value="ch">Switzerland</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button>
                        <Save className="mr-2 h-4 w-4" />
                        {t.organization.save}
                      </Button>
                    </CardContent>
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
