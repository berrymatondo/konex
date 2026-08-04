"use client";

import { useState, type ElementType } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateDocumentationPDF,
  generateCahierDesChargesPDF,
} from "@/lib/pdf-generator";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  UserPlus,
  CheckSquare,
  Shield,
  ShoppingCart,
  FlaskConical,
  Banknote,
  FileText,
  History,
  Settings,
  UserCog,
  ChevronRight,
  Database,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Code,
  Building2,
  Package,
  Truck,
  Warehouse,
  Download,
  Calendar,
  FileDown,
  FileSpreadsheet,
  Landmark,
  Activity,
  ArrowLeftRight,
  Sliders,
  Inbox,
  GitMerge,
  PieChart,
  TrendingUp,
  Factory,
} from "lucide-react";

// Documentation content
const documentationSections = {
  en: {
    title: "Application Documentation",
    subtitle:
      "Complete guide for the Gold Acquisition Platform - Central Bank of DR Congo",
    overview: {
      title: "Platform Overview",
      description:
        "The Gold Acquisition Platform (GAP) is a comprehensive compliance and trading system designed for central banks to manage gold purchases from artisanal and large-scale mining operations. It implements LBMA Responsible Gold Guidance (RGG) standards and ensures full regulatory compliance.",
      keyFeatures: [
        "Counterparty onboarding with KYC/AML screening",
        "Automated preliminary compliance scoring ",
        "Risk-based due diligence workflow ",
        "Purchase order management with dual approval ",
        "Assay verification and settlement processing",
        "Complete audit trail and regulatory reporting",
      ],
    },
    pages: [
      {
        id: "dashboard",
        name: "Dashboard",
        route: "/",
        icon: LayoutDashboard,
        category: "Main",
        businessDescription:
          "The central command center providing real-time visibility into gold acquisition operations. Displays key performance indicators (KPIs) including active counterparties, pending purchase orders, gold in transit, and monthly acquisition volumes. Enables quick decision-making through at-a-glance metrics.",
        technicalDescription:
          "Server-side rendered page fetching aggregated data from multiple database tables (counterparties, purchase_orders, assays, settlements). Uses SWR for client-side data refresh. Implements responsive grid layout with Card components for KPI display.",
        userStory: "N/A",
        dataFlow:
          "API: /api/dashboard → Aggregates from counterparties, purchase_orders, assays tables",
        permissions: "All authenticated users",
      },
      {
        id: "counterparties",
        name: "Counterparties",
        route: "/counterparties",
        icon: Users,
        category: "Main",
        businessDescription:
          "Master list of all registered gold suppliers (mines, refiners, traders). Shows compliance status, risk level, and screening results for each entity. Supports filtering by status (Active, Pending Review, Pending Screening, Pending Risk Review, Blocked) and search functionality.",
        technicalDescription:
          "Client component with SWR data fetching from /api/counterparties. Implements DataTable pattern with sortable columns, pagination, and row actions. Status badges use color-coded system aligned with risk classification.",
        userStory: "N/A",
        dataFlow:
          "API: GET /api/counterparties → counterparties table with JOINs to screening_results, ubos",
        permissions: "Compliance Officer, Risk Manager",
      },
      {
        id: "counterparty-detail",
        name: "Counterparty Detail",
        route: "/counterparties/[id]",
        icon: Users,
        category: "Main",
        businessDescription:
          "Complete 360° view of a single counterparty including legal information, registration details, beneficial owners (UBOs), uploaded documents (certificates, licenses), screening history, and transaction summary. Critical for due diligence reviews.",
        technicalDescription:
          "Dynamic route with [id] parameter. Fetches counterparty data with related entities (UBOs, documents, screening_results). Tabbed interface for organized information display. Document viewer supports PDF preview.",
        userStory: "N/A",
        dataFlow:
          "API: GET /api/counterparties/[id] → counterparties + ubos + documents + screening_results",
        permissions: "Compliance Officer, Risk Manager",
      },
      {
        id: "onboarding",
        name: "Onboarding",
        route: "/onboarding",
        icon: UserPlus,
        category: "Main",
        businessDescription:
          "Multi-step wizard for registering new gold suppliers. Captures: legal entity information, registration numbers, jurisdiction, gold source types (ASM/LSM/Recycled), Ultimate Beneficial Owners with PEP flags, and required compliance documents. Initiates the KYC/AML screening process.",
        technicalDescription:
          "Stepper component managing form state across multiple pages. Form validation using Zod schema. File upload with drag-and-drop support. On completion, triggers POST to /api/counterparties creating entity with 'pending_screening' status.",
        userStory: "N/A",
        dataFlow:
          "POST /api/counterparties → Creates counterparty + ubos + documents records",
        permissions: "Compliance Officer",
      },
      {
        id: "screening",
        name: "Screening Results",
        route: "/screening/[id]",
        icon: Shield,
        category: "Main",
        businessDescription:
          "Compliance screening dashboard implementing the  Preliminary Compliance Score algorithm. Displays automated checks: Sanctions (blocking gate), PEP status (40% weight), Adverse Media (35% weight), and Jurisdiction Risk (25% weight). Calculates final score and risk classification (LOW 0-25, MEDIUM 26-60, HIGH 61-99, BLOCKED 100).",
        technicalDescription:
          "Interactive form allowing manual override of screening inputs. Real-time score calculation using weighted formula. Score breakdown visualization with progress indicators. Saves to screening_results table with SHA-256 hash for audit integrity.",
        userStory: "N/A",
        dataFlow:
          "GET/POST /api/screening/[id] → screening_results + screening_audit_log tables",
        permissions: "Compliance Officer",
        algorithm: `
Preliminary Score = (PEP × 0.40) + (AdverseMedia × 0.35) + (Jurisdiction × 0.25)

Where:
- PEP: 100 if PEP, 0 if not
- AdverseMedia: 0 (0 hits), 30 (1-2 hits), 60 (3-5 hits), 100 (6+ hits)
- Jurisdiction: 0-100 based on country risk + business type
- Sanctions: Blocking gate (Hit = automatic 100)

Classification:
- 0-25: LOW → PENDING_STANDARD_REVIEW
- 26-60: MEDIUM → PENDING_ENHANCED_REVIEW  
- 61-99: HIGH → PENDING_SENIOR_REVIEW
- 100: BLOCKED → AUTOMATIC_REJECTION
        `,
      },
      {
        id: "approval-queue",
        name: "Approval Queue",
        route: "/approval-queue",
        icon: CheckSquare,
        category: "Main",
        businessDescription:
          "Centralized workflow queue for counterparties awaiting compliance decisions. Groups entities by urgency and risk level. Enables batch processing of approvals/rejections. Shows time-in-queue metrics to ensure SLA compliance.",
        technicalDescription:
          "Filtered view of counterparties with status IN ('pending_review', 'pending_screening', 'pending_risk_review'). Sortable by created_at for FIFO processing. Action buttons trigger status transitions and audit log entries.",
        userStory: "N/A",
        dataFlow: "GET /api/approval-queue → Filtered counterparties query",
        permissions: "Compliance Officer, Senior Compliance Officer",
      },
      {
        id: "risk-management",
        name: "Risk Management",
        route: "/risk-management",
        icon: Shield,
        category: "Main",
        businessDescription:
          "Dashboard for comprehensive risk tier assignment per . Shows counterparties pending risk review, distribution of risk tiers across portfolio, and EDD (Enhanced Due Diligence) requirements. Entry point for detailed risk assessments.",
        technicalDescription:
          "Aggregates risk_assessments table data. Charts using Recharts for tier distribution visualization. Links to /risk-management/[id]/assess for individual assessments.",
        userStory: "N/A",
        dataFlow:
          "GET /api/risk-assessments → risk_assessments + counterparties tables",
        permissions: "Risk Manager, Senior Compliance Officer",
      },
      {
        id: "risk-assessment",
        name: "Risk Assessment",
        route: "/risk-management/[id]/assess",
        icon: Shield,
        category: "Main",
        businessDescription:
          "Detailed risk scoring interface implementing  algorithm. Evaluates: Country Risk (30%), Source Type (25%), UBO/PEP (20%), Transaction History (15%), Feed Confidence (10%). Applies automatic flags for ASM/Mercury exposure (+15) and CAHRA zones (+20). Triggers EDD workflow for HIGH/CRITICAL results.",
        technicalDescription:
          "Form with sliders and dropdowns for each risk factor. Real-time score calculation with weighted sum. Mandatory acknowledgment checkboxes for policy compliance. Creates risk_assessments record and audit log entry on submission.",
        userStory: "N/A",
        dataFlow:
          "POST /api/risk-assessments → risk_assessments + risk_audit_log tables",
        permissions: "Risk Manager",
        algorithm: `
Risk Score = (Country × 0.30) + (Source × 0.25) + (PEP × 0.20) + (Volume × 0.15) + (FeedConfidence × 0.10)

Automatic Bonuses:
- ASM/Mercury Flag: +15 points
- CAHRA Zone: +20 points

Risk Tiers:
- 0-25: LOW
- 26-50: MEDIUM
- 51-75: HIGH
- 76-100: CRITICAL

EDD Required: HIGH or CRITICAL tier, or ASM/Mercury exposure
        `,
      },
      {
        id: "risk-feeds",
        name: "Risk Feeds",
        route: "/risk-management/feeds",
        icon: Database,
        category: "Main",
        businessDescription:
          "Configuration panel for external risk data feed integrations. Manages connections to: CAHRA country lists, Country Risk Index, Mercury/Minamata database, and Sanctions lists. Allows weight adjustment for each feed's contribution to risk scores.",
        technicalDescription:
          "Admin interface for risk_feed_configs table. Displays sync status, last update timestamps, and confidence levels. Manual sync triggers via POST to /api/risk-feeds/sync.",
        userStory: "N/A",
        dataFlow: "GET/POST /api/risk-feeds → risk_feed_configs table",
        permissions: "System Administrator, Risk Manager",
      },
      {
        id: "risk-audit",
        name: "Risk Audit Log",
        route: "/risk-management/audit-log",
        icon: History,
        category: "Main",
        businessDescription:
          "Immutable audit trail of all risk decisions per LBMA RGG requirements. Records: tier assignments, tier changes, overrides, and approvals. Includes actor identification, timestamps, IP addresses, and cryptographic hashes for tamper-evidence.",
        technicalDescription:
          "Paginated query of risk_audit_log table with filters for action type, date range, and counterparty. Each entry includes SHA-256 hash of previous record for chain verification. Export functionality for regulatory reporting.",
        userStory: "N/A",
        dataFlow: "GET /api/risk-audit-log → risk_audit_log table",
        permissions: "Compliance Officer, Auditor (read-only)",
      },
      {
        id: "monetary-policy",
        name: "Monetary Policy",
        route: "/monetary-policy",
        icon: Landmark,
        category: "Main",
        businessDescription:
          "Read-only Balance Sheet Impact Simulator (MP-01). Lets policy analysts model how a proposed gold acquisition would affect the central bank's pro-forma balance sheet under different funding scenarios (Reserve Drawdown, Bond Issuance, FX Swap, External Borrowing). Auto-calculates key policy ratios (Gold/Reserves, LCR, Leverage, Capital Adequacy), compares funding scenarios with weighted scoring and a radar chart, and produces an exportable committee package. Strictly a simulation — it never modifies actual ledger data (all outputs labeled 'SIMULATION - NOT EXECUTED').",
        technicalDescription:
          "Client-side 5-step wizard (Scenario Library → Configuration → Pro-Forma → Comparison → Export). Pure simulation logic in lib/monetary-policy.ts (simulateBalanceSheetImpact, computeRatios, compareScenarios). Radar chart built with Recharts via shadcn ChartContainer. Constraint validation enforces the ≤10% of reserves and T+2 settlement rules. Export step computes a real SHA-256 integrity hash via crypto.subtle. No database writes.",
        userStory: "MP-01 Screens 0-4",
        dataFlow:
          "In-memory only: BASELINE_BALANCE_SHEET + SCENARIO_TEMPLATES (lib/monetary-policy.ts). No persistence; future integration: GET /api/v1/balance-sheet/current, POST /api/v1/monetary-policy/simulate.",
        permissions: "Risk Manager, Administrator",
        algorithm: `
Gold Increase (USD M) = purchaseAmountOz × pricePerOz / 1,000,000

Funding source effect on pro-forma:
- RESERVE_DRAWDOWN:   foreignReserves   -= goldIncrease (asset swap)
- BOND_ISSUANCE:      bondsOutstanding  += goldIncrease
- FX_SWAP:            fxSwaps           += goldIncrease
- EXTERNAL_BORROWING: externalBorrowing += goldIncrease

Key Ratios:
- Gold/Reserves   = gold / (gold + foreignReserves)
- LCR             = HQLA / netCashOutflows(30d)
- Leverage        = totalAssets / equity
- CapitalAdequacy = equity / totalAssets

Composite Score = Σ (objectiveWeight × normalizedObjectiveScore) / Σ weights
(objectives min-max normalized across scenarios; cost efficiency inverted)

Constraints: purchase ≤ 10% of total reserves per transaction; settlement ≥ T+2.
        `,
      },
      {
        id: "impact-macro",
        name: "Macro Impact Simulator",
        route: "/impact-macro",
        icon: Activity,
        category: "Main",
        businessDescription:
          "Monetary Impact Simulator for the BCC artisanal gold purchase programme (since Feb 2026). Models seven macroeconomic transmission channels across a multi-year horizon: base-money creation, broad-money growth (M2/M3) via the deposit multiplier, banking-system liquidity and sterilisation needs, inflation (money-growth elasticity + FX pass-through), exchange-rate dynamics (depreciation pressure vs. reserve-confidence effect), gross international reserves and import cover, and central-bank balance-sheet risk (sterilisation quasi-fiscal cost). Features include: full scenario library with save/load/export/import stored in localStorage, sensitivity sweep (up to 37 simulations across a single input axis), banking-system liquidity breakdown chart, mark-to-market stress test on the balance sheet, dual-axis historical chart (Jan 2024 – Jul 2026 actuals), and a Methodology tab exposing all model equations. Bilingual (EN/FR) throughout. Purely client-side — no server or database writes.",
        technicalDescription:
          "Single `\"use client\"` file (`app/impact-macro/page.tsx`, ~1 800 lines). Simulation engine (`simulate`) runs a per-year loop over 26 `SimInputs` fields, deriving: derived money multiplier `(1+c)/(c+r+e)`, net CDF injection after sterilisation, FX pressure model with leakage fraction dampened by reserve confidence and BCC intervention, inflation as `baseInflation + M2-growth×elasticity + netFX×passThrough`. `decisionMetrics` compares against a zero-gold baseline and checks constraints (`inflationCeilingPct`, `importCoverFloorMonths`). Charts use Recharts (`LineChart`, `BarChart`, `ComposedChart`, stacked bars via `stackId`). Scenario persistence: `localStorage` under keys `bccgold.v1.index` and `bccgold.v1.scenario.<id>`, with save/save-as/export-JSON/import-JSON/archive/delete. Sensitivity sweep (`sweepData` useMemo) runs the full simulation N times (up to 37) across a configured input range. Balance-sheet stress applies user-defined gold-volatility, inflation cap, and import-cover floor. UI: shadcn `Tabs`, `Slider`, `Dialog`, `ScrollArea`, `Badge`, `Textarea`; `useLanguage` from `@/lib/i18n/language-context` for FR/EN toggle; `AppHeader` with title + subtitle.",
        userStory: "MAC-01",
        dataFlow:
          "Fully in-memory. Scenario state persisted to localStorage (keys: `bccgold.v1.index`, `bccgold.v1.scenario.*`). No API calls; no database reads or writes.",
        permissions: "Risk Manager, Administrator, Central Bank Analyst",
        algorithm: `
Key constants:
  TROY_OZ_PER_TONNE = 32 150.7547

Derived money multiplier:
  mm = (1 + c) / (c + r + e)
  where c = currency-to-deposit ratio,
        r = required-reserve ratio,
        e = excess-reserve propensity

Annual simulation loop (y = 1 … horizonYears):
  goldValueUSD  = tonnes × fineness × TROY_OZ_PER_TONNE × priceUSD_y
  baseInjCDF    = goldValueUSD × exchangeRate
  sterilCDF     = baseInjCDF × sterilizationPct / 100
  netInjCDF     = baseInjCDF − sterilCDF

  domesticInj   = netInjCDF × (1 − leakagePct/100)
  fxLeakage     = netInjCDF × leakagePct/100

  deltaM2       = domesticInj × (mm − 1)
  m2GrowthPct   = deltaM2 / prevM2 × 100

  fxPressureRaw = (fxLeakage / prevM2) × fxPressureScaling × 100
  reserveDamp   = fxPressureRaw × (goldValueUSD / reserves) × reserveConfidenceOffset
  netFXBeforeIntv = max(0, fxPressureRaw − reserveDamp)
  netFXchange   = netFXBeforeIntv × (1 − bccFXInterventionPct/100)

  inflation     = baseInflation + m2GrowthPct × elasticity + netFXchange × passThrough
  exchangeRate  = exchangeRate × (1 + (fxDepreciationBase + netFXchange) / 100)

  reserves      = reservesInit + cumGoldHoldingsUSD
  importCover   = reserves / importsPerMonth
  sterilCost    = sterilCDF × sterilizationRate/100

Decision constraints:
  - inflation  > inflationCeilingPct   → constraint violated
  - importCover < importCoverFloorMonths → constraint violated

Banking-system liquidity split:
  sterilized     = sterilCDF
  addlReserves   = (r / denom) × netInjCDF
  freeLiquidity  = (e / denom) × netInjCDF
  currency       = (c / denom) × netInjCDF
  where denom = c + r + e
`,
      },
      {
        id: "purchase-orders",
        name: "Purchase Orders",
        route: "/purchase-orders",
        icon: ShoppingCart,
        category: "Operations",
        businessDescription:
          "Central registry of all gold purchase orders. Tracks order lifecycle from Draft → Submitted → Pending Approval → Approved → In Transit → Received. Displays estimated values, LBMA pricing, and delivery status.",
        technicalDescription:
          "DataTable component fetching from /api/purchase-orders with JOINs to counterparties for supplier details. Status-based filtering and sorting by date/value. Row actions for view/edit/cancel operations.",
        userStory: "N/A",
        dataFlow:
          "GET /api/purchase-orders → purchase_orders + counterparties tables",
        permissions: "Trader, Compliance Officer",
      },
      {
        id: "purchase-order-new",
        name: "Create Purchase Order",
        route: "/purchase-orders/new",
        icon: ShoppingCart,
        category: "Operations",
        businessDescription:
          "Order entry form for new gold acquisitions. Enforces  compliance gate: only APPROVED counterparties with completed EDD (if HIGH risk) can be selected. Captures: estimated weight, gold type (Doré/Bullion), purity range, Incoterms, delivery vault, expected dispatch date. Integrates real-time LBMA pricing with 15-minute lock window.",
        technicalDescription:
          "Multi-step form with counterparty selector filtered by status/EDD completion. Price calculator component fetching live LBMA rates. Timer component for price lock expiry. Draft save functionality for incomplete orders.",
        userStory: "N/A",
        dataFlow: "POST /api/purchase-orders → purchase_orders table",
        permissions: "Trader",
        businessRules: [
          "Counterparty status must be 'active' or 'approved'",
          "HIGH risk counterparties require completed EDD",
          "Price lock expires after 15 minutes",
          "Orders >$1M require dual approval",
        ],
      },
      {
        id: "purchase-order-detail",
        name: "Purchase Order Detail",
        route: "/purchase-orders/[id]",
        icon: ShoppingCart,
        category: "Operations",
        businessDescription:
          "Complete order management interface with three tabs: Details (order summary), Approval (dual-approval workflow for >$1M transactions), and Tracking (dispatch monitoring with timeline). Implements  compliance gate with real-time sanctions re-check before approval.",
        technicalDescription:
          "Tabbed interface with dynamic content based on order status. Approval tab shows OTP/MFA input for second approver. Tracking tab displays shipment timeline with QR code for tracking ID. Status transitions trigger audit log entries.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/purchase-orders/[id] → purchase_orders + po_approvals tables",
        permissions: "Trader, Compliance Officer, Senior Approver",
      },
      {
        id: "dispatch",
        name: "Dispatch",
        route: "/dispatch",
        icon: Truck,
        category: "Operations",
        businessDescription:
          "Pre-shipment documentation and dispatch validation module . Central hub for validating export documents, shipping manifests, and customs clearance before gold dispatch. Tracks validation status from pending documents through final dispatch confirmation. Ensures regulatory compliance before handoff to vault intake.",
        technicalDescription:
          "Dashboard showing all dispatch validations with status indicators. Filterable by status (pending_docs, docs_validated, pending_authorization, dispatched, in_transit). Links to detailed validation workflow pages. Integrates with purchase_orders table for PO data.",
        userStory: "N/A",
        dataFlow:
          "GET /api/dispatch �� dispatch_validations table + purchase_orders JOINs",
        permissions: "Trade Compliance Officer",
      },
      {
        id: "dispatch-detail",
        name: "Dispatch Validation",
        route: "/dispatch/[id]",
        icon: Truck,
        category: "Operations",
        businessDescription:
          "Four-stage pre-shipment validation workflow implementing : (1) Document Upload & Validation - validates export license, certificate of origin, transport docs, and insurance against PO terms; (2) Manifest & Customs Check - verifies weight tolerances (±5%), seal numbers, and customs pre-clearance; (3) Dispatch Authorization - carrier assignment with dual-approval for >$1M shipments; (4) Dispatch Confirmation - success screen with tracking ID and  handoff trigger.",
        technicalDescription:
          "Tabbed interface with 4 stages matching  screens. Document validation uses OCR simulation for metadata extraction. Weight tolerance gauge uses SVG semi-circle visualization. Dual approval implements signature + OTP pattern. Authorization generates SHA-256 hash for immutability. On dispatch, triggers transition to in_transit status.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/dispatch/[id] + POST /api/dispatch/[id]/authorize → dispatch_validations + dispatch_documents + dispatch_audit_log tables",
        permissions: "Trade Compliance Officer, Authorized Signer",
        algorithm: `
Document Validation:
- Export License: Must be valid (not expired) and from recognized authority
- Certificate of Origin: Must match PO origin country
- Transport Docs: Must specify secure carrier and route
- Insurance: Insured value must be ≥ PO amount

Weight Tolerance:
- ≤5% variance: Auto-approve
- 5-10% variance: Compliance Officer sign-off required
- >10% variance: Auto-hold, investigation required

Dispatch Authorization:
- Cryptographically signed with SHA-256 hash
- Dual approval required for shipments >$1M USD
- Each approver must complete MFA/OTP authentication
- Segregation of duties enforced (different approvers)
        `,
        businessRules: [
          "No dispatch without all documents validated",
          "Customs clearance required for both origin and destination",
          "CAHRA routing triggers EDD re-review",
          "Dual approval for >$1M or HIGH-risk counterparties",
          "Authorization hash immutable once created",
          "Carrier pickup triggers automatic  transition",
        ],
      },
      {
        id: "vault-intake",
        name: "Vault Intake",
        route: "/vault-intake",
        icon: Warehouse,
        category: "Operations",
        businessDescription:
          "Physical gold receipt and chain-of-custody initiation . Central hub for logging vault receipts from dispatched shipments. Tracks receipt status from pending intake through assay completion to settlement handoff. Integrates with  dispatch data and feeds into  settlement.",
        technicalDescription:
          "Dashboard showing all vault intakes with status indicators. Filterable by status (pending_intake, received, assay_scheduled, assayed, pending_settlement). Links to detailed 4-stage workflow pages. Integrates with dispatch_validations and purchase_orders tables.",
        userStory: "N/A",
        dataFlow:
          "GET /api/vault-intake → vault_intakes table + dispatch_validations JOINs",
        permissions: "Vault Operator, Assay Coordinator",
      },
      {
        id: "vault-intake-detail",
        name: "Vault Intake Validation",
        route: "/vault-intake/[id]",
        icon: Warehouse,
        category: "Operations",
        businessDescription:
          "Four-stage vault intake workflow implementing : (1) Receipt Logging - PO/tracking lookup, seal verification vs manifest, gross/net weight recording with ±5% tolerance gauge, photo evidence upload, operator OTP authentication; (2) Assay Scheduling - ISO 17025 lab selection with accreditation expiry, sample ID generation with barcode, Fire Assay/XRF method selection, courier tracking timeline, SLA countdown timer; (3) Purity Verification - certificate upload with OCR, purity breakdown (Au/Ag/Cu/Fe %), pure gold weight calculation, variance comparison with tolerance bands; (4) Settlement Handoff - allocation summary, status transition (RECEIVED → ASSAYED → PENDING_SETTLEMENT), SHA-256 audit hash, LBMA RGG compliance badge.",
        technicalDescription:
          "Tabbed interface with 4 stages matching  screens. Weight tolerance gauge uses SVG semi-circle visualization. Assay lab selector validates ISO 17025 accreditation. Purity variance bar shows ±0.1g (green), ±0.1-0.3g (yellow), >±0.3g (red) thresholds. On lock, generates immutable SHA-256 hash and triggers  settlement handoff.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/vault-intake/[id] + POST /api/assay/dispatch → vault_intakes + assay_samples + custody_log + audit_trail tables",
        permissions: "Vault Operator, Assay Coordinator, Quality Controller",
        algorithm: `
Weight Tolerance (Receipt):
- ≤5% variance: Auto-approve
- 5-10% variance: Supervisor sign-off required  
- >10% variance: Auto-lock PO, route to Compliance

Assay Lab Validation:
- ISO 17025 certificate must be valid (not expired)
- Suspended labs excluded from selector
- Split-sample protocol: 50% sent, 50% retained

Purity Variance (Assay Results):
- ≤2% variance: Auto-approve for settlement
- 2-5% variance: Risk Manager sign-off required
- >5% variance: Auto-hold, supplier dispute triggered

Settlement Handoff:
- Cryptographically sealed with SHA-256 hash
- Chain-of-custody locked (no modifications)
- Triggers  valuation with pure Au weight
        `,
        businessRules: [
          "Seal numbers must match shipping manifest exactly",
          "All photo evidence mandatory before intake record creation",
          "Operator MFA/OTP required for chain-of-custody sign-off",
          "Only LBMA-approved ISO 17025 labs accepted",
          "Split-sample retention required for dispute resolution",
          "Purity variance >2% requires Risk Manager approval",
          "Settlement handoff generates immutable audit hash",
        ],
      },
      {
        id: "assays",
        name: "Assays",
        route: "/assays",
        icon: FlaskConical,
        category: "Operations",
        businessDescription:
          "Laboratory assay results management. Records: batch number, gross/net weight, purity percentage, fine gold content, assay method, laboratory name. Links to vault intake records. Critical for settlement calculation and quality verification.",
        technicalDescription:
          "CRUD interface for assays table. Calculation helpers for fine gold weight (net weight × purity). PDF certificate upload and preview. Status workflow: Pending → Verified → Disputed.",
        userStory: "N/A",
        dataFlow:
          "GET/POST /api/assays → assays + vault_intakes + purchase_orders tables",
        permissions: "Operations Manager, Quality Controller",
      },
      {
        id: "settlements",
        name: "Settlements",
        route: "/settlements",
        icon: Banknote,
        category: "Operations",
        businessDescription:
          "Valuation, Settlement & Allocation Engine . Central hub for calculating final transaction value using verified assay data and LBMA pricing, executing dual-approved fund transfers to counterparties, and legally allocating pure gold weight into the central bank reserve ledger. Multi-currency settlement support (USD/EUR) with FX rate locking.",
        technicalDescription:
          "Dashboard showing all settlements with status indicators. Filterable by status (pending_valuation, pending_review, pending_approval, executed, allocated). Links to detailed 4-stage workflow pages. Integrates with vault_intakes, assays, and purchase_orders tables.",
        userStory: "N/A",
        dataFlow:
          "GET /api/settlements → settlements + vault_intakes + assays + counterparties tables",
        permissions: "Finance Officer, Treasury Manager, Reserve Manager",
      },
      {
        id: "settlement-detail",
        name: "Settlement Workflow",
        route: "/settlements/[id]",
        icon: Banknote,
        category: "Operations",
        businessDescription:
          "Four-stage settlement workflow implementing : (1) Pricing & Valuation Engine - LBMA AM/PM fixing integration, purity adjustment factor, premium/discount calculation, 15-minute price lock timer, currency selection (USD/EUR); (2) Settlement Calculation & Review - gross value display, deductions table (logistics, insurance, assay fees, withholding tax), counterparty banking details (IBAN/SWIFT), review checklist; (3) Dual Approval & Execution - settlement summary, Finance Officer + Treasury Director OTP slots, segregation of duties enforcement, Approve/Reject/Amend actions; (4) Allocation Confirmation - success banner with Settlement ID, reserve allocation entry (gold weight, account ID, valuation date, Posted & Locked status), title transfer certificate, SHA-256 audit hash, LBMA RGG compliance badge.",
        technicalDescription:
          "Tabbed interface with 4 stages matching  screens. Real-time LBMA rate fetching with price lock countdown. Dual-approval enforces segregation of duties (different RBAC roles). On execution, generates SHA-256 hash linking PO, Assay, Pricing, Settlement, and Allocation records. Reserve entry posted to central bank core ledger via secure API.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/settlements/[id] + POST /api/settlements/[id]/execute + POST /api/reserves/allocate → settlements + reserve_allocations + audit_trail tables",
        permissions: "Finance Officer, Treasury Director, Reserve Manager",
        algorithm: `
Valuation Formula:
- Pure Au Weight = Net Weight × (Au% / 100)
- Gross Value = Pure Au Weight × LBMA Rate (converted to troy oz)
- Net Payable = Gross Value - Total Deductions (logistics + insurance + assay + tax)
- All calculations rounded to 2 decimal places

Price Lock Rules:
- 15-minute validity window for selected LBMA fixing
- Contract terms enforce specific fixing (AM/PM on dispatch date)
- Manual refresh available if lock expires

Dual-Approval Threshold:
- >$1,000,000 USD requires two independent authorized signers
- Signers must hold distinct RBAC roles (Maker and Checker)
- Segregation of duties enforced (Approver 1 ≠ Approver 2)
- Each approver authenticates via MFA/OTP

Settlement Execution:
- Final sanctions/AML check on beneficiary bank account
- Payment instruction transmitted to Central Bank payment gateway
- No reversals permitted within module (corrections via )
        `,
        businessRules: [
          "Assay results must be locked before settlement proceeds",
          "LBMA fixing rate applied per contract terms (AM/PM)",
          "All deductions must be transparent and PO-authorized",
          "Dual-approval mandatory for >$1M transactions",
          "Beneficiary change requires Compliance re-approval",
          "Settlement generates immutable audit hash",
          "Reserve allocation posted to official monetary statistics",
          "Records retained ≥5 years per LBMA RGG",
        ],
      },
      {
        id: "reports",
        name: "Reports",
        route: "/reports",
        icon: FileText,
        category: "System",
        businessDescription:
          "Regulatory and management reporting center. Available reports: Acquisition Summary (monthly volumes), Counterparty Overview (portfolio composition), Gold Inventory (current holdings), Settlement Report (payment history), Compliance Audit (screening statistics), Risk Assessment (tier distribution).",
        technicalDescription:
          "Report generator with date range picker and export options (PDF, CSV, Excel). Server-side data aggregation for large datasets. Scheduled report functionality for automated delivery.",
        userStory: "N/A",
        dataFlow:
          "Various /api/reports/* endpoints aggregating multiple tables",
        permissions: "Compliance Officer, Finance Officer, Management",
      },
      {
        id: "audit",
        name: "Audit & Compliance",
        route: "/audit",
        icon: Shield,
        category: "System",
        businessDescription:
          "Immutable Audit Trail & Regulatory Export Engine . Central hub for auditors and compliance officers to retrieve tamper-evident transaction history, generate regulatory reports (FIU STR/SAR, IMF SDDS, LBMA Disclosure), and export data in multiple formats (JSON/CSV/XML) with digital signature attachment. Enforces ≥5-year retention policies per LBMA RGG.",
        technicalDescription:
          "Tabbed interface with 4 screens: (1) Immutable Audit Trail Viewer - chronological timeline with SHA-256 hash chain verification; (2) Regulatory Report Generator - auto-population from verified transaction data; (3) Export Configuration - format mapping with digital signature; (4) Compliance Dashboard - retention countdown, audit readiness score, system health indicators.",
        userStory: "N/A",
        dataFlow:
          "GET /api/audit/{transactionId} → audit_trail + all linked tables",
        permissions:
          "Auditor (read-only), Compliance Officer, Chief Compliance Officer",
      },
      {
        id: "audit-trail-viewer",
        name: "Immutable Audit Trail",
        route: "/audit#audit-trail",
        icon: Shield,
        category: "System",
        businessDescription:
          "Tamper-evident transaction history with chain verification ( Screen 1). Chronological, read-only display of every state change from counterparty onboarding through settlement. Each entry includes timestamp, actor ID, IP/device fingerprint, previous hash, current hash, and chain-link validation status. Events: Feed Sync, Calculation Triggered, Risk Assessment, ASM Flag, Acknowledged, APPROVED.",
        technicalDescription:
          "Timeline view with vertical chain showing Onboarding → Screening → Risk → PO → Dispatch → Intake → Assay → Settlement. Nightly automated hash validation across all settled transactions. Any mismatch triggers immediate alert to CCO and FIU notification.",
        userStory: "N/A",
        dataFlow:
          "GET /api/v1/audit/{transactionId} → {entries: [], chainStatus: 'VERIFIED', retentionExpiry: '2031-05-05'}",
        permissions: "Auditor (time-bound, view-only), Compliance Officer",
        algorithm: `
Hash Chain Verification:
function verifyAuditChain(transactionId):
  chain = getAuditEntries(transactionId);
  for i from 1 to chain.length:
    expectedHash = SHA256(chain[i-1].hash + chain[i].data + chain[i].timestamp);
    if chain[i].hash != expectedHash:
      return { status: "CHAIN_BREAK", alert: "FIU_NOTIFIED" };
  return { status: "VERIFIED", entries: chain.length };
        `,
        businessRules: [
          "Records are strictly read-only after SETTLED status",
          "Chain-break triggers immediate FIU notification",
          "External auditors receive time-bound, view-only credentials",
          "No export without dual-approval logging",
        ],
      },
      {
        id: "regulatory-reports",
        name: "Regulatory Report Generator",
        route: "/audit#reports",
        icon: FileText,
        category: "System",
        businessDescription:
          "Automated compliance and reserve reporting ( Screen 2). One-click generation of mandatory regulatory reports: FIU Suspicious Transaction Reports (STR/SAR), IMF SDDS reserve asset disclosures, LBMA Responsible Gold Guidance compliance summaries. Auto-populates from verified transaction data with validation checklist.",
        technicalDescription:
          "Report Type Selector with auto-population engine pulling KYC, risk tier, assay results, pricing, settlement, and allocation data. PDF preview with digital watermark. Submission tracking with acknowledgment receipt.",
        userStory: "N/A",
        dataFlow:
          "POST /api/v1/reports/generate → {reportId, format: 'PDF', downloadUrl, generatedAt}",
        permissions: "Compliance Reporting Officer, Chief Compliance Officer",
        businessRules: [
          "FIU reports auto-format to national STR/SAR templates",
          "IMF SDDS reports map to reserve asset classification standards",
          "LBMA disclosures follow Step 5.1 public reporting guidance",
          "Suspicious activity auto-generates draft STR for review",
        ],
      },
      {
        id: "export-config",
        name: "Export Configuration",
        route: "/audit#export",
        icon: Download,
        category: "System",
        businessDescription:
          "Multi-format export and digital signature attachment ( Screen 3). Configurable export interface allowing auditors to select date ranges, transaction filters, output formats (JSON/CSV/XML), and field mappings. Attaches cryptographic digital signatures and chain verification certificates to every export package.",
        technicalDescription:
          "Format selector with drag-and-drop field mapping. Export queue showing pending, processing, and completed exports. SHA-256 manifest hash and CB-signed certificate attached to packages.",
        userStory: "N/A",
        dataFlow:
          "POST /api/v1/export/configure → {exportId, status: 'PROCESSING', manifestHash}",
        permissions:
          "Auditor, Compliance Officer (dual-approval for >10,000 records)",
        businessRules: [
          "Every export includes SHA-256 manifest hash",
          "Digital signature verifies export authenticity",
          "Exports >10,000 records require dual-approval",
          "All export actions logged with actor ID, timestamp, IP, file hash",
        ],
      },
      {
        id: "compliance-dashboard",
        name: "Compliance Dashboard",
        route: "/audit#compliance",
        icon: Calendar,
        category: "System",
        businessDescription:
          "Retention countdown and audit readiness monitoring ( Screen 4). Centralized compliance dashboard displaying retention countdowns, archival status, audit readiness scores (0-100), scheduled reports calendar, and system health indicators (CPU, Memory, Storage, Network). Enables proactive management of regulatory obligations and long-term data preservation.",
        technicalDescription:
          "Real-time dashboard with retention timer, SVG gauge for audit score, health indicator LEDs, alert log panel, and calendar view of upcoming FIU/IMF/LBMA reporting deadlines. Automated archival to WORM cold storage upon 5-year expiry.",
        userStory: "N/A",
        dataFlow:
          "GET /api/v1/compliance/retention-status → {activeTransactions: 142, archivalPending: 18, retentionCompliance: '100%'}",
        permissions: "Chief Compliance Officer, System Administrator",
        businessRules: [
          "5-year minimum retention from settlement date",
          "Automated migration to WORM cold storage upon expiry",
          "Metadata remains searchable after archival",
          "Annual automated hash validation on archived records",
        ],
      },
      {
        id: "settings",
        name: "Settings",
        route: "/settings",
        icon: Settings,
        category: "System",
        businessDescription:
          "Application configuration including: user profile management, notification preferences (email alerts for approvals, settlements), security settings (password, 2FA), and organization details (bank name, regulatory identifiers).",
        technicalDescription:
          "Tabbed settings interface persisting to users and organization_settings tables. Password change with bcrypt hashing. 2FA setup with TOTP (Time-based One-Time Password) support.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/settings → users + organization_settings tables",
        permissions:
          "All authenticated users (own profile), Administrator (organization settings)",
      },
      {
        id: "admin",
        name: "Administration",
        route: "/admin",
        icon: UserCog,
        category: "System",
        businessDescription:
          "Administrator-only control center for identity and access governance. Provides two capabilities: (1) User Management — create new users with a temporary password, assign them a profile (Compliance Officer, Risk Manager, Admin), change profiles, and remove accounts; (2) Profile Access Matrix — define, per profile, exactly which application pages each role can see and open. Admins always retain full access. This is where the Admin role is granted, since it cannot be self-assigned at public sign-up.",
        technicalDescription:
          "Protected route guarded by a server-side requireAdmin check in app/admin/layout.tsx. User operations run through server actions in app/admin/actions.ts (create via Better Auth, role updates and deletes scoped to admins). The access matrix is persisted in the role_page_access table and exposed to clients via /api/access/me, which drives both sidebar link filtering and URL enforcement in proxy.ts.",
        userStory: "N/A",
        dataFlow:
          "Server Actions (app/admin/actions.ts) + GET /api/access/me → user + role_page_access tables",
        permissions: "Admin only",
        businessRules: [
          "Only users with the Admin profile can open /admin (URL is blocked for others)",
          "The Admin profile cannot be self-assigned at public sign-up; it is granted here",
          "Admins always have access to every page regardless of the access matrix",
          "Removing a page from a profile hides its menu link and blocks direct URL access",
          "New users receive a temporary password and can sign in immediately",
        ],
      },
      {
        id: "transactions",
        name: "Transactions",
        route: "/transactions",
        icon: ArrowLeftRight,
        category: "Main",
        businessDescription:
          "Alternative transaction hub providing a KPI summary (active counterparties, pending POs, gold in transit, monthly acquisitions) combined with a full paginated transactions table and a counterparty breakdown panel. Designed as an operations-centric view for traders and operations managers who need all transaction activity in one screen rather than navigating the individual module pages.",
        technicalDescription:
          "Client component using SWR to fetch aggregated data from GET /api/dashboard, reusing the KPICard, TransactionsTable, and CounterpartyDashboard shared components. Bilingual via useLanguage. Toggle between showing recent transactions (5) and all transactions.",
        userStory: "N/A",
        dataFlow:
          "GET /api/dashboard → stats + transactions array (reuses dashboard aggregation endpoint)",
        permissions: "Trader, Operations Manager, Compliance Officer",
      },
      {
        id: "previsions",
        name: "Forecasts (Market Curves)",
        route: "/previsions",
        icon: TrendingUp,
        category: "Main",
        businessDescription:
          "Market curve viewer aggregating seven key financial curves relevant to gold reserve management: XAU Deposit rates, SOFR OIS (overnight index swap), XAU Forward rates, US Treasury yields, Copper forward curve, FX Forward rates, and Gold Implied Volatility. Each curve shows bid/mid/ask values across multiple tenors, day-over-day and week-over-week changes, with individual and normalized chart views. Supports export of the full curve set. Purely display — no data modification.",
        technicalDescription:
          "Client-only component (~500 lines). Curve data is static/hardcoded for demonstration. Recharts LineChart for individual/normalized views. ViewMode (individual | normalized), PriceMode (bid | mid | ask), and CompareRef (J+1 | J+7 | M+1) state drives chart rendering. Export via CSV-style download. Bilingual via useLanguage.",
        userStory: "N/A",
        dataFlow:
          "In-memory static curve data. Future integration: GET /api/market-data/curves → live pricing feeds.",
        permissions: "Risk Manager, Trader, Reserve Manager",
      },
      {
        id: "calibration",
        name: "Liquidity Calibration",
        route: "/calibration",
        icon: Sliders,
        category: "Main",
        businessDescription:
          "BCC base-money trajectory monitor and reserve-calibration tool. Displays the central bank's actual monetary base trajectory (Avoirs) against pre-programme and post-programme forecasts over a 12-month horizon. The Factors panel decomposes the monthly delta into its contributing components (gold purchases, Treasury operations, FX transactions, banknotes, BCC bonds). The Forecast panel adds a confidence band. A Required Reserves breakdown table shows how a gold-purchase injection affects mandatory reserves across CDF and USD deposit categories. A projection table provides J+1, J+7, and M+1 forward estimates with sterilization actions.",
        technicalDescription:
          "Client-only component with three chart views (avoirs | facteurs | prevision) driven by a ChartView state toggle. Recharts LineChart and ReferenceArea for corridor visualization. All data is static/hardcoded for the current pilot period. Bilingual via useLanguage.",
        userStory: "MAC-01 support",
        dataFlow:
          "In-memory static data. Future integration: GET /api/bcc/monetary-base → live base-money statistics.",
        permissions: "Risk Manager, Central Bank Analyst, Administrator",
      },
      {
        id: "gestion-reserves",
        name: "Reserve Management",
        route: "/gestion-reserves",
        icon: PieChart,
        category: "Main",
        businessDescription:
          "Reserve Desk — Allocation Engine: a full-featured reserve portfolio management tool embedded as an iframe. Seven screens: (1) Overview — portfolio KPIs, asset allocation donut, currency composition, constraint status summary; (2) Positions — filterable/searchable positions table with asset class, CCY, issuer, rating, market value, duration, yield, liquidity; (3) New Optimization — strategic/tactical run types, constraint configuration, pre-run validation checklist, optimization trigger; (4) Recommendation — allocation recommendation with constraint check, suggested trades, rationale narrative, scenario robustness, approval workflow; (5) Assumptions — reusable optimization assumption templates (inflation, rate, FX, spread outlooks); (6) Scenarios — stress scenarios library (rate shock, credit spread, FX shock, outflow uplift); (7) Policy & Limits — versioned investment-policy and risk-limit sets with draft/approve/activate workflow.",
        technicalDescription:
          "React wrapper (app/gestion-reserves/page.tsx) hosts a self-contained HTML app (/public/reserve-engine.html) in an iframe. Tab navigation is handled by the React wrapper which sends postMessage({action:'nav', screen}) and postMessage({action:'lang', lang}) to the iframe. The iframe exposes window.goScreen for direct navigation. Language is synced from the global LanguageContext (localStorage key 'gold-acquisition-language') to the iframe on load and on language change. The HTML engine contains its own JS simulation data and i18n dictionary for EN/FR translation of all 7 screens.",
        userStory: "RES-01",
        dataFlow:
          "Fully client-side simulation. The iframe reads localStorage for the current language. No API calls; no database reads or writes. Future: GET /api/reserves/portfolio → live position data.",
        permissions: "Reserve Manager, Risk Manager, Administrator",
      },
      {
        id: "manifest-queue",
        name: "Manifest Queue",
        route: "/manifest-queue",
        icon: Inbox,
        category: "Operations",
        businessDescription:
          "Queue for managing the export-manifest review cycle between the counterparty and the BCC Trade Compliance team. Each manifest item progresses through: Draft → Submitted → (Accepted | Returned). Compliance officers can accept a manifest (advancing the PO to dispatch-ready) or return it with a reason code and review notes, which re-opens it for counterparty correction. Shows attempt count, submission and review timestamps, document attachments, and SLA metrics.",
        technicalDescription:
          "Client component fetching from GET /api/manifest-queue (SWR). Filterable by status. Inline action buttons (Accept / Return) trigger PUT requests. Return dialog captures reason code and free-text notes. Links to the full manifest detail page at /purchase-orders/[id]/manifest.",
        userStory: "N/A",
        dataFlow:
          "GET /api/manifest-queue → manifests + purchase_orders tables. PUT /api/purchase-orders/[id]/manifest → status transitions",
        permissions: "Trade Compliance Officer, Senior Compliance Officer",
      },
      {
        id: "po-lifecycle",
        name: "PO Lifecycle",
        route: "/po-lifecycle",
        icon: GitMerge,
        category: "Operations",
        businessDescription:
          "Visual, interactive workflow diagram of the end-to-end Purchase Order lifecycle, rendered as an SVG swimlane map. Shows every status node (BCC internal, counterparty, external systems) and every transition arrow, color-coded by actor: BCC operations (blue), counterparty (orange), payment/banking systems (amber), optional/future nodes (slate). Clicking a node highlights the relevant swimlane. Live status counts fetched via API show how many POs are currently in each state. Useful for onboarding, training, and monitoring.",
        technicalDescription:
          "Client component rendering an SVG at a 1520×910 virtual coordinate space scaled responsively via CSS percentage positioning. Node positions use pX/pY helpers. Status counts fetched via SWR from GET /api/po-lifecycle/counts. Clicking a node calls setHighlighted. Bilingual labels.",
        userStory: "N/A",
        dataFlow:
          "GET /api/po-lifecycle/counts → count per PO status from purchase_orders table",
        permissions: "All authenticated users (read-only)",
      },
    ],
    workflow: {
      title: "End-to-End Workflow",
      steps: [
        {
          phase: "1. Counterparty Onboarding",
          description: "Register new gold supplier with KYC documents",
          userStory: "N/A",
          route: "/onboarding",
        },
        {
          phase: "2. Compliance Screening",
          description:
            "Automated sanctions/PEP/adverse media checks with preliminary score",
          userStory: "N/A",
          route: "/screening/[id]",
        },
        {
          phase: "3. Risk Assessment",
          description:
            "Comprehensive risk tier assignment with EDD for high-risk entities",
          userStory: "N/A",
          route: "/risk-management/[id]/assess",
        },
        {
          phase: "4. Purchase Order Creation",
          description: "Create gold acquisition order with LBMA pricing",
          userStory: "N/A",
          route: "/purchase-orders/new",
        },
        {
          phase: "5. Dual Approval",
          description:
            "Compliance gate and dual approval for large transactions",
          userStory: "N/A",
          route: "/purchase-orders/[id]",
        },
        {
          phase: "6. Pre-Shipment Dispatch",
          description:
            "Document validation, manifest check, and dispatch authorization",
          userStory: "N/A",
          route: "/dispatch/[id]",
        },
        {
          phase: "7. Vault Intake & Assay",
          description:
            "Receipt logging, seal verification, lab scheduling, purity verification",
          userStory: "N/A",
          route: "/vault-intake/[id]",
        },
        {
          phase: "8. Valuation & Settlement",
          description:
            "LBMA pricing, settlement calculation, dual-approval execution",
          userStory: "N/A",
          route: "/settlements/[id]",
        },
        {
          phase: "9. Reserve Allocation",
          description:
            "Gold weight posted to central bank reserve ledger with audit hash",
          userStory: "N/A",
          route: "/settlements/[id]",
        },
        {
          phase: "10. Immutable Audit Trail",
          description:
            "Tamper-evident transaction history with hash chain verification",
          userStory: "N/A",
          route: "/audit#audit-trail",
        },
        {
          phase: "11. Regulatory Reporting",
          description: "Auto-generated FIU/IMF/LBMA compliance reports",
          userStory: "N/A",
          route: "/audit#reports",
        },
        {
          phase: "12. Long-Term Archival",
          description: "5-year retention with WORM cold storage migration",
          userStory: "N/A",
          route: "/audit#compliance",
        },
      ],
    },
    database: {
      title: "Database Schema",
      tables: [
        {
          name: "counterparties",
          description: "Gold supplier master data",
          columns:
            "id, legal_name, registration_number, country, status, risk_level, screening_status",
        },
        {
          name: "ubos",
          description: "Ultimate Beneficial Owners",
          columns:
            "id, counterparty_id, full_name, ownership_percentage, is_pep",
        },
        {
          name: "documents",
          description: "KYC/compliance documents",
          columns: "id, counterparty_id, document_type, file_path, verified",
        },
        {
          name: "screening_results",
          description: "Compliance check results",
          columns:
            "id, counterparty_id, check_type, result, details, checked_at",
        },
        {
          name: "screening_audit_log",
          description: "Screening decision audit trail",
          columns:
            "id, counterparty_id, preliminary_score, classification, policy_hash",
        },
        {
          name: "risk_assessments",
          description: "Risk tier assignments",
          columns:
            "id, counterparty_id, overall_score, risk_tier, edd_required",
        },
        {
          name: "risk_audit_log",
          description: "Risk decision audit trail",
          columns: "id, counterparty_id, action, old_tier, new_tier, reason",
        },
        {
          name: "purchase_orders",
          description: "Gold acquisition orders",
          columns:
            "id, counterparty_id, status, estimated_weight_kg, gold_type, total_estimated_value",
        },
        {
          name: "po_approvals",
          description: "PO approval records",
          columns: "id, purchase_order_id, approver_role, decision, decided_at",
        },
        {
          name: "assays",
          description: "Laboratory test results",
          columns:
            "id, purchase_order_id, batch_number, gross_weight_kg, purity_percentage",
        },
        {
          name: "dispatch_validations",
          description: " Pre-shipment dispatch records",
          columns:
            "id, purchase_order_id, status, carrier_id, pickup_date, authorization_hash, dual_approval_complete",
        },
        {
          name: "dispatch_documents",
          description: " Export documents",
          columns:
            "id, dispatch_id, document_type, file_path, validated, validation_notes",
        },
        {
          name: "vault_intakes",
          description: " Vault receipt records",
          columns:
            "id, dispatch_id, tracking_id, seal_numbers, gross_weight_kg, net_weight_kg, operator_otp_verified, custody_log",
        },
        {
          name: "assay_samples",
          description: " Lab sample tracking",
          columns:
            "id, vault_intake_id, sample_id, lab_id, assay_method, sla_deadline, status",
        },
        {
          name: "assay_results",
          description: " Purity verification",
          columns:
            "id, assay_sample_id, au_purity, ag_content, cu_content, fe_content, pure_au_weight_kg, certificate_path",
        },
        {
          name: "settlements",
          description: " Valuation & settlement records",
          columns:
            "id, vault_intake_id, lbma_fixing_type, lbma_rate, gross_value, total_deductions, net_payable, currency, status",
        },
        {
          name: "settlement_approvals",
          description: " Dual-approval records",
          columns:
            "id, settlement_id, approver_role, approver_name, otp_verified, approved_at",
        },
        {
          name: "reserve_allocations",
          description: " Reserve ledger entries",
          columns:
            "id, settlement_id, pure_au_weight_kg, reserve_account_id, valuation_date, entry_status, audit_hash",
        },
        {
          name: "audit_entries",
          description: " Immutable audit events",
          columns:
            "id, transaction_id, event_type, actor_id, actor_type, ip_address, device_fingerprint, previous_hash, current_hash, timestamp",
        },
        {
          name: "regulatory_reports",
          description: " Generated compliance reports",
          columns:
            "id, report_type, transaction_ids, format, digital_signature, submission_status, generated_at",
        },
        {
          name: "export_packages",
          description: " Data export records",
          columns:
            "id, export_format, field_mapping, date_range, manifest_hash, digital_signature, created_by, created_at",
        },
        {
          name: "retention_status",
          description: " Archival tracking",
          columns:
            "id, transaction_id, retention_expiry, archival_status, worm_storage_path, last_verification",
        },
        {
          name: "audit_trail",
          description: "Cryptographic chain linking all records",
          columns:
            "id, entity_type, entity_id, previous_hash, current_hash, created_at",
        },
      ],
    },
  },
  fr: {
    title: "Documentation de l'Application",
    subtitle:
      "Guide complet pour la Plateforme d'Acquisition d'Or - Banque Centrale de la République Démocratique du Congo",
    overview: {
      title: "Vue d'ensemble de la Plateforme",
      description:
        "La Plateforme d'Acquisition d'Or est un système complet de conformité et de trading conçu pour les banques centrales afin de gérer les achats d'or provenant d'exploitations minières artisanales et industrielles. Elle implémente les normes LBMA Responsible Gold Guidance (RGG) et assure une conformité réglementaire totale.",
      keyFeatures: [
        "Intégration des contreparties avec screening KYC/AML",
        "Score de conformité préliminaire automatisé ",
        "Workflow de due diligence basé sur le risque ",
        "Gestion des ordres d'achat avec double approbation ",
        "Vérification des essais et traitement des règlements",
        "Piste d'audit complète et reporting réglementaire",
      ],
    },
    pages: [
      {
        id: "dashboard",
        name: "Tableau de Bord",
        route: "/",
        icon: LayoutDashboard,
        category: "Principal",
        businessDescription:
          "Centre de commande central offrant une visibilité en temps réel sur les opérations d'acquisition d'or. Affiche les indicateurs clés de performance (KPI) incluant les contreparties actives, les ordres d'achat en attente, l'or en transit et les volumes d'acquisition mensuels. Permet une prise de décision rapide grâce aux métriques en un coup d'œil.",
        technicalDescription:
          "Page rendue côté serveur récupérant des données agrégées de plusieurs tables (counterparties, purchase_orders, assays, settlements). Utilise SWR pour le rafraîchissement côté client. Implémente une grille responsive avec composants Card pour l'affichage des KPI.",
        userStory: "N/A",
        dataFlow:
          "API: /api/dashboard → Agrège counterparties, purchase_orders, assays",
        permissions: "Tous les utilisateurs authentifiés",
      },
      {
        id: "counterparties",
        name: "Contreparties",
        route: "/counterparties",
        icon: Users,
        category: "Principal",
        businessDescription:
          "Liste maîtresse de tous les fournisseurs d'or enregistrés (mines, raffineurs, traders). Affiche le statut de conformité, le niveau de risque et les résultats de screening pour chaque entité. Supporte le filtrage par statut (Actif, En attente de révision, En attente de screening, En attente d'évaluation des risques, Bloqué) et la recherche.",
        technicalDescription:
          "Composant client avec récupération de données SWR depuis /api/counterparties. Implémente le pattern DataTable avec colonnes triables, pagination et actions de ligne. Les badges de statut utilisent un système de couleurs aligné avec la classification des risques.",
        userStory: "N/A",
        dataFlow:
          "API: GET /api/counterparties → table counterparties avec JOINs vers screening_results, ubos",
        permissions: "Officier de Conformité, Gestionnaire des Risques",
      },
      {
        id: "onboarding",
        name: "Intégration",
        route: "/onboarding",
        icon: UserPlus,
        category: "Principal",
        businessDescription:
          "Assistant multi-étapes pour l'enregistrement de nouveaux fournisseurs d'or. Capture: informations légales, numéros d'enregistrement, juridiction, types de sources d'or (ASM/LSM/Recyclé), Bénéficiaires Effectifs Ultimes avec indicateurs PPE, et documents de conformité requis. Lance le processus de screening KYC/AML.",
        technicalDescription:
          "Composant Stepper gérant l'état du formulaire sur plusieurs pages. Validation de formulaire avec schéma Zod. Upload de fichiers avec support glisser-déposer. À la fin, déclenche POST vers /api/counterparties créant l'entité avec statut 'pending_screening'.",
        userStory: "N/A",
        dataFlow:
          "POST /api/counterparties → Crée enregistrements counterparty + ubos + documents",
        permissions: "Officier de Conformité",
      },
      {
        id: "screening",
        name: "Résultats de Screening",
        route: "/screening/[id]",
        icon: Shield,
        category: "Principal",
        businessDescription:
          "Tableau de bord de screening de conformité implémentant l'algorithme  de Score de Conformité Préliminaire. Affiche les vérifications automatisées: Sanctions (porte bloquante), statut PPE (pondération 40%), Médias Défavorables (pondération 35%), et Risque Juridictionnel (pondération 25%). Calcule le score final et la classification de risque (LOW 0-25, MEDIUM 26-60, HIGH 61-99, BLOCKED 100).",
        technicalDescription:
          "Formulaire interactif permettant la modification manuelle des entrées de screening. Calcul du score en temps réel utilisant la formule pondérée. Visualisation du breakdown du score avec indicateurs de progression. Sauvegarde dans la table screening_results avec hash SHA-256 pour l'intégrité de l'audit.",
        userStory: "N/A",
        dataFlow:
          "GET/POST /api/screening/[id] → tables screening_results + screening_audit_log",
        permissions: "Officier de Conformité",
        algorithm: `
Score Préliminaire = (PPE × 0.40) + (MédiasDéfavorables × 0.35) + (Juridiction × 0.25)

Où:
- PPE: 100 si PPE, 0 sinon
- MédiasDéfavorables: 0 (0 hits), 30 (1-2 hits), 60 (3-5 hits), 100 (6+ hits)
- Juridiction: 0-100 basé sur risque pays + type d'activité
- Sanctions: Porte bloquante (Hit = automatique 100)

Classification:
- 0-25: LOW → PENDING_STANDARD_REVIEW
- 26-60: MEDIUM → PENDING_ENHANCED_REVIEW  
- 61-99: HIGH → PENDING_SENIOR_REVIEW
- 100: BLOCKED → AUTOMATIC_REJECTION
        `,
      },
      {
        id: "risk-management",
        name: "Gestion des Risques",
        route: "/risk-management",
        icon: Shield,
        category: "Principal",
        businessDescription:
          "Tableau de bord pour l'attribution complète des niveaux de risque selon . Affiche les contreparties en attente d'évaluation des risques, la distribution des niveaux de risque dans le portefeuille, et les exigences EDD (Due Diligence Renforcée). Point d'entrée pour les évaluations de risque détaillées.",
        technicalDescription:
          "Agrège les données de la table risk_assessments. Graphiques utilisant Recharts pour la visualisation de la distribution des niveaux. Liens vers /risk-management/[id]/assess pour les évaluations individuelles.",
        userStory: "N/A",
        dataFlow:
          "GET /api/risk-assessments → tables risk_assessments + counterparties",
        permissions: "Gestionnaire des Risques, Officier de Conformité Senior",
      },
      {
        id: "monetary-policy",
        name: "Politique Monétaire",
        route: "/monetary-policy",
        icon: Landmark,
        category: "Principal",
        businessDescription:
          "Simulateur d'impact bilanciel en lecture seule (MP-01). Permet aux analystes de modéliser l'effet d'une acquisition d'or sur le bilan pro-forma de la banque centrale selon différents scénarios de financement (Tirage sur réserves, Émission obligataire, Swap de change, Emprunt externe). Calcule automatiquement les ratios clés (Or/Réserves, LCR, Levier, Adéquation des fonds propres), compare les scénarios via une notation pondérée et un graphique radar, puis produit un dossier comité exportable. Strictement une simulation : aucune donnée réelle du grand livre n'est modifiée (sorties marquées « SIMULATION - NON EXÉCUTÉE »).",
        technicalDescription:
          "Assistant client en 5 étapes (Bibliothèque → Configuration → Pro-forma → Comparaison → Export). Logique de simulation pure dans lib/monetary-policy.ts (simulateBalanceSheetImpact, computeRatios, compareScenarios). Graphique radar avec Recharts via le ChartContainer shadcn. La validation des contraintes applique les règles ≤10% des réserves et règlement T+2. L'étape d'export calcule un vrai hachage d'intégrité SHA-256 via crypto.subtle. Aucune écriture en base.",
        userStory: "MP-01 Écrans 0-4",
        dataFlow:
          "En mémoire uniquement : BASELINE_BALANCE_SHEET + SCENARIO_TEMPLATES (lib/monetary-policy.ts). Pas de persistance ; intégration future : GET /api/v1/balance-sheet/current, POST /api/v1/monetary-policy/simulate.",
        permissions: "Gestionnaire des Risques, Administrateur",
        algorithm: `
Augmentation d'or (M USD) = quantitéOz × prixParOz / 1 000 000

Effet de la source de financement sur le pro-forma :
- RESERVE_DRAWDOWN :   réservesChange    -= augmentationOr (échange d'actifs)
- BOND_ISSUANCE :      obligationsÉmises += augmentationOr
- FX_SWAP :            swapsChange       += augmentationOr
- EXTERNAL_BORROWING : empruntsExternes  += augmentationOr

Ratios clés :
- Or/Réserves         = or / (or + réservesChange)
- LCR                 = HQLA / sortiesNettes(30j)
- Levier              = totalActifs / fondsPropres
- AdéquationFonds     = fondsPropres / totalActifs

Score composite = Σ (poidsObjectif × scoreNormalisé) / Σ poids
(objectifs normalisés min-max entre scénarios ; efficience-coût inversée)

Contraintes : achat ≤ 10% des réserves totales par transaction ; règlement ≥ T+2.
        `,
      },
      {
        id: "impact-macro",
        name: "Simulateur d'Impact Macro",
        route: "/impact-macro",
        icon: Activity,
        category: "Principal",
        businessDescription:
          "Simulateur d'impact monétaire du programme d'achat d'or artisanal de la BCC (depuis fév. 2026). Modélise sept canaux de transmission macroéconomique sur un horizon pluriannuel : création de monnaie de base, croissance de la masse monétaire large (M2/M3) via le multiplicateur de dépôts, liquidité du système bancaire et besoin de stérilisation, inflation (élasticité à la croissance monétaire + pass-through de change), dynamique du taux de change (pression à la dépréciation vs. effet de confiance lié aux réserves), réserves brutes internationales et couverture des importations, risque au bilan de la banque centrale (coût quasi-fiscal de stérilisation). Fonctionnalités : bibliothèque de scénarios complète avec sauvegarde/chargement/export/import stockés en localStorage, balayage de sensibilité (jusqu'à 37 simulations sur un axe de paramètre), graphique de répartition de liquidité du système bancaire, test de résistance mark-to-market sur le bilan, graphique historique à double axe (données réelles jan. 2024 – juil. 2026), et un onglet Méthodologie exposant toutes les équations du modèle. Bilingue (FR/EN) partout. Entièrement côté client — aucune écriture serveur ni base de données.",
        technicalDescription:
          "Fichier unique `\"use client\"` (`app/impact-macro/page.tsx`, ~1 800 lignes). Le moteur de simulation (`simulate`) effectue une boucle annuelle sur 26 champs `SimInputs` : multiplicateur monétaire dérivé `(1+c)/(c+r+e)`, injection nette CDF après stérilisation, modèle de pression FX avec fraction de fuite atténuée par la confiance des réserves et l'intervention BCC, inflation = `baseInflation + croissanceM2×élasticité + FXnet×passThrough`. `decisionMetrics` compare au scénario de référence sans or et vérifie les contraintes (`inflationCeilingPct`, `importCoverFloorMonths`). Graphiques Recharts (`LineChart`, `BarChart`, `ComposedChart`, barres empilées via `stackId`). Persistance des scénarios : `localStorage` sous les clés `bccgold.v1.index` et `bccgold.v1.scenario.<id>`, avec sauvegarde/enregistrer-sous/export-JSON/import-JSON/archiver/supprimer. Le balayage de sensibilité (`sweepData` useMemo) exécute la simulation N fois (jusqu'à 37) sur une plage de paramètre configurée. Le test de résistance bilan applique une volatilité or, un plafond d'inflation et un plancher de couverture imports définis par l'utilisateur. UI : shadcn `Tabs`, `Slider`, `Dialog`, `ScrollArea`, `Badge`, `Textarea` ; `useLanguage` depuis `@/lib/i18n/language-context` pour le basculement FR/EN ; `AppHeader` avec titre + sous-titre.",
        userStory: "MAC-01",
        dataFlow:
          "Entièrement en mémoire. État des scénarios persisté en localStorage (clés : `bccgold.v1.index`, `bccgold.v1.scenario.*`). Aucun appel API ; aucune lecture ou écriture en base de données.",
        permissions: "Gestionnaire des Risques, Administrateur, Analyste Banque Centrale",
        algorithm: `
Constantes :
  TROY_OZ_PER_TONNE = 32 150,7547

Multiplicateur monétaire dérivé :
  mm = (1 + c) / (c + r + e)
  où  c = ratio devises / dépôts
      r = coefficient de réserves obligatoires
      e = propension aux réserves excédentaires

Boucle de simulation annuelle (y = 1 … horizonYears) :
  valeurOrUSD   = tonnes × finesse × TROY_OZ_PER_TONNE × prixUSD_y
  injectionCDF  = valeurOrUSD × tauxChange
  sterilCDF     = injectionCDF × partStérilisée / 100
  netteInj      = injectionCDF − sterilCDF

  injDomestique = netteInj × (1 − fuiteLiquidité/100)
  fuiteFX       = netteInj × fuiteLiquidité/100

  deltaM2       = injDomestique × (mm − 1)
  croissM2Pct   = deltaM2 / M2préc × 100

  pressionFXbrute = (fuiteFX / M2préc) × échelonnageFX × 100
  amortissement   = pressionFXbrute × (valeurOrUSD / réserves) × offsetConfiance
  FXnetAvantIntv  = max(0, pressionFXbrute − amortissement)
  FXnetChange     = FXnetAvantIntv × (1 − interventionBCC/100)

  inflation     = inflationBase + croissM2Pct × élasticité + FXnetChange × passThrough
  tauxChange    = tauxChange × (1 + (déprécBase + FXnetChange) / 100)

  réserves      = réservesInit + detentionsOrCumulUSD
  couvImports   = réserves / importsParMois
  coûtSteril    = sterilCDF × tauxSterilisation/100

Contraintes de décision :
  - inflation    > plafondInflation      → contrainte violée
  - couvImports  < plancher CouvImports  → contrainte violée

Répartition liquidité système bancaire :
  stérilisé      = sterilCDF
  réservAddl     = (r / denom) × netteInj
  liquiditéLibre = (e / denom) × netteInj
  monnaie        = (c / denom) × netteInj
  où denom = c + r + e
`,
      },
      {
        id: "purchase-orders",
        name: "Ordres d'Achat",
        route: "/purchase-orders",
        icon: ShoppingCart,
        category: "Opérations",
        businessDescription:
          "Registre central de tous les ordres d'achat d'or. Suit le cycle de vie de la commande de Brouillon → Soumis → En attente d'approbation → Approuvé → En transit → Reçu. Affiche les valeurs estimées, les prix LBMA et le statut de livraison.",
        technicalDescription:
          "Composant DataTable récupérant depuis /api/purchase-orders avec JOINs vers counterparties pour les détails du fournisseur. Filtrage basé sur le statut et tri par date/valeur. Actions de ligne pour les opérations voir/modifier/annuler.",
        userStory: "N/A",
        dataFlow:
          "GET /api/purchase-orders → tables purchase_orders + counterparties",
        permissions: "Trader, Officier de Conformité",
      },
      {
        id: "dispatch",
        name: "Expédition",
        route: "/dispatch",
        icon: Truck,
        category: "Opérations",
        businessDescription:
          "Module de documentation pré-expédition et validation de dispatch . Hub central pour la validation des documents d'exportation, manifestes d'expédition et dédouanement avant l'envoi de l'or. Suit le statut de validation depuis les documents en attente jusqu'à la confirmation finale de dispatch. Assure la conformité réglementaire avant le transfert vers la réception coffre.",
        technicalDescription:
          "Tableau de bord affichant toutes les validations de dispatch avec indicateurs de statut. Filtrable par statut (pending_docs, docs_validated, pending_authorization, dispatched, in_transit). Liens vers les pages détaillées du workflow de validation. Intégration avec la table purchase_orders pour les données PO.",
        userStory: "N/A",
        dataFlow:
          "GET /api/dispatch → table dispatch_validations + JOINs purchase_orders",
        permissions: "Officier de Conformité Commerce",
      },
      {
        id: "dispatch-detail",
        name: "Validation de Dispatch",
        route: "/dispatch/[id]",
        icon: Truck,
        category: "Opérations",
        businessDescription:
          "Workflow de validation pré-expédition en quatre étapes implémentant : (1) Upload & Validation des Documents - valide la licence d'export, le certificat d'origine, les docs de transport et l'assurance par rapport aux termes du PO; (2) Vérification Manifeste & Douanes - vérifie les tolérances de poids (±5%), les numéros de scellés et le pré-dédouanement; (3) Autorisation de Dispatch - assignation du transporteur avec double approbation pour les expéditions >$1M; (4) Confirmation de Dispatch - écran de succès avec ID de suivi et déclenchement du transfert vers .",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans . La validation des documents utilise une simulation OCR pour l'extraction des métadonnées. La jauge de tolérance de poids utilise une visualisation SVG en demi-cercle. La double approbation implémente le pattern signature + OTP. L'autorisation génère un hash SHA-256 pour l'immutabilité. Au dispatch, déclenche la transition vers le statut in_transit.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/dispatch/[id] + POST /api/dispatch/[id]/authorize → tables dispatch_validations + dispatch_documents + dispatch_audit_log",
        permissions: "Officier de Conformité Commerce, Signataire Autorisé",
        algorithm: `
Validation des Documents:
- Licence d'Export: Doit être valide (non expirée) et d'une autorité reconnue
- Certificat d'Origine: Doit correspondre au pays d'origine du PO
- Docs de Transport: Doit spécifier un transporteur sécurisé et un itinéraire
- Assurance: La valeur assurée doit être ≥ au montant du PO

Tolérance de Poids:
- Variance ≤5%: Approbation automatique
- Variance 5-10%: Signature de l'Officier de Conformité requise
- Variance >10%: Mise en attente automatique, investigation requise

Autorisation de Dispatch:
- Signée cryptographiquement avec hash SHA-256
- Double approbation requise pour les expéditions >$1M USD
- Chaque approbateur doit compléter l'authentification MFA/OTP
- Séparation des fonctions imposée (approbateurs différents)
        `,
        businessRules: [
          "Pas de dispatch sans validation de tous les documents",
          "Dédouanement requis pour l'origine et la destination",
          "Routage via CAHRA déclenche une re-revue EDD",
          "Double approbation pour >$1M ou contreparties à HAUT risque",
          "Hash d'autorisation immuable une fois créé",
          "Collecte par transporteur déclenche automatiquement la transition ",
        ],
      },
      {
        id: "vault-intake",
        name: "Réception Coffre",
        route: "/vault-intake",
        icon: Warehouse,
        category: "Opérations",
        businessDescription:
          "Réception physique de l'or et initiation de la chaîne de garde . Hub central pour l'enregistrement des réceptions au coffre depuis les expéditions dispatched. Suit le statut de réception depuis l'attente jusqu'à la fin de l'essai et le transfert vers le règlement. Intègre les données  dispatch et alimente  règlement.",
        technicalDescription:
          "Tableau de bord affichant toutes les réceptions avec indicateurs de statut. Filtrable par statut (pending_intake, received, assay_scheduled, assayed, pending_settlement). Liens vers les pages détaillées du workflow en 4 étapes. Intégration avec les tables dispatch_validations et purchase_orders.",
        userStory: "N/A",
        dataFlow:
          "GET /api/vault-intake → table vault_intakes + JOINs dispatch_validations",
        permissions: "Opérateur Coffre, Coordinateur Essai",
      },
      {
        id: "vault-intake-detail",
        name: "Validation Réception Coffre",
        route: "/vault-intake/[id]",
        icon: Warehouse,
        category: "Opérations",
        businessDescription:
          "Workflow de réception coffre en quatre étapes implémentant : (1) Enregistrement Réception - recherche PO/tracking, vérification scellés vs manifeste, enregistrement poids brut/net avec jauge tolérance ±5%, upload preuves photos, authentification OTP opérateur; (2) Planification Essai - sélection labo ISO 17025 avec expiration accréditation, génération ID échantillon avec code-barres, sélection méthode Fire Assay/XRF, timeline suivi transporteur, timer compte à rebours SLA; (3) Vérification Pureté - upload certificat avec OCR, détail pureté (Au/Ag/Cu/Fe %), calcul poids or pur, comparaison variance avec bandes de tolérance; (4) Transfert Règlement - résumé allocation, transition statut (RECEIVED → ASSAYED → PENDING_SETTLEMENT), hash audit SHA-256, badge conformité LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans . La jauge de tolérance de poids utilise une visualisation SVG en demi-cercle. Le sélecteur de labo valide l'accréditation ISO 17025. La barre de variance de pureté montre les seuils ±0.1g (vert), ±0.1-0.3g (jaune), >±0.3g (rouge). Au verrouillage, génère un hash SHA-256 immuable et déclenche le transfert  règlement.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/vault-intake/[id] + POST /api/assay/dispatch → tables vault_intakes + assay_samples + custody_log + audit_trail",
        permissions: "Opérateur Coffre, Coordinateur Essai, Contrôleur Qualité",
        algorithm: `
Tolérance de Poids (Réception):
- Variance ≤5%: Approbation automatique
- Variance 5-10%: Signature superviseur requise
- Variance >10%: Verrouillage auto PO, routage vers Conformité

Validation Labo Essai:
- Certificat ISO 17025 doit être valide (non expiré)
- Labos suspendus exclus du sélecteur
- Protocole échantillon scindé: 50% envoyé, 50% retenu

Variance de Pureté (Résultats Essai):
- Variance ≤2%: Approbation auto pour règlement
- Variance 2-5%: Signature Risk Manager requise
- Variance >5%: Mise en attente auto, litige fournisseur déclenché

Transfert Règlement:
- Scellé cryptographiquement avec hash SHA-256
- Chaîne de garde verrouillée (pas de modifications)
- Déclenche valorisation  avec poids Au pur
        `,
        businessRules: [
          "Numéros de scellés doivent correspondre exactement au manifeste d'expédition",
          "Toutes preuves photos obligatoires avant création enregistrement réception",
          "MFA/OTP opérateur requis pour signature chaîne de garde",
          "Seuls les labos ISO 17025 approuvés LBMA acceptés",
          "Rétention échantillon scindé requise pour résolution litiges",
          "Variance pureté >2% nécessite approbation Risk Manager",
          "Transfert règlement génère hash d'audit immuable",
        ],
      },
      {
        id: "assays",
        name: "Essais",
        route: "/assays",
        icon: FlaskConical,
        category: "Opérations",
        businessDescription:
          "Gestion des résultats d'essai de laboratoire. Enregistre: numéro de lot, poids brut/net, pourcentage de pureté, contenu en or fin, méthode d'essai, nom du laboratoire. Lié aux enregistrements de réception coffre. Critique pour le calcul du règlement et la vérification de la qualité.",
        technicalDescription:
          "Interface CRUD pour la table assays. Helpers de calcul pour le poids d'or fin (poids net × pureté). Upload et prévisualisation de certificat PDF. Workflow de statut: En attente → Vérifié → Contesté.",
        userStory: "N/A",
        dataFlow:
          "GET/POST /api/assays → tables assays + vault_intakes + purchase_orders",
        permissions: "Responsable Opérations, Contrôleur Qualité",
      },
      {
        id: "settlements",
        name: "Règlements",
        route: "/settlements",
        icon: Banknote,
        category: "Opérations",
        businessDescription:
          "Moteur de Valorisation, Règlement & Allocation . Hub central pour calculer la valeur finale de la transaction à partir des données d'essai vérifiées et des prix LBMA, exécuter les transferts de fonds à double approbation vers les contreparties, et allouer légalement le poids d'or pur dans le registre des réserves de la banque centrale. Support multi-devises (USD/EUR) avec verrouillage du taux FX.",
        technicalDescription:
          "Tableau de bord affichant tous les règlements avec indicateurs de statut. Filtrable par statut (pending_valuation, pending_review, pending_approval, executed, allocated). Liens vers les pages détaillées du workflow en 4 étapes. Intégration avec les tables vault_intakes, assays, et purchase_orders.",
        userStory: "N/A",
        dataFlow:
          "GET /api/settlements → tables settlements + vault_intakes + assays + counterparties",
        permissions:
          "Officier Financier, Responsable Trésorerie, Gestionnaire de Réserves",
      },
      {
        id: "settlement-detail",
        name: "Workflow de Règlement",
        route: "/settlements/[id]",
        icon: Banknote,
        category: "Opérations",
        businessDescription:
          "Workflow de règlement en quatre étapes implémentant : (1) Moteur de Tarification & Valorisation - intégration fixing LBMA AM/PM, facteur d'ajustement de pureté, calcul prime/remise, timer de verrouillage de prix 15 minutes, sélection de devise (USD/EUR); (2) Calcul & Révision du Règlement - affichage valeur brute, tableau des déductions (logistique, assurance, frais d'essai, retenue à la source), coordonnées bancaires contrepartie (IBAN/SWIFT), liste de vérification; (3) Double Approbation & Exécution - résumé du règlement, slots OTP Officier Financier + Directeur Trésorerie, application de la séparation des fonctions, actions Approuver/Rejeter/Amender; (4) Confirmation d'Allocation - bannière de succès avec ID Règlement, entrée d'allocation de réserve (poids or, ID compte, date de valorisation, statut Posté & Verrouillé), certificat de transfert de titre, hash d'audit SHA-256, badge de conformité LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans . Récupération en temps réel des taux LBMA avec compte à rebours de verrouillage de prix. La double approbation applique la séparation des fonctions (rôles RBAC différents). À l'exécution, génère un hash SHA-256 liant les enregistrements PO, Essai, Tarification, Règlement et Allocation. Entrée de réserve postée vers le registre central de la banque via API sécurisée.",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/settlements/[id] + POST /api/settlements/[id]/execute + POST /api/reserves/allocate → tables settlements + reserve_allocations + audit_trail",
        permissions:
          "Officier Financier, Directeur Trésorerie, Gestionnaire de Réserves",
        algorithm: `
Formule de Valorisation:
- Poids Au Pur = Poids Net × (Au% / 100)
- Valeur Brute = Poids Au Pur × Taux LBMA (converti en once troy)
- Net à Payer = Valeur Brute - Total Déductions (logistique + assurance + essai + taxe)
- Tous les calculs arrondis à 2 décimales

Règles de Verrouillage de Prix:
- Fenêtre de validité de 15 minutes pour le fixing LBMA sélectionné
- Les termes du contrat imposent un fixing spécifique (AM/PM à la date de dispatch)
- Actualisation manuelle disponible si le verrouillage expire

Seuil de Double Approbation:
- >$1,000,000 USD nécessite deux signataires autorisés indépendants
- Les signataires doivent détenir des rôles RBAC distincts (Maker et Checker)
- Séparation des fonctions imposée (Approbateur 1 ≠ Approbateur 2)
- Chaque approbateur s'authentifie via MFA/OTP

Exécution du Règlement:
- Vérification finale sanctions/AML sur le compte bancaire bénéficiaire
- Instruction de paiement transmise à la passerelle de paiement de la Banque Centrale
- Pas d'annulation permise dans ce module (corrections via )
        `,
        businessRules: [
          "Résultats d'essai doivent être verrouillés avant le règlement",
          "Taux de fixing LBMA appliqué selon les termes du contrat (AM/PM)",
          "Toutes les déductions doivent être transparentes et autorisées par le PO",
          "Double approbation obligatoire pour les transactions >$1M",
          "Changement de bénéficiaire nécessite ré-approbation Conformité",
          "Le règlement génère un hash d'audit immuable",
          "Allocation de réserve postée dans les statistiques monétaires officielles",
          "Enregistrements conservés ≥5 ans selon LBMA RGG",
        ],
      },
      {
        id: "reports",
        name: "Rapports",
        route: "/reports",
        icon: FileText,
        category: "Système",
        businessDescription:
          "Centre de reporting réglementaire et de gestion. Rapports disponibles: Résumé des Acquisitions (volumes mensuels), Vue d'ensemble des Contreparties (composition du portefeuille), Inventaire d'Or (avoirs actuels), Rapport de Règlement (historique des paiements), Audit de Conformité (statistiques de screening), Évaluation des Risques (distribution des niveaux).",
        technicalDescription:
          "Générateur de rapports avec sélecteur de plage de dates et options d'export (PDF, CSV, Excel). Agrégation de données côté serveur pour les grands ensembles de données. Fonctionnalité de rapport programmé pour livraison automatique.",
        userStory: "N/A",
        dataFlow: "Divers endpoints /api/reports/* agrégeant plusieurs tables",
        permissions: "Officier de Conformité, Officier Financier, Direction",
      },
      {
        id: "audit",
        name: "Audit & Conformité",
        route: "/audit",
        icon: Shield,
        category: "Système",
        businessDescription:
          "Moteur de Piste d'Audit Immuable & Export Réglementaire . Hub central pour les auditeurs et officiers de conformité pour récupérer l'historique des transactions inviolable, générer des rapports réglementaires (FIU STR/SAR, IMF SDDS, LBMA Disclosure), et exporter les données en plusieurs formats (JSON/CSV/XML) avec signature digitale. Applique les politiques de r��tention ≥5 ans selon LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 écrans: (1) Visualiseur de Piste d'Audit Immuable - timeline chronologique avec vérification de chaîne SHA-256; (2) Générateur de Rapports Réglementaires - auto-population depuis données vérifiées; (3) Configuration d'Export - mapping de format avec signature digitale; (4) Tableau de Bord Conformité - compte à rebours rétention, score préparation audit, indicateurs santé système.",
        userStory: "N/A",
        dataFlow:
          "GET /api/audit/{transactionId} → audit_trail + toutes tables liées",
        permissions:
          "Auditeur (lecture seule), Officier de Conformité, Directeur Conformité",
      },
      {
        id: "audit-trail-viewer",
        name: "Piste d'Audit Immuable",
        route: "/audit#audit-trail",
        icon: Shield,
        category: "Système",
        businessDescription:
          "Historique des transactions inviolable avec vérification de chaîne ( Écran 1). Affichage chronologique en lecture seule de chaque changement d'état depuis l'intégration contrepartie jusqu'au règlement. Chaque entrée inclut horodatage, ID acteur, empreinte IP/appareil, hash précédent, hash actuel et statut de validation de lien de chaîne. Événements: Sync Feed, Calcul Déclenché, Évaluation Risque, Flag ASM, Reconnu, APPROUVÉ.",
        technicalDescription:
          "Vue timeline avec chaîne verticale montrant Intégration → Screening → Risque → OA → Dispatch → Réception → Essai → Règlement. Validation de hash automatisée nocturne sur toutes les transactions réglées. Toute discordance déclenche alerte immédiate au DCO et notification FIU.",
        userStory: "N/A",
        dataFlow:
          "GET /api/v1/audit/{transactionId} → {entries: [], chainStatus: 'VERIFIED', retentionExpiry: '2031-05-05'}",
        permissions:
          "Auditeur (limité dans le temps, lecture seule), Officier de Conformité",
        businessRules: [
          "Enregistrements strictement en lecture seule après statut SETTLED",
          "Rupture de chaîne déclenche notification FIU immédiate",
          "Auditeurs externes reçoivent credentials limités dans le temps, lecture seule",
          "Pas d'export sans journalisation double approbation",
        ],
      },
      {
        id: "regulatory-reports",
        name: "Générateur Rapports Réglementaires",
        route: "/audit#reports",
        icon: FileText,
        category: "Système",
        businessDescription:
          "Reporting de conformité et réserves automatisé ( Écran 2). Génération en un clic de rapports réglementaires obligatoires: Rapports de Transaction Suspecte FIU (STR/SAR), divulgations d'actifs de réserve IMF SDDS, résumés de conformité LBMA Responsible Gold Guidance. Auto-population depuis données de transaction vérifiées avec liste de validation.",
        technicalDescription:
          "Sélecteur de Type de Rapport avec moteur d'auto-population tirant KYC, niveau de risque, résultats d'essai, tarification, règlement et données d'allocation. Prévisualisation PDF avec filigrane digital. Suivi de soumission avec accusé de réception.",
        userStory: "N/A",
        dataFlow:
          "POST /api/v1/reports/generate → {reportId, format: 'PDF', downloadUrl, generatedAt}",
        permissions: "Officier de Reporting Conformité, Directeur Conformité",
        businessRules: [
          "Rapports FIU auto-formatés selon templates STR/SAR nationaux",
          "Rapports IMF SDDS mappés aux standards de classification d'actifs de réserve",
          "Divulgations LBMA suivent guidance Step 5.1 de reporting public",
          "Activité suspecte auto-génère brouillon STR pour revue",
        ],
      },
      {
        id: "export-config",
        name: "Configuration d'Export",
        route: "/audit#export",
        icon: Download,
        category: "Système",
        businessDescription:
          "Export multi-format et pièce jointe signature digitale ( Écran 3). Interface d'export configurable permettant aux auditeurs de sélectionner plages de dates, filtres de transaction, formats de sortie (JSON/CSV/XML), et mappings de champs. Attache signatures digitales cryptographiques et certificats de vérification de chaîne à chaque package d'export.",
        technicalDescription:
          "Sélecteur de format avec mapping de champs glisser-déposer. File d'export montrant exports en attente, en cours et complétés. Hash de manifeste SHA-256 et certificat signé CB attachés aux packages.",
        userStory: "N/A",
        dataFlow:
          "POST /api/v1/export/configure → {exportId, status: 'PROCESSING', manifestHash}",
        permissions:
          "Auditeur, Officier de Conformité (double approbation pour >10,000 enregistrements)",
        businessRules: [
          "Chaque export inclut hash de manifeste SHA-256",
          "Signature digitale vérifie authenticité de l'export",
          "Exports >10,000 enregistrements nécessitent double approbation",
          "Toutes actions d'export journalisées avec ID acteur, horodatage, IP, hash de fichier",
        ],
      },
      {
        id: "compliance-dashboard",
        name: "Tableau de Bord Conformité",
        route: "/audit#compliance",
        icon: Calendar,
        category: "Système",
        businessDescription:
          "Compte à rebours de rétention et surveillance préparation audit ( Écran 4). Tableau de bord conformité centralisé affichant comptes à rebours de rétention, statut d'archivage, scores de préparation audit (0-100), calendrier des rapports planifiés, et indicateurs de santé système (CPU, Mémoire, Stockage, Réseau). Permet gestion proactive des obligations réglementaires et préservation données long terme.",
        technicalDescription:
          "Tableau de bord temps réel avec timer de rétention, jauge SVG pour score audit, LEDs indicateurs de santé, panneau journal d'alertes, et vue calendrier des échéances de reporting FIU/IMF/LBMA. Archivage automatisé vers stockage froid WORM à expiration des 5 ans.",
        userStory: "N/A",
        dataFlow:
          "GET /api/v1/compliance/retention-status → {activeTransactions: 142, archivalPending: 18, retentionCompliance: '100%'}",
        permissions: "Directeur Conformité, Administrateur Système",
        businessRules: [
          "Rétention minimum 5 ans depuis date de règlement",
          "Migration automatisée vers stockage froid WORM à expiration",
          "Métadonnées restent recherchables après archivage",
          "Validation de hash automatisée annuelle sur enregistrements archivés",
        ],
      },
      {
        id: "settings",
        name: "Paramètres",
        route: "/settings",
        icon: Settings,
        category: "Système",
        businessDescription:
          "Configuration de l'application incluant: gestion du profil utilisateur, préférences de notification (alertes email pour approbations, règlements), paramètres de sécurité (mot de passe, 2FA), et détails de l'organisation (nom de la banque, identifiants réglementaires).",
        technicalDescription:
          "Interface de paramètres à onglets persistant vers les tables users et organization_settings. Changement de mot de passe avec hashage bcrypt. Configuration 2FA avec support TOTP (Time-based One-Time Password).",
        userStory: "N/A",
        dataFlow:
          "GET/PUT /api/settings → tables users + organization_settings",
        permissions:
          "Tous les utilisateurs authentifiés (propre profil), Administrateur (paramètres organisation)",
      },
      {
        id: "admin",
        name: "Administration",
        route: "/admin",
        icon: UserCog,
        category: "Système",
        businessDescription:
          "Centre de contrôle réservé aux administrateurs pour la gouvernance des identités et des accès. Offre deux fonctions : (1) Gestion des utilisateurs — créer de nouveaux utilisateurs avec un mot de passe temporaire, leur attribuer un profil (Officier de Conformité, Gestionnaire des Risques, Admin), changer de profil et supprimer des comptes ; (2) Matrice d'accès par profil — définir, pour chaque profil, exactement quelles pages de l'application chaque rôle peut voir et ouvrir. Les administrateurs conservent toujours un accès total. C'est ici qu'est attribué le rôle Admin, car il ne peut pas être auto-attribué lors de l'inscription publique.",
        technicalDescription:
          "Route protégée par une vérification serveur requireAdmin dans app/admin/layout.tsx. Les opérations sur les utilisateurs passent par des Server Actions (app/admin/actions.ts) : création via Better Auth, changement de profil et suppression réservés aux admins. La matrice d'accès est persistée dans la table role_page_access et exposée aux clients via /api/access/me, qui pilote à la fois le filtrage des liens de la barre latérale et le blocage des URL dans proxy.ts.",
        userStory: "N/A",
        dataFlow:
          "Server Actions (app/admin/actions.ts) + GET /api/access/me → tables user + role_page_access",
        permissions: "Admin uniquement",
        businessRules: [
          "Seuls les utilisateurs avec le profil Admin peuvent ouvrir /admin (l'URL est bloquée pour les autres)",
          "Le profil Admin ne peut pas être auto-attribué à l'inscription publique ; il est accordé ici",
          "Les admins ont toujours accès à toutes les pages, indépendamment de la matrice d'accès",
          "Retirer une page d'un profil masque son lien de menu et bloque l'accès direct par URL",
          "Les nouveaux utilisateurs reçoivent un mot de passe temporaire et peuvent se connecter immédiatement",
        ],
      },
      {
        id: "transactions",
        name: "Transactions",
        route: "/transactions",
        icon: ArrowLeftRight,
        category: "Principal",
        businessDescription:
          "Hub transactionnel alternatif fournissant un résumé KPI (contreparties actives, OA en attente, or en transit, acquisitions mensuelles) combiné à un tableau complet de transactions paginé et un panneau de ventilation par contrepartie. Conçu comme une vue orientée opérations pour les traders et responsables qui ont besoin de toute l'activité transactionnelle sur un seul écran.",
        technicalDescription:
          "Composant client utilisant SWR pour récupérer les données agrégées via GET /api/dashboard, réutilisant les composants KPICard, TransactionsTable et CounterpartyDashboard. Bilingue via useLanguage. Bascule entre transactions récentes (5) et toutes les transactions.",
        userStory: "N/A",
        dataFlow:
          "GET /api/dashboard → stats + tableau transactions (réutilise l'endpoint d'agrégation du tableau de bord)",
        permissions: "Trader, Responsable Opérations, Officier de Conformité",
      },
      {
        id: "previsions",
        name: "Prévisions (Courbes de Marché)",
        route: "/previsions",
        icon: TrendingUp,
        category: "Principal",
        businessDescription:
          "Visualiseur de courbes de marché agrégeant sept courbes financières clés pour la gestion des réserves : taux de dépôt XAU, SOFR OIS (swap indexé au jour le jour), taux forward XAU, courbe des taux US Treasury, courbe forward cuivre, taux forward FX et volatilité implicite or. Chaque courbe affiche les valeurs bid/mid/ask sur plusieurs maturités, variations J-1 et S-1, avec vues individuelle et normalisée. Purement affichage — aucune modification de données.",
        technicalDescription:
          "Composant client uniquement (~500 lignes). Les données de courbes sont statiques/codées en dur. LineChart Recharts pour les vues individuelle/normalisée. États ViewMode (individual | normalized), PriceMode (bid | mid | ask) et CompareRef (J+1 | J+7 | M+1). Export via téléchargement CSV. Bilingue via useLanguage.",
        userStory: "N/A",
        dataFlow:
          "Données statiques en mémoire. Intégration future : GET /api/market-data/curves → flux de prix en direct.",
        permissions: "Gestionnaire des Risques, Trader, Gestionnaire de Réserves",
      },
      {
        id: "calibration",
        name: "Calibration de Liquidité",
        route: "/calibration",
        icon: Sliders,
        category: "Principal",
        businessDescription:
          "Moniteur de trajectoire de base monétaire BCC et outil de calibration des réserves. Affiche la trajectoire effective des avoirs de la banque centrale face aux prévisions pré-programme et post-programme sur 12 mois. Le panneau Facteurs décompose le delta mensuel en ses composantes (achats d'or, opérations Trésor, opérations FX, billets, bons BCC). Le panneau Prévision ajoute une bande de confiance. Un tableau de décomposition des réserves obligatoires montre comment une injection liée aux achats d'or affecte les réserves sur les dépôts CDF et USD. Un tableau de projection fournit les estimations J+1, J+7 et M+1 avec les actions de stérilisation.",
        technicalDescription:
          "Composant client uniquement avec trois vues graphiques (avoirs | facteurs | prevision) pilotées par une bascule d'état ChartView. LineChart et ReferenceArea Recharts pour la visualisation du corridor. Données statiques/codées en dur pour la période pilote actuelle. Bilingue via useLanguage.",
        userStory: "Support MAC-01",
        dataFlow:
          "Données statiques en mémoire. Intégration future : GET /api/bcc/monetary-base → statistiques de base monétaire en direct.",
        permissions: "Gestionnaire des Risques, Analyste Banque Centrale, Administrateur",
      },
      {
        id: "gestion-reserves",
        name: "Gestion des Réserves",
        route: "/gestion-reserves",
        icon: PieChart,
        category: "Principal",
        businessDescription:
          "Reserve Desk — Moteur d'allocation : outil complet de gestion de portefeuille de réserves intégré en iframe. Sept écrans : (1) Vue d'ensemble — KPI portefeuille, donut d'allocation d'actifs, composition devises, résumé statut contraintes ; (2) Positions — tableau de positions filtrable/recherchable avec classe d'actif, devise, émetteur, notation, valeur de marché, duration, rendement, liquidité ; (3) Nouvelle optimisation — types d'exécution stratégique/tactique, configuration des contraintes, liste de validation pré-exécution, déclencheur d'optimisation ; (4) Recommandation — recommandation d'allocation avec vérification des contraintes, ordres suggérés, justification narrative, robustesse scénarielle, workflow d'approbation ; (5) Hypothèses — modèles d'hypothèses d'optimisation réutilisables (inflation, taux, change, spreads) ; (6) Scénarios — bibliothèque de scénarios de stress (choc de taux, spread crédit, choc FX, majoration des sorties) ; (7) Politique & Limites — jeux de limites de politique d'investissement et de risque versionnés avec workflow brouillon/soumettre/approuver.",
        technicalDescription:
          "Wrapper React (app/gestion-reserves/page.tsx) héberge une application HTML autonome (/public/reserve-engine.html) dans une iframe. La navigation par onglets est gérée par le wrapper React qui envoie postMessage({action:'nav', screen}) et postMessage({action:'lang', lang}) à l'iframe. L'iframe expose window.goScreen pour la navigation directe. La langue est synchronisée depuis le LanguageContext global (clé localStorage 'gold-acquisition-language') vers l'iframe au chargement et lors de chaque changement de langue. Le moteur HTML contient ses propres données de simulation JS et son dictionnaire i18n EN/FR pour la traduction des 7 écrans.",
        userStory: "RES-01",
        dataFlow:
          "Simulation entièrement côté client. L'iframe lit localStorage pour la langue courante. Aucun appel API. Futur : GET /api/reserves/portfolio → données de positions en direct.",
        permissions: "Gestionnaire de Réserves, Gestionnaire des Risques, Administrateur",
      },
      {
        id: "manifest-queue",
        name: "File Manifestes",
        route: "/manifest-queue",
        icon: Inbox,
        category: "Opérations",
        businessDescription:
          "File d'attente pour gérer le cycle de révision des manifestes d'exportation entre la contrepartie et l'équipe Conformité Commerce BCC. Chaque manifeste progresse selon : Brouillon → Soumis → (Accepté | Retourné). Les officiers de conformité peuvent accepter (faisant avancer le PO vers prêt-pour-dispatch) ou retourner avec un code de motif et des notes, ce qui le rouvre pour correction par la contrepartie. Affiche le nombre de tentatives, les horodatages de soumission et révision, les pièces jointes et les métriques de délai.",
        technicalDescription:
          "Composant client récupérant via GET /api/manifest-queue (SWR). Filtrable par statut. Boutons d'action inline (Accepter / Retourner) déclenchent des PUT. Le dialogue de retour capture le code de motif et des notes en texte libre. Liens vers la page de détail manifeste /purchase-orders/[id]/manifest.",
        userStory: "N/A",
        dataFlow:
          "GET /api/manifest-queue → tables manifests + purchase_orders. PUT /api/purchase-orders/[id]/manifest → transitions de statut",
        permissions: "Officier de Conformité Commerce, Officier de Conformité Senior",
      },
      {
        id: "po-lifecycle",
        name: "Cycle de Vie PO",
        route: "/po-lifecycle",
        icon: GitMerge,
        category: "Opérations",
        businessDescription:
          "Diagramme de workflow visuel et interactif du cycle de vie complet des ordres d'achat, rendu sous forme de carte SVG à couloirs. Montre chaque nœud de statut (BCC interne, contrepartie, systèmes externes) et chaque flèche de transition, codés par couleur selon l'acteur : opérations BCC (bleu), contrepartie (orange), systèmes de paiement/banque (ambre), nœuds optionnels/futurs (ardoise). Cliquer sur un nœud met en surbrillance le couloir concerné. Les comptages de statut en direct récupérés via API montrent combien de PO se trouvent dans chaque état. Utile pour l'onboarding, la formation et le suivi.",
        technicalDescription:
          "Composant client rendant un SVG dans un espace de coordonnées virtuelles 1520×910 dimensionné de façon responsive via positionnement CSS en pourcentage. Les positions des nœuds utilisent les helpers pX/pY. Comptages récupérés via SWR depuis GET /api/po-lifecycle/counts. Cliquer sur un nœud appelle setHighlighted. Labels bilingues.",
        userStory: "N/A",
        dataFlow:
          "GET /api/po-lifecycle/counts → comptage par statut PO depuis la table purchase_orders",
        permissions: "Tous les utilisateurs authentifiés (lecture seule)",
      },
    ],
    workflow: {
      title: "Workflow de Bout en Bout",
      steps: [
        {
          phase: "1. Intégration Contrepartie",
          description:
            "Enregistrer nouveau fournisseur d'or avec documents KYC",
          userStory: "N/A",
          route: "/onboarding",
        },
        {
          phase: "2. Screening de Conformité",
          description:
            "Vérifications automatisées sanctions/PPE/médias défavorables avec score préliminaire",
          userStory: "N/A",
          route: "/screening/[id]",
        },
        {
          phase: "3. Évaluation des Risques",
          description:
            "Attribution complète du niveau de risque avec EDD pour entités à haut risque",
          userStory: "N/A",
          route: "/risk-management/[id]/assess",
        },
        {
          phase: "4. Création Ordre d'Achat",
          description: "Créer ordre d'acquisition d'or avec prix LBMA",
          userStory: "N/A",
          route: "/purchase-orders/new",
        },
        {
          phase: "5. Double Approbation",
          description:
            "Porte de conformité et double approbation pour grandes transactions",
          userStory: "N/A",
          route: "/purchase-orders/[id]",
        },
        {
          phase: "6. Dispatch Pré-Expédition",
          description:
            "Validation des documents, vérification du manifeste et autorisation de dispatch",
          userStory: "N/A",
          route: "/dispatch/[id]",
        },
        {
          phase: "7. Réception Coffre & Essai",
          description:
            "Enregistrement réception, vérification scellés, planification labo, vérification pureté",
          userStory: "N/A",
          route: "/vault-intake/[id]",
        },
        {
          phase: "8. Valorisation & Règlement",
          description:
            "Tarification LBMA, calcul du règlement, exécution à double approbation",
          userStory: "N/A",
          route: "/settlements/[id]",
        },
        {
          phase: "9. Allocation aux Réserves",
          description:
            "Poids d'or posté au registre des réserves de la banque centrale avec hash d'audit",
          userStory: "N/A",
          route: "/settlements/[id]",
        },
        {
          phase: "10. Piste d'Audit Immuable",
          description:
            "Historique des transactions inviolable avec vérification de chaîne de hash",
          userStory: "N/A",
          route: "/audit#audit-trail",
        },
        {
          phase: "11. Reporting Réglementaire",
          description: "Rapports de conformité FIU/IMF/LBMA auto-générés",
          userStory: "N/A",
          route: "/audit#reports",
        },
        {
          phase: "12. Archivage Long Terme",
          description:
            "Rétention 5 ans avec migration vers stockage froid WORM",
          userStory: "N/A",
          route: "/audit#compliance",
        },
      ],
    },
    database: {
      title: "Schéma de Base de Données",
      tables: [
        {
          name: "counterparties",
          description: "Donn��es maîtresses fournisseurs d'or",
          columns:
            "id, legal_name, registration_number, country, status, risk_level, screening_status",
        },
        {
          name: "ubos",
          description: "Bénéficiaires Effectifs Ultimes",
          columns:
            "id, counterparty_id, full_name, ownership_percentage, is_pep",
        },
        {
          name: "documents",
          description: "Documents KYC/conformité",
          columns: "id, counterparty_id, document_type, file_path, verified",
        },
        {
          name: "screening_results",
          description: "Résultats des vérifications de conformité",
          columns:
            "id, counterparty_id, check_type, result, details, checked_at",
        },
        {
          name: "screening_audit_log",
          description: "Piste d'audit décisions screening",
          columns:
            "id, counterparty_id, preliminary_score, classification, policy_hash",
        },
        {
          name: "risk_assessments",
          description: "Attributions des niveaux de risque",
          columns:
            "id, counterparty_id, overall_score, risk_tier, edd_required",
        },
        {
          name: "risk_audit_log",
          description: "Piste d'audit décisions risque",
          columns: "id, counterparty_id, action, old_tier, new_tier, reason",
        },
        {
          name: "purchase_orders",
          description: "Ordres d'acquisition d'or",
          columns:
            "id, counterparty_id, status, estimated_weight_kg, gold_type, total_estimated_value",
        },
        {
          name: "po_approvals",
          description: "Enregistrements approbation OA",
          columns: "id, purchase_order_id, approver_role, decision, decided_at",
        },
        {
          name: "assays",
          description: "Résultats tests laboratoire",
          columns:
            "id, purchase_order_id, batch_number, gross_weight_kg, purity_percentage",
        },
        {
          name: "dispatch_validations",
          description: " Enregistrements dispatch pré-expédition",
          columns:
            "id, purchase_order_id, status, carrier_id, pickup_date, authorization_hash, dual_approval_complete",
        },
        {
          name: "dispatch_documents",
          description: " Documents d'export",
          columns:
            "id, dispatch_id, document_type, file_path, validated, validation_notes",
        },
        {
          name: "vault_intakes",
          description: " Enregistrements réception coffre",
          columns:
            "id, dispatch_id, tracking_id, seal_numbers, gross_weight_kg, net_weight_kg, operator_otp_verified, custody_log",
        },
        {
          name: "assay_samples",
          description: " Suivi échantillons labo",
          columns:
            "id, vault_intake_id, sample_id, lab_id, assay_method, sla_deadline, status",
        },
        {
          name: "assay_results",
          description: " Vérification pureté",
          columns:
            "id, assay_sample_id, au_purity, ag_content, cu_content, fe_content, pure_au_weight_kg, certificate_path",
        },
        {
          name: "settlements",
          description: " Enregistrements valorisation & règlement",
          columns:
            "id, vault_intake_id, lbma_fixing_type, lbma_rate, gross_value, total_deductions, net_payable, currency, status",
        },
        {
          name: "settlement_approvals",
          description: " Enregistrements double approbation",
          columns:
            "id, settlement_id, approver_role, approver_name, otp_verified, approved_at",
        },
        {
          name: "reserve_allocations",
          description: " Entrées registre réserves",
          columns:
            "id, settlement_id, pure_au_weight_kg, reserve_account_id, valuation_date, entry_status, audit_hash",
        },
        {
          name: "audit_entries",
          description: " Événements d'audit immuables",
          columns:
            "id, transaction_id, event_type, actor_id, actor_type, ip_address, device_fingerprint, previous_hash, current_hash, timestamp",
        },
        {
          name: "regulatory_reports",
          description: " Rapports conformité générés",
          columns:
            "id, report_type, transaction_ids, format, digital_signature, submission_status, generated_at",
        },
        {
          name: "export_packages",
          description: " Enregistrements export données",
          columns:
            "id, export_format, field_mapping, date_range, manifest_hash, digital_signature, created_by, created_at",
        },
        {
          name: "retention_status",
          description: " Suivi archivage",
          columns:
            "id, transaction_id, retention_expiry, archival_status, worm_storage_path, last_verification",
        },
        {
          name: "audit_trail",
          description: "Chaîne cryptographique liant tous les enregistrements",
          columns:
            "id, entity_type, entity_id, previous_hash, current_hash, created_at",
        },
      ],
    },
  },
};

