"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// ─── SVG coordinate space ─────────────────────────────────────────────────────
const SVG_W = 1520;
const SVG_H = 910;

function pX(x: number) { return `${(x / SVG_W) * 100}%`; }
function pY(y: number) { return `${(y / SVG_H) * 100}%`; }

// ─── Card style presets ───────────────────────────────────────────────────────
const STYLE = {
  bcc:     { bg: "#0d1e3d", border: "#3b82f6", lbl: "#60a5fa",  txt: "#bfdbfe" },
  bcc_ok:  { bg: "#052e16", border: "#22c55e", lbl: "#86efac",  txt: "#bbf7d0" },
  bcc_err: { bg: "#3b0a0a", border: "#ef4444", lbl: "#fca5a5",  txt: "#fecaca" },
  cp:      { bg: "#2c1503", border: "#f97316", lbl: "#fdba74",  txt: "#fed7aa" },
  cp_ok:   { bg: "#052e16", border: "#22c55e", lbl: "#86efac",  txt: "#bbf7d0" },
  cp_err:  { bg: "#3b0a0a", border: "#ef4444", lbl: "#fca5a5",  txt: "#fecaca" },
  sys:     { bg: "#0f172a", border: "#475569", lbl: "#94a3b8",  txt: "#cbd5e1" },
  sys_ok:  { bg: "#052e16", border: "#22c55e", lbl: "#86efac",  txt: "#bbf7d0" },
  sys_pay: { bg: "#1a0e02", border: "#f59e0b", lbl: "#fcd34d",  txt: "#fde68a" },
  opt:     { bg: "#0f172a", border: "#334155", lbl: "#64748b",  txt: "#94a3b8" },
} as const;
type StyleKey = keyof typeof STYLE;

// ─── Node definitions ─────────────────────────────────────────────────────────
interface NodeDef {
  status: string;
  x: number; y: number;
  w?: number; h?: number;
  label: string;
  actor: string;
  style: StyleKey;
  optional?: boolean;
  warn?: boolean;
}

const CW = 188; // card width
const CH = 90;  // card height

const NODES: NodeDef[] = [
  // Phase 1
  { status: "draft",                x: 28,   y: 110,  label: "Brouillon",         actor: "Agent BCC",    style: "bcc" },
  // Phase 2
  { status: "submitted",            x: 28,   y: 275,  label: "Soumis",            actor: "Agent BCC",    style: "bcc" },
  { status: "approved",             x: 28,   y: 410,  label: "Approuvé",          actor: "Agent BCC",    style: "bcc_ok" },
  { status: "rejected",             x: 258,  y: 410,  label: "Rejeté",            actor: "Agent BCC",    style: "bcc_err", warn: true },
  // Phase 3
  { status: "sent_to_counterparty", x: 28,   y: 630,  label: "Transmis à la CP",  actor: "Agent BCC",    style: "bcc" },
  // Phase 4
  { status: "accepted",             x: 495,  y: 462,  label: "Accepté",           actor: "Contrepartie", style: "cp_ok" },
  { status: "negotiating",          x: 495,  y: 568,  label: "En négociation",    actor: "Contrepartie", style: "cp" },
  { status: "declined",             x: 495,  y: 674,  label: "Décliné",           actor: "Contrepartie", style: "cp_err", warn: true },
  // Phase 5
  { status: "in_transit",           x: 748,  y: 462,  label: "En Transit",        actor: "Agent BCC",    style: "sys" },
  { status: "delivered",            x: 968,  y: 462,  label: "Livré",             actor: "Système",      style: "sys" },
  { status: "pending_settlement",   x: 968,  y: 576,  label: "Attente Règlement", actor: "Système",      style: "sys_pay" },
  { status: "settled",              x: 855,  y: 694,  label: "Réglé",             actor: "Système",      style: "sys_ok" },
  { status: "completed",            x: 1074, y: 694,  label: "Terminé ✓",         actor: "Système",      style: "sys_ok" },
  // Terminal
  { status: "cancelled",            x: 28,   y: 800,  label: "Annulé",            actor: "Agent BCC",    style: "bcc_err", warn: true },
];

