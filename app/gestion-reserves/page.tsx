"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { cn } from "@/lib/utils";

type Tab = 0 | 1 | 2 | 3;

// ─── Micro-components ─────────────────────────────────────────────────────────

function Dot({ color = "gold" }: { color?: "gold" | "green" | "blue" | "red" | "orange" | "purple" }) {
  const c: Record<string, string> = {
    gold: "bg-yellow-400", green: "bg-emerald-400", blue: "bg-blue-400",
    red: "bg-red-400", orange: "bg-orange-400", purple: "bg-purple-500",
  };
  return <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1", c[color])} />;
}

function Bdg({ v, children }: { v: "warn"|"pass"|"info"|"purple"|"red"|"gray"; children: React.ReactNode }) {
  const c: Record<string, string> = {
    warn:   "bg-[#4c330a] text-[#ffd98a] border-[#815a12]",
    pass:   "bg-[#073c2a] text-[#7ef0b3] border-[#116947]",
    info:   "bg-[#0b305a] text-[#73b9ff] border-[#1b5d9a]",
    purple: "bg-[#2b2147] text-[#c7b7ff] border-[#5c49a4]",
    red:    "bg-[#4a1518] text-[#ff9da4] border-[#7f2a31]",
    gray:   "bg-[#111d28] text-muted-foreground border-border",
  };
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap", c[v])}>{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[11px] text-[#d6e4ef] bg-[#0b1721] border border-border rounded px-1.5 py-px">{children}</code>;
}

function Callout({ type, title, children, className }: {
  type: "info"|"warn"|"good"|"red"; title?: string; children: React.ReactNode; className?: string;
}) {
  const m: Record<string, { border: string; bg: string; dot: "blue"|"orange"|"green"|"red" }> = {
    info: { border: "border-[#19568e]", bg: "bg-[#09213a]", dot: "blue" },
    warn: { border: "border-[#815a12]", bg: "bg-[#251b0b]", dot: "orange" },
    good: { border: "border-[#116947]", bg: "bg-[#062a1d]", dot: "green" },
    red:  { border: "border-[#7f2a31]", bg: "bg-[#271013]", dot: "red" },
  };
  const { border, bg, dot } = m[type];
  return (
    <div className={cn("flex items-start gap-2.5 border rounded-xl p-3.5 mb-3.5", border, bg, className)}>
      <Dot color={dot} />
      <div>
        {title && <div className="text-[13px] font-bold mb-1">{title}</div>}
        <div className="text-[12px] text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function SecHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-[.06em] my-2.5">
      {children}<span className="flex-1 h-px bg-border" />
    </div>
  );
}

function Formula({ note, children }: { note?: string; children: React.ReactNode }) {
  return (
    <div className="font-mono bg-[#07121b] border border-border border-l-[3px] border-l-yellow-400 rounded-lg px-3 py-2.5 text-[12px] text-[#dce7ef] mb-2.5">
      {children}
      {note && <small className="block text-muted-foreground font-sans text-[11px] mt-1">{note}</small>}
    </div>
  );
}

function Step({ no, title, desc }: { no: number; title: string; desc: string }) {
  return (
    <div className="flex gap-2.5 border border-border bg-[#0a1520] rounded-xl p-2.5">
      <div className="w-7 h-7 rounded-full bg-yellow-400 text-[#1b1605] flex items-center justify-center font-bold text-sm shrink-0">{no}</div>
      <div><h4 className="text-[13px] font-bold mb-0.5">{title}</h4><p className="text-[12px] text-muted-foreground">{desc}</p></div>
    </div>
  );
}

function PRow({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <div className="flex justify-between gap-2 items-start py-1.5 border-b border-border last:border-b-0">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={cn("font-bold text-right text-[11px]", vc ?? "text-foreground")}>{value}</span>
    </div>
  );
}

function RuleItem({ color = "gold", children }: { color?: "gold"|"green"|"blue"|"red"|"orange"|"purple"; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-b-0 text-[11px] text-muted-foreground">
      <Dot color={color} /><div>{children}</div>
    </div>
  );
}

function Anno({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0b1621] border-l-[3px] border-l-[#534AB7] px-3 py-2.5 text-[11px] text-muted-foreground mt-2.5 rounded-r-lg leading-relaxed">
      {children}
    </div>
  );
}