type DocumentationLanguage = "en" | "fr";

interface CurrentDocumentationPage {
  id: string;
  name: string;
  route: string;
  icon: ElementType;
  category: string;
  businessDescription: string;
  technicalDescription: string;
  userStory: string;
  dataFlow: string;
  permissions: string;
  algorithm?: string;
  businessRules?: string[];
}

interface CurrentPageDefinition {
  id: string;
  route: string;
  icon: ElementType;
  group: "pilotage" | "operations" | "specialized" | "system" | "admin" | "public";
  name: Record<DocumentationLanguage, string>;
  business: Record<DocumentationLanguage, string>;
  technical: Record<DocumentationLanguage, string>;
  dataFlow: string;
  permissions: Record<DocumentationLanguage, string>;
  userStory?: string;
  algorithm?: string;
  businessRules?: Record<DocumentationLanguage, string[]>;
}

const categoryLabels: Record<CurrentPageDefinition["group"], Record<DocumentationLanguage, string>> = {
  pilotage: { en: "Pilotage", fr: "Pilotage" },
  operations: { en: "Operations", fr: "Opérations" },
  specialized: { en: "Specialized tools", fr: "Outils spécialisés" },
  system: { en: "System", fr: "Système" },
  admin: { en: "Administration", fr: "Administration" },
  public: { en: "Public access", fr: "Accès public" },
};

