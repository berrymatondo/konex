"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Building2,
  Layers,
  BadgeCheck,
  Shield,
  Landmark,
  BarChart3,
  Lock,
  Earth,
  Users,
  Handshake,
  KeyRound,
  Globe2,
} from "lucide-react";

// ─── Content (mirrors https://v0-gold-dashboard-tau.vercel.app/) ─────────────
const TRUST_BADGES = ["Certifié LBMA", "ISO 27001", "SOC 2 Type II"];

const CITIES: Array<{ name: string; position: string; delay: number }> = [
  {
    name: "Kinshasa",
    position: "top-[15%] right-[5%] md:right-[10%]",
    delay: 0,
  },
  {
    name: "New York",
    position: "bottom-[25%] left-[0%] md:left-[5%]",
    delay: 1,
  },
  { name: "Dubai", position: "top-[40%] right-[0%] md:right-[5%]", delay: 2 },
  {
    name: "London",
    position: "bottom-[15%] right-[10%] md:right-[15%]",
    delay: 0.5,
  },
  {
    name: "Zurich",
    position: "bottom-[25%] right-[20%] md:right-[15%]",
    delay: 1.5,
  },
];

const STATS: Array<{
  value: number;
  decimals: number;
  suffix: string;
  label: string;
}> = [
  { value: 142, decimals: 0, suffix: "T", label: "Or Géré" },
  { value: 15, decimals: 0, suffix: "+", label: "Banques Centrales" },
  { value: 99.5, decimals: 1, suffix: "%", label: "Pureté Garantie" },
  { value: 24, decimals: 0, suffix: "/7", label: "Monitoring" },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Pré-traitement et conformité",
    description:
      "Enrôlement des maisons de négoce et/ou raffinerie, collecte KYC et contrôles sanctions, PPE et LBC avant toute opération",
  },
  {
    icon: BadgeCheck,
    title: "Acquisition Stratégique",
    description:
      "Pilotage des achats d’or auprès de fournisseurs agréés, dans le respect des exigences de provenance et de conformité.",
  },
  {
    icon: Shield,
    title: "Transformation en Or Monétaire",
    description:
      "Suivi du raffinage et de la conversion de l’or brut en actifs monétaires éligibles aux réserves officielles.",
  },
  {
    icon: Landmark,
    title: "Analyse Macroéconomique",
    description:
      "Évaluation de l’impact des opérations sur la liquidité, le taux de change, l’inflation et la politique monétaire.",
  },
  {
    icon: BarChart3,
    title: "Optimisation des Réserves",
    description:
      "Analyse, simulation et allocation stratégique pour renforcer la performance et la résilience des réserves internationales.",
  },
  {
    icon: Lock,
    title: "Conformité & Traçabilité",
    description:
      "Contrôle des opérations, piste d’audit complète et alignement avec les standards internationaux, notamment ceux de la LBMA.",
  },
];

const ECOSYSTEM_ACTORS = [
  {
    icon: Users,
    title: "Agents de la BCC",
    description:
      "Pilotage des opérations, suivi des réserves, analyses, validations et contrôles.",
  },
  {
    icon: Handshake,
    title: "Maisons de négoce & mandataires",
    description:
      "Enrôlement, transmission des documents, soumission des offres et suivi des transactions.",
  },
  {
    icon: KeyRound,
    title: "Dépositaires — notamment la BRI",
    description:
      "Conservation des actifs, confirmation des mouvements et suivi des positions détenues.",
  },
  {
    icon: Globe2,
    title: "Tierces contreparties — notamment la Banque d’Angleterre",
    description:
      "Coordination des opérations internationales, échanges d’informations et sécurisation des règlements.",
  },
];