// Optional system states (no real DB status, shown dashed)
const OPT_NODES = [
  { x: 258, y: 275, label: "Attente Conformité", actor: "Optionnel · Système", slug: "pending_approval" },
  { x: 258, y: 375, label: "Attente Finance",    actor: "Optionnel · Système", slug: "pending_finance" },
];

// ─── SWR types ────────────────────────────────────────────────────────────────
interface StatsData { counts: Record<string, number>; total: number; criticalCount: number; activeCount: number; }
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── SVG card helper ──────────────────────────────────────────────────────────
function SvgCard({ node }: { node: NodeDef }) {
  const s = STYLE[node.style];
  const w = node.w ?? CW;
  const h = node.h ?? CH;
  return (
    <g>
      {/* Outer glow */}
      <rect x={node.x - 1} y={node.y - 1} width={w + 2} height={h + 2} rx={9} fill="none" stroke={s.border} strokeWidth={0.4} opacity={0.3} />
      {/* Card */}
      <rect x={node.x} y={node.y} width={w} height={h} rx={8} fill={s.bg} stroke={s.border} strokeWidth={node.optional ? 1 : 2} strokeDasharray={node.optional ? "4,3" : undefined} />
      {/* Actor label */}
      <text x={node.x + w / 2} y={node.y + 17} textAnchor="middle" fill={s.lbl} fontSize={8.5} fontWeight="700" letterSpacing="0.04em" fontFamily="ui-sans-serif,system-ui,sans-serif">{node.actor}</text>
      {/* Status name */}
      <text x={node.x + w / 2} y={node.y + 52} textAnchor="middle" fill={s.txt} fontSize={15} fontWeight="800" fontFamily="ui-sans-serif,system-ui,sans-serif">{node.label}</text>
      {/* Slug */}
      <text x={node.x + w / 2} y={node.y + 73} textAnchor="middle" fill={`${s.border}80`} fontSize={8.5} fontStyle="italic" fontFamily="ui-monospace,monospace">{node.status}</text>
    </g>
  );
}

function SvgOptCard({ node }: { node: typeof OPT_NODES[0] }) {
  const s = STYLE.opt;
  return (
    <g>
      <rect x={node.x} y={node.y} width={CW} height={CH} rx={8} fill={s.bg} stroke={s.border} strokeWidth={1} strokeDasharray="4,3" />
      <text x={node.x + CW / 2} y={node.y + 17} textAnchor="middle" fill={s.lbl} fontSize={8} fontWeight="600" fontFamily="ui-sans-serif,system-ui,sans-serif">{node.actor}</text>
      <text x={node.x + CW / 2} y={node.y + 52} textAnchor="middle" fill={s.txt} fontSize={14} fontWeight="700" fontFamily="ui-sans-serif,system-ui,sans-serif">{node.label}</text>
      <text x={node.x + CW / 2} y={node.y + 73} textAnchor="middle" fill={`${s.border}60`} fontSize={8.5} fontStyle="italic" fontFamily="ui-monospace,monospace">{node.slug}</text>
    </g>
  );
}

// ─── Arrow with label ─────────────────────────────────────────────────────────
function Arrow({ d, color, label, lx, ly, dashed, thin }: {
  d: string; color: string; label?: string; lx?: number; ly?: number; dashed?: boolean; thin?: boolean;
}) {
  const id = `ah-${color.replace("#", "")}`;
  return (
    <>
      <defs>
        <marker id={id} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={color} />
        </marker>
      </defs>
      <path d={d} fill="none" stroke={color} strokeWidth={thin ? 1 : 1.5}
        strokeDasharray={dashed ? "5,3" : undefined} opacity={dashed ? 0.7 : 1}
        markerEnd={`url(#${id})`} />
      {label && lx !== undefined && ly !== undefined && (
        <text x={lx} y={ly} fill={`${color}cc`} fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif">{label}</text>
      )}
    </>
  );
}

