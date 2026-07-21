"use client";

import { useRef, useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

const SCREENS_EN = [
  { id: "overview",        label: "Overview" },
  { id: "positions",       label: "Positions" },
  { id: "optimize",        label: "New Optimization" },
  { id: "recommendation",  label: "Recommendation" },
  { id: "assumptions",     label: "Assumptions" },
  { id: "scenarios",       label: "Scenarios" },
  { id: "policy",          label: "Policy & Limits" },
] as const;

const SCREENS_FR = [
  { id: "overview",        label: "Vue d'ensemble" },
  { id: "positions",       label: "Positions" },
  { id: "optimize",        label: "Nouvelle optimisation" },
  { id: "recommendation",  label: "Recommandation" },
  { id: "assumptions",     label: "Hypothèses" },
  { id: "scenarios",       label: "Scénarios" },
  { id: "policy",          label: "Politique & Limites" },
] as const;

type ScreenId = (typeof SCREENS_EN)[number]["id"];

export default function GestionReservesPage() {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const langRef    = useRef("en");
  const activeRef  = useRef<ScreenId>("overview");
  const [active, setActive] = useState<ScreenId>("overview");
  const [ready, setReady] = useState(false);
  const { language } = useLanguage();

  // Keep refs in sync so the load-once effect always sees the latest values
  langRef.current   = language;
  activeRef.current = active;

  const SCREENS = language === "fr" ? SCREENS_FR : SCREENS_EN;

  // Attach load listener directly to iframe element — more reliable than the onLoad prop
  // when the browser has the file cached and fires the event before React registers it.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function handleLoad() {
      setReady(true);
      const cw = iframeRef.current?.contentWindow;
      if (!cw) return;
      try { (cw as unknown as { goScreen: (s: string) => void }).goScreen(activeRef.current); } catch { /**/ }
      cw.postMessage({ action: "lang", lang: langRef.current }, "*");
    }

    // If already loaded (e.g. instant cache hit before this effect ran)
    if (iframe.contentDocument?.readyState === "complete") {
      handleLoad();
    } else {
      iframe.addEventListener("load", handleLoad);
    }

    // Safety fallback: reveal iframe after 6 s regardless of load event
    const fallback = setTimeout(() => setReady(true), 6000);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      clearTimeout(fallback);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // attach once on mount; language captured via ref below

  // Send language changes to iframe after it is ready
  useEffect(() => {
    if (!ready) return;
    const cw = iframeRef.current?.contentWindow;
    if (cw) cw.postMessage({ action: "lang", lang: language }, "*");
  }, [language, ready]);

  function navigate(id: ScreenId) {
    setActive(id);
    const cw = iframeRef.current?.contentWindow;
    if (cw) {
      try {
        (cw as unknown as { goScreen: (s: string) => void }).goScreen(id);
      } catch {
        cw.postMessage({ action: "nav", screen: id }, "*");
      }
    }
  }

  const headerTitle = language === "fr"
    ? "Reserve Desk — Moteur d'allocation"
    : "Reserve Desk — Allocation Engine";
  const headerSubtitle = language === "fr"
    ? "Analyse des positions, optimisation stratégique et recommandations d'allocation."
    : "Position analysis, strategic optimization and allocation recommendations.";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title={headerTitle}
            subtitle={headerSubtitle}
          />
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border bg-[#0d1823] shrink-0 overflow-x-auto">
              {SCREENS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(s.id)}
                  className={cn(
                    "px-4 py-3 text-[12px] font-semibold border-r border-border border-b-2 transition-colors whitespace-nowrap last:border-r-0 shrink-0",
                    active === s.id
                      ? "text-foreground border-b-yellow-400 bg-[#0f1d2a]"
                      : "text-muted-foreground border-b-transparent hover:bg-[#112131] hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* iframe */}
            <div className="flex-1 relative">
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#07101a]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {language === "fr" ? "Chargement…" : "Loading…"}
                    </span>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src="/reserve-engine.html"
                className="w-full h-full border-0"
                title="Reserve Desk"
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
