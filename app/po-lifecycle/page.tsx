"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertTriangle, CheckCircle2, TrendingUp, Zap } from "lucide-react";

// ─── SVG coordinate space ────────────────────────────────────────────────────
const SVG_W = 1600;
const SVG_H = 980;

function pX(x: number) { return `${(x / SVG_W) * 100}%`; }
function pY(y: number) { return `${(y / SVG_H) * 100}%`; }

// ─── Node definitions ─────────────────────────────────────────────────────────
// cx/cy = center of each rect, rw/rh = rect width/height (from SVG source)
interface NodeDef {
  status: string;
  label: string;
  color: "blue" | "green" | "red" | "orange" | "amber" | "gray";
  warn: boolean;
  cx: number; cy: number; rw: number; rh: number;
  phase: number;
  optional?: boolean;
}

const NODES: NodeDef[] = [
  { status: "draft",                label: "Brouillon",           color: "blue",   warn: false, cx: 143,  cy: 122, rw: 160, rh: 44, phase: 1 },
  { status: "submitted",            label: "Soumis",              color: "blue",   warn: false, cx: 143,  cy: 302, rw: 160, rh: 44, phase: 2 },
  { status: "pending_compliance",   label: "Attente Conformité",  color: "gray",   warn: false, cx: 390,  cy: 278, rw: 150, rh: 40, phase: 2, optional: true },
  { status: "pending_finance",      label: "Attente Finance",     color: "gray",   warn: false, cx: 390,  cy: 358, rw: 150, rh: 40, phase: 2, optional: true },
  { status: "approved",             label: "Approuvé",            color: "green",  warn: false, cx: 143,  cy: 432, rw: 160, rh: 44, phase: 2 },
  { status: "sent_to_counterparty", label: "Transmis à la CP",    color: "blue",   warn: false, cx: 143,  cy: 590, rw: 195, rh: 44, phase: 3 },
  { status: "rejected",             label: "Rejeté",              color: "red",    warn: true,  cx: 390,  cy: 432, rw: 160, rh: 44, phase: 2 },
  { status: "accepted",             label: "Accepté",             color: "green",  warn: false, cx: 705,  cy: 575, rw: 160, rh: 44, phase: 4 },
  { status: "negotiating",          label: "En négociation",      color: "orange", warn: false, cx: 705,  cy: 670, rw: 160, rh: 44, phase: 4 },
  { status: "declined",             label: "Décliné",             color: "red",    warn: true,  cx: 705,  cy: 760, rw: 160, rh: 44, phase: 4 },
  { status: "in_transit",           label: "En Transit",          color: "gray",   warn: false, cx: 980,  cy: 575, rw: 160, rh: 44, phase: 5 },
  { status: "delivered",            label: "Livré",               color: "gray",   warn: false, cx: 1220, cy: 575, rw: 160, rh: 44, phase: 5 },
  { status: "pending_settlement",   label: "Attente Règlement",   color: "amber",  warn: false, cx: 1220, cy: 690, rw: 185, rh: 44, phase: 5 },
  { status: "settled",              label: "Réglé",               color: "green",  warn: false, cx: 1220, cy: 800, rw: 160, rh: 44, phase: 5 },
  { status: "completed",            label: "Terminé ✓",           color: "green",  warn: false, cx: 1473, cy: 800, rw: 165, rh: 44, phase: 5 },
  { status: "cancelled",            label: "Annulé",              color: "red",    warn: true,  cx: 390,  cy: 880, rw: 160, rh: 44, phase: 0 },
];

// ─── Badge colors (hex — rendered as inline styles in SVG space) ──────────────
const COLORS: Record<string, { bg: string; glow: string; text: string }> = {
  blue:   { bg: "#2563eb", glow: "#3b82f680", text: "#fff" },
  green:  { bg: "#059669", glow: "#10b98180", text: "#fff" },
  red:    { bg: "#dc2626", glow: "#ef444480", text: "#fff" },
  orange: { bg: "#ea580c", glow: "#f9731680", text: "#fff" },
  amber:  { bg: "#d97706", glow: "#f59e0b80", text: "#fff" },
  gray:   { bg: "#475569", glow: "#64748b80", text: "#fff" },
};