// Scoped gold/slate theme override — only applies inside this page, the rest
// of the app keeps its own palette. Tailwind's bg-background/text-primary/...
// utilities read these same custom-property names, so plain utility classes
// below automatically pick up this page's colors.
const THEME_VARS = {
  "--background": "#0f172a",
  "--foreground": "#e2e8f0",
  "--card": "rgba(30,41,59,0.7)",
  "--card-foreground": "#e2e8f0",
  "--primary": "#d4af37",
  "--primary-foreground": "#0f172a",
  "--muted-foreground": "#94a3b8",
  "--accent": "#1e293b",
  "--accent-foreground": "#e2e8f0",
  "--success": "#10b981",
  "--border": "rgba(255,255,255,0.1)",
  "--input": "rgba(255,255,255,0.1)",
  "--ring": "#d4af37",
  backgroundImage:
    "radial-gradient(circle at 50% 0%, #1a2333 0%, #0f172a 100%)",
  backgroundAttachment: "fixed",
} as React.CSSProperties;

// ─── Scroll-reveal wrapper (fade + rise, once) ───────────────────────────────
function Reveal({
  children,
  className = "",
  from = "translate-y-8",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-x-0 translate-y-0 scale-100" : `opacity-0 ${from}`} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Stat card with count-up-on-view ─────────────────────────────────────────
function StatCard({ stat }: { stat: (typeof STATS)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const duration = 1800;
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            setDisplay(stat.value * progress);
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(stat.value);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stat.value]);

  return (
    <Reveal>
      <div ref={ref} className="text-center">
        <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-2 [text-shadow:0_0_10px_rgba(212,175,55,0.3)]">
          <span>
            {display.toFixed(stat.decimals)}
            {stat.suffix}
          </span>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
          {stat.label}
        </div>
      </div>
    </Reveal>
  );
}

// ─── Fixed ambient floating dots (client-only to avoid hydration mismatch) ──
function AmbientDots() {
  const [dots, setDots] = useState<
    Array<{ top: number; left: number; delay: number; duration: number }>
  >([]);

  useEffect(() => {
    setDots(
      Array.from({ length: 20 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
      })),
    );
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-primary/20 rounded-full animate-pulse"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function AccueilClient() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background text-foreground font-sans antialiased"
      style={THEME_VARS}
    >
      <style>{`
        @keyframes accueil-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes accueil-spin { to { transform: rotate(360deg); } }
        .accueil-float { animation: accueil-float 3s ease-in-out infinite; }
      `}</style>

      <AmbientDots />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left column — copy */}
            <Reveal
              from="-translate-x-12"
              className="order-2 lg:order-1 text-center lg:text-left space-y-6 sm:space-y-8"
            >
              <div className="inline-flex items-center gap-2 backdrop-blur-md bg-[#1e293b99] border border-white/5 px-4 py-2 rounded-full text-sm mx-auto lg:mx-0">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-muted-foreground">
                  Plateforme de Gestion des Réserves en Or
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                <span className="text-foreground">La Référence pour les</span>
                <br />
                <span className="text-primary [text-shadow:0_0_10px_rgba(212,175,55,0.3)]">
                  Réserves d&apos;Or
                </span>
                <br />
                <span className="text-foreground">des Banques Centrales</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0">
                Konex est une plateforme intégrée qui accompagne les banques
                centrales et les institutions financières dans la gestion
                stratégique de leurs réserves d&apos;or. Elle couvre le
                pré-traitement et l&apos;acquisition de l&apos;or, sa
                transformation en or monétaire, l&apos;analyse macroéconomique,
                l&apos;optimisation des réserves internationales et la
                conformité des opérations aux standards internationaux de la
                LBMA (London Bullion Market Association).
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" asChild className="gap-2 group">
                  <Link href="/sign-in">
                    Accéder à la Plateforme
                    <ArrowRight
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <Link href="/documentation">
                    Découvrir les Fonctionnalités
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 justify-center lg:justify-start">
                {TRUST_BADGES.map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2
                      className="w-4 h-4 text-success"
                      aria-hidden="true"
                    />
                    {label}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Right column — animated gold orbit graphic */}
            <Reveal
              from="scale-90"
              className="order-1 lg:order-2 h-[400px] sm:h-[450px] lg:h-[550px] relative flex flex-col items-center"
            >
              <div className="text-center mb-4 lg:absolute lg:top-0 lg:left-1/2 lg:-translate-x-1/2 lg:z-10">
                <h2 className="text-4xl sm:text-5xl lg:text-4xl font-bold text-primary tracking-wider [text-shadow:0_0_10px_rgba(212,175,55,0.3)]">
                  KONEX
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 uppercase tracking-[0.2em]">
                  Gold Reserve Management
                </p>
              </div>
              <div className="flex-1 w-full">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-primary/20 blur-[100px] animate-pulse" />
                  <div className="relative w-[280px] h-[280px] md:w-[400px] md:h-[400px]">
                    <div
                      className="absolute inset-0 rounded-full border-2 border-primary/30"
                      style={{ animation: "accueil-spin 20s linear infinite" }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-primary/60 rounded-full" />
                    </div>
                    <div
                      className="absolute inset-6 md:inset-8 rounded-full border border-primary/20"
                      style={{
                        animation: "accueil-spin 15s linear infinite reverse",
                      }}
                    >
                      <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                    </div>
                    <div
                      className="absolute inset-12 md:inset-16 rounded-full border border-primary/10"
                      style={{ animation: "accueil-spin 25s linear infinite" }}
                    />
                    <div className="absolute inset-16 md:inset-20 rounded-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] overflow-hidden">
                      <div className="absolute inset-0 flex flex-col justify-around opacity-20">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="h-px bg-primary/60" />
                        ))}
                      </div>
                      <div className="absolute inset-0 flex justify-around opacity-20">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="w-px bg-primary/60" />
                        ))}
                      </div>
                      <div className="absolute top-[25%] left-[30%] w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
                      <div
                        className="absolute top-[35%] left-[55%] w-1.5 h-1.5 bg-primary/80 rounded-full animate-pulse"
                        style={{ animationDelay: "0.5s" }}
                      />
                      <div
                        className="absolute top-[45%] left-[40%] w-1 h-1 bg-primary/60 rounded-full animate-pulse"
                        style={{ animationDelay: "1s" }}
                      />
                      <div
                        className="absolute top-[55%] left-[65%] w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(212,175,55,0.8)]"
                        style={{ animationDelay: "1.5s" }}
                      />
                      <div
                        className="absolute top-[40%] left-[25%] w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse"
                        style={{ animationDelay: "2s" }}
                      />
                      <div
                        className="absolute top-[60%] left-[35%] w-1 h-1 bg-primary/50 rounded-full animate-pulse"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox="0 0 400 400"
                      style={{ animation: "accueil-spin 30s linear infinite" }}
                    >
                      <defs>
                        <linearGradient
                          id="accueil-arc-gradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="rgba(212,175,55,0)" />
                          <stop offset="50%" stopColor="rgba(212,175,55,0.8)" />
                          <stop offset="100%" stopColor="rgba(212,175,55,0)" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M100,200 Q200,80 300,200"
                        fill="none"
                        stroke="url(#accueil-arc-gradient)"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                      <path
                        d="M150,300 Q200,180 250,100"
                        fill="none"
                        stroke="url(#accueil-arc-gradient)"
                        strokeWidth="1.5"
                        className="animate-pulse"
                        style={{ animationDelay: "1s" }}
                      />
                    </svg>
                  </div>

                  {CITIES.map((city) => (
                    <div
                      key={city.name}
                      className={`absolute ${city.position} accueil-float backdrop-blur-md bg-[#1e293b99] border border-white/5 px-3 py-1.5 rounded-full text-xs text-primary flex items-center gap-2`}
                      style={{ animationDelay: `${city.delay}s` }}
                    >
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      {city.name}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ChevronDown className="w-6 h-6 text-primary/50" aria-hidden="true" />
        </div>
      </section>

      {/* ══════════════════ STATS ══════════════════ */}
      <section className="py-16 sm:py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ WHY GOLD RESERVES ══════════════════ */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="backdrop-blur-md bg-[#1e293b99] border border-white/5 rounded-2xl p-6 sm:p-8 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2
                      className="w-5 h-5 sm:w-6 sm:h-6 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                    Pourquoi les Reserves en Or ?
                  </h2>
                </div>
                <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  <p>
                    Chaque banque nationale est tenue de constituer des réserves
                    en devises étrangères, communément appelées réserves
                    d&apos;État. En complément, elle doit également détenir des
                    actifs stables, notamment de l&apos;or.
                  </p>
                  <p>
                    Toutefois, cet or doit répondre à des exigences strictes :
                    il doit être raffiné selon des standards reconnus et
                    certifié par des organismes accrédités, notamment la{" "}
                    <span className="text-primary font-medium">
                      London Bullion Market Association (LBMA)
                    </span>
                    .
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Konex</span> a
                    pour mission d&apos;accompagner les banques à chaque étape
                    de ce processus. Cela inclut l&apos;acquisition d&apos;or
                    brut, son raffinage auprès d&apos;entités certifiées, puis
                    sa validation officielle afin de garantir sa conformité aux
                    normes internationales.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Une Plateforme <span className="text-primary">Complète</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              De l&apos;acquisition à la certification, Konex couvre
              l&apos;ensemble du cycle de vie des réserves en or de votre
              institution.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="backdrop-blur-md bg-[#1e293b99] border border-white/5 rounded-xl p-5 sm:p-6 hover:border-primary/30 transition-colors group h-full">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon
                      className="w-5 h-5 sm:w-6 sm:h-6 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    {title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FINAL CTA ══════════════════ */}
      <section className="py-16 sm:pb-20">
        <div className="container mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1e293b99] backdrop-blur-md">
              <div className="border-b border-white/5 px-6 py-8 text-center sm:px-8 sm:py-10 md:px-10">
                <h2 className="mx-auto max-w-5xl text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
                  Une plateforme au service de tout l’écosystème des{" "}
                  <span className="text-primary">réserves d’or</span>
                </h2>
                <p className="mx-auto mt-4 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Konex réunit, dans un environnement sécurisé,
                </p>
                <p className="mx-auto max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  les acteurs qui interviennent tout au long du cycle de gestion
                  des réserves d’or.
                </p>
              </div>
              <div className="grid gap-px bg-white/5 sm:grid-cols-2">
                {ECOSYSTEM_ACTORS.map(
                  ({ icon: Icon, title, description }, index) => (
                    <Reveal key={title} delay={index * 60}>
                      <article className="group h-full bg-[#172236] p-6 transition-colors hover:bg-[#1c2940] sm:p-8">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground sm:text-lg">
                          {title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </article>
                    </Reveal>
                  ),
                )}
              </div>
              <div className="border-t border-primary/20 bg-primary/5 px-6 py-5 sm:px-8 md:px-10">
                <p className="text-sm font-semibold leading-relaxed text-foreground sm:text-base text-center">
                  Chaque acteur bénéficie d’un accès adapté à son rôle, avec une
                  traçabilité complète des échanges, des validations et des
                  opérations.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <Reveal from="scale-95">
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-r from-primary/20 via-primary/10 to-primary/20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(212,175,55,0.15),transparent_50%)]" />
              <div className="relative z-10 text-center py-12 sm:py-16 px-4 sm:px-6">
                <Earth
                  className="w-12 h-12 sm:w-16 sm:h-16 text-primary mx-auto mb-6 animate-pulse"
                  aria-hidden="true"
                />
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Prêt à Sécuriser vos Réserves ?
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-8">
                  Rejoignez les banques centrales qui font confiance à Konex
                  pour la gestion stratégique de leurs réserves en or.
                </p>
                <Button size="lg" asChild className="gap-2 group">
                  <Link href="/sign-in">
                    Commencer Maintenant
                    <ArrowRight
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <span className="font-semibold text-foreground">KONEX</span>
              <span className="text-muted-foreground text-sm">
                Reserve Management System
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              2024 Konex. Tous droits réservés.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
