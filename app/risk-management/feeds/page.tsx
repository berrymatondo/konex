"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Database,
  Settings,
  Play,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

interface RiskFeed {
  id: string;
  name: string;
  nameEn: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  status: "online" | "offline" | "degraded";
  lastSync: Date;
  dataAge: string;
  recordCount: number;
  weight: number;
  critical: boolean;
}

const initialFeeds: RiskFeed[] = [
  {
    id: "cahra",
    name: "CAHRA List",
    nameEn: "CAHRA List",
    nameFr: "Liste CAHRA",
    description: "Conflict-Affected and High-Risk Areas database",
    descriptionFr: "Base de données des zones de conflit et à haut risque",
    status: "online",
    lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
    dataAge: "2h",
    recordCount: 847,
    weight: 30,
    critical: true,
  },
  {
    id: "country_risk",
    name: "Country Risk Index",
    nameEn: "Country Risk Index",
    nameFr: "Indice de Risque Pays",
    description: "FATF, Transparency International, Political Stability indices",
    descriptionFr: "Indices GAFI, Transparency International, Stabilité politique",
    status: "online",
    lastSync: new Date(Date.now() - 30 * 60 * 1000),
    dataAge: "30m",
    recordCount: 195,
    weight: 25,
    critical: true,
  },
  {
    id: "mercury_db",
    name: "Mercury Usage Database",
    nameEn: "Mercury Usage Database",
    nameFr: "Base de données Usage du Mercure",
    description: "Minamata Convention compliance tracking",
    descriptionFr: "Suivi de conformité de la Convention de Minamata",
    status: "online",
    lastSync: new Date(Date.now() - 4 * 60 * 60 * 1000),
    dataAge: "4h",
    recordCount: 2341,
    weight: 20,
    critical: true,
  },
  {
    id: "sanctions",
    name: "Sanctions Updates",
    nameEn: "Sanctions Updates",
    nameFr: "Mises à jour des Sanctions",
    description: "UN, EU, OFAC consolidated sanctions lists",
    descriptionFr: "Listes consolidées de sanctions ONU, UE, OFAC",
    status: "online",
    lastSync: new Date(Date.now() - 15 * 60 * 1000),
    dataAge: "15m",
    recordCount: 12847,
    weight: 25,
    critical: true,
  },
];

export default function RiskFeedsPage() {
  const { language } = useLanguage();
  const [feeds, setFeeds] = useState<RiskFeed[]>(initialFeeds);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);

  const handleSync = async (feedId: string) => {
    setSyncing(feedId);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setFeeds(feeds.map(f => 
      f.id === feedId 
        ? { ...f, lastSync: new Date(), dataAge: "Just now" }
        : f
    ));
    setSyncing(null);
  };

  const handleWeightChange = (feedId: string, newWeight: number) => {
    setFeeds(feeds.map(f => 
      f.id === feedId ? { ...f, weight: newWeight } : f
    ));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online": return <Wifi className="h-4 w-4 text-emerald-500" />;
      case "offline": return <WifiOff className="h-4 w-4 text-red-500" />;
      case "degraded": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online": return <Badge variant="outline" className="border-emerald-500 text-emerald-500">Online</Badge>;
      case "offline": return <Badge variant="destructive">Offline</Badge>;
      case "degraded": return <Badge variant="secondary" className="border-amber-500 text-amber-500">Degraded</Badge>;
      default: return null;
    }
  };

  const allFeedsOnline = feeds.every(f => f.status === "online");
  const criticalFeedOffline = feeds.some(f => f.critical && f.status === "offline");

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader 
            title={language === "fr" ? "Intégration des Flux de Risques" : "Risk Feed Integration"}
            subtitle={language === "fr" ? "Configuration des sources de données externes" : "External data source configuration"}
          />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Back Button */}
              <div className="mb-4">
                <Link href="/risk-management">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {language === "fr" ? "Retour" : "Back"}
                  </Button>
                </Link>
              </div>

              {/* System Status Alert */}
              {criticalFeedOffline && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {language === "fr" ? "Flux critique hors ligne" : "Critical Feed Offline"}
                  </AlertTitle>
                  <AlertDescription>
                    {language === "fr" 
                      ? "Un ou plusieurs flux de risques critiques sont hors ligne. Les nouvelles approbations de contreparties sont suspendues."
                      : "One or more critical risk feeds are offline. New counterparty approvals are paused."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Overview Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${allFeedsOnline ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                      {allFeedsOnline ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Statut Système" : "System Status"}
                      </p>
                      <p className="text-xl font-semibold">
                        {allFeedsOnline 
                          ? (language === "fr" ? "Opérationnel" : "Operational")
                          : (language === "fr" ? "Dégradé" : "Degraded")}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Flux Actifs" : "Active Feeds"}
                      </p>
                      <p className="text-xl font-semibold">
                        {feeds.filter(f => f.status === "online").length}/{feeds.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Globe className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Enregistrements" : "Total Records"}
                      </p>
                      <p className="text-xl font-semibold">
                        {feeds.reduce((acc, f) => acc + f.recordCount, 0).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
                      <Clock className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Dernière Sync" : "Last Full Sync"}
                      </p>
                      <p className="text-xl font-semibold">
                        {Math.min(...feeds.map(f => (Date.now() - f.lastSync.getTime()) / 60000)).toFixed(0)}m
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Auto-Sync Toggle */}
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {language === "fr" ? "Synchronisation automatique" : "Auto-Sync"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" 
                          ? "Mettre à jour les flux toutes les 15 minutes"
                          : "Update feeds every 15 minutes"}
                      </p>
                    </div>
                  </div>
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                </CardContent>
              </Card>

              {/* Feed Cards */}
              <div className="grid gap-6 md:grid-cols-2">
                {feeds.map((feed) => (
                  <Card key={feed.id} className="relative overflow-hidden">
                    {feed.critical && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-bl">
                        CRITICAL
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {getStatusIcon(feed.status)}
                          {language === "fr" ? feed.nameFr : feed.nameEn}
                        </CardTitle>
                        {getStatusBadge(feed.status)}
                      </div>
                      <CardDescription>
                        {language === "fr" ? feed.descriptionFr : feed.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">
                            {language === "fr" ? "Dernière sync" : "Last Sync"}
                          </p>
                          <p className="font-medium">{feed.dataAge}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            {language === "fr" ? "Enregistrements" : "Records"}
                          </p>
                          <p className="font-medium">{feed.recordCount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            {language === "fr" ? "Poids" : "Weight"}
                          </p>
                          <p className="font-medium">{feed.weight}%</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">
                          {language === "fr" ? "Pondération du facteur de risque" : "Risk Factor Weighting"}
                        </Label>
                        <Slider 
                          value={[feed.weight]} 
                          onValueChange={([v]) => handleWeightChange(feed.id, v)}
                          max={50}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSync(feed.id)}
                        disabled={syncing === feed.id}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncing === feed.id ? 'animate-spin' : ''}`} />
                        {language === "fr" ? "Forcer Sync" : "Force Sync"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Play className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Tester" : "Test Connection"}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        {language === "fr" ? "Voir données" : "View Data"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {/* System Behavior Info */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>
                  {language === "fr" ? "Comportement du système" : "System Behavior"}
                </AlertTitle>
                <AlertDescription>
                  {language === "fr" 
                    ? "Si un flux critique est hors ligne pendant plus de 4 heures, le système suspend automatiquement les nouvelles approbations de contreparties et alerte le Gestionnaire des Risques par email/SMS."
                    : "If any critical feed goes offline for >4 hours, the system automatically pauses new counterparty approvals and alerts the Risk Manager via email/SMS."}
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