// ─── Main SVG diagram ─────────────────────────────────────────────────────────
function LifecycleSVG() {
  const cx = (x: number) => x + CW / 2;
  const cy = (y: number) => y + CH / 2;
  const L  = (x: number) => x;
  const R  = (x: number) => x + CW;
  const T  = (y: number) => y;
  const B  = (y: number) => y + CH;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {/* Background */}
      <rect width={SVG_W} height={SVG_H} fill="#070d1a" />

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <text x={SVG_W / 2} y={38} textAnchor="middle" fill="#f1f5f9" fontSize={22} fontWeight="800" fontFamily="ui-sans-serif,system-ui,sans-serif">
        Cycle de vie — Bons de Commande
      </text>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {[
        { x: 60,  color: "#3b82f6", label: "Agent BCC" },
        { x: 200, color: "#f97316", label: "Contrepartie" },
        { x: 340, color: "#64748b", label: "Système" },
        { x: 460, color: "#ef4444", label: "Erreur / Annulé" },
        { x: 610, color: "#22c55e", label: "Succès / Complété" },
      ].map(({ x, color, label }) => (
        <g key={label} transform={`translate(${x}, 58)`}>
          <rect x={0} y={-9} width={14} height={14} rx={3} fill={`${color}20`} stroke={color} strokeWidth={1.5} />
          <text x={20} y={2} fill="#94a3b8" fontSize={11} fontFamily="ui-sans-serif,system-ui,sans-serif">{label}</text>
        </g>
      ))}
      <g transform="translate(790, 58)">
        <line x1={0} y1={-2} x2={34} y2={-2} stroke="#475569" strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={40} y={2} fill="#94a3b8" fontSize={11} fontFamily="ui-sans-serif,system-ui,sans-serif">État optionnel</text>
      </g>

      {/* ── Phase boxes ─────────────────────────────────────────────────── */}
      {/* Phase 1 */}
      <rect x={16} y={92} width={212} height={118} rx={8} fill="#1e3a5f0a" stroke="#3b82f640" strokeWidth={1.5} />
      <text x={24} y={106} fill="#3b82f6" fontSize={8.5} fontWeight="700" letterSpacing="0.1em" fontFamily="ui-sans-serif,system-ui,sans-serif">PHASE 1 · CRÉATION</text>
      {/* Phase 2 */}
      <rect x={16} y={258} width={452} height={254} rx={8} fill="#1e3a5f08" stroke="#3b82f630" strokeWidth={1.5} />
      <text x={24} y={272} fill="#3b82f6" fontSize={8.5} fontWeight="700" letterSpacing="0.1em" fontFamily="ui-sans-serif,system-ui,sans-serif">PHASE 2 · APPROBATION INTERNE</text>
      {/* Phase 3 */}
      <rect x={16} y={614} width={212} height={118} rx={8} fill="#1e3a5f0a" stroke="#3b82f640" strokeWidth={1.5} />
      <text x={24} y={628} fill="#3b82f6" fontSize={8.5} fontWeight="700" letterSpacing="0.1em" fontFamily="ui-sans-serif,system-ui,sans-serif">PHASE 3 · TRANSMISSION</text>
      {/* Phase 4 */}
      <rect x={483} y={447} width={212} height={328} rx={8} fill="#43140708" stroke="#f9731630" strokeWidth={1.5} />
      <text x={491} y={461} fill="#f97316" fontSize={8.5} fontWeight="700" letterSpacing="0.08em" fontFamily="ui-sans-serif,system-ui,sans-serif">PHASE 4 · RÉPONSE CONTREPARTIE</text>
      {/* Phase 5 */}
      <rect x={734} y={447} width={756} height={352} rx={8} fill="#1e293b08" stroke="#47556930" strokeWidth={1.5} />
      <text x={742} y={461} fill="#94a3b8" fontSize={8.5} fontWeight="700" letterSpacing="0.08em" fontFamily="ui-sans-serif,system-ui,sans-serif">PHASE 5 · LIVRAISON & RÈGLEMENT</text>
      {/* Cancelled box */}
      <rect x={16} y={784} width={212} height={108} rx={8} fill="#450a0a08" stroke="#ef444440" strokeWidth={1.5} strokeDasharray="5,3" />

      {/* ── Arrows ──────────────────────────────────────────────────────── */}

      {/* draft → submitted: "Soumettre pour approbation" */}
      <Arrow d={`M ${cx(28)} ${B(110)} L ${cx(28)} ${T(275)}`} color="#3b82f6"
        label="Soumettre pour approbation" lx={148} ly={196} />

      {/* submitted → optional states */}
      <Arrow d={`M ${R(28)} ${cy(275)} L ${L(258)} ${cy(275)}`} color="#475569" dashed thin
        label="Conformité" lx={222} ly={cy(275) - 5} />
      <Arrow d={`M ${cx(258)} ${B(275)} L ${cx(258)} ${T(375)}`} color="#475569" dashed thin />

      {/* submitted → approved: "Double approbation (OTP + Conformité)" */}
      <Arrow d={`M ${cx(28)} ${B(275)} L ${cx(28)} ${T(410)}`} color="#3b82f6"
        label="Double approbation" lx={148} ly={330} />
      <text x={148} y={342} fill="#3b82f680" fontSize={8.5} fontFamily="ui-sans-serif,system-ui,sans-serif">(OTP + Conformité)</text>

      {/* approved → rejected */}
      <Arrow d={`M ${R(28)} ${cy(410)} L ${L(258)} ${cy(410)}`} color="#ef4444"
        label="Rejeter" lx={204} ly={cy(410) - 6} />

      {/* approved → sent_to_cp: "Transmettre à la contrepartie" */}
      <Arrow d={`M ${cx(28)} ${B(410)} L ${cx(28)} ${T(630)}`} color="#22c55e"
        label="Transmettre à" lx={148} ly={533} />
      <text x={148} y={545} fill="#22c55e80" fontSize={8.5} fontFamily="ui-sans-serif,system-ui,sans-serif">la contrepartie</text>

      {/* BCC agent can also re-submit from rejected */}
      <Arrow d={`M ${cx(28)} ${B(410)} L ${cx(28)} ${T(630)}`} color="#22c55e" />

      {/* sent_to_cp → accepted: Accepter */}
      <Arrow d={`M ${R(28)} ${28 + 630 + 28} C 340 ${28 + 630 + 28}, 340 ${cy(462)}, ${L(495)} ${cy(462)}`}
        color="#22c55e" label="Accepter" lx={258} ly={cy(462) - 6} />

      {/* sent_to_cp → negotiating: Négocier */}
      <Arrow d={`M ${R(28)} ${cy(630)} L ${L(495)} ${cy(568)}`}
        color="#f97316" dashed label="Négocier" lx={265} ly={cy(630) - 4} />

      {/* sent_to_cp → declined: Décliner */}
      <Arrow d={`M ${R(28)} ${28 + 630 + 62} C 340 ${28 + 630 + 62}, 340 ${cy(674)}, ${L(495)} ${cy(674)}`}
        color="#ef4444" dashed label="Décliner" lx={255} ly={cy(674) + 12} />

      {/* accepted → in_transit: Expédier */}
      <Arrow d={`M ${R(495)} ${cy(462)} L ${L(748)} ${cy(462)}`}
        color="#64748b" label="Expédier" lx={R(495) + 6} ly={cy(462) - 6} />

      {/* in_transit → delivered: Réception coffre */}
      <Arrow d={`M ${R(748)} ${cy(462)} L ${L(968)} ${cy(462)}`}
        color="#64748b" label="Réception coffre" lx={R(748) + 4} ly={cy(462) - 6} />

      {/* delivered → pending_settlement: Paiement initié */}
      <Arrow d={`M ${cx(968)} ${B(462)} L ${cx(968)} ${T(576)}`}
        color="#f59e0b" label="Paiement initié" lx={cx(968) + 8} ly={B(462) + 26} />

      {/* pending_settlement → settled: Paiement reçu */}
      <Arrow d={`M ${cx(968)} ${B(576)} C ${cx(968)} ${B(576) + 20}, ${cx(855)} ${B(576) + 20}, ${cx(855)} ${T(694)}`}
        color="#22c55e" label="Paiement reçu" lx={870} ly={B(576) + 14} />

      {/* settled → completed: Clôture */}
      <Arrow d={`M ${R(855)} ${cy(694)} L ${L(1074)} ${cy(694)}`}
        color="#22c55e" label="Clôture" lx={R(855) + 4} ly={cy(694) - 6} />

      {/* rejected → cancelled (long dashed path) */}
      <Arrow d={`M ${cx(258)} ${B(410)} C ${cx(258)} 790, ${cx(28)} 790, ${cx(28)} ${T(800)}`}
        color="#ef4444" dashed thin />

      {/* declined → cancelled (long dashed path going below) */}
      <Arrow d={`M ${cx(495)} ${B(674)} C ${cx(495)} 870, ${cx(28)} 870, ${cx(28)} ${B(800)}`}
        color="#ef4444" dashed thin />

      {/* Agent cancel note */}
      <rect x={16} y={584} width={212} height={24} rx={4} fill="#450a0a20" />
      <text x={cx(28)} y={600} textAnchor="middle" fill="#fca5a580" fontSize={8} fontFamily="ui-sans-serif,system-ui,sans-serif">
        Agent: Annuler (draft, submitted, sent_to_cp...)
      </text>
      <line x1={cx(28)} y1={608} x2={cx(28)} y2={614} stroke="#ef444450" strokeWidth={1} strokeDasharray="3,2" />

      {/* ── Optional nodes ──────────────────────────────────────────────── */}
      {OPT_NODES.map((n) => <SvgOptCard key={n.slug} node={n} />)}

      {/* ── Status cards (drawn on top) ──────────────────────────────────── */}
      {NODES.map((n) => <SvgCard key={n.status} node={n} />)}
    </svg>
  );
}