const currentPageDefinitions: CurrentPageDefinition[] = [
  {
    id: "market-oversight", route: "/", icon: LayoutDashboard, group: "pilotage",
    name: { en: "Market Oversight", fr: "Market Oversight" },
    business: { en: "Central-bank market dashboard covering gold, currencies, commodities, BCC bills, liquidity, peer benchmarks, signals and alerts.", fr: "Tableau de pilotage de la banque centrale couvrant l’or, les devises, les matières premières, les Bons BCC, la liquidité, les comparaisons, signaux et alertes." },
    technical: { en: "Client dashboard combining application settings, SWR data and in-page market datasets. /market-oversight redirects to this route.", fr: "Tableau client combinant les paramètres applicatifs, des données SWR et les jeux de données de marché de la page. /market-oversight redirige vers cette route." },
    dataFlow: "GET /api/dashboard + lib/app-settings → Market Oversight", permissions: { en: "Authenticated users", fr: "Utilisateurs authentifiés" },
  },
  {
    id: "counterparties", route: "/counterparties et /counterparties/[id]", icon: Users, group: "pilotage",
    name: { en: "Counterparties and Refineries", fr: "Contreparties et raffineries" },
    business: { en: "Registry and detail view for trading houses and refineries, including identity type, gold source, UBOs, KYC documents, banking details and accreditation data.", fr: "Registre et fiche détaillée des maisons de négoce et raffineries : type d’identité, source d’or, bénéficiaires effectifs, documents KYC, coordonnées bancaires et accréditations." },
    technical: { en: "List and dynamic detail/edit screens backed by the counterparties, ubos, documents and screening_results tables.", fr: "Liste et fiche dynamique consultable/modifiable adossées aux tables counterparties, ubos, documents et screening_results." },
    dataFlow: "GET/PUT/DELETE /api/counterparties/[id] ↔ counterparties + ubos + documents", permissions: { en: "Compliance, Risk Manager, Administrator", fr: "Conformité, Gestionnaire des risques, Administrateur" }, userStory: "N/A",
  },
  {
    id: "onboarding", route: "/onboarding", icon: UserPlus, group: "pilotage",
    name: { en: "Counterparty Onboarding", fr: "Intégration des contreparties" },
    business: { en: "Creates a trading counterparty or refinery with country selection, gold source, UBOs, optional IBAN/SWIFT, KYC files and refinery accreditation attributes.", fr: "Crée une contrepartie de négoce ou une raffinerie avec pays, source d’or, bénéficiaires effectifs, IBAN/SWIFT facultatifs, pièces KYC et attributs d’accréditation." },
    technical: { en: "Single client form posting the entity and UBO payload, then uploading selected documents through multipart requests.", fr: "Formulaire client unique enregistrant l’entité et ses bénéficiaires effectifs, puis téléversant les documents sélectionnés en multipart." },
    dataFlow: "POST /api/counterparties → POST /api/documents → /screening/[id]", permissions: { en: "Compliance Officer", fr: "Agent de conformité" }, userStory: "N/A",
  },
  {
    id: "approval-queue", route: "/approval-queue", icon: CheckSquare, group: "pilotage",
    name: { en: "Approval Queue", fr: "File d’approbation" },
    business: { en: "Reviews counterparties awaiting a compliance decision and exposes their status, source profile and review actions.", fr: "Présente les contreparties en attente d’une décision de conformité avec leur statut, profil de source et actions de revue." },
    technical: { en: "SWR list populated by the approval-queue endpoint from counterparty records.", fr: "Liste SWR alimentée par l’API approval-queue à partir des dossiers de contreparties." },
    dataFlow: "GET /api/approval-queue → counterparties", permissions: { en: "Compliance Officer, Senior Compliance", fr: "Agent de conformité, Responsable conformité" }, userStory: "N/A",
  },
  {
    id: "screening", route: "/screening/[id]", icon: Shield, group: "pilotage",
    name: { en: "Compliance Screening", fr: "Contrôle de conformité" },
    business: { en: "Evaluates sanctions, PEP, adverse media and jurisdiction signals before routing the entity to approval or risk management.", fr: "Évalue les sanctions, PPE, médias défavorables et le risque juridictionnel avant orientation vers l’approbation ou la gestion des risques." },
    technical: { en: "Dynamic screening result page reading the counterparty and persisting checks and score decisions.", fr: "Écran dynamique lisant la contrepartie puis enregistrant les contrôles et la décision de score." },
    dataFlow: "GET/POST /api/screening/[id] ↔ screening_results + counterparties", permissions: { en: "Compliance Officer", fr: "Agent de conformité" }, userStory: "N/A",
  },
  {
    id: "risk-management", route: "/risk-management, /risk-management/[id] et /risk-management/[id]/assess", icon: Shield, group: "pilotage",
    name: { en: "Risk Management", fr: "Gestion des risques" },
    business: { en: "Tracks pending and completed assessments, displays risk factors and records a tier. The source risk is initialized from the gold source stored during onboarding.", fr: "Suit les évaluations en attente et réalisées, présente les facteurs de risque et attribue un niveau. Le risque source reprend la source d’or enregistrée lors de l’intégration." },
    technical: { en: "SWR dashboards and a dynamic assessment form posting weighted scores and EDD indicators.", fr: "Tableaux SWR et formulaire dynamique enregistrant les scores pondérés et indicateurs EDD." },
    dataFlow: "GET/POST /api/risk-assessments + GET /api/counterparties/[id] → risk_assessments", permissions: { en: "Risk Manager, Senior Compliance", fr: "Gestionnaire des risques, Responsable conformité" }, userStory: "N/A",
    algorithm: "Overall = Country × 30% + Source × 25% + PEP × 20% + Volume × 15% + Feed confidence × 10%\nASM/Mercury flag: +15 · CAHRA: +20",
  },
  {
    id: "risk-tools", route: "/risk-management/feeds et /risk-management/audit-log", icon: Database, group: "pilotage",
    name: { en: "Risk Feeds and Audit", fr: "Sources et journal de risque" },
    business: { en: "Provides the risk-feed configuration view and the history of risk-tier decisions.", fr: "Fournit la vue de configuration des sources de risque et l’historique des décisions de niveau de risque." },
    technical: { en: "Dedicated client views; the audit history is read through the risk-audit-log endpoint.", fr: "Vues clientes dédiées ; l’historique est lu via l’API risk-audit-log." },
    dataFlow: "GET /api/risk-audit-log ↔ risk_audit_log", permissions: { en: "Risk Manager, Auditor", fr: "Gestionnaire des risques, Auditeur" }, userStory: "N/A",
  },
  {
    id: "transactions", route: "/transactions", icon: ArrowLeftRight, group: "pilotage",
    name: { en: "Transactions", fr: "Transactions" },
    business: { en: "Consolidated view of gold transactions and their financial and operational status.", fr: "Vue consolidée des transactions d’or et de leur statut financier et opérationnel." },
    technical: { en: "Client reporting view linked to operational records and dashboard data.", fr: "Vue de reporting cliente reliée aux enregistrements opérationnels et aux données du tableau de bord." },
    dataFlow: "transactions + purchase_orders + settlements → transaction view", permissions: { en: "Authenticated users with page access", fr: "Utilisateurs authentifiés autorisés" },
  },
  {
    id: "purchase-orders", route: "/purchase-orders, /purchase-orders/new, /purchase-orders/[id], /edit et /respond", icon: ShoppingCart, group: "operations",
    name: { en: "Purchase Orders", fr: "Bons de commande" },
    business: { en: "Creates, reviews, approves and sends gold purchase orders. Refineries are excluded from the supplier list; bullion orders can select a refinery separately.", fr: "Crée, révise, approuve et transmet les bons de commande d’or. Les raffineries sont exclues de la liste des fournisseurs ; un PO de lingots peut sélectionner séparément une raffinerie." },
    technical: { en: "List, create, detail, edit and counterparty-response routes backed by purchase_orders and po_approvals.", fr: "Routes liste, création, détail, modification et réponse contrepartie adossées à purchase_orders et po_approvals." },
    dataFlow: "GET/POST/PUT /api/purchase-orders → purchase_orders + po_approvals", permissions: { en: "Trading Officer, Approver, Counterparty", fr: "Agent de marché, Approbateur, Contrepartie" }, userStory: "N/A",
  },
  {
    id: "manifests", route: "/purchase-orders/[id]/manifest et /manifest-queue", icon: Inbox, group: "operations",
    name: { en: "Shipment Manifests", fr: "Manifestes d’expédition" },
    business: { en: "Allows the counterparty to submit shipment details and documents, then lets the central bank accept, return or reject the manifest with SLA monitoring.", fr: "Permet à la contrepartie de soumettre les données et documents d’expédition, puis à la banque centrale d’accepter, retourner ou rejeter le manifeste avec suivi SLA." },
    technical: { en: "Manifest wizard, document routes and review queue backed by counterparty_manifests and manifest_documents.", fr: "Assistant manifeste, routes documentaires et file de revue adossés à counterparty_manifests et manifest_documents." },
    dataFlow: "POST /api/purchase-orders/[id]/manifest → GET /api/manifest-queue", permissions: { en: "Counterparty, Vault/Operations Officer", fr: "Contrepartie, Agent coffre/opérations" }, userStory: "N/A",
  },
  {
    id: "dispatch", route: "/dispatch et /dispatch/[id]", icon: Truck, group: "operations",
    name: { en: "Dispatch", fr: "Expédition" },
    business: { en: "Validates shipment documents, carrier information and dual authorization before transit to the vault.", fr: "Valide les documents d’expédition, le transporteur et la double autorisation avant le transit vers le coffre." },
    technical: { en: "Dispatch list and dynamic validation page using dispatch manifests, documents and authorization endpoints.", fr: "Liste et validation dynamique utilisant les API de manifeste de dispatch, documents et autorisation." },
    dataFlow: "GET /api/dispatch → /api/dispatch/[id]/documents → /authorize", permissions: { en: "Operations Officer, Approvers", fr: "Agent des opérations, Approbateurs" }, userStory: "N/A",
  },
  {
    id: "vault-intake", route: "/vault-intake et /vault-intake/[id]", icon: Warehouse, group: "operations",
    name: { en: "Vault Intake and Assay", fr: "Réception coffre et essai" },
    business: { en: "Receives a dispatched PO with known counterparty, PO and manifest data prefilled; records seals, counts, custody, weighing, sampling and assay results.", fr: "Réceptionne un PO expédié avec préremplissage des données connues de la contrepartie, du PO et du manifeste ; enregistre scellés, comptage, garde, pesée, échantillonnage et essai." },
    technical: { en: "Multi-step dynamic form persisted in vault_receptions with document/photo helpers and assay fields.", fr: "Formulaire dynamique multi-étapes persisté dans vault_receptions avec gestion des documents, photos et résultats d’essai." },
    dataFlow: "GET/POST/PUT /api/vault-intake/[id] ↔ vault_receptions + purchase_orders + manifests", permissions: { en: "Vault Officer, Assay Officer", fr: "Agent coffre, Agent d’essai" }, userStory: "N/A",
  },
  {
    id: "vault-exceptions", route: "/vault-intake/[id]/security, /count-discrepancy et /variance/*", icon: AlertTriangle, group: "operations",
    name: { en: "Vault Exceptions and Referee", fr: "Exceptions coffre et arbitrage" },
    business: { en: "Handles security incidents, bar-count discrepancies, weight/assay variance, counterparty responses and independent referee outcomes.", fr: "Traite les incidents de sécurité, écarts de comptage, écarts de poids ou d’essai, réponses de la contrepartie et résultats d’un arbitre indépendant." },
    technical: { en: "Specialized nested routes backed by security_incidents, count_discrepancies, variance_reviews, variance_responses and referee tables.", fr: "Sous-routes spécialisées adossées aux tables security_incidents, count_discrepancies, variance_reviews, variance_responses et d’arbitrage." },
    dataFlow: "vault-intake exception APIs → review/counterparty/referee outcome", permissions: { en: "Vault Officer, Compliance, Counterparty, Approver", fr: "Agent coffre, Conformité, Contrepartie, Approbateur" }, userStory: "N/A",
  },
  {
    id: "assays", route: "/assays et /assays/[id]", icon: FlaskConical, group: "operations",
    name: { en: "Assays", fr: "Essais" },
    business: { en: "Lists laboratory assays and displays weight, purity, fine-gold content and certificate information.", fr: "Liste les essais de laboratoire et affiche poids, pureté, teneur en or fin et informations du certificat." },
    technical: { en: "List/detail routes reading assays and related purchase-order data.", fr: "Routes liste/détail lisant assays et les données du bon de commande associé." },
    dataFlow: "GET /api/assays et /api/assays/[id] ↔ assays", permissions: { en: "Assay Officer, Operations", fr: "Agent d’essai, Opérations" }, userStory: "N/A",
  },
  {
    id: "refining-orders", route: "/refining-orders/[id]/{approval,dispatch,reserve-eligibility,settlement}", icon: Factory, group: "operations",
    name: { en: "Refining Orders", fr: "Ordres de raffinage" },
    business: { en: "Covers toll-refining order creation, approval, dispatch, outturn reconciliation, reserve-eligibility classification and refiner settlement.", fr: "Couvre la création de l’ordre de raffinage à façon, son approbation, l’expédition, le rapprochement de l’outturn, l’éligibilité aux réserves et le règlement de la raffinerie." },
    technical: { en: "Dedicated React workflow components for each refining stage. The current implementation is a guided operational prototype with local component state.", fr: "Composants React dédiés à chaque étape du raffinage. L’implémentation actuelle est un prototype opérationnel guidé avec état local." },
    dataFlow: "Eligible doré lot → refining order → approval → dispatch → outturn → eligibility → settlement", permissions: { en: "Bullion Desk, Vault/Assay, Reserve Manager, Treasury", fr: "Desk Or, Coffre/Essai, Gestionnaire des réserves, Trésorerie" },
  },
  {
    id: "non-monetary-holdings", route: "/non-monetary-holdings", icon: Package, group: "operations",
    name: { en: "Non-monetary Gold Holdings", fr: "Avoirs d’or non monétaire" },
    business: { en: "Sub-ledger for reserve-ineligible gold with monitoring and remediation through re-refining, accreditation watch or sourcing verification.", fr: "Sous-livre des lots non éligibles aux réserves avec suivi et remédiation par nouveau raffinage, surveillance d’accréditation ou vérification de l’approvisionnement." },
    technical: { en: "Client workflow component displaying holding state and remediation actions.", fr: "Composant client affichant l’état de détention et les actions de remédiation." },
    dataFlow: "Failed reserve-eligibility gate → non-monetary holding → remediation → re-evaluation", permissions: { en: "Reserve Manager, Compliance", fr: "Gestionnaire des réserves, Conformité" },
  },
  {
    id: "settlements", route: "/settlements et /settlements/[id]", icon: Banknote, group: "operations",
    name: { en: "Settlements and Allocation", fr: "Règlements et allocation" },
    business: { en: "Performs valuation, editable deduction review, dual approval, payment execution and reserve allocation. Known logistics and assay costs and counterparty IBAN/SWIFT are prefilled.", fr: "Réalise la valorisation, la révision éditable des déductions, la double approbation, le paiement et l’allocation aux réserves. Les coûts logistiques, frais d’essai et IBAN/SWIFT connus sont préremplis." },
    technical: { en: "List/detail workflow backed by settlements; allocation certificate generation uses a persisted SHA-256 audit hash.", fr: "Workflow liste/détail adossé à settlements ; le certificat d’allocation utilise un hash d’audit SHA-256 persisté." },
    dataFlow: "GET/PUT /api/settlements/[id] → settlements → allocation certificate PDF", permissions: { en: "Finance Officer, Treasury Approver", fr: "Agent financier, Approbateur Trésorerie" }, userStory: "N/A",
  },
  {
    id: "po-lifecycle", route: "/po-lifecycle", icon: GitMerge, group: "operations",
    name: { en: "PO Lifecycle", fr: "Cycle de vie PO" },
    business: { en: "Visual map of purchase-order states, actors, branches and current operational volumes.", fr: "Carte visuelle des statuts du bon de commande, acteurs, embranchements et volumes opérationnels actuels." },
    technical: { en: "Responsive SVG workflow enriched with lifecycle statistics from a dedicated endpoint.", fr: "Workflow SVG responsive enrichi par les statistiques d’une API dédiée." },
    dataFlow: "GET /api/po-lifecycle-stats → lifecycle diagram", permissions: { en: "Operations and oversight roles", fr: "Profils opérations et pilotage" },
  },
  {
    id: "specialized-tools", route: "/previsions, /calibration, /gestion-reserves, /impact-macro et /monetary-policy", icon: TrendingUp, group: "specialized",
    name: { en: "Forecasting and Reserve Tools", fr: "Prévisions et outils de réserves" },
    business: { en: "Specialized simulations for forecasting, calibration, reserve management, macro impact and monetary-policy analysis. These routes exist but are no longer listed in the main sidebar.", fr: "Simulations spécialisées de prévision, calibration, gestion des réserves, impact macro et analyse monétaire. Ces routes existent mais ne figurent plus dans le menu principal." },
    technical: { en: "React wrappers and self-contained HTML engines under public/, synchronized through postMessage and the global language context.", fr: "Wrappers React et moteurs HTML autonomes sous public/, synchronisés par postMessage et le contexte global de langue." },
    dataFlow: "React route ↔ public HTML simulation engine", permissions: { en: "Direct access subject to route authorization", fr: "Accès direct soumis aux autorisations de route" },
  },
  {
    id: "reports-audit", route: "/reports et /audit", icon: FileText, group: "system",
    name: { en: "Reports and Audit Log", fr: "Rapports et journal d’audit" },
    business: { en: "Generates operational reports and exposes the chronological audit history of workflow actions.", fr: "Génère les rapports opérationnels et présente l’historique chronologique des actions du workflow." },
    technical: { en: "PDF/report generators and audit-log API backed by the audit_log table.", fr: "Générateurs PDF/rapports et API audit-log adossée à la table audit_log." },
    dataFlow: "GET /api/audit-log + operational APIs → screen/PDF export", permissions: { en: "Auditor, Compliance, Management", fr: "Auditeur, Conformité, Direction" }, userStory: "N/A",
  },
  {
    id: "settings", route: "/settings", icon: Settings, group: "system",
    name: { en: "Settings", fr: "Paramètres" },
    business: { en: "Configures application-level market and operational values used by the dashboard.", fr: "Configure les valeurs de marché et paramètres opérationnels utilisés par le tableau de pilotage." },
    technical: { en: "Client settings persisted through the application-settings helper.", fr: "Paramètres clients persistés via le module application-settings." },
    dataFlow: "settings UI ↔ lib/app-settings", permissions: { en: "Authorized settings users", fr: "Utilisateurs autorisés aux paramètres" },
  },
  {
    id: "documentation", route: "/documentation", icon: BookOpen, group: "system",
    name: { en: "Documentation", fr: "Documentation" },
    business: { en: "Bilingual functional and technical reference for current pages, workflows, permissions, APIs and database tables, with PDF exports.", fr: "Référence fonctionnelle et technique bilingue des pages, workflows, permissions, API et tables actuelles, avec exports PDF." },
    technical: { en: "Client documentation catalogue rendered from the current route inventory and exported by the PDF generator.", fr: "Catalogue documentaire client construit à partir de l’inventaire actuel des routes et exporté par le générateur PDF." },
    dataFlow: "documentation catalogue → screen or PDF", permissions: { en: "Authenticated users", fr: "Utilisateurs authentifiés" },
  },
  {
    id: "administration", route: "/admin", icon: UserCog, group: "admin",
    name: { en: "Administration", fr: "Administration" },
    business: { en: "Manages users, custom roles and page-level access rights.", fr: "Gère les utilisateurs, les rôles personnalisés et les droits d’accès par page." },
    technical: { en: "Admin-only layout and server actions backed by Better Auth, app_role and role_page_access.", fr: "Layout réservé aux administrateurs et server actions adossés à Better Auth, app_role et role_page_access." },
    dataFlow: "admin actions ↔ users + app_role + role_page_access", permissions: { en: "Administrator only", fr: "Administrateur uniquement" },
  },
  {
    id: "public-access", route: "/accueil, /sign-in et /sign-up", icon: Landmark, group: "public",
    name: { en: "Public Landing and Authentication", fr: "Accueil public et authentification" },
    business: { en: "Public product presentation and authentication entry points.", fr: "Présentation publique du produit et points d’entrée d’authentification." },
    technical: { en: "Public Next.js pages; authentication is handled through Better Auth API routes.", fr: "Pages publiques Next.js ; l’authentification est gérée par les routes API Better Auth." },
    dataFlow: "sign-in/sign-up ↔ /api/auth/[...all]", permissions: { en: "Public", fr: "Public" },
  },
];

