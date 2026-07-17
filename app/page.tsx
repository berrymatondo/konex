"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { readAppSettings, APP_SETTINGS_DEFAULTS } from "@/lib/app-settings";
import useSWR from "swr";
import { isCounterpartyRole } from "@/lib/roles";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider } from "@/components/sidebar-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketTicker {
  id: string;
  name: string;
  sub: string;
  value: number;
  unit: string;
  change: number;
  changePct: number;
  sparkline: number[];
  time: string;
}

interface FxRow {
  pair: string;
  sub?: string;
  rate: number;
  decimals: number;
  d1: number;
  d1dec: number;
  m1: number;
  sparkline: number[];
}

interface BonRow {
  maturity: string;
  rate: number;
  varPb: number;
  announced: number;
  submissions: number;
  retained: number;
  btc: number;
  satisfaction: number;
  encours: number;
  nextAuction: string;
}

interface LiquidityKpi {
  label: string;
  value: string;
  change: string;
  positive: boolean | null;
}

interface CommodityRow {
  label: string;
  level: number;
  levelDec: number;
  d1: number;
  m1: number;
}

interface SignalRow {
  factor: string;
  situation: string;
  signal: "favorable" | "warning" | "unfavorable";
}

interface Alert {
  level: "critical" | "warning" | "info";
  text: string;
  time: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const TICKERS: MarketTicker[] = [
  {
    id: "gold",
    name: "GOLD",
    sub: "XAU / USD",
    value: 2345.6,
    unit: "USD/oz",
    change: 18.4,
    changePct: 0.79,
    time: "09:30",
    sparkline: [2280, 2295, 2310, 2290, 2305, 2325, 2318, 2330, 2340, 2346],
  },
  {
    id: "copper",
    name: "COPPER",
    sub: "LME 3M",
    value: 9742.0,
    unit: "USD/ton",
    change: -54.5,
    changePct: -0.56,
    time: "09:30",
    sparkline: [9820, 9810, 9830, 9800, 9780, 9760, 9775, 9755, 9745, 9742],
  },
  {
    id: "brent",
    name: "BRENT",
    sub: "ICE",
    value: 84.32,
    unit: "USD/bbl",
    change: 0.62,
    changePct: 0.74,
    time: "09:30",
    sparkline: [83.0, 83.4, 83.2, 83.7, 83.5, 84.0, 83.8, 84.1, 84.2, 84.32],
  },
  {
    id: "ust10y",
    name: "UST 10Y",
    sub: "Rendement",
    value: 4.28,
    unit: "%",
    change: 0.07,
    changePct: 1.66,
    time: "09:30",
    sparkline: [4.1, 4.12, 4.18, 4.15, 4.2, 4.22, 4.19, 4.24, 4.26, 4.28],
  },
  {
    id: "dxy",
    name: "DXY",
    sub: "Indice dollar",
    value: 104.21,
    unit: "",
    change: 0.18,
    changePct: 0.17,
    time: "09:30",
    sparkline: [
      103.5, 103.6, 103.8, 103.7, 104.0, 103.9, 104.1, 104.0, 104.15, 104.21,
    ],
  },
  {
    id: "cdfusd",
    name: "CDF / USD",
    sub: "Interbancaire",
    value: 2257.35,
    unit: "",
    change: 12.5,
    changePct: 0.43,
    time: "09:30",
    sparkline: [2220, 2225, 2230, 2228, 2235, 2240, 2242, 2248, 2253, 2257],
  },
  {
    id: "goldvol",
    name: "GOLD VOLATILITY",
    sub: "3M ATM",
    value: 15.62,
    unit: "",
    change: -0.48,
    changePct: -2.98,
    time: "09:30",
    sparkline: [17.0, 16.8, 16.5, 16.3, 16.1, 16.2, 16.0, 15.9, 15.7, 15.62],
  },
  {
    id: "move",
    name: "MOVE INDEX",
    sub: "Volatilité taux US",
    value: 105.34,
    unit: "",
    change: -1.25,
    changePct: -1.17,
    time: "09:30",
    sparkline: [
      108, 107.5, 107.0, 106.8, 106.5, 106.2, 106.0, 105.8, 105.5, 105.34,
    ],
  },
];

const FX_ROWS: FxRow[] = [
  {
    pair: "USD / CDF",
    sub: "Interbancaire",
    rate: 2257.35,
    decimals: 2,
    d1: 12.5,
    d1dec: 2,
    m1: 0.43,
    sparkline: [2220, 2225, 2230, 2228, 2235, 2240, 2242, 2248, 2253, 2257],
  },
  {
    pair: "EUR / USD",
    rate: 1.0768,
    decimals: 4,
    d1: -0.0021,
    d1dec: 4,
    m1: -0.19,
    sparkline: [
      1.09, 1.085, 1.082, 1.083, 1.08, 1.079, 1.078, 1.077, 1.077, 1.0768,
    ],
  },
  {
    pair: "GBP / USD",
    rate: 1.2553,
    decimals: 4,
    d1: 0.0045,
    d1dec: 4,
    m1: 0.36,
    sparkline: [
      1.247, 1.249, 1.251, 1.25, 1.252, 1.253, 1.254, 1.255, 1.255, 1.2553,
    ],
  },
  {
    pair: "USD / ZAR",
    rate: 18.74,
    decimals: 2,
    d1: 0.21,
    d1dec: 2,
    m1: 1.12,
    sparkline: [
      18.3, 18.4, 18.5, 18.45, 18.55, 18.6, 18.65, 18.7, 18.72, 18.74,
    ],
  },
  {
    pair: "USD / GHS",
    rate: 12.18,
    decimals: 2,
    d1: 0.07,
    d1dec: 2,
    m1: 0.58,
    sparkline: [
      12.0, 12.05, 12.08, 12.1, 12.11, 12.13, 12.14, 12.15, 12.17, 12.18,
    ],
  },
  {
    pair: "USD / KES",
    rate: 129.45,
    decimals: 2,
    d1: 0.19,
    d1dec: 2,
    m1: 0.15,
    sparkline: [
      128.8, 128.9, 129.0, 129.1, 129.2, 129.2, 129.3, 129.35, 129.4, 129.45,
    ],
  },
  {
    pair: "USD / CNY",
    rate: 7.1897,
    decimals: 4,
    d1: 0.0143,
    d1dec: 4,
    m1: 0.2,
    sparkline: [
      7.16, 7.165, 7.17, 7.172, 7.175, 7.178, 7.18, 7.184, 7.187, 7.1897,
    ],
  },
];

const BONS_BCC: BonRow[] = [
  {
    maturity: "7 jours",
    rate: 10.5,
    varPb: 25,
    announced: 300,
    submissions: 612,
    retained: 300,
    btc: 2.04,
    satisfaction: 49.0,
    encours: 412.3,
    nextAuction: "20/06/2026",
  },
  {
    maturity: "28 jours",
    rate: 11.75,
    varPb: 25,
    announced: 500,
    submissions: 1085,
    retained: 500,
    btc: 2.17,
    satisfaction: 46.1,
    encours: 1231.7,
    nextAuction: "23/06/2026",
  },
  {
    maturity: "84 jours",
    rate: 12.5,
    varPb: 20,
    announced: 700,
    submissions: 1564,
    retained: 700,
    btc: 2.23,
    satisfaction: 44.8,
    encours: 1987.4,
    nextAuction: "25/06/2026",
  },
  {
    maturity: "182 jours",
    rate: 13.25,
    varPb: 15,
    announced: 600,
    submissions: 1023,
    retained: 600,
    btc: 1.71,
    satisfaction: 58.7,
    encours: 1102.5,
    nextAuction: "30/06/2026",
  },
];

const LIQUIDITY_KPIS: LiquidityKpi[] = [
  {
    label: "Excédent de réserves bancaires (Mds CDF)",
    value: "3 480",
    change: "-1,8 %",
    positive: false,
  },
  {
    label: "Taux interbancaire O/N (%)",
    value: "24,60",
    change: "+8 pb",
    positive: false,
  },
  {
    label: "Volume interbancaire (Mds CDF)",
    value: "1 920",
    change: "+6,3 %",
    positive: true,
  },
  {
    label: "Inflation (YoY)",
    value: "6,24 %",
    change: "-0,18 pt",
    positive: true,
  },
  {
    label: "Réserves int. brutes (Mds USD)",
    value: "7,21",
    change: "+0,43 %",
    positive: true,
  },
  {
    label: "Couverture import. (mois)",
    value: "3,3",
    change: "-0,1",
    positive: false,
  },
];

const COMMODITY_ROWS: CommodityRow[] = [
  { label: "Gold (XAU/USD)", level: 2345.6, levelDec: 2, d1: 0.79, m1: 4.12 },
  { label: "Copper (LME 3M)", level: 9742.0, levelDec: 0, d1: -0.56, m1: 2.35 },
  { label: "Brent (ICE)", level: 84.32, levelDec: 2, d1: 0.74, m1: -1.22 },
  {
    label: "Bloomberg Commodity Index",
    level: 102.18,
    levelDec: 2,
    d1: 0.21,
    m1: 1.05,
  },
];

const PEER_GROUPS = [
  "Banques centrales africaines",
  "G20 Banques centrales",
  "CEMAC",
  "COMESA",
];
const PEER_COUNTRIES = [
  "DRC (BCC)",
  "Ghana (BoG)",
  "Afrique du Sud (SARB)",
  "Botswana (BoB)",
  "Maroc (BAM)",
];
const PEER_ROWS: {
  label: string;
  values: number[];
  fmt: (v: number) => string;
}[] = [
  {
    label: "Réserves brutes (Mds USD)",
    values: [7.21, 9.8, 64.9, 8.3, 37.8],
    fmt: (v) => v.toFixed(2),
  },
  {
    label: "Mois d'importations (mois)",
    values: [3.3, 3.5, 4.6, 6.7, 6.1],
    fmt: (v) => v.toFixed(1),
  },
  {
    label: "Or officiel détenu (tonnes)",
    values: [31.2, 32.9, 125.5, 24.1, 22.1],
    fmt: (v) => v.toFixed(1),
  },
  {
    label: "Part de l'or dans réserves (%)",
    values: [18.5, 42.0, 11.1, 22.6, 6.8],
    fmt: (v) => v.toFixed(1) + " %",
  },
  {
    label: "Variation or (12M, tonnes)",
    values: [5.2, 16.4, 8.1, 2.3, 1.9],
    fmt: (v) => "+" + v.toFixed(1),
  },
  {
    label: "Variation réserves (12M)",
    values: [6.2, 15.7, 4.3, 10.8, 5.6],
    fmt: (v) => "+" + v.toFixed(1) + " %",
  },
  {
    label: "Part des actifs liquides (%)",
    values: [68.0, 61.0, 72.0, 70.0, 66.0],
    fmt: (v) => v.toFixed(1) + " %",
  },
  {
    label: "Rendement des réserves (YoY)",
    values: [1.85, 2.1, 1.9, 2.4, 1.7],
    fmt: (v) => v.toFixed(2) + " %",
  },
];

const SIGNAL_ROWS: SignalRow[] = [
  { factor: "Or (XAU/USD)", situation: "Hausse", signal: "favorable" },
  { factor: "Cuivre", situation: "Baisse modérée", signal: "warning" },
  { factor: "Brent", situation: "Hausse modérée", signal: "warning" },
  { factor: "UST 10Y", situation: "Hausse", signal: "unfavorable" },
  { factor: "DXY", situation: "Hausse", signal: "unfavorable" },
  { factor: "CDF/USD", situation: "Pression haussière", signal: "unfavorable" },
  {
    factor: "Taux BCC (court terme)",
    situation: "En hausse",
    signal: "warning",
  },
  { factor: "MOVE Index", situation: "Élevé", signal: "warning" },
];

const ALERTS: Alert[] = [
  {
    level: "critical",
    text: "Hausse rapide des rendements UST 10Y (+7 pb)",
    time: "09:30",
  },
  {
    level: "critical",
    text: "Taux Bon BCC 84j en hausse (+20 pb)",
    time: "09:28",
  },
  { level: "warning", text: "Pression haussière sur CDF/USD", time: "09:27" },
  {
    level: "info",
    text: "Prochaine adjudication BCC : 20/06/2026 (7j)",
    time: "09:25",
  },
  {
    level: "warning",
    text: "Tombées importantes le 22/06 (1,35 Md CDF)",
    time: "09:22",
  },
];

const CALENDAR_EVENTS = [
  { date: "20/06/2026", label: "Adjudication Bon BCC 7 jours" },
  { date: "23/06/2026", label: "Adjudication Bon BCC 28 jours" },
  { date: "25/06/2026", label: "Adjudication Bon BCC 84 jours" },
  { date: "22/06/2026", label: "Tombées Bons BCC (1,35 Mds CDF)" },
  { date: "18/06/2026", label: "Réunion Fed (FOMC)" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "#22c55e",
}: {
  data: number[];
  color?: string;
}) {
  const w = 72,
    h = 28;
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) + 1}`,
    )
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible shrink-0"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TickerCard({ t }: { t: MarketTicker }) {
  const pos = t.change >= 0;
  const color = pos ? "#22c55e" : "#ef4444";
  const fmtVal = (v: number) =>
    v.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return (
    <Card className="p-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[11px] font-bold leading-none truncate">
            {t.name}
          </p>
          <p className="text-[9px] text-muted-foreground truncate">{t.sub}</p>
        </div>
        {pos ? (
          <TrendingUp className="h-3 w-3 text-success shrink-0 mt-0.5" />
        ) : (
          <TrendingDown className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
        )}
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">
        {fmtVal(t.value)}
        {t.unit && (
          <span className="text-[9px] font-normal text-muted-foreground ml-1">
            {t.unit}
          </span>
        )}
      </p>
      <div className="flex items-end justify-between gap-1 mt-auto">
        <div>
          <p
            className={cn(
              "text-[10px] font-medium",
              pos ? "text-success" : "text-destructive",
            )}
          >
            {pos ? "+" : ""}
            {fmtVal(t.change)} {pos ? "+" : ""}
            {Math.abs(t.changePct).toFixed(2)} %
          </p>
          <p className="text-[9px] text-muted-foreground">
            Mise à jour : {t.time}
          </p>
        </div>
        <Sparkline data={t.sparkline} color={color} />
      </div>
    </Card>
  );
}

function SignalDot({ signal }: { signal: SignalRow["signal"] }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0",
        signal === "favorable"
          ? "bg-success"
          : signal === "warning"
            ? "bg-yellow-400"
            : "bg-destructive",
      )}
    />
  );
}

function AlertIcon({ level }: { level: Alert["level"] }) {
  if (level === "critical")
    return (
      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
    );
  if (level === "warning")
    return (
      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
    );
  return <Info className="h-3.5 w-3.5 text-blue-400   shrink-0 mt-0.5" />;
}

// ─── Scrolling ticker bar ─────────────────────────────────────────────────────

interface TickerItem {
  id: string;
  label: string;
  value: number;
  changePct: number;
  unit: string;
  isin?: string;
}

const TICKER_STATIC: TickerItem[] = [
  {
    id: "eb2029",
    label: "DRC, 8.75% 04/32",
    value: 103.3,
    changePct: -0.32,
    unit: "",
    isin: "XS3344646875",
  },
  {
    id: "eb2031",
    label: "DRC, 9.5% 04/37",
    value: 104.73,
    changePct: +0.18,
    unit: "",
    isin: "XS3344646958",
  },
  {
    id: "cobalt",
    label: "Cobalt LME",
    value: 27450,
    changePct: +1.24,
    unit: "USD/t",
  },
];

function ScrollingTicker({ items }: { items: TickerItem[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border/40 bg-card/60">
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 36s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-track py-1.5">
        {doubled.map((item, i) => {
          const pos = item.changePct >= 0;
          return (
            <div
              key={`${item.id}-${i}`}
              className="flex items-center gap-2 px-6 whitespace-nowrap select-none border-r border-border/30 last:border-0"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0 mt-px",
                  pos ? "bg-success" : "bg-destructive",
                )}
              />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-foreground">
                  {item.label}
                </span>
                {item?.isin && (
                  <span className="text-[9px] font-normal text-muted-foreground">
                    {item.isin}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold tabular-nums text-blue-400">
                {item.value.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {item.unit && (
                  <span className="text-[9px] font-normal text-muted-foreground ml-1">
                    {item.unit}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  pos ? "bg-success text-black" : "bg-destructive text-white",
                )}
              >
                {pos ? "+" : ""}
                {item.changePct.toFixed(2)} %
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const [peerGroup, setPeerGroup] = useState("Banques centrales africaines");
  const [usdcdf, setUsdcdf] = useState<number>(APP_SETTINGS_DEFAULTS.usdcdf);
  const [goldPx, setGoldPx] = useState<number>(APP_SETTINGS_DEFAULTS.gold);
  const [copperPx, setCopper] = useState<number>(APP_SETTINGS_DEFAULTS.copper);

  const [liveGold, setLiveGold] = useState<number>(APP_SETTINGS_DEFAULTS.gold);
  const [liveCopper, setLiveCopper] = useState<number>(
    APP_SETTINGS_DEFAULTS.copper,
  );
  const [liveCdf, setLiveCdf] = useState<number>(APP_SETTINGS_DEFAULTS.usdcdf);

  const init = (id: string) => TICKERS.find((t) => t.id === id)!.value;
  const [liveBrent, setLiveBrent] = useState<number>(init("brent"));
  const [liveUst, setLiveUst] = useState<number>(init("ust10y"));
  const [liveDxy, setLiveDxy] = useState<number>(init("dxy"));
  const [liveGoldVol, setLiveGoldVol] = useState<number>(init("goldvol"));
  const [liveMove, setLiveMove] = useState<number>(init("move"));

  const router = useRouter();

  useEffect(() => {
    const s = readAppSettings();
    setUsdcdf(s.usdcdf);
    setGoldPx(s.gold);
    setCopper(s.copper);
    setLiveGold(s.gold);
    setLiveCopper(s.copper);
    setLiveCdf(s.usdcdf);
  }, []);

  useEffect(() => {
    const d1 = () => parseFloat((Math.random() * 2 - 1).toFixed(2));
    const id = setInterval(() => {
      setLiveGold((v) => parseFloat((v + d1()).toFixed(2)));
      setLiveCopper((v) => parseFloat((v + d1()).toFixed(2)));
      setLiveCdf((v) => parseFloat((v + d1()).toFixed(2)));
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const d2 = () => parseFloat(((Math.random() - 0.5) * 0.2).toFixed(2));
    const id = setInterval(() => {
      setLiveBrent((v) => parseFloat((v + d2()).toFixed(2)));
      setLiveUst((v) => parseFloat((v + d2()).toFixed(2)));
      setLiveDxy((v) => parseFloat((v + d2()).toFixed(2)));
      setLiveGoldVol((v) => parseFloat((v + d2()).toFixed(2)));
      setLiveMove((v) => parseFloat((v + d2()).toFixed(2)));
    }, 8_000);
    return () => clearInterval(id);
  }, []);

  // Counterparties are not allowed to see Market Oversight — send them to their
  // own dashboard immediately, before any content is painted.
  const { data: accessData } = useSWR<{
    role: string | null;
    roleLabel: string | null;
  }>("/api/access/me", fetcher);
  useEffect(() => {
    if (
      accessData?.role &&
      isCounterpartyRole({ key: accessData.role, label: accessData.roleLabel })
    ) {
      router.replace("/transactions");
    }
  }, [accessData, router]);

  // Prevent a flash of Market Oversight while the role is being resolved.
  if (!accessData) return null;
  if (
    accessData.role &&
    isCounterpartyRole({ key: accessData.role, label: accessData.roleLabel })
  ) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            title="Market Oversight"
            subtitle="Surveillance des marchés, indicateurs clés et benchmarks internationaux"
          />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[1600px] space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Dernière mise à jour : 19/06/2026 09:30</span>
                <span className="flex items-center gap-1.5 text-success font-medium">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse inline-block" />
                  Données à jour
                </span>
              </div>
              {/* SCROLLING TICKER */}
              <ScrollingTicker
                items={[
                  ...TICKER_STATIC,
                  {
                    id: "gold-tk",
                    label: "Or XAU/USD",
                    value: liveGold,
                    changePct: 0.79,
                    unit: "USD/oz",
                  },
                  {
                    id: "copper-tk",
                    label: "Cuivre LME",
                    value: liveCopper,
                    changePct: -0.56,
                    unit: "USD/t",
                  },
                ]}
              />

              {/* MARKET PULSE */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Market Pulse
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
                  {TICKERS.map((t) => {
                    const LIVE: Record<string, number> = {
                      gold: liveGold,
                      copper: liveCopper,
                      cdfusd: liveCdf,
                      brent: liveBrent,
                      ust10y: liveUst,
                      dxy: liveDxy,
                      goldvol: liveGoldVol,
                      move: liveMove,
                    };
                    const v = LIVE[t.id];
                    return (
                      <TickerCard
                        key={t.id}
                        t={v !== undefined ? { ...t, value: v } : t}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 3-COLUMN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                {/* LEFT (3/10) */}
                <div className="lg:col-span-3 space-y-4">
                  {/* A. FX */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        A. FX &amp; Taux Directeurs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left pb-1 font-medium">
                                Paire
                              </th>
                              <th className="text-right pb-1 font-medium">
                                Cours
                              </th>
                              <th className="text-right pb-1 font-medium">
                                Var. J-1
                              </th>
                              <th className="text-right pb-1 font-medium">
                                Var. 1M
                              </th>
                              <th className="pb-1 pl-2 font-medium">Tend.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {FX_ROWS.map((row) => {
                              const r =
                                row.pair === "USD / CDF"
                                  ? { ...row, rate: liveCdf }
                                  : row;
                              const pos1 = r.d1 >= 0;
                              const pos1m = r.m1 >= 0;
                              return (
                                <tr
                                  key={r.pair}
                                  className="border-b border-border/50 last:border-0"
                                >
                                  <td className="py-1.5">
                                    <p className="font-medium">{r.pair}</p>
                                    {r.sub && (
                                      <p className="text-[9px] text-muted-foreground">
                                        {r.sub}
                                      </p>
                                    )}
                                  </td>
                                  <td className="text-right py-1.5 font-mono tabular-nums">
                                    {r.rate.toLocaleString("fr-FR", {
                                      minimumFractionDigits: r.decimals,
                                      maximumFractionDigits: r.decimals,
                                    })}
                                  </td>
                                  <td
                                    className={cn(
                                      "text-right py-1.5 font-medium",
                                      pos1
                                        ? "text-success"
                                        : "text-destructive",
                                    )}
                                  >
                                    {pos1 ? "+" : ""}
                                    {r.d1.toLocaleString("fr-FR", {
                                      minimumFractionDigits: r.d1dec,
                                      maximumFractionDigits: r.d1dec,
                                    })}
                                  </td>
                                  <td
                                    className={cn(
                                      "text-right py-1.5 font-medium",
                                      pos1m
                                        ? "text-success"
                                        : "text-destructive",
                                    )}
                                  >
                                    {pos1m ? "+" : ""}
                                    {r.m1.toFixed(2)} %
                                  </td>
                                  <td className="py-1.5 pl-2">
                                    <Sparkline
                                      data={r.sparkline}
                                      color={pos1 ? "#22c55e" : "#ef4444"}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* C. Commodity */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        C. Commodity &amp; External Outlook
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left pb-1 font-medium">
                              Indicateur
                            </th>
                            <th className="text-right pb-1 font-medium">
                              Niveau
                            </th>
                            <th className="text-right pb-1 font-medium">J-1</th>
                            <th className="text-right pb-1 font-medium">1M</th>
                            <th className="pb-1 pl-1 font-medium">Tend.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {COMMODITY_ROWS.map((row) => {
                            const lvl = row.label.startsWith("Gold")
                              ? liveGold
                              : row.label.startsWith("Copper")
                                ? liveCopper
                                : row.level;
                            const r =
                              lvl !== row.level ? { ...row, level: lvl } : row;
                            const pd1 = r.d1 >= 0;
                            const pm1 = r.m1 >= 0;
                            return (
                              <tr
                                key={r.label}
                                className="border-b border-border/50 last:border-0"
                              >
                                <td className="py-1.5 pr-2 text-[10px]">
                                  {r.label}
                                </td>
                                <td className="text-right py-1.5 font-mono tabular-nums">
                                  {r.level.toLocaleString("fr-FR", {
                                    minimumFractionDigits: r.levelDec,
                                    maximumFractionDigits: r.levelDec,
                                  })}
                                </td>
                                <td
                                  className={cn(
                                    "text-right py-1.5 font-medium",
                                    pd1 ? "text-success" : "text-destructive",
                                  )}
                                >
                                  {pd1 ? "+" : ""}
                                  {r.d1.toFixed(2)} %
                                </td>
                                <td
                                  className={cn(
                                    "text-right py-1.5 font-medium",
                                    pm1 ? "text-success" : "text-destructive",
                                  )}
                                >
                                  {pm1 ? "+" : ""}
                                  {r.m1.toFixed(2)} %
                                </td>
                                <td className="py-1.5 pl-1">
                                  {pd1 ? (
                                    <TrendingUp className="h-3 w-3 text-success" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-destructive" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5">
                        <p className="text-[11px] font-semibold">
                          Lecture de l&apos;environnement externe
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Hausse de l&apos;or et stabilité du cuivre. Brent en
                          hausse modérée. Environnement globalement neutre à
                          légèrement favorable pour les réserves.
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold text-success border-success/50"
                        >
                          NEUTRE / LÉGÈREMENT FAVORABLE
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* MIDDLE (4/10) */}
                <div className="lg:col-span-4 space-y-4">
                  {/* B. Marché Monétaire BCC */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        B. Marché Monétaire BCC
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Bons BCC
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left pb-1 font-medium pr-2">
                                Maturité
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Taux (%)
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Var. (pb)
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Annoncé
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Soumissions
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Retenu
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                BTC
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Satisf. %
                              </th>
                              <th className="text-right pb-1 font-medium pr-2">
                                Encours
                              </th>
                              <th className="text-right pb-1 font-medium">
                                Proch. adj.
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {BONS_BCC.map((row) => (
                              <tr
                                key={row.maturity}
                                className="border-b border-border/50 last:border-0"
                              >
                                <td className="py-1.5 pr-2 font-medium">
                                  {row.maturity}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.rate.toFixed(2)}
                                </td>
                                <td className="text-right py-1.5 pr-2 text-destructive font-medium">
                                  +{row.varPb}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.announced}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.submissions.toLocaleString("fr-FR")}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.retained}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.btc.toFixed(2)}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.satisfaction.toFixed(1)}
                                </td>
                                <td className="text-right py-1.5 pr-2 tabular-nums">
                                  {row.encours.toLocaleString("fr-FR", {
                                    minimumFractionDigits: 1,
                                  })}
                                </td>
                                <td className="text-right py-1.5 text-muted-foreground">
                                  {row.nextAuction}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Indicateurs de liquidité &amp; environnement monétaire
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {LIQUIDITY_KPIS.map((kpi) => (
                            <div
                              key={kpi.label}
                              className="rounded-md border border-border bg-card p-2 space-y-0.5"
                            >
                              <p className="text-[9px] text-muted-foreground leading-tight">
                                {kpi.label}
                              </p>
                              <p className="text-sm font-bold tabular-nums">
                                {kpi.value}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] font-medium",
                                  kpi.positive === true
                                    ? "text-success"
                                    : kpi.positive === false
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                                )}
                              >
                                {kpi.change}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* D. Peer & Reserve Benchmarks */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                          D. Peer &amp; Reserve Benchmarks
                        </CardTitle>
                        <Select value={peerGroup} onValueChange={setPeerGroup}>
                          <SelectTrigger className="h-6 text-[10px] w-auto min-w-[190px] px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PEER_GROUPS.map((g) => (
                              <SelectItem key={g} value={g} className="text-xs">
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] whitespace-nowrap">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left pb-1 font-medium pr-3">
                                Indicateur
                              </th>
                              {PEER_COUNTRIES.map((c, i) => (
                                <th
                                  key={c}
                                  className={cn(
                                    "text-right pb-1 font-medium pr-2",
                                    i === 0 && "text-foreground",
                                  )}
                                >
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {PEER_ROWS.map((row) => (
                              <tr
                                key={row.label}
                                className="border-b border-border/50 last:border-0"
                              >
                                <td className="py-1.5 pr-3 text-muted-foreground">
                                  {row.label}
                                </td>
                                {row.values.map((v, i) => (
                                  <td
                                    key={i}
                                    className={cn(
                                      "text-right py-1.5 pr-2 tabular-nums",
                                      i === 0 &&
                                        "font-semibold text-foreground",
                                    )}
                                  >
                                    {row.fmt(v)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-3 leading-relaxed">
                        Sources : Banques centrales, FMI (IFS), World Gold
                        Council, Bloomberg, rapports annuels.
                        <br />
                        Dernières données disponibles entre avr. et juin 2026
                        selon les pays.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT (3/10) */}
                <div className="lg:col-span-3 space-y-4">
                  {/* E. Matrice des Signaux */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        E. Matrice des Signaux
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left pb-1 font-medium">
                              Facteur
                            </th>
                            <th className="text-left pb-1 font-medium">
                              Situation
                            </th>
                            <th className="text-right pb-1 font-medium">
                              Signal
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {SIGNAL_ROWS.map((row) => (
                            <tr
                              key={row.factor}
                              className="border-b border-border/50 last:border-0"
                            >
                              <td className="py-1.5 font-medium">
                                {row.factor}
                              </td>
                              <td className="py-1.5 text-muted-foreground text-[10px]">
                                {row.situation}
                              </td>
                              <td className="py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span
                                    className={cn(
                                      "text-[10px] font-medium",
                                      row.signal === "favorable"
                                        ? "text-success"
                                        : row.signal === "warning"
                                          ? "text-yellow-400"
                                          : "text-destructive",
                                    )}
                                  >
                                    {row.signal === "favorable"
                                      ? "Favorable"
                                      : row.signal === "warning"
                                        ? "Surveillance"
                                        : "Défavorable"}
                                  </span>
                                  <SignalDot signal={row.signal} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* F. Alertes */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        F. Alertes Prioritaires
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {ALERTS.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0"
                        >
                          <AlertIcon level={a.level} />
                          <p className="text-[11px] flex-1 leading-snug">
                            {a.text}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {a.time}
                          </span>
                        </div>
                      ))}
                      <button className="text-[10px] text-primary hover:underline pt-1">
                        Voir toutes les alertes (12)
                      </button>
                    </CardContent>
                  </Card>

                  {/* G. Calendrier */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        G. Calendrier
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {CALENDAR_EVENTS.map((ev, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0"
                        >
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-muted-foreground">
                              {ev.date}
                            </p>
                            <p className="text-[11px] leading-snug">
                              {ev.label}
                            </p>
                          </div>
                        </div>
                      ))}
                      <button className="text-[10px] text-primary hover:underline pt-1">
                        Voir le calendrier complet
                      </button>
                    </CardContent>
                  </Card>

                  {/* Actions Rapides */}
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-[11px] font-bold uppercase tracking-wide">
                        Actions Rapides
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] justify-start truncate"
                          onClick={() => router.push("/monetary-policy")}
                        >
                          Ouvrir R1 Allocation
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] justify-start truncate"
                        >
                          Courbes &amp; Perspectives
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] justify-start truncate"
                          onClick={() => router.push("/monetary-policy")}
                        >
                          Màj H1 Impact Macro
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] justify-start truncate"
                        >
                          Màj H2 Liquidité
                        </Button>
                      </div>
                      <Button className="w-full h-8 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white">
                        <Zap className="mr-2 h-3.5 w-3.5" />
                        Générer la note quotidienne de marché
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