// ─── Count badge (HTML overlay) ───────────────────────────────────────────────
function CountBadge({ node, count, hovered }: { node: NodeDef; count: number; hovered: boolean }) {
  const s = STYLE[node.style];
  const bx = (node.x + (node.w ?? CW)) - 10;
  const by = node.y + 10;

  if (count === 0) return (
    <div style={{ position: "absolute", left: pX(bx), top: pY(by), transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", background: "#1e293b", border: "1px solid #334155", pointerEvents: "none" }} />
  );

  return (
    <div style={{ position: "absolute", left: pX(bx), top: pY(by), transform: `translate(-50%,-50%) scale(${hovered ? 1.2 : 1})`, pointerEvents: "none", zIndex: 10, transition: "transform .15s" }}>
      {node.warn && <div className="animate-ping" style={{ position: "absolute", inset: -3, borderRadius: 12, background: `${s.border}40`, zIndex: -1 }} />}
      <div style={{ minWidth: count > 9 ? 24 : 20, height: 20, padding: "0 5px", borderRadius: 10, background: s.border, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#fff", fontFamily: "ui-monospace,monospace", boxShadow: `0 0 10px ${s.border}80, 0 2px 6px rgba(0,0,0,.6)`, border: `1.5px solid ${s.border}88` }}>
        {count > 99 ? "99+" : count}
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ node, count, total }: { node: NodeDef; count: number; total: number }) {
  const s = STYLE[node.style];
  const pct = total > 0 && count > 0 ? Math.round((count / total) * 100) : 0;
  const above = node.y > 700;
  const ttY = above ? node.y - 8 : node.y + CH + 8;
  const nearRight = node.x > SVG_W - 300;

  return (
    <div style={{ position: "absolute", left: pX(nearRight ? node.x : node.x + CW / 2), top: pY(ttY), transform: above ? `translate(${nearRight ? "-100%" : "-50%"}, -100%)` : `translate(${nearRight ? "-100%" : "-50%"}, 0)`, zIndex: 50, pointerEvents: "none" }}>
      <div style={{ background: "#0a1220", border: `1px solid ${s.border}44`, borderRadius: 10, padding: "12px 16px", whiteSpace: "nowrap", boxShadow: `0 10px 40px rgba(0,0,0,.8)`, minWidth: 190 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.border }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{node.label}</span>
          <span style={{ fontSize: 9, color: "#475569", marginLeft: "auto" }}>{node.actor}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "ui-monospace,monospace", color: count === 0 ? "#334155" : s.border }}>{count}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>bon{count !== 1 ? "s" : ""} de commande</span>
        </div>
        {total > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 3 }}>
              <span>Part du total</span><span style={{ color: pct > 0 ? "#94a3b8" : "#334155" }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: s.border, transition: "width .4s" }} />
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: "0.5px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
          <code style={{ fontSize: 9, color: "#475569" }}>{node.status}</code>
          <span style={{ fontSize: 9, color: "#334155" }}>cliquer pour filtrer</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PoLifecyclePage() {
  const { data, isLoading, mutate } = useSWR<StatsData>("/api/po-lifecycle-stats", fetcher, { refreshInterval: 30_000 });

  const [hovered, setHovered] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (data) setLastRefreshed(new Date()); }, [data]);

  const secSince = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
  const nextIn   = Math.max(0, 30 - secSince);
  const counts   = data?.counts ?? {};
  const total    = data?.total  ?? 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen" style={{ background: "#070d1a" }}>
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title="Cycle de vie — Bons de commande" subtitle="Vue d'ensemble du flux opérationnel" />

          {/* Topbar */}
          <div className="shrink-0 flex items-center justify-between px-5 py-2 border-b" style={{ background: "#0d1527", borderColor: "#1e293b" }}>
            <div className="flex items-center gap-4 text-sm">
              <span style={{ color: "#475569" }}>Total :</span>
              <span className="font-black text-white font-mono">{total}</span>
              <span style={{ color: "#334155" }}>·</span>
              <span style={{ color: "#475569" }}>Pipeline actif :</span>
              <span className="font-bold text-emerald-400 font-mono">{data?.activeCount ?? 0}</span>
              {(data?.criticalCount ?? 0) > 0 && (
                <>
                  <span style={{ color: "#334155" }}>·</span>
                  <span className="font-bold text-red-400 font-mono animate-pulse">{data?.criticalCount} critique{(data?.criticalCount ?? 0) > 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: nextIn > 5 ? "#22c55e" : "#f59e0b", boxShadow: nextIn > 5 ? "0 0 6px #22c55e" : "0 0 6px #f59e0b" }} />
              <span className="text-[11px] text-slate-500">{isLoading ? "Actualisation…" : `Actualisation dans ${nextIn}s`}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" style={{ background: "transparent" }}
                onClick={() => { mutate(); setLastRefreshed(new Date()); }} disabled={isLoading}>
                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* Diagram */}
          <div className="flex-1 overflow-auto" style={{ background: "#070d1a" }}>
            <div className="relative w-full" style={{ aspectRatio: `${SVG_W}/${SVG_H}`, minWidth: 900 }}>
              <LifecycleSVG />

              {/* Interactive overlays */}
              {NODES.map((node) => {
                const count = counts[node.status] || 0;
                const isHov = hovered === node.status;
                const s = STYLE[node.style];
                const w = node.w ?? CW;
                const h = node.h ?? CH;

                const aL = pX(node.x);
                const aT = pY(node.y);
                const aW = `${(w / SVG_W) * 100}%`;
                const aH = `${(h / SVG_H) * 100}%`;

                return (
                  <div key={node.status}>
                    {isHov && (
                      <div style={{ position: "absolute", left: aL, top: aT, width: aW, height: aH, border: `2px solid ${s.border}`, borderRadius: 9, boxShadow: `0 0 22px ${s.border}60`, pointerEvents: "none", zIndex: 5 }} />
                    )}
                    <Link href={`/purchase-orders?status=${node.status}`}
                      style={{ position: "absolute", left: aL, top: aT, width: aW, height: aH, cursor: "pointer", zIndex: 8 }}
                      onMouseEnter={() => setHovered(node.status)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${node.label} · ${count} PO`}
                    />
                    <CountBadge node={node} count={count} hovered={isHov} />
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