function buildCurrentPages(language: DocumentationLanguage): CurrentDocumentationPage[] {
  return currentPageDefinitions.map((page) => ({
    id: page.id,
    name: page.name[language],
    route: page.route,
    icon: page.icon,
    category: categoryLabels[page.group][language],
    businessDescription: page.business[language],
    technicalDescription: page.technical[language],
    userStory: page.userStory ?? "N/A",
    dataFlow: page.dataFlow,
    permissions: page.permissions[language],
    algorithm: page.algorithm,
    businessRules: page.businessRules?.[language],
  }));
}

const currentDatabaseTables = {
  en: [
    { name: "counterparties", description: "Trading counterparty and refinery master records", columns: "identity, contacts, country, banking, type, gold sources, LBMA/refining attributes, status" },
    { name: "ubos", description: "Ultimate beneficial owners", columns: "counterparty_id, full_name, nationality, residence_country, ownership_percent, PEP fields" },
    { name: "documents", description: "KYC and counterparty files", columns: "counterparty_id, type, file_name, file_data, mime_type, status, timestamps" },
    { name: "screening_results", description: "Compliance screening checks", columns: "counterparty_id, check_type, result, details, checked_at" },
    { name: "risk_assessments / risk_audit_log", description: "Risk scores, tiers, EDD and decision history", columns: "factor scores, overall_score, risk_tier, EDD, acknowledgment, actor, timestamps" },
    { name: "purchase_orders / po_approvals", description: "Purchase orders and approval decisions", columns: "counterparty, refinery, gold type, quantities, prices, logistics, assay fee, status, approvals" },
    { name: "counterparty_manifests / manifest_documents", description: "Shipment manifest submissions and files", columns: "PO, shipment, carrier, seals, declared gold, review, SLA, documents" },
    { name: "dispatch_manifests / dispatch_documents", description: "Dispatch validation and authorization", columns: "PO, manifest, carrier, approvals, authorization, document validation" },
    { name: "vault_receptions", description: "Vault receipt, custody, weighing and assay data", columns: "selected PO, arrival, seals, bars, scale, sample, laboratory, purity, certificate, declarations" },
    { name: "security_incidents / count_discrepancies", description: "Vault security and count exceptions", columns: "shipment, incident/discrepancy details, evidence, decision, timestamps" },
    { name: "variance_reviews / variance_responses / bar_variance_records", description: "Weight and assay variance workflow", columns: "shipment, bar, values, response, review state and outcome" },
    { name: "referee_appointments / referee_results", description: "Independent assay referee workflow", columns: "shipment, laboratory, dates, certificate, bar results, notes" },
    { name: "assays", description: "Laboratory assay records", columns: "purchase_order_id, batch, weights, purity, fine gold, laboratory, certificate" },
    { name: "settlements", description: "Valuation, deductions, payment and allocation", columns: "PO, assay, counterparty, fine gold, price, amount, bank reference, deductions, audit_hash, status" },
    { name: "transactions", description: "Gold transaction ledger", columns: "counterparty, type, weight, purity, price, total value, status" },
    { name: "audit_log", description: "Cross-workflow audit history", columns: "entity, action, previous/new status, JSON details, actor, timestamp" },
    { name: "app_role / role_page_access", description: "Custom roles and page-level authorization", columns: "role metadata, page keys" },
    { name: "notifications", description: "In-application notifications", columns: "recipient, event, content, read state, timestamps" },
  ],
  fr: [
    { name: "counterparties", description: "Référentiel des contreparties de négoce et raffineries", columns: "identité, contacts, pays, banque, type, sources d’or, attributs LBMA/raffinage, statut" },
    { name: "ubos", description: "Bénéficiaires effectifs", columns: "counterparty_id, nom, nationalité, résidence, pourcentage de détention, données PPE" },
    { name: "documents", description: "Pièces KYC et documents de contrepartie", columns: "counterparty_id, type, nom, données binaires, type MIME, statut, dates" },
    { name: "screening_results", description: "Contrôles de conformité", columns: "counterparty_id, type de contrôle, résultat, détails, date" },
    { name: "risk_assessments / risk_audit_log", description: "Scores, niveaux de risque, EDD et historique des décisions", columns: "scores des facteurs, score global, niveau, EDD, attestation, acteur, dates" },
    { name: "purchase_orders / po_approvals", description: "Bons de commande et décisions d’approbation", columns: "contrepartie, raffinerie, type d’or, quantités, prix, logistique, frais d’essai, statut, approbations" },
    { name: "counterparty_manifests / manifest_documents", description: "Soumissions de manifestes et documents", columns: "PO, expédition, transporteur, scellés, or déclaré, revue, SLA, documents" },
    { name: "dispatch_manifests / dispatch_documents", description: "Validation et autorisation d’expédition", columns: "PO, manifeste, transporteur, approbations, autorisation, validation documentaire" },
    { name: "vault_receptions", description: "Réception coffre, garde, pesée et essai", columns: "PO, arrivée, scellés, barres, balance, échantillon, laboratoire, pureté, certificat, déclarations" },
    { name: "security_incidents / count_discrepancies", description: "Incidents de sécurité et écarts de comptage", columns: "expédition, détails, preuves, décision, dates" },
    { name: "variance_reviews / variance_responses / bar_variance_records", description: "Workflow des écarts de poids et d’essai", columns: "expédition, barre, valeurs, réponse, état de revue et résultat" },
    { name: "referee_appointments / referee_results", description: "Arbitrage indépendant des essais", columns: "expédition, laboratoire, dates, certificat, résultats par barre, notes" },
    { name: "assays", description: "Enregistrements d’essai laboratoire", columns: "purchase_order_id, lot, poids, pureté, or fin, laboratoire, certificat" },
    { name: "settlements", description: "Valorisation, déductions, paiement et allocation", columns: "PO, essai, contrepartie, or fin, prix, montant, référence bancaire, déductions, audit_hash, statut" },
    { name: "transactions", description: "Registre des transactions d’or", columns: "contrepartie, type, poids, pureté, prix, valeur totale, statut" },
    { name: "audit_log", description: "Historique d’audit transversal", columns: "entité, action, ancien/nouveau statut, détails JSON, acteur, date" },
    { name: "app_role / role_page_access", description: "Rôles personnalisés et autorisations par page", columns: "métadonnées du rôle, clés des pages" },
    { name: "notifications", description: "Notifications dans l’application", columns: "destinataire, événement, contenu, état de lecture, dates" },
  ],
};

