"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertTriangle, TrendingUp } from "lucide-react";

// ─── SVG coordinate space ─────────────────────────────────────────────────────
const SVG_W = 2100;
const SVG_H = 600;

function pX(x: number) { return `${(x / SVG_W) * 100}%`; }
function pY(y: number) { return `${(y / SVG_H) * 100}%`; }

// ─── Node definitions ─────────────────────────────────────────────────────────
interface NodeDef {
  status: string;
  label: string;
  color: "blue" | "green" | "red" | "violet" | "orange" | "amber" | "gray";
  warn: boolean;
  cx: number; cy: number; rw: number; rh: number;
  phase: number;
}

const NODES: NodeDef[] = [
  // Phase 1 — Création
  { status: "draft",                label: "Brouillon",          color: "blue",   warn: false, cx: 100,  cy: 280, rw: 155, rh: 44, phase: 1 },
  // Phase 2 — Approbation
  { status: "submitted",            label: "Soumis",             color: "blue",   warn: false, cx: 323,  cy: 200, rw: 155, rh: 44, phase: 2 },
  { status: "rejected",             label: "Rejeté",             color: "red",    warn: true,  cx: 323,  cy: 395, rw: 155, rh: 44, phase: 2 },
  // Phase 3 — Transmission
  { status: "approved",             label: "Approuvé",           color: "green",  warn: false, cx: 590,  cy: 200, rw: 155, rh: 44, phase: 3 },
  { status: "sent_to_counterparty", label: "Transmis CP",        color: "blue",   warn: false, cx: 855,  cy: 200, rw: 165, rh: 44, phase: 3 },
  // Phase 4 — Réponse CP
  { status: "accepted",             label: "Accepté",            color: "green",  warn: false, cx: 1085, cy: 152, rw: 155, rh: 44, phase: 4 },
  { status: "declined",             label: "Décliné",            color: "red",    warn: true,  cx: 1085, cy: 328, rw: 155, rh: 44, phase: 4 },
  // Phase 5 — Manifeste
  { status: "manifest_validated",   label: "Manifeste validé",   color: "violet", warn: false, cx: 1315, cy: 152, rw: 195, rh: 44, phase: 5 },
  // Phase 6 — Entrée coffre
  { status: "in_transit",           label: "En transit",         color: "gray",   warn: false, cx: 1540, cy: 200, rw: 155, rh: 44, phase: 6 },
  { status: "delivered",            label: "Livré",              color: "green",  warn: false, cx: 1760, cy: 152, rw: 155, rh: 44, phase: 6 },
  { status: "negotiating",          label: "En négociation",     color: "orange", warn: false, cx: 1760, cy: 348, rw: 165, rh: 44, phase: 6 },
  // Phase 7 — Règlement
  { status: "pending_settlement",   label: "Attente règlement",  color: "amber",  warn: false, cx: 2000, cy: 200, rw: 185, rh: 44, phase: 7 },
  // Terminal error
  { status: "cancelled",            label: "Annulé",             color: "red",    warn: true,  cx: 590,  cy: 510, rw: 155, rh: 44, phase: 0 },
];