// ─── Phase summary data ───────────────────────────────────────────────────────
const PHASES = [
  { id: 1, label: "Création",     icon: "✏️", statuses: ["draft"] },
  { id: 2, label: "Approbation",  icon: "🔏", statuses: ["submitted", "pending_compliance", "pending_finance", "approved", "rejected"] },
  { id: 3, label: "Transmission", icon: "📤", statuses: ["sent_to_counterparty"] },
  { id: 4, label: "Réponse CP",   icon: "🤝", statuses: ["accepted", "negotiating", "declined"] },
  { id: 5, label: "Livraison",    icon: "🏦", statuses: ["in_transit", "delivered", "pending_settlement", "settled", "completed"] },
  { id: 0, label: "Annulés",      icon: "⛔", statuses: ["cancelled"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatsData {
  counts: Record<string, number>;
  total: number;
  byPhase: Record<number, number>;
  criticalCount: number;
  activeCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Count badge (rendered over the SVG via absolute positioning) ─────────────
function CountBadge({
  count, node, hovered,
}: { count: number; node: NodeDef; hovered: boolean }) {
  const isWarn = node.warn && count > 0;
  const col = COLORS[node.color];

  // Position: right side inside the rect, vertically centered
  const bx = node.cx + node.rw / 2 - 14;
  const by = node.cy;

  if (count === 0) {
    return (
      <div
        style={{
          position: "absolute",
          left: pX(bx),
          top: pY(by),
          transform: "translate(-50%, -50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          pointerEvents: "none",
          transition: "all .2s",
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: pX(bx),
        top: pY(by),
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 10,
        transition: "transform .15s",
        scale: hovered ? "1.3" : "1",
      }}
    >
      {/* Glow ring for warn states */}
      {isWarn && (
        <div
          className="animate-ping"
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: 14,
            background: col.glow,
            zIndex: -1,
          }}
        />
      )}
      {/* Badge pill */}
      <div
        style={{
          minWidth: count > 9 ? 26 : 20,
          height: 20,
          padding: "0 5px",
          borderRadius: 10,
          background: col.bg,
          boxShadow: `0 0 10px ${col.glow}, 0 2px 6px rgba(0,0,0,0.5)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 11,
          color: col.text,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "-0.03em",
          border: `1.5px solid ${col.bg}dd`,
        }}
      >
        {count > 99 ? "99+" : count}
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ node, count, total }: { node: NodeDef; count: number; total: number }) {
  const isWarn = node.warn && count > 0;
  const pct = total > 0 && count > 0 ? Math.round((count / total) * 100) : 0;

  // Show above for bottom nodes
  const above = node.cy > 750;
  const ttY = above
    ? node.cy - node.rh / 2 - 8
    : node.cy + node.rh / 2 + 8;

  const col = COLORS[node.color];

  return (
    <div
      style={{
        position: "absolute",
        left: pX(node.cx),
        top: pY(ttY),
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        zIndex: 50,
        pointerEvents: "none",
        animation: "fadeIn .1s ease",
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${col.bg}55`,
          borderRadius: 10,
          padding: "10px 14px",
          whiteSpace: "nowrap",
          boxShadow: `0 8px 30px rgba(0,0,0,0.7), 0 0 0 1px ${col.bg}22`,
          minWidth: 170,
        }}
      >
        {/* State label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.bg, boxShadow: `0 0 6px ${col.glow}` }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{node.label}</span>
          {node.optional && <span style={{ fontSize: 9, color: "#64748b", background: "#1e293b", padding: "1px 5px", borderRadius: 4, border: "0.5px solid #334155" }}>optionnel</span>}
        </div>
        {/* Count */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: count === 0 ? "#334155" : isWarn ? "#f87171" : col.bg, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ fontSize: 11, color: "#64748b" }}>bon{count !== 1 ? "s" : ""} de commande</span>
        </div>
        {/* Percentage bar */}
        {total > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 3 }}>
              <span>Part du total</span>
              <span style={{ color: pct > 0 ? "#94a3b8" : "#334155" }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: col.bg, borderRadius: 2, transition: "width .3s" }} />
            </div>
          </div>
        )}
        {/* Code */}
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: "0.5px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#475569", fontFamily: "ui-monospace", fontStyle: "italic" }}>{node.status}</span>
          <span style={{ fontSize: 9, color: "#334155" }}>Cliquer pour filtrer</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PoLifecyclePage() {
  const { data, isLoading, mutate } = useSWR<StatsData>(
    "/api/po-lifecycle-stats",
    fetcher,
    { refreshInterval: 30_000 },
  );

  const [hovered, setHovered] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [tick, setTick] = useState(0);

  // Countdown to next refresh
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (data) setLastRefreshed(new Date());
  }, [data]);

  const secSinceRefresh = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
  const nextIn = Math.max(0, 30 - secSinceRefresh);

  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const criticalCount = data?.criticalCount ?? 0;
  const activeCount = data?.activeCount ?? 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen" style={{ background: "#070d1a" }}>
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="Tableau de bord stratégique"
            subtitle="Cycle de vie — Bons de commande · Vue temps réel"
          />

          {/* ── Critical alert strip ─────────────────────────────────── */}
          {criticalCount > 0 && (
            <div
              className="shrink-0 flex items-center gap-3 px-5 py-2 border-b animate-pulse"
              style={{ background: "#450a0a30", borderColor: "#dc262640" }}
            >
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-medium text-red-300">
                {criticalCount} bon{criticalCount > 1 ? "s" : ""} de commande en état critique
                <span className="font-normal text-red-400/70 ml-1.5">(rejeté, décliné ou annulé)</span>
              </span>
              <Link href="/purchase-orders?status=rejected" className="ml-auto text-xs text-red-400 hover:text-red-200 underline">Voir →</Link>
            </div>
          )}

          {/* ── Phase summary strip ───────────────────────────────────── */}
          <div className="shrink-0 flex items-stretch gap-0 border-b" style={{ background: "#0d1527", borderColor: "#1e293b" }}>
            {/* Totals */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-r" style={{ borderColor: "#1e293b" }}>
              <div className="rounded-lg p-1.5" style={{ background: "#1e293b" }}>
                <Activity className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total POs</p>
                <p className="text-2xl font-black text-white leading-none font-mono">{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-2.5 border-r" style={{ borderColor: "#1e293b" }}>
              <div className="rounded-lg p-1.5" style={{ background: "#0c2a1e" }}>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pipeline actif</p>
                <p className="text-2xl font-black text-emerald-400 leading-none font-mono">{activeCount}</p>
              </div>
            </div>

            {/* Phase blocks */}
            {PHASES.map((ph) => {
              const phCount = ph.statuses.reduce((s, st) => s + (counts[st] || 0), 0);
              const isAlert = ph.id === 0 && phCount > 0;
              return (
                <div
                  key={ph.id}
                  className="flex items-center gap-2 px-4 py-2.5 border-r"
                  style={{
                    borderColor: "#1e293b",
                    background: isAlert && phCount > 0 ? "#1a050540" : "transparent",
                  }}
                >
                  <span className="text-base leading-none">{ph.icon}</span>
                  <div>
                    <p className="text-[10px] tracking-wider" style={{ color: "#475569" }}>
                      {ph.id === 0 ? "Annulés" : `Phase ${ph.id} · ${ph.label}`}
                    </p>
                    <p
                      className="text-xl font-bold leading-none font-mono"
                      style={{ color: isAlert && phCount > 0 ? "#f87171" : phCount > 0 ? "#e2e8f0" : "#334155" }}
                    >
                      {phCount}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Live + refresh */}
            <div className="ml-auto flex items-center gap-3 px-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: nextIn > 5 ? "#22c55e" : "#f59e0b", animation: "pulse 2s infinite" }}
                />
                <span className="text-[10px]" style={{ color: "#475569" }}>
                  {isLoading ? "Actualisation…" : `Prochaine dans ${nextIn}s`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                style={{ color: "#64748b", background: "transparent" }}
                onClick={() => { mutate(); setLastRefreshed(new Date()); }}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* ── SVG + overlays ────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto" style={{ background: "#070d1a" }}>
            <div
              className="relative w-full"
              style={{ aspectRatio: "1600/980", minWidth: 900 }}
            >
              {/* The base SVG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/po-lifecycle.svg"
                alt="Cycle de vie des bons de commande"
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  userSelect: "none",
                  display: "block",
                }}
              />

              {/* Count badges + clickable areas */}
              {NODES.map((node) => {
                const count = counts[node.status] || 0;
                const isHov = hovered === node.status;

                // Clickable area covers full rect
                const areaL = pX(node.cx - node.rw / 2);
                const areaT = pY(node.cy - node.rh / 2);
                const areaW = `${(node.rw / SVG_W) * 100}%`;
                const areaH = `${(node.rh / SVG_H) * 100}%`;

                return (
                  <div key={node.status}>
                    {/* Hover highlight ring on the node rect */}
                    {isHov && (
                      <div
                        style={{
                          position: "absolute",
                          left: areaL,
                          top: areaT,
                          width: areaW,
                          height: areaH,
                          border: `2px solid ${COLORS[node.color].bg}`,
                          borderRadius: 8,
                          boxShadow: `0 0 16px ${COLORS[node.color].glow}`,
                          pointerEvents: "none",
                          zIndex: 5,
                          animation: "fadeIn .1s ease",
                        }}
                      />
                    )}

                    {/* Invisible clickable overlay */}
                    <Link
                      href={`/purchase-orders?status=${node.status}`}
                      style={{
                        position: "absolute",
                        left: areaL,
                        top: areaT,
                        width: areaW,
                        height: areaH,
                        cursor: "pointer",
                        zIndex: 8,
                      }}
                      onMouseEnter={() => setHovered(node.status)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${node.label} — ${count} PO${count !== 1 ? "s" : ""}`}
                    />

                    {/* Count badge */}
                    <CountBadge count={count} node={node} hovered={isHov} />

                    {/* Tooltip */}
                    {isHov && (
                      <Tooltip node={node} count={count} total={total} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