function buildCurrentWorkflow(language: DocumentationLanguage) {
  const fr = language === "fr";
  return {
    title: fr ? "Workflow opérationnel actuel" : "Current Operational Workflow",
    steps: [
      { phase: fr ? "1. Intégration" : "1. Onboarding", description: fr ? "Créer la contrepartie ou la raffinerie et déposer les pièces KYC" : "Create the counterparty or refinery and upload KYC files", userStory: "N/A", route: "/onboarding" },
      { phase: "2. Screening", description: fr ? "Contrôler sanctions, PPE, médias et juridiction" : "Check sanctions, PEP, adverse media and jurisdiction", userStory: "N/A", route: "/screening/[id]" },
      { phase: fr ? "3. Risque" : "3. Risk", description: fr ? "Évaluer les facteurs, la source d’or et les exigences EDD" : "Assess factors, stored gold source and EDD requirements", userStory: "N/A", route: "/risk-management/[id]/assess" },
      { phase: fr ? "4. Bon de commande" : "4. Purchase Order", description: fr ? "Créer, approuver et transmettre le PO à la contrepartie" : "Create, approve and send the PO to the counterparty", userStory: "N/A", route: "/purchase-orders/[id]" },
      { phase: fr ? "5. Réponse & manifeste" : "5. Response & Manifest", description: fr ? "Accepter ou négocier le PO, puis soumettre et revoir le manifeste" : "Accept or negotiate the PO, then submit and review the manifest", userStory: "N/A", route: "/purchase-orders/[id]/respond" },
      { phase: fr ? "6. Expédition" : "6. Dispatch", description: fr ? "Valider les documents et la double autorisation de départ" : "Validate documents and dual dispatch authorization", userStory: "N/A", route: "/dispatch/[id]" },
      { phase: fr ? "7. Réception coffre" : "7. Vault Intake", description: fr ? "Préremplir le dossier et vérifier arrivée, scellés, comptage et garde" : "Prefill the record and verify arrival, seals, count and custody", userStory: "N/A", route: "/vault-intake/[id]" },
      { phase: fr ? "8. Pesée & essai" : "8. Weighing & Assay", description: fr ? "Enregistrer les barres, la pesée, l’échantillon et la pureté" : "Record bars, weighing, sample and purity", userStory: "N/A", route: "/vault-intake/[id]" },
      { phase: fr ? "9. Gestion des écarts" : "9. Exception Handling", description: fr ? "Traiter sécurité, comptage, variance, réponse et arbitrage si nécessaire" : "Handle security, count, variance, response and referee when required", userStory: "N/A", route: "/vault-intake/[id]/variance" },
      { phase: fr ? "10. Raffinage (si requis)" : "10. Refining (if required)", description: fr ? "Approuver, expédier, rapprocher l’outturn et classer l’éligibilité" : "Approve, dispatch, reconcile outturn and classify reserve eligibility", userStory: "N/A", route: "/refining-orders/[id]/approval" },
      { phase: fr ? "11. Règlement" : "11. Settlement", description: fr ? "Valoriser, réviser les déductions et exécuter le paiement" : "Value, review deductions and execute payment", userStory: "N/A", route: "/settlements/[id]" },
      { phase: fr ? "12. Allocation ou détention" : "12. Allocation or Holding", description: fr ? "Allouer aux réserves ou transférer au sous-livre non monétaire" : "Allocate to reserves or transfer to the non-monetary sub-ledger", userStory: "N/A", route: "/non-monetary-holdings" },
      { phase: fr ? "13. Audit & reporting" : "13. Audit & Reporting", description: fr ? "Tracer les décisions et produire les rapports/PDF" : "Trace decisions and generate reports/PDFs", userStory: "N/A", route: "/audit" },
    ],
  };
}