// ─── Phase summary ────────────────────────────────────────────────────────────
const PHASES = [
  { id: 1, label: "Création",      icon: "✏️",  statuses: ["draft"] },
  { id: 2, label: "Approbation",   icon: "🔏",  statuses: ["submitted", "rejected"] },
  { id: 3, label: "Transmission",  icon: "📤",  statuses: ["approved", "sent_to_counterparty"] },
  { id: 4, label: "Réponse CP",    icon: "🤝",  statuses: ["accepted", "declined"] },
  { id: 5, label: "Manifeste",     icon: "📦",  statuses: ["manifest_validated"] },
  { id: 6, label: "Entrée coffre", icon: "🏦",  statuses: ["in_transit", "delivered", "negotiating"] },
  { id: 7, label: "Règlement",     icon: "💰",  statuses: ["pending_settlement"] },
  { id: 0, label: "Annulés",       icon: "⛔",  statuses: ["cancelled"] },
];

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS: Record<string, { bg: string; glow: string; fill: string; stroke: string; nodeText: string }> = {
  blue:   { bg: "#2563eb", glow: "#3b82f680", fill: "#0f2347", stroke: "#3b82f6", nodeText: "#93c5fd" },
  green:  { bg: "#059669", glow: "#10b98180", fill: "#052e16", stroke: "#22c55e", nodeText: "#86efac" },
  red:    { bg: "#dc2626", glow: "#ef444480", fill: "#450a0a", stroke: "#ef4444", nodeText: "#fca5a5" },
  violet: { bg: "#7c3aed", glow: "#8b5cf680", fill: "#2e1065", stroke: "#8b5cf6", nodeText: "#c4b5fd" },
  orange: { bg: "#ea580c", glow: "#f9731680", fill: "#431407", stroke: "#f97316", nodeText: "#fdba74" },
  amber:  { bg: "#d97706", glow: "#f59e0b80", fill: "#451a03", stroke: "#f59e0b", nodeText: "#fcd34d" },
  gray:   { bg: "#475569", glow: "#64748b80", fill: "#0f172a", stroke: "#64748b", nodeText: "#94a3b8" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatsData {
  counts: Record<string, number>;
  total: number;
  byPhase: Record<number, number>;
  criticalCount: number;
  activeCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Inline SVG diagram ───────────────────────────────────────────────────────
function LifecycleSVG() {
  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-label="Cycle de vie des bons de commande"
    >
      <defs>
        <marker id="ah-b" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#60a5fa" /></marker>
        <marker id="ah-g" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#4ade80" /></marker>
        <marker id="ah-r" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#f87171" /></marker>
        <marker id="ah-v" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#a78bfa" /></marker>
        <marker id="ah-s" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#94a3b8" /></marker>
        <marker id="ah-o" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#fb923c" /></marker>
        <marker id="ah-a" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#fbbf24" /></marker>
      </defs>

      {/* Background */}
      <rect width={SVG_W} height={SVG_H} fill="#0f172a" />

      {/* ── Phase bands ──────────────────────────────────────────────────── */}
      {/* Phase 1 – Création       0–200  */}
      <rect x={0}    y={88} width={200}  height={512} fill="#1e3a5f18" stroke="#1e3a5f50" strokeWidth={0.5} />
      {/* Phase 2 – Approbation    200–445 */}
      <rect x={200}  y={88} width={245}  height={512} fill="#1e293b15" stroke="#1e293b50" strokeWidth={0.5} />
      {/* Phase 3 – Transmission   445–745 */}
      <rect x={445}  y={88} width={300}  height={512} fill="#05431022" stroke="#05431050" strokeWidth={0.5} />
      {/* Phase 4 – Réponse CP     745–1010 */}
      <rect x={745}  y={88} width={265}  height={512} fill="#43140720" stroke="#43140750" strokeWidth={0.5} />
      {/* Phase 5 – Manifeste      1010–1230 */}
      <rect x={1010} y={88} width={220}  height={512} fill="#2e106520" stroke="#2e106550" strokeWidth={0.5} />
      {/* Phase 6 – Entrée coffre  1230–1875 */}
      <rect x={1230} y={88} width={645}  height={512} fill="#1e293b18" stroke="#1e293b50" strokeWidth={0.5} />
      {/* Phase 7 – Règlement      1875–2100 */}
      <rect x={1875} y={88} width={225}  height={512} fill="#45170320" stroke="#45170350" strokeWidth={0.5} />

      {/* Phase separators */}
      {[200, 445, 745, 1010, 1230, 1875].map((x) => (
        <line key={x} x1={x} y1={88} x2={x} y2={SVG_H} stroke="#1e293b" strokeWidth={1} />
      ))}

      {/* Phase labels */}
      <text x={100}  y={110} textAnchor="middle" fill="#3b82f6" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 1 · CRÉATION</text>
      <text x={323}  y={110} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 2 · APPROBATION</text>
      <text x={595}  y={110} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 3 · TRANSMISSION</text>
      <text x={878}  y={110} textAnchor="middle" fill="#f97316" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 4 · RÉPONSE CP</text>
      <text x={1120} y={110} textAnchor="middle" fill="#8b5cf6" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 5 · MANIFESTE</text>
      <text x={1553} y={110} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 6 · ENTRÉE COFFRE</text>
      <text x={1988} y={110} textAnchor="middle" fill="#f59e0b" fontSize={10} fontWeight="700" letterSpacing="0.06em">PHASE 7 · RÈGLEMENT</text>

      {/* ── Arrows ───────────────────────────────────────────────────────── */}

      {/* Main success flow */}
      {/* draft(right=177) → submitted(left=246) */}
      <path d="M 178 280 C 210 280, 210 200, 246 200" fill="none" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#ah-b)" />
      {/* submitted(right=401) → approved(left=513) */}
      <path d="M 401 200 L 513 200" fill="none" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#ah-b)" />
      {/* approved(right=668) → sent_to_cp(left=773) */}
      <path d="M 668 200 L 773 200" fill="none" stroke="#22c55e" strokeWidth={1.5} markerEnd="url(#ah-g)" />
      {/* sent_to_cp(right=938) → accepted(left=1008) */}
      <path d="M 938 200 C 970 200, 970 152, 1008 152" fill="none" stroke="#22c55e" strokeWidth={1.5} markerEnd="url(#ah-g)" />
      {/* accepted(right=1163) → manifest_validated(left=1218) */}
      <path d="M 1163 152 L 1218 152" fill="none" stroke="#8b5cf6" strokeWidth={1.5} markerEnd="url(#ah-v)" />
      {/* manifest_validated(right=1413) → in_transit(left=1463) */}
      <path d="M 1413 152 C 1438 152, 1438 200, 1463 200" fill="none" stroke="#64748b" strokeWidth={1.5} markerEnd="url(#ah-s)" />
      {/* in_transit(right=1618) → delivered(left=1683) */}
      <path d="M 1618 200 C 1648 200, 1648 152, 1683 152" fill="none" stroke="#22c55e" strokeWidth={1.5} markerEnd="url(#ah-g)" />
      {/* delivered(right=1838) → pending_settlement(left=1908) */}
      <path d="M 1838 152 C 1868 152, 1868 200, 1908 200" fill="none" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#ah-a)" />

      {/* Negotiation branch */}
      {/* in_transit(bottom=222) → negotiating(left=1678) */}
      <path d="M 1540 222 C 1540 348, 1678 348" fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="6,3" markerEnd="url(#ah-o)" />
      {/* negotiating(right=1843) → pending_settlement(left=1908) — orange arc up */}
      <path d="M 1843 348 C 1878 348, 1878 200, 1908 200" fill="none" stroke="#f97316" strokeWidth={1.5} markerEnd="url(#ah-a)" />

      {/* Error / rejection branches — red dashed */}
      {/* submitted(bottom=222) → rejected(top=373) */}
      <path d="M 323 222 L 323 373" fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" markerEnd="url(#ah-r)" />
      {/* rejected(bottom=417) → cancelled(left=513) */}
      <path d="M 323 417 C 323 510, 513 510" fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#ah-r)" />
      {/* sent_to_cp(bottom=222) → declined(left=1008) */}
      <path d="M 855 222 C 855 328, 1008 328" fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" markerEnd="url(#ah-r)" />
      {/* declined(bottom=350) → cancelled(right=668) */}
      <path d="M 1085 350 L 1085 510 L 668 510" fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#ah-r)" />

      {/* ── Nodes ────────────────────────────────────────────────────────── */}
      {NODES.map((node) => {
        const col = COLORS[node.color];
        return (
          <g key={node.status}>
            <rect
              x={node.cx - node.rw / 2} y={node.cy - node.rh / 2}
              width={node.rw} height={node.rh}
              rx={8} fill={col.fill} stroke={col.stroke} strokeWidth={1.5}
            />
            <text
              x={node.cx} y={node.cy}
              textAnchor="middle" dominantBaseline="middle"
              fill={col.nodeText} fontSize={12} fontWeight="600"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <g transform="translate(12, 10)">
        {[
          { fill: "#0f2347",  stroke: "#3b82f6", label: "Agent BCC" },
          { fill: "#431407",  stroke: "#f97316", label: "Contrepartie" },
          { fill: "#052e16",  stroke: "#22c55e", label: "Succès" },
          { fill: "#450a0a",  stroke: "#ef4444", label: "Erreur" },
          { fill: "#2e1065",  stroke: "#8b5cf6", label: "Manifeste" },
          { fill: "#431407",  stroke: "#f97316", label: "Négociation" },
          { fill: "#451a03",  stroke: "#f59e0b", label: "Règlement" },
        ].map(({ fill, stroke, label }, i) => (
          <g key={label} transform={`translate(${i * 120}, 0)`}>
            <rect x={0} y={0} width={13} height={13} rx={2} fill={fill} stroke={stroke} strokeWidth={1.5} />
            <text x={18} y={10} fill="#94a3b8" fontSize={11} fontFamily="ui-sans-serif, system-ui, sans-serif">{label}</text>
          </g>
        ))}
        <g transform="translate(840, 0)">
          <line x1={0} y1={6} x2={37} y2={6} stroke="#475569" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={42} y={10} fill="#94a3b8" fontSize={11} fontFamily="ui-sans-serif, system-ui, sans-serif">Branche rejet</text>
        </g>
      </g>
    </svg>
  );
}

// ─── Count badge ──────────────────────────────────────────────────────────────
function CountBadge({ count, node, hovered }: { count: number; node: NodeDef; hovered: boolean }) {
  const isWarn = node.warn && count > 0;
  const col = COLORS[node.color];
  const bx = node.cx + node.rw / 2 - 14;
  const by = node.cy;

  if (count === 0) {
    return (
      <div style={{
        position: "absolute", left: pX(bx), top: pY(by),
        transform: "translate(-50%, -50%)",
        width: 8, height: 8, borderRadius: "50%",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
        pointerEvents: "none",
      }} />
    );
  }

  return (
    <div style={{
      position: "absolute", left: pX(bx), top: pY(by),
      transform: "translate(-50%, -50%)",
      pointerEvents: "none", zIndex: 10,
      scale: hovered ? "1.3" : "1", transition: "scale .15s",
    }}>
      {isWarn && (
        <div className="animate-ping" style={{
          position: "absolute", inset: -3, borderRadius: 14, background: col.glow, zIndex: -1,
        }} />
      )}
      <div style={{
        minWidth: count > 9 ? 26 : 20, height: 20, padding: "0 5px", borderRadius: 10,
        background: col.bg, boxShadow: `0 0 10px ${col.glow}, 0 2px 6px rgba(0,0,0,0.5)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 11, color: "#fff",
        fontFamily: "ui-monospace, monospace", letterSpacing: "-0.03em",
        border: `1.5px solid ${col.bg}dd`,
      }}>
        {count > 99 ? "99+" : count}
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ node, count, total }: { node: NodeDef; count: number; total: number }) {
  const isWarn = node.warn && count > 0;
  const pct = total > 0 && count > 0 ? Math.round((count / total) * 100) : 0;
  const col = COLORS[node.color];
  const above = node.cy > 430;
  const ttY = above ? node.cy - node.rh / 2 - 8 : node.cy + node.rh / 2 + 8;

  return (
    <div style={{
      position: "absolute", left: pX(node.cx), top: pY(ttY),
      transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      zIndex: 50, pointerEvents: "none",
    }}>
      <div style={{
        background: "#0f172a", border: `1px solid ${col.bg}55`, borderRadius: 10,
        padding: "10px 14px", whiteSpace: "nowrap",
        boxShadow: `0 8px 30px rgba(0,0,0,0.7), 0 0 0 1px ${col.bg}22`, minWidth: 170,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.bg, boxShadow: `0 0 6px ${col.glow}` }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{node.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontSize: 28, fontWeight: 800, lineHeight: 1, fontFamily: "ui-monospace, monospace",
            color: count === 0 ? "#334155" : isWarn ? "#f87171" : col.bg,
          }}>{count}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>bon{count !== 1 ? "s" : ""} de commande</span>
        </div>
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
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: "0.5px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
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
    "/api/po-lifecycle-stats", fetcher, { refreshInterval: 30_000 },
  );

  const [hovered, setHovered] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (data) setLastRefreshed(new Date()); }, [data]);

  const secSince = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
  const nextIn = Math.max(0, 30 - secSince);

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

          {/* ── Alert strip ───────────────────────────────────────────── */}
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
              <Link href="/purchase-orders?status=rejected" className="ml-auto text-xs text-red-400 hover:text-red-200 underline">
                Voir →
              </Link>
            </div>
          )}

          {/* ── Phase summary strip ───────────────────────────────────── */}
          <div className="shrink-0 flex items-stretch border-b overflow-x-auto" style={{ background: "#0d1527", borderColor: "#1e293b" }}>
            <div className="flex items-center gap-3 px-4 py-2.5 border-r shrink-0" style={{ borderColor: "#1e293b" }}>
              <div className="rounded-lg p-1.5" style={{ background: "#1e293b" }}>
                <Activity className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total POs</p>
                <p className="text-xl font-black text-white leading-none font-mono">{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 border-r shrink-0" style={{ borderColor: "#1e293b" }}>
              <div className="rounded-lg p-1.5" style={{ background: "#0c2a1e" }}>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pipeline actif</p>
                <p className="text-xl font-black text-emerald-400 leading-none font-mono">{activeCount}</p>
              </div>
            </div>

            {PHASES.map((ph) => {
              const phCount = ph.statuses.reduce((s, st) => s + (counts[st] || 0), 0);
              const isAlert = ph.id === 0 && phCount > 0;
              return (
                <div
                  key={ph.id}
                  className="flex items-center gap-2 px-3 py-2.5 border-r shrink-0"
                  style={{ borderColor: "#1e293b", background: isAlert ? "#1a050540" : "transparent" }}
                >
                  <span className="text-sm leading-none">{ph.icon}</span>
                  <div>
                    <p className="text-[10px] tracking-wider whitespace-nowrap" style={{ color: "#475569" }}>
                      {ph.id === 0 ? "Annulés" : `Ph.${ph.id} · ${ph.label}`}
                    </p>
                    <p
                      className="text-lg font-bold leading-none font-mono"
                      style={{ color: isAlert && phCount > 0 ? "#f87171" : phCount > 0 ? "#e2e8f0" : "#334155" }}
                    >
                      {phCount}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="ml-auto flex items-center gap-3 px-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: nextIn > 5 ? "#22c55e" : "#f59e0b", animation: "pulse 2s infinite" }} />
                <span className="text-[10px]" style={{ color: "#475569" }}>
                  {isLoading ? "Actualisation…" : `Prochain dans ${nextIn}s`}
                </span>
              </div>
              <Button
                variant="ghost" size="sm" className="h-7 text-xs"
                style={{ color: "#64748b", background: "transparent" }}
                onClick={() => { mutate(); setLastRefreshed(new Date()); }}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* ── Diagram ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto" style={{ background: "#070d1a" }}>
            <div className="relative w-full" style={{ aspectRatio: `${SVG_W}/${SVG_H}`, minWidth: 1100 }}>
              <LifecycleSVG />

              {NODES.map((node) => {
                const count = counts[node.status] || 0;
                const isHov = hovered === node.status;
                const col = COLORS[node.color];

                const areaL = pX(node.cx - node.rw / 2);
                const areaT = pY(node.cy - node.rh / 2);
                const areaW = `${(node.rw / SVG_W) * 100}%`;
                const areaH = `${(node.rh / SVG_H) * 100}%`;

                return (
                  <div key={node.status}>
                    {isHov && (
                      <div style={{
                        position: "absolute", left: areaL, top: areaT, width: areaW, height: areaH,
                        border: `2px solid ${col.bg}`, borderRadius: 8,
                        boxShadow: `0 0 16px ${col.glow}`, pointerEvents: "none", zIndex: 5,
                      }} />
                    )}
                    <Link
                      href={`/purchase-orders?status=${node.status}`}
                      style={{ position: "absolute", left: areaL, top: areaT, width: areaW, height: areaH, cursor: "pointer", zIndex: 8 }}
                      onMouseEnter={() => setHovered(node.status)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${node.label} — ${count} PO${count !== 1 ? "s" : ""}`}
                    />
                    <CountBadge count={count} node={node} hovered={isHov} />
                    {isHov && <Tooltip node={node} count={count} total={total} />}
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