function State({ children, type = "default" }: { children: React.ReactNode; type?: "default"|"active"|"warn"|"red"|"blue" }) {
  const c: Record<string, string> = {
    default: "border-border bg-[#0b1621] text-muted-foreground",
    active:  "bg-[#073c2a] text-[#7ef0b3] border-[#116947]",
    warn:    "bg-[#4c330a] text-[#ffd98a] border-[#815a12]",
    red:     "bg-[#4a1518] text-[#ff9da4] border-[#7f2a31]",
    blue:    "bg-[#0b305a] text-[#73b9ff] border-[#1b5d9a]",
  };
  return <span className={cn("border px-2.5 py-1.5 rounded-full text-[11px]", c[type])}>{children}</span>;
}

function Topbar({ title, badge, bv, right }: {
  title: string; badge: string; bv: "warn"|"pass"|"info"|"purple"|"red"|"gray"; right: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#0d1823]">
      <div className="flex items-center gap-2.5">
        <span className="text-[14px] font-bold">{title}</span>
        <Bdg v={bv}>{badge}</Bdg>
      </div>
      <div className="text-[12px] text-muted-foreground">{right}</div>
    </div>
  );
}

function Footer({ note, btn, gold }: { note: string; btn: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-[#0d1823]">
      <span className="text-[11px] text-muted-foreground">{note}</span>
      <button className={cn(
        "px-4 py-2 text-[12px] font-bold rounded-lg border",
        gold
          ? "bg-gradient-to-br from-[#ffd84a] to-[#e5a900] border-[#e5a900] text-[#201803]"
          : "bg-gradient-to-br from-[#238bff] to-[#166fd3] border-[#238bff] text-white"
      )}>{btn}</button>
    </div>
  );
}

function KpiCard({ title, value, sub, vc }: { title: string; value: string; sub: string; vc?: string }) {
  return (
    <div className="border border-border rounded-xl bg-gradient-to-br from-[#0b151e] to-[#0d1b27] p-3">
      <h4 className="text-[11px] text-muted-foreground font-bold uppercase tracking-[.04em] mb-2">{title}</h4>
      <div className={cn("text-[22px] font-black tracking-tight mb-0.5", vc ?? "text-foreground")}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

// ─── Table class constants ────────────────────────────────────────────────────

const TH = "bg-[#0c1925] text-muted-foreground text-[10px] uppercase tracking-[.04em] px-2.5 py-2 text-left font-medium";
const TD = "px-2.5 py-2 text-[12px] border-b border-border last:border-b-0 align-top";
const TDr = "px-2.5 py-2 text-[12px] border-b border-border last:border-b-0 align-top text-right font-mono";

// ─── Screen 1 ─────────────────────────────────────────────────────────────────

function Screen1() {
  return (
    <>
      <Topbar title="US-R1-01 — Vue fonctionnelle et parcours utilisateur" badge="Poste de pilotage réserves" bv="info" right="Acteur principal : Gestionnaire des réserves" />
      <div className="flex min-h-[650px]">
        <div className="flex-1 p-5 overflow-hidden">
          <Callout type="info" title="User story principale">
            En tant que <strong className="text-foreground">gestionnaire des réserves</strong>, je souhaite analyser les positions, les données de marché, les besoins de liquidité et les limites approuvées afin de proposer une allocation cible qui préserve la sécurité des actifs, garantit la liquidité mobilisable et améliore le rendement dans le cadre autorisé.
          </Callout>

          <div className="grid grid-cols-3 gap-3 mb-3.5">
            <KpiCard title="Objectif prioritaire"    value="Sécurité"   sub="Préservation du capital, qualité crédit, limites et actifs non grevés." vc="text-emerald-400" />
            <KpiCard title="Objectif secondaire"     value="Liquidité"  sub="Cash D+0/D+1, besoins prévisibles, haircuts et mobilisation." vc="text-blue-400" />
            <KpiCard title="Objectif sous contrainte" value="Rendement" sub="Revenus attendus uniquement après respect des limites de sécurité et liquidité." vc="text-yellow-400" />
          </div>

          <SecHead>Objectifs fonctionnels du module</SecHead>
          <div className="overflow-x-auto mb-3.5">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead><tr><th className={TH}>Objectif métier</th><th className={TH}>Question à résoudre</th><th className={TH}>Sortie attendue</th></tr></thead>
              <tbody>
                {[
                  ["Allocation stratégique","Quelle composition optimale par instrument, devise et tranche ?","Allocation cible versionnée avec écarts à l'allocation actuelle."],
                  ["Rendement sous contrainte","Comment générer davantage de revenus sans augmenter le risque au-delà du mandat ?","Gain de rendement estimé, contribution par actif et décision de rééquilibrage."],
                  ["Liquidité","Aurai-je suffisamment de cash demain, dans une semaine et dans un mois ?","Ladder D+0/D+1/D+7/D+30/D+90 et ratio de couverture interne."],
                  ["Or et collatéral","Comment exploiter l'or détenu sans compromettre sa fonction de réserve ?","Arbitrage or physique, Gold Deposit, repo/TRS, actifs grevés et capacité de mobilisation."],
                  ["Risque et stress tests","Que puis-je perdre si les taux, l'or, les spreads ou la liquidité bougent ?","VaR, ES, duration, DV01, scénarios, violations de limites."],
                ].map(([o,q,s]) => (
                  <tr key={o as string}><td className={TD}>{o}</td><td className={TD}>{q}</td><td className={TD}>{s}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <SecHead>Parcours utilisateur nominal</SecHead>
          <div className="space-y-2">
            <Step no={1} title="Sélectionner le portefeuille et la version" desc="L'utilisateur choisit le portefeuille, la date de valorisation, la devise de reporting et la version de l'allocation cible." />
            <Step no={2} title="Synchroniser les données" desc="KONEX charge les positions validées, les prix Bloomberg, les limites, les besoins de liquidité et les paramètres de risque." />
            <Step no={3} title="Analyser l'allocation actuelle" desc="Le moteur calcule les poids actuels, la valeur totale, les revenus, la liquidité, la VaR, la duration et les actifs non grevés." />
            <Step no={4} title="Comparer à l'allocation cible" desc="KONEX affiche les écarts, les décisions indicatives et les montants de rééquilibrage par classe d'actifs." />
            <Step no={5} title="Tester les risques et scénarios" desc="L'utilisateur exécute les stress tests taux, or, spreads, liquidité, repo/TRS et crise combinée." />
            <Step no={6} title="Produire la recommandation" desc="Le module génère un plan de rééquilibrage et une note du comité, sans exécuter automatiquement les transactions." />
          </div>
        </div>

        <div className="w-[326px] border-l border-border flex flex-col bg-[#0d1823] shrink-0">
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Acteurs</div>
            <PRow label="Principal" value="Gestionnaire des réserves" />
            <PRow label="Validation risque" value="Middle Office / Risques" />
            <PRow label="Positions" value="Back Office / Comptabilité" />
            <PRow label="Décision" value="Comité d'investissement" />
          </div>
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Préconditions</div>
            <RuleItem color="green">Positions et cash-flows rapprochés.</RuleItem>
            <RuleItem color="green">Données Bloomberg synchronisées ou fallback validé.</RuleItem>
            <RuleItem color="green">Limites et corridors d'allocation actifs.</RuleItem>
            <RuleItem color="orange">Besoins de liquidité par horizon disponibles.</RuleItem>
          </div>
          <div className="p-3.5 flex-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Cycle de statut</div>
            <div className="flex gap-2 items-center flex-wrap">
              <State>Simulation</State>
              <State type="active">Revue risques</State>
              <State type="warn">Comité</State>
              <State type="blue">Approuvée</State>
              <State>Active</State>
            </div>
            <Anno><strong className="text-foreground font-bold">Dev note :</strong> aucune allocation simulée ne devient active sans validation de la fonction risque et approbation de l'organe habilité.</Anno>
          </div>
        </div>
      </div>
      <Footer note="Résultat attendu : allocation cible documentée, plan de rééquilibrage et note comité." btn="Continuer" />
    </>
  );
}

// ─── Screen 2 ─────────────────────────────────────────────────────────────────

function Screen2() {
  return (
    <>
      <Topbar title="US-R1-02 — Données d'entrée, validations et blocs UI" badge="Positions validées" bv="pass" right="Sources : RMS / Back Office / Bloomberg / Référentiels internes" />
      <div className="flex min-h-[650px]">
        <div className="flex-1 p-5 overflow-hidden">
          <Callout type="warn" title="Principe d'intégration">
            R1 ne doit pas mélanger les axes d'analyse. L'allocation par instrument, l'exposition par devise et les overlays de financement sont trois vues différentes. Une même position peut apparaître dans plusieurs vues analytiques, mais elle ne doit être comptée qu'une seule fois dans la valeur nette du portefeuille.
          </Callout>

          <SecHead>A. Données de portefeuille et positions</SecHead>
          <div className="overflow-x-auto mb-3.5">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead><tr><th className={TH}>Famille</th><th className={TH}>Données requises</th><th className={TH}>Source</th><th className={TH}>Contrôle</th></tr></thead>
              <tbody>
                {[
                  ["Identification","Portefeuille, tranche, instrument, ISIN, ticket, contrepartie, custodian.","RMS / Front-to-Back","Unicité ticket et mapping référentiel."],
                  ["Position","Nominal, quantité, poids fin, coût moyen, prix d'acquisition, date de valeur.","Back Office / Comptabilité","Rapprochement comptable et opérationnel."],
                  ["Valorisation","Prix propre, intérêts courus, valeur marché, P&L réalisé et latent.","Bloomberg + moteur interne","Prix frais, bid/mid/ask, fallback et override."],
                  ["Statut liquidité","Disponible, grevé, en transit, placé, alloué, non alloué.","Custody / Opérations","Ne pas inclure les actifs grevés dans le cash mobilisable."],
                  ["Cash-flows","Coupons, maturités, intérêts, marges, frais, appels de marge.","Back Office / Contrats","Date de valeur et devise obligatoires."],
                ].map(([f,d,s,c]) => (
                  <tr key={f as string}><td className={TD}>{f}</td><td className={TD}>{d}</td><td className={TD}>{s}</td><td className={TD}>{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <div>
              <SecHead>B. Univers d'actifs R1</SecHead>
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead><tr><th className={TH}>Actif</th><th className={TH}>Traitement métier</th></tr></thead>
                <tbody>
                  {[
                    ["Cash","Liquidité D+0, par compte et devise."],
                    ["BIS Deposit","Placement sécurisé, échéance et pénalité de sortie."],
                    ["UST","Titres souverains USD, courbe, duration, DV01."],
                    ["Reverse repo","Placement cash garanti par collatéral."],
                    ["Repo","Financement ; crée cash et actifs grevés."],
                    ["TRS","Exposition synthétique ; notional, funding et collatéral séparés."],
                    ["Gold","Or physique / monétaire, alloué ou non alloué."],
                    ["Gold Deposit","Or placé et rémunéré, suivi par contrepartie et tenor."],
                    ["Covered Bonds USD","Actif de spread avec limites crédit et liquidité."],
                  ].map(([a,t]) => (
                    <tr key={a as string}><td className={TD}>{a}</td><td className={TD}>{t}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <SecHead>C. Données de marché et limites</SecHead>
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead><tr><th className={TH}>Catégorie</th><th className={TH}>Exemples</th></tr></thead>
                <tbody>
                  {[
                    ["Courbes USD","UST, SOFR/OIS, GC repo, Fed funds implicite."],
                    ["Instruments UST","Prix, yield, duration, DV01, convexité, liquidité."],
                    ["Or","XAU/USD, LBMA AM/PM, XAU Deposit, forwards, volatilité."],
                    ["Covered Bonds","YTM, YTW, OAS, Z-spread, rating, CDS, liquidité."],
                    ["Limites","Duration max, VaR/ES max, min liquidité, max contrepartie, max actifs grevés."],
                    ["Besoins liquidité","D+0, D+1, D+7, D+30, D+90, sorties exceptionnelles."],
                  ].map(([c,e]) => (
                    <tr key={c as string}><td className={TD}>{c}</td><td className={TD}>{e}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SecHead>Blocs fonctionnels de la page R1</SecHead>
          <div className="overflow-x-auto">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead><tr><th className={TH}>Bloc UI</th><th className={TH}>Contenu affiché</th><th className={TH}>Règle d'implémentation</th></tr></thead>
              <tbody>
                {[
                  ["Synthèse du portefeuille","Réserves totales, rendement attendu, liquidité D+1, VaR, or total, actifs non grevés.","Calculer sur positions validées et date de valorisation unique."],
                  ["Allocation actuelle vs cible","Poids actuel, cible, écart, valeur et décision par classe d'actifs.","Les écarts doivent sommer à zéro pour une allocation cible complète."],
                  ["Liquidité et résistance","Liquidité D+0 à D+90, besoins de cash et stress tests principaux.","Exclure actifs grevés ou appliquer haircuts."],
                  ["Positions et décisions","Valeur, rendement, liquidité D+1, décision et statut.","Le tableau traduit la recommandation en actions indicatives, non exécutées."],
                  ["Synthèse d'allocation","Résultats, scores sécurité/liquidité/rendement, plan et contrôles.","Afficher les contraintes actives et les violations éventuelles."],
                ].map(([b,c,r]) => (
                  <tr key={b as string}><td className={TD}>{b}</td><td className={TD}>{c}</td><td className={TD}>{r}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[326px] border-l border-border flex flex-col bg-[#0d1823] shrink-0">
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Qualité de données</div>
            <PRow label="Positions" value="Validées"           vc="text-emerald-400" />
            <PRow label="Marchés"   value="Synchronisés"       vc="text-emerald-400" />
            <PRow label="Limites"   value="Actives"            vc="text-emerald-400" />
            <PRow label="Fallback"  value="Autorisé si validé" vc="text-orange-400"  />
          </div>
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Blocage automatique</div>
            <RuleItem color="red">Prix obsolète ou absent sur actif significatif.</RuleItem>
            <RuleItem color="red">Positions non rapprochées.</RuleItem>
            <RuleItem color="red">Double comptage détecté sur repo, TRS ou Gold Deposit.</RuleItem>
            <RuleItem color="orange">Limite dure dépassée : optimisation non activable.</RuleItem>
          </div>
          <div className="p-3.5 flex-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Dev note</div>
            <Anno>
              <strong className="text-foreground font-bold">API attendues :</strong><br />
              <Code>GET /reserve/positions</Code><br />
              <Code>GET /market/prices</Code><br />
              <Code>GET /limits/active</Code><br />
              <Code>POST /reserve/r1/snapshot</Code><br />
              <Code>POST /reserve/r1/calculate</Code><br /><br />
              Chaque snapshot doit figer source, heure, devise, unité, statut et utilisateur.
            </Anno>
          </div>
        </div>
      </div>
      <Footer note="La page R1 ne calcule rien si les positions ou les prix critiques ne sont pas validés." btn="Voir calculs" />
    </>
  );
}

// ─── Screen 3 ─────────────────────────────────────────────────────────────────

function Screen3() {
  return (
    <>
      <Topbar title="US-R1-03 — Calculs, allocation cible et moteur d'optimisation" badge="Portfolio engine" bv="purple" right="Calculs par actif i, devise c, tranche k et scénario s" />
      <div className="flex min-h-[650px]">
        <div className="flex-1 p-5 overflow-hidden">
          <div className="grid grid-cols-5 gap-2.5 mb-3.5">
            <KpiCard title="Valeur totale"      value="6,49 Md"   sub="USD valeur marché consolidée"  vc="text-blue-400"    />
            <KpiCard title="Rendement attendu"  value="4,12 %"    sub="Horizon 12 mois"                vc="text-emerald-400" />
            <KpiCard title="Liquidité D+1"      value="2,86 Md"   sub="44,1 % du portefeuille"         vc="text-blue-400"    />
            <KpiCard title="VaR 10j 95%"        value="118,4 M"   sub="1,82 % des réserves"            vc="text-orange-400"  />
            <KpiCard title="Actifs non grevés"  value="92,6 %"    sub="Après repo et collatéral"       vc="text-emerald-400" />
          </div>

          <SecHead>Formules principales</SecHead>
          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <div>
              <Formula note="Valeur totale du portefeuille.">V<sub>P</sub> = Σ<sub>i=1..n</sub> MV<sub>i,USD</sub></Formula>
              <Formula note="Poids actuel par classe d'actifs ou instrument.">w<sub>i</sub> = MV<sub>i,USD</sub> / V<sub>P</sub></Formula>
              <Formula note="Écart à corriger : positif = renforcer ; négatif = réduire.">Gap<sub>i</sub> = w<sub>i,cible</sub> − w<sub>i,actuel</sub></Formula>
              <Formula note="Montant indicatif du rééquilibrage avant coûts, arrondis et contraintes.">Transaction<sub>i</sub> = Gap<sub>i</sub> × V<sub>P</sub></Formula>
              <Formula note="Rendement attendu agrégé.">E[R<sub>P</sub>] = Σ<sub>i</sub> w<sub>i</sub> × E[R<sub>i</sub>]</Formula>
            </div>
            <div>
              <Formula note="Liquidité mobilisable par horizon.">Liquidité<sub>h</sub> = Cash<sub>non grevé</sub> + Entrées<sub>h</sub> + Σ(Valeur cessible × (1 − Haircut)) − Sorties<sub>h</sub> − Marges<sub>h</sub></Formula>
              <Formula note="Couverture interne du besoin de liquidité.">LCR<sub>h</sub> = Liquidité<sub>h</sub> / BesoinCash<sub>h</sub></Formula>
              <Formula note="Duration pondérée.">Duration<sub>P</sub> = Σ<sub>i</sub> w<sub>i</sub> × Duration<sub>i</sub></Formula>
              <Formula note="VaR paramétrique simplifiée.">VaR<sub>α,h</sub> = z<sub>α</sub> × V<sub>P</sub> × σ<sub>P</sub> × √h</Formula>
              <Formula note="Mesure de mobilisation disponible.">Ratio<sub>non grevé</sub> = Actifs non grevés / Actifs totaux × 100</Formula>
            </div>
          </div>

          <SecHead>Allocation actuelle vs cible — règles de calcul</SecHead>
          <div className="overflow-x-auto mb-3.5">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th className={TH}>Classe</th>
                  <th className={cn(TH,"text-right")}>Actuelle</th>
                  <th className={cn(TH,"text-right")}>Cible</th>
                  <th className={cn(TH,"text-right")}>Décision</th>
                  <th className={TH}>Règle</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Cash","18,0 %","15,0 %","−3,0 pt","red","Réduire si supérieur au coussin minimal et si liquidité D+1 reste couverte."],
                  ["BIS Deposit","16,0 %","15,0 %","−1,0 pt","red","Réduire si excès de dépôt et alternative UST/repo conforme."],
                  ["UST","31,0 %","35,0 %","+4,0 pt","green","Renforcer si rendement et liquidité améliorent le portefeuille sans dépasser duration."],
                  ["Repo / TRS","8,0 %","10,0 %","+2,0 pt","green","Renforcer uniquement si collatéral, haircut, funding et limites sont validés."],
                  ["Gold","18,0 %","17,0 %","−1,0 pt","red","Ajuster sans vendre nécessairement : conversion vers Gold Deposit possible."],
                  ["Gold Deposit","4,0 %","5,0 %","+1,0 pt","green","Renforcer si contrepartie, tenor et restitution sont acceptables."],
                  ["Covered Bonds USD","5,0 %","3,0 %","−2,0 pt","red","Réduire si spread, liquidité ou concentration consomme trop de risque."],
                ] as const).map(([cls,act,tgt,dec,col,rule]) => (
                  <tr key={cls}>
                    <td className={TD}>{cls}</td>
                    <td className={TDr}>{act}</td>
                    <td className={TDr}>{tgt}</td>
                    <td className={cn(TDr, col === "red" ? "text-red-400" : "text-emerald-400")}>{dec}</td>
                    <td className={TD}>{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SecHead>Fonction objectif du solveur</SecHead>
          <Formula note="Le solveur maximise le rendement ajusté du risque uniquement après satisfaction des contraintes de sécurité et liquidité.">
            Max<sub>w</sub> : wᵀμ − λ(wᵀΣw) − κ × CoûtsTransaction − Pénalités
          </Formula>
        </div>

        <div className="w-[326px] border-l border-border flex flex-col bg-[#0d1823] shrink-0">
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Contraintes dures</div>
            <RuleItem color="green">Σ wᵢ = 100 %.</RuleItem>
            <RuleItem color="green">Liquidité D+1 et D+7 ≥ besoins × marge sécurité.</RuleItem>
            <RuleItem color="green">Duration, VaR et ES ≤ limites approuvées.</RuleItem>
            <RuleItem color="green">Exposition contrepartie, pays, émetteur, custodian ≤ limites.</RuleItem>
            <RuleItem color="orange">Or physique ≥ plancher stratégique ; or placé ≤ plafond.</RuleItem>
            <RuleItem color="red">Actifs grevés, repo/TRS, notional et levier ≤ plafonds.</RuleItem>
          </div>
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Sorties attendues</div>
            <PRow label="Allocation"    value="Poids cible" />
            <PRow label="Plan"          value="Achats / ventes / dépôts" />
            <PRow label="Avant / après" value="Rendement, risque, liquidité" />
            <PRow label="Explication"   value="Contraintes actives" />
          </div>
          <div className="p-3.5 flex-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Dev note</div>
            <Anno>
              <strong className="text-foreground font-bold">POST /reserve/r1/optimize</strong><br />
              Payload : <Code>portfolio_id</Code>, <Code>valuation_date</Code>, <Code>target_version</Code>, <Code>constraints</Code>, <Code>scenario_id</Code>.<br /><br />
              Réponse : <Code>target_weights[]</Code>, <Code>trade_plan[]</Code>, <Code>risk_after</Code>, <Code>liquidity_after</Code>, <Code>active_constraints[]</Code>.
            </Anno>
          </div>
        </div>
      </div>
      <Footer note="Le solveur propose une allocation ; il ne déclenche jamais une transaction sans workflow d'approbation." btn="Optimiser l'allocation" gold />
    </>
  );
}

// ─── Screen 4 ─────────────────────────────────────────────────────────────────

function Screen4() {
  return (
    <>
      <Topbar title="US-R1-04 — Scénarios, gouvernance, événements et critères d'acceptation" badge="Comité requis" bv="warn" right="Toute recommandation doit être versionnée et auditée" />
      <div className="flex min-h-[650px]">
        <div className="flex-1 p-5 overflow-hidden">
          <SecHead>Scénarios minimum à implémenter</SecHead>
          <div className="overflow-x-auto mb-3.5">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead><tr><th className={TH}>Scénario</th><th className={TH}>Chocs indicatifs</th><th className={TH}>Questions couvertes</th></tr></thead>
              <tbody>
                {[
                  ["Taux USD +100 pb","Hausse parallèle UST/OIS.","Perte obligataire, duration, DV01 et capacité de conservation."],
                  ["Taux USD −100 pb","Baisse parallèle des taux.","Gain de prix et risque de réinvestissement futur."],
                  ["Pentification","Courts stables, longs +100 pb.","Risque des maturités longues et des covered bonds."],
                  ["Aplatissement / inversion","Courts +100 pb, longs stables ou en baisse.","Attractivité cash/T-Bills vs duration."],
                  ["Or −15 %","Baisse XAU, vol et haircuts en hausse.","Perte sur or et capacité de financement collatéralisé."],
                  ["Or +15 %","Hausse XAU et concentration accrue.","Gain, dépassement de cible, opportunité de rebalancing."],
                  ["Covered Bonds +100 pb","Élargissement OAS/Z-spread.","Perte de marché, risque de spread et liquidité."],
                  ["Stress repo","Funding +100 pb, haircut +5 pt, appels de marge.","Besoins cash et hausse des actifs grevés."],
                  ["Sortie de réserves","Décaissement exceptionnel à D+1/D+7.","Capacité de fournir le cash sans vente forcée."],
                  ["Crise combinée","Or −15 %, UST +150 pb, covered spreads +150 pb, USD outflow.","Résilience globale et plan d'urgence."],
                ].map(([s,c,q]) => (
                  <tr key={s as string}><td className={TD}>{s}</td><td className={TD}>{c}</td><td className={TD}>{q}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <SecHead>Workflow et événements système</SecHead>
          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <div className="space-y-2">
              <Step no={1} title="Snapshot créé"        desc="Positions, prix, limites et besoins de liquidité sont figés." />
              <Step no={2} title="Calcul exécuté"       desc="Allocation, rendement, liquidité et risque sont recalculés." />
              <Step no={3} title="Scénarios validés"    desc="Stress tests, violations et contraintes actives sont enregistrés." />
              <Step no={4} title="Proposition générée"  desc="Plan de rééquilibrage et note comité sont produits." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead><tr><th className={TH}>Événement</th><th className={TH}>Déclencheur</th><th className={TH}>Consommateur</th></tr></thead>
                <tbody>
                  {[
                    ["r1.snapshot.created","Création d'un snapshot","Audit, Risk"],
                    ["r1.calculation.completed","Fin des calculs","UI, Reporting"],
                    ["r1.limit.breached","Limite dure dépassée","Middle Office"],
                    ["r1.recommendation.created","Plan proposé","Comité"],
                    ["r1.committee.note.generated","Export note","Documents"],
                  ].map(([ev,d,c]) => (
                    <tr key={ev as string}><td className={TD}><Code>{ev}</Code></td><td className={TD}>{d}</td><td className={TD}>{c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SecHead>Critères d'acceptation</SecHead>
          <div className="overflow-x-auto">
            <table className="w-full border border-border rounded-xl overflow-hidden">
              <thead><tr><th className={TH}>ID</th><th className={TH}>Critère</th><th className={TH}>Résultat attendu</th></tr></thead>
              <tbody>
                {[
                  ["AC-01","La page affiche le portefeuille, la date, la devise, la version et le statut.","Contexte visible avant tout calcul."],
                  ["AC-02","Les positions non validées ou les prix obsolètes bloquent l'optimisation.","Bouton Optimiser désactivé et alerte visible."],
                  ["AC-03","Les poids par instrument totalisent 100 %.","Erreur si somme ≠ 100 % au-delà de la tolérance."],
                  ["AC-04","La vue instrument, devise et tranche est séparée.","Aucune addition erronée entre axes analytiques."],
                  ["AC-05","Repo, reverse repo et TRS sont traités séparément.","Exposition, financement, collatéral et actifs grevés distincts."],
                  ["AC-06","La liquidité D+1 applique haircuts et exclusions d'actifs grevés.","Calcul conforme à la formule de liquidité."],
                  ["AC-07","Les stress tests recalculent valeur, risque, liquidité et limites.","Résultats avant/après disponibles."],
                  ["AC-08","La recommandation n'est pas exécutable directement.","Workflow validation requis."],
                  ["AC-09","La note comité reprend hypothèses, décisions, impacts et risques.","Export généré et rattaché au snapshot."],
                  ["AC-10","Toutes les hypothèses, overrides et validations sont auditables.","Piste d'audit complète avec utilisateur et horodatage."],
                ].map(([id,crit,res]) => (
                  <tr key={id as string}>
                    <td className={cn(TD,"font-mono font-bold text-yellow-400 text-[11px]")}>{id}</td>
                    <td className={TD}>{crit}</td>
                    <td className={TD}>{res}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[326px] border-l border-border flex flex-col bg-[#0d1823] shrink-0">
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Alertes majeures</div>
            <RuleItem color="red">VaR ou ES supérieure à la limite.</RuleItem>
            <RuleItem color="red">Liquidité insuffisante sur D+1 ou D+7.</RuleItem>
            <RuleItem color="orange">Concentration contrepartie proche de 100 %.</RuleItem>
            <RuleItem color="orange">Taux d'actifs grevés supérieur au plafond.</RuleItem>
            <RuleItem color="blue">Donnée stale ou override manuel.</RuleItem>
          </div>
          <div className="p-3.5 border-b border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Sorties de reporting</div>
            <PRow label="Dashboard"            value="Exécutif" />
            <PRow label="Proposition SAA"      value="PDF / Word" />
            <PRow label="Plan de rééquilibrage" value="Transactions indicatives" />
            <PRow label="Rapport risque"        value="VaR / ES / stress" />
            <PRow label="Note comité"           value="Synthèse décisionnelle" />
          </div>
          <div className="p-3.5 flex-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.04em] mb-2.5">Phrase de synthèse attendue</div>
            <Callout type="good" className="mb-0">
              Le portefeuille respecte les limites de sécurité et dispose d'une couverture de liquidité D+1 suffisante. La simulation propose de réduire l'excès de cash et de renforcer les UST / Gold Deposit, avec un gain de rendement estimé sans dépassement de VaR, duration ou concentration.
            </Callout>
          </div>
        </div>
      </div>
      <Footer note="La recommandation finale doit être validée indépendamment avant toute exécution." btn="Générer la note comité" gold />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  "US-R1-01 — Vision & parcours",
  "US-R1-02 — Données & UI",
  "US-R1-03 — Calculs & optimisation",
  "US-R1-04 — Scénarios & gouvernance",
];

export default function GestionReservesPage() {
  const [tab, setTab] = useState<Tab>(0);

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="US-R1 — Allocation et Gestion Intégrée des Réserves"
            subtitle="User story développeur — sécurité, liquidité, rendement, allocation cible, stress tests et note comité."
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px]">
              {/* Tab nav */}
              <div className="flex border border-border border-b-0 rounded-t-xl overflow-hidden bg-[#0d1823]">
                {TABS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setTab(i as Tab)}
                    className={cn(
                      "px-4 py-3 text-[12px] font-bold border-r border-border border-b-2 transition-colors last:border-r-0",
                      tab === i
                        ? "text-foreground border-b-yellow-400 bg-[#0f1d2a]"
                        : "text-muted-foreground border-b-transparent hover:bg-[#112131] hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Screen shell */}
              <div className="border border-border rounded-b-xl overflow-hidden bg-[#071019]">
                {tab === 0 && <Screen1 />}
                {tab === 1 && <Screen2 />}
                {tab === 2 && <Screen3 />}
                {tab === 3 && <Screen4 />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