export default function DocumentationPage() {
  const { language, t } = useLanguage();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  const documentationLanguage: DocumentationLanguage = language === "fr" ? "fr" : "en";
  const baseContent = documentationLanguage === "fr" ? documentationSections.fr : documentationSections.en;
  const content = {
    ...baseContent,
    overview: {
      ...baseContent.overview,
      description: documentationLanguage === "fr"
        ? "KONEX est la plateforme de pilotage, conformité et exécution du programme d’acquisition d’or de la Banque Centrale du Congo. Elle couvre les contreparties et raffineries, le cycle complet des bons de commande, les manifestes, le coffre, les essais, le raffinage, les règlements, l’allocation et l’audit."
        : "KONEX is the Central Bank of Congo platform for oversight, compliance and execution of the gold-acquisition programme. It covers counterparties and refineries, the full purchase-order lifecycle, manifests, vault intake, assays, refining, settlements, allocation and audit.",
      keyFeatures: documentationLanguage === "fr"
        ? ["Intégration KYC/AML des contreparties et raffineries", "Screening et évaluation du risque avec source d’or enregistrée", "Cycle PO, réponse contrepartie et manifeste documentaire", "Réception coffre, essai, écarts et arbitrage", "Raffinage, éligibilité, avoirs non monétaires et règlements", "Audit, rapports et contrôle des accès"]
        : ["KYC/AML onboarding for counterparties and refineries", "Screening and risk assessment using the stored gold source", "PO lifecycle, counterparty response and document manifest", "Vault intake, assay, exceptions and referee", "Refining, eligibility, non-monetary holdings and settlements", "Audit, reporting and access control"],
    },
    pages: buildCurrentPages(documentationLanguage),
    workflow: buildCurrentWorkflow(documentationLanguage),
    database: {
      title: documentationLanguage === "fr" ? "Schéma de données actuel" : "Current Data Schema",
      tables: currentDatabaseTables[documentationLanguage],
    },
  };
  const selectedPageData = selectedPage
    ? content.pages.find((p) => p.id === selectedPage)
    : null;

  // Function to download full documentation PDF
  const handleDownloadDocumentation = () => {
    const sections = content.pages.map((page) => ({
      id: page.id,
      name: page.name,
      route: page.route,
      category: page.category,
      businessDescription: page.businessDescription,
      technicalDescription: page.technicalDescription,
      userStory: page.userStory,
      dataFlow: page.dataFlow,
      permissions: page.permissions,
      algorithm: page.algorithm,
      businessRules: page.businessRules,
    }));

    generateDocumentationPDF({
      title: content.title,
      subtitle: content.subtitle,
      language: language as "en" | "fr",
      sections,
      databaseTables: content.database.tables,
    });
  };

  // Function to download Cahier des Charges PDF
  const handleDownloadCahierDesCharges = () => {
    const sections = content.pages.map((page) => ({
      id: page.id,
      name: page.name,
      route: page.route,
      category: page.category,
      businessDescription: page.businessDescription,
      technicalDescription: page.technicalDescription,
      userStory: page.userStory,
      dataFlow: page.dataFlow,
      permissions: page.permissions,
      algorithm: page.algorithm,
      businessRules: page.businessRules,
    }));

    generateCahierDesChargesPDF({
      language: language as "en" | "fr",
      projectName: "Konex - Gold Acquisition Platform",
      client: "Central Bank",
      version: "1.0.0",
      sections,
    });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader title={content.title} subtitle={content.subtitle} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-8">
              {/* Overview Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {content.overview.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleDownloadDocumentation}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        {language === "fr"
                          ? "Documentation PDF"
                          : "Documentation PDF"}
                      </Button>
                      <Button
                        variant="default"
                        onClick={handleDownloadCahierDesCharges}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        {language === "fr"
                          ? "Cahier des Charges"
                          : "Requirements Spec"}
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {language === "fr"
                      ? "Telechargez la documentation technique complete ou le cahier des charges avec specifications fonctionnelles et techniques."
                      : "Download the complete technical documentation or the requirements specification with functional and technical specs."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {content.overview.description}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {content.overview.keyFeatures.map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-3 rounded-lg bg-muted/50"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Workflow Diagram */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    {content.workflow.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {content.workflow.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex flex-col items-center p-3 rounded-lg border bg-card min-w-35">
                          {step.userStory && step.userStory !== "N/A" && (
                            <Badge variant="outline" className="mb-2">
                              {step.userStory}
                            </Badge>
                          )}
                          <span className="text-xs font-semibold text-center">
                            {step.phase}
                          </span>
                          <span className="text-xs text-muted-foreground text-center mt-1">
                            {step.description}
                          </span>
                        </div>
                        {i < content.workflow.steps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pages Documentation */}
              <Tabs defaultValue="pages" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="pages">
                    {language === "fr"
                      ? "Pages de l'Application"
                      : "Application Pages"}
                  </TabsTrigger>
                  <TabsTrigger value="database">
                    {language === "fr" ? "Base de Données" : "Database Schema"}
                  </TabsTrigger>
                  <TabsTrigger value="glossary">
                    {language === "fr" ? "Lexique" : "Glossary"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pages" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* Page List */}
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {language === "fr" ? "Navigation" : "Navigation"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-150">
                          <div className="space-y-1 p-4 pt-0">
                            {Array.from(new Set(content.pages.map((page) => page.category)))
                              .map((category) => (
                                <div key={category} className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
                                    {category}
                                  </p>
                                  {content.pages
                                    .filter((p) => p.category === category)
                                    .map((page) => {
                                      const Icon = page.icon;
                                      return (
                                        <button
                                          key={page.id}
                                          onClick={() =>
                                            setSelectedPage(page.id)
                                          }
                                          className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                                            selectedPage === page.id
                                              ? "bg-primary text-primary-foreground"
                                              : "hover:bg-muted",
                                          )}
                                        >
                                          <Icon className="h-4 w-4 shrink-0" />
                                          <span className="truncate">
                                            {page.name}
                                          </span>
                                          <ChevronRight className="h-4 w-4 ml-auto shrink-0 opacity-50" />
                                        </button>
                                      );
                                    })}
                                </div>
                              ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Page Detail */}
                    <Card className="lg:col-span-2">
                      <CardContent className="p-6">
                        {selectedPageData ? (
                          <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const Icon = selectedPageData.icon;
                                  return (
                                    <Icon className="h-8 w-8 text-primary" />
                                  );
                                })()}
                                <div>
                                  <h2 className="text-2xl font-bold">
                                    {selectedPageData.name}
                                  </h2>
                                  <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    {selectedPageData.route}
                                  </code>
                                </div>
                              </div>
                              {selectedPageData.userStory && selectedPageData.userStory !== "N/A" && (
                                <Badge variant="outline">
                                  {selectedPageData.userStory}
                                </Badge>
                              )}
                            </div>

                            {/* Business Description */}
                            <div className="space-y-2">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {language === "fr"
                                  ? "Description Métier"
                                  : "Business Description"}
                              </h3>
                              <p className="text-muted-foreground leading-relaxed">
                                {selectedPageData.businessDescription}
                              </p>
                            </div>

                            {/* Technical Description */}
                            <div className="space-y-2">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Code className="h-4 w-4" />
                                {language === "fr"
                                  ? "Description Technique"
                                  : "Technical Description"}
                              </h3>
                              <p className="text-muted-foreground leading-relaxed">
                                {selectedPageData.technicalDescription}
                              </p>
                            </div>

                            {/* Data Flow */}
                            <div className="space-y-2">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                {language === "fr"
                                  ? "Flux de Données"
                                  : "Data Flow"}
                              </h3>
                              <code className="block text-sm bg-muted p-3 rounded-lg">
                                {selectedPageData.dataFlow}
                              </code>
                            </div>

                            {/* Permissions */}
                            <div className="space-y-2">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                {language === "fr"
                                  ? "Permissions"
                                  : "Permissions"}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {selectedPageData.permissions
                                  .split(", ")
                                  .map((perm, i) => (
                                    <Badge key={i} variant="secondary">
                                      {perm}
                                    </Badge>
                                  ))}
                              </div>
                            </div>

                            {/* Algorithm (if applicable) */}
                            {selectedPageData.algorithm && (
                              <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  {language === "fr"
                                    ? "Algorithme"
                                    : "Algorithm"}
                                </h3>
                                <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto">
                                  {selectedPageData.algorithm.trim()}
                                </pre>
                              </div>
                            )}

                            {/* Business Rules (if applicable) */}
                            {selectedPageData.businessRules && (
                              <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                  <CheckSquare className="h-4 w-4" />
                                  {language === "fr"
                                    ? "Règles Métier"
                                    : "Business Rules"}
                                </h3>
                                <ul className="space-y-1">
                                  {selectedPageData.businessRules.map(
                                    (rule, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                        {rule}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-125 text-center">
                            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="font-semibold mb-2">
                              {language === "fr"
                                ? "Sélectionnez une page"
                                : "Select a Page"}
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                              {language === "fr"
                                ? "Cliquez sur une page dans la liste de navigation pour voir sa documentation détaillée."
                                : "Click on a page in the navigation list to view its detailed documentation."}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="database" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        {content.database.title}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Structure des tables de la base de données PostgreSQL (Neon)"
                          : "PostgreSQL (Neon) database table structure"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {content.database.tables.map((table, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <code className="text-sm font-semibold text-primary">
                                {table.name}
                              </code>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {table.description}
                            </p>
                            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded block">
                              {table.columns}
                            </code>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="glossary" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        {language === "fr"
                          ? "Lexique des Termes et Abréviations"
                          : "Glossary of Terms & Abbreviations"}
                      </CardTitle>
                      <CardDescription>
                        {language === "fr"
                          ? "Définitions des abréviations clés et termes réglementaires utilisés dans le système Gold Acquisition"
                          : "Key abbreviations and regulatory terms used throughout the Gold Acquisition System"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Regulatory & Compliance Terms */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            {language === "fr"
                              ? "Termes Réglementaires & Conformité"
                              : "Regulatory & Compliance Terms"}
                          </h3>
                          <div className="grid gap-2">
                            {[
                              {
                                abbr: "KYC",
                                full: "Know Your Customer",
                                desc:
                                  language === "fr"
                                    ? "Processus de vérification d'identité et d'évaluation des risques pour l'intégration des contreparties."
                                    : "Identity verification and risk assessment process for onboarding counterparties.",
                              },
                              {
                                abbr: "AML / CFT",
                                full: "Anti-Money Laundering / Combating the Financing of Terrorism",
                                desc:
                                  language === "fr"
                                    ? "Cadres réglementaires mondiaux pour prévenir les flux financiers illicites et le financement du terrorisme."
                                    : "Global regulatory frameworks preventing illicit financial flows and terrorist funding.",
                              },
                              {
                                abbr: "EDD",
                                full: "Enhanced Due Diligence",
                                desc:
                                  language === "fr"
                                    ? "Procédures de conformité supplémentaires requises pour les contreparties à haut risque; bloque la création de PO jusqu'à achèvement."
                                    : "Additional compliance procedures required for high-risk counterparties; blocks PO creation until complete.",
                              },
                              {
                                abbr: "UBO",
                                full: "Ultimate Beneficial Owner",
                                desc:
                                  language === "fr"
                                    ? "Personne(s) physique(s) qui possède(nt) ou contrôle(nt) ultimement une entité contrepartie (seuil ≥25%)."
                                    : "Natural person(s) who ultimately owns or controls a counterparty entity (≥25% threshold).",
                              },
                              {
                                abbr: "PEP",
                                full: "Politically Exposed Person",
                                desc:
                                  language === "fr"
                                    ? "Individu investi d'une fonction publique importante; déclenche un examen de conformité renforcé."
                                    : "Individual with prominent public function; triggers enhanced compliance scrutiny.",
                              },
                              {
                                abbr: "FATF",
                                full: "Financial Action Task Force",
                                desc:
                                  language === "fr"
                                    ? "Organisme intergouvernemental établissant les normes mondiales AML/CFT."
                                    : "Inter-governmental body setting global AML/CFT standards.",
                              },
                              {
                                abbr: "5AMLD",
                                full: "5th Anti-Money Laundering Directive",
                                desc:
                                  language === "fr"
                                    ? "Directive UE étendant le champ d'application AML aux négociants en métaux précieux."
                                    : "EU directive expanding AML scope to include precious metals dealers and traders.",
                              },
                              {
                                abbr: "FIU",
                                full: "Financial Intelligence Unit",
                                desc:
                                  language === "fr"
                                    ? "Agence nationale recevant et analysant les rapports de transactions suspectes."
                                    : "National agency receiving and analyzing suspicious transaction reports.",
                              },
                            ].map((term, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                              >
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono"
                                >
                                  {term.abbr}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">
                                    {term.full}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {term.desc}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Gold Industry Terms */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4 text-amber-500" />
                            {language === "fr"
                              ? "Termes de l'Industrie de l'Or"
                              : "Gold Industry Terms"}
                          </h3>
                          <div className="grid gap-2">
                            {[
                              {
                                abbr: "LBMA",
                                full: "London Bullion Market Association",
                                desc:
                                  language === "fr"
                                    ? "Autorité mondiale sur les métaux précieux de gros; publie le Responsible Gold Guidance (RGG) et les prix de fixing quotidiens."
                                    : "Global authority on wholesale precious metals; publishes Responsible Gold Guidance (RGG) and daily gold fixing prices.",
                              },
                              {
                                abbr: "RGG",
                                full: "Responsible Gold Guidance",
                                desc:
                                  language === "fr"
                                    ? "Cadre LBMA pour la diligence raisonnable de la chaîne d'approvisionnement, la conformité ESG et les normes d'audit."
                                    : "LBMA's framework for supply chain due diligence, ESG compliance, and audit standards.",
                              },
                              {
                                abbr: "ASM / ASGM",
                                full: "Artisanal & Small-Scale Mining / Gold Mining",
                                desc:
                                  language === "fr"
                                    ? "Opérations minières à faible capital et forte main-d'œuvre; toujours classées à haut risque selon LBMA/OECD."
                                    : "Low-capital, high-labor mining operations; always classified as high-risk per LBMA/OECD.",
                              },
                              {
                                abbr: "LSM",
                                full: "Large-Scale Mining",
                                desc:
                                  language === "fr"
                                    ? "Opérations minières industrielles avec surveillance réglementaire formelle et extraction mécanisée."
                                    : "Industrial mining operations with formal regulatory oversight and mechanized extraction.",
                              },
                              {
                                abbr: "CAHRA",
                                full: "Conflict-Affected & High-Risk Areas",
                                desc:
                                  language === "fr"
                                    ? "Zones géographiques avec conflits armés ou gouvernance faible; déclenche une EDD obligatoire."
                                    : "Geographic zones with armed conflict or weak governance; triggers mandatory EDD.",
                              },
                              {
                                abbr: "OECD",
                                full: "Organisation for Economic Co-operation and Development",
                                desc:
                                  language === "fr"
                                    ? "Éditeur de la norme mondiale pour la diligence raisonnable de la chaîne d'approvisionnement minérale responsable."
                                    : "Publisher of global standard for responsible mineral supply chain due diligence.",
                              },
                              {
                                abbr: "Incoterms",
                                full: "International Commercial Terms",
                                desc:
                                  language === "fr"
                                    ? "Termes commerciaux publiés par ICC définissant les responsabilités acheteur/vendeur (FCA, CIF, DAP, EXW)."
                                    : "ICC-published trade terms defining buyer/seller responsibilities (FCA, CIF, DAP, EXW).",
                              },
                            ].map((term, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                              >
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono"
                                >
                                  {term.abbr}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">
                                    {term.full}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {term.desc}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* System & Business Terms */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            {language === "fr"
                              ? "Termes Système & Métier"
                              : "System & Business Terms"}
                          </h3>
                          <div className="grid gap-2">
                            {[
                              {
                                abbr: "PO",
                                full: "Purchase Order",
                                desc:
                                  language === "fr"
                                    ? "Document commercial autorisant une transaction d'acquisition d'or; immuable après soumission."
                                    : "Commercial document authorizing a gold acquisition transaction; immutable upon submission.",
                              },
                              {
                                abbr: "US",
                                full: "User Story",
                                desc:
                                  language === "fr"
                                    ? "Artefact de développement agile définissant une fonctionnalité du point de vue utilisateur."
                                    : "Agile development artifact defining a feature from an end-user perspective.",
                              },
                              {
                                abbr: "MVP",
                                full: "Minimum Viable Product",
                                desc:
                                  language === "fr"
                                    ? "Périmètre de lancement initial couvrant les workflows d'intégration, risque, PO et coffre-fort."
                                    : "Initial release scope covering core onboarding, risk, PO, and vault workflows.",
                              },
                              {
                                abbr: "IMF / SDDS",
                                full: "International Monetary Fund / Special Data Dissemination Standard",
                                desc:
                                  language === "fr"
                                    ? "Cadre pour le reporting des données de réserves des banques centrales et la conformité d'audit."
                                    : "Framework for central bank reserve data reporting and audit compliance.",
                              },
                              {
                                abbr: "UN / EU / OFAC",
                                full: "United Nations / European Union / Office of Foreign Assets Control",
                                desc:
                                  language === "fr"
                                    ? "Principales listes de sanctions internationales vérifiées lors des contrôles de conformité préliminaires."
                                    : "Primary international sanctions lists screened during preliminary compliance checks.",
                              },
                            ].map((term, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                              >
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono"
                                >
                                  {term.abbr}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">
                                    {term.full}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {term.desc}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Technical Terms */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Code className="h-4 w-4 text-emerald-500" />
                            {language === "fr"
                              ? "Termes Techniques"
                              : "Technical Terms"}
                          </h3>
                          <div className="grid gap-2">
                            {[
                              {
                                abbr: "API",
                                full: "Application Programming Interface",
                                desc:
                                  language === "fr"
                                    ? "Points d'accès techniques permettant l'échange de données sécurisé système-à-système."
                                    : "Technical endpoints enabling secure system-to-system data exchange and workflow automation.",
                              },
                              {
                                abbr: "RBAC",
                                full: "Role-Based Access Control",
                                desc:
                                  language === "fr"
                                    ? "Modèle de sécurité restreignant l'accès système selon les fonctions utilisateur (Trade Manager, Compliance, Risk)."
                                    : "Security model restricting system access based on user job functions (Trade Manager, Compliance, Risk).",
                              },
                              {
                                abbr: "MFA / OTP",
                                full: "Multi-Factor Authentication / One-Time Password",
                                desc:
                                  language === "fr"
                                    ? "Exigence de sécurité pour les signataires à double approbation; 2+ facteurs de vérification obligatoires."
                                    : "Security requirement for dual-approval signers; 2+ verification factors mandatory.",
                              },
                              {
                                abbr: "FIPS / TLS / AES",
                                full: "Federal Info Processing Standards / Transport Layer Security / Advanced Encryption Standard",
                                desc:
                                  language === "fr"
                                    ? "Normes cryptographiques assurant la protection des données en transit (TLS 1.3) et au repos (AES-256)."
                                    : "Cryptographic standards ensuring data protection in transit (TLS 1.3) and at rest (AES-256).",
                              },
                              {
                                abbr: "SHA-256",
                                full: "Secure Hash Algorithm 256-bit",
                                desc:
                                  language === "fr"
                                    ? "Fonction de hachage cryptographique utilisée pour l'immutabilité des PO et l'intégrité du journal d'audit."
                                    : "Cryptographic hash function used for PO immutability and audit log integrity.",
                              },
                              {
                                abbr: "JSON / CSV / XML",
                                full: "JavaScript Object Notation / Comma-Separated Values / Extensible Markup Language",
                                desc:
                                  language === "fr"
                                    ? "Formats d'échange de données standard pour les exports d'audit et les payloads API."
                                    : "Standard data interchange formats for audit exports and API payloads.",
                              },
                            ].map((term, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                              >
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono"
                                >
                                  {term.abbr}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">
                                    {term.full}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {term.desc}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
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
