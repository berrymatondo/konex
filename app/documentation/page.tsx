"use client";

import { useState } from "react";
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
        "Automated preliminary compliance scoring (US-01)",
        "Risk-based due diligence workflow (US-02)",
        "Purchase order management with dual approval (US-03)",
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
        userStory: "US-01 Screen 3",
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
        userStory: "US-01 Screen 1",
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
        userStory: "US-01 Screen 1",
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
          "Compliance screening dashboard implementing the US-01 Preliminary Compliance Score algorithm. Displays automated checks: Sanctions (blocking gate), PEP status (40% weight), Adverse Media (35% weight), and Jurisdiction Risk (25% weight). Calculates final score and risk classification (LOW 0-25, MEDIUM 26-60, HIGH 61-99, BLOCKED 100).",
        technicalDescription:
          "Interactive form allowing manual override of screening inputs. Real-time score calculation using weighted formula. Score breakdown visualization with progress indicators. Saves to screening_results table with SHA-256 hash for audit integrity.",
        userStory: "US-01, US-01-bis",
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
        userStory: "US-01 Screen 3",
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
          "Dashboard for comprehensive risk tier assignment per US-02. Shows counterparties pending risk review, distribution of risk tiers across portfolio, and EDD (Enhanced Due Diligence) requirements. Entry point for detailed risk assessments.",
        technicalDescription:
          "Aggregates risk_assessments table data. Charts using Recharts for tier distribution visualization. Links to /risk-management/[id]/assess for individual assessments.",
        userStory: "US-02 Screen 2",
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
          "Detailed risk scoring interface implementing US-02 algorithm. Evaluates: Country Risk (30%), Source Type (25%), UBO/PEP (20%), Transaction History (15%), Feed Confidence (10%). Applies automatic flags for ASM/Mercury exposure (+15) and CAHRA zones (+20). Triggers EDD workflow for HIGH/CRITICAL results.",
        technicalDescription:
          "Form with sliders and dropdowns for each risk factor. Real-time score calculation with weighted sum. Mandatory acknowledgment checkboxes for policy compliance. Creates risk_assessments record and audit log entry on submission.",
        userStory: "US-02 Screen 2, 3",
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
        userStory: "US-02 Screen 1",
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
        userStory: "US-02 Screen 4",
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
        id: "purchase-orders",
        name: "Purchase Orders",
        route: "/purchase-orders",
        icon: ShoppingCart,
        category: "Operations",
        businessDescription:
          "Central registry of all gold purchase orders. Tracks order lifecycle from Draft → Submitted → Pending Approval → Approved → In Transit → Received. Displays estimated values, LBMA pricing, and delivery status.",
        technicalDescription:
          "DataTable component fetching from /api/purchase-orders with JOINs to counterparties for supplier details. Status-based filtering and sorting by date/value. Row actions for view/edit/cancel operations.",
        userStory: "US-03 Screen 4",
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
          "Order entry form for new gold acquisitions. Enforces US-03 compliance gate: only APPROVED counterparties with completed EDD (if HIGH risk) can be selected. Captures: estimated weight, gold type (Doré/Bullion), purity range, Incoterms, delivery vault, expected dispatch date. Integrates real-time LBMA pricing with 15-minute lock window.",
        technicalDescription:
          "Multi-step form with counterparty selector filtered by status/EDD completion. Price calculator component fetching live LBMA rates. Timer component for price lock expiry. Draft save functionality for incomplete orders.",
        userStory: "US-03 Screen 1, 2",
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
          "Complete order management interface with three tabs: Details (order summary), Approval (dual-approval workflow for >$1M transactions), and Tracking (dispatch monitoring with timeline). Implements US-03 compliance gate with real-time sanctions re-check before approval.",
        technicalDescription:
          "Tabbed interface with dynamic content based on order status. Approval tab shows OTP/MFA input for second approver. Tracking tab displays shipment timeline with QR code for tracking ID. Status transitions trigger audit log entries.",
        userStory: "US-03 Screen 3, 4",
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
          "Pre-shipment documentation and dispatch validation module (US-04). Central hub for validating export documents, shipping manifests, and customs clearance before gold dispatch. Tracks validation status from pending documents through final dispatch confirmation. Ensures regulatory compliance before handoff to vault intake.",
        technicalDescription:
          "Dashboard showing all dispatch validations with status indicators. Filterable by status (pending_docs, docs_validated, pending_authorization, dispatched, in_transit). Links to detailed validation workflow pages. Integrates with purchase_orders table for PO data.",
        userStory: "US-04",
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
          "Four-stage pre-shipment validation workflow implementing US-04: (1) Document Upload & Validation - validates export license, certificate of origin, transport docs, and insurance against PO terms; (2) Manifest & Customs Check - verifies weight tolerances (±5%), seal numbers, and customs pre-clearance; (3) Dispatch Authorization - carrier assignment with dual-approval for >$1M shipments; (4) Dispatch Confirmation - success screen with tracking ID and US-05 handoff trigger.",
        technicalDescription:
          "Tabbed interface with 4 stages matching US-04 screens. Document validation uses OCR simulation for metadata extraction. Weight tolerance gauge uses SVG semi-circle visualization. Dual approval implements signature + OTP pattern. Authorization generates SHA-256 hash for immutability. On dispatch, triggers transition to in_transit status.",
        userStory: "US-04 Screen 1, 2, 3, 4",
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
          "Carrier pickup triggers automatic US-05 transition",
        ],
      },
      {
        id: "vault-intake",
        name: "Vault Intake",
        route: "/vault-intake",
        icon: Warehouse,
        category: "Operations",
        businessDescription:
          "Physical gold receipt and chain-of-custody initiation (US-05). Central hub for logging vault receipts from dispatched shipments. Tracks receipt status from pending intake through assay completion to settlement handoff. Integrates with US-04 dispatch data and feeds into US-06 settlement.",
        technicalDescription:
          "Dashboard showing all vault intakes with status indicators. Filterable by status (pending_intake, received, assay_scheduled, assayed, pending_settlement). Links to detailed 4-stage workflow pages. Integrates with dispatch_validations and purchase_orders tables.",
        userStory: "US-05",
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
          "Four-stage vault intake workflow implementing US-05: (1) Receipt Logging - PO/tracking lookup, seal verification vs manifest, gross/net weight recording with ±5% tolerance gauge, photo evidence upload, operator OTP authentication; (2) Assay Scheduling - ISO 17025 lab selection with accreditation expiry, sample ID generation with barcode, Fire Assay/XRF method selection, courier tracking timeline, SLA countdown timer; (3) Purity Verification - certificate upload with OCR, purity breakdown (Au/Ag/Cu/Fe %), pure gold weight calculation, variance comparison with tolerance bands; (4) Settlement Handoff - allocation summary, status transition (RECEIVED → ASSAYED → PENDING_SETTLEMENT), SHA-256 audit hash, LBMA RGG compliance badge.",
        technicalDescription:
          "Tabbed interface with 4 stages matching US-05 screens. Weight tolerance gauge uses SVG semi-circle visualization. Assay lab selector validates ISO 17025 accreditation. Purity variance bar shows ±0.1g (green), ±0.1-0.3g (yellow), >±0.3g (red) thresholds. On lock, generates immutable SHA-256 hash and triggers US-06 settlement handoff.",
        userStory: "US-05 Screen 1, 2, 3, 4",
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
- Triggers US-06 valuation with pure Au weight
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
        userStory: "US-05",
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
          "Valuation, Settlement & Allocation Engine (US-06). Central hub for calculating final transaction value using verified assay data and LBMA pricing, executing dual-approved fund transfers to counterparties, and legally allocating pure gold weight into the central bank reserve ledger. Multi-currency settlement support (USD/EUR) with FX rate locking.",
        technicalDescription:
          "Dashboard showing all settlements with status indicators. Filterable by status (pending_valuation, pending_review, pending_approval, executed, allocated). Links to detailed 4-stage workflow pages. Integrates with vault_intakes, assays, and purchase_orders tables.",
        userStory: "US-06",
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
          "Four-stage settlement workflow implementing US-06: (1) Pricing & Valuation Engine - LBMA AM/PM fixing integration, purity adjustment factor, premium/discount calculation, 15-minute price lock timer, currency selection (USD/EUR); (2) Settlement Calculation & Review - gross value display, deductions table (logistics, insurance, assay fees, withholding tax), counterparty banking details (IBAN/SWIFT), review checklist; (3) Dual Approval & Execution - settlement summary, Finance Officer + Treasury Director OTP slots, segregation of duties enforcement, Approve/Reject/Amend actions; (4) Allocation Confirmation - success banner with Settlement ID, reserve allocation entry (gold weight, account ID, valuation date, Posted & Locked status), title transfer certificate, SHA-256 audit hash, LBMA RGG compliance badge.",
        technicalDescription:
          "Tabbed interface with 4 stages matching US-06 screens. Real-time LBMA rate fetching with price lock countdown. Dual-approval enforces segregation of duties (different RBAC roles). On execution, generates SHA-256 hash linking PO, Assay, Pricing, Settlement, and Allocation records. Reserve entry posted to central bank core ledger via secure API.",
        userStory: "US-06 Screen 1, 2, 3, 4",
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
- No reversals permitted within module (corrections via US-07)
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
          "Immutable Audit Trail & Regulatory Export Engine (US-07). Central hub for auditors and compliance officers to retrieve tamper-evident transaction history, generate regulatory reports (FIU STR/SAR, IMF SDDS, LBMA Disclosure), and export data in multiple formats (JSON/CSV/XML) with digital signature attachment. Enforces ≥5-year retention policies per LBMA RGG.",
        technicalDescription:
          "Tabbed interface with 4 screens: (1) Immutable Audit Trail Viewer - chronological timeline with SHA-256 hash chain verification; (2) Regulatory Report Generator - auto-population from verified transaction data; (3) Export Configuration - format mapping with digital signature; (4) Compliance Dashboard - retention countdown, audit readiness score, system health indicators.",
        userStory: "US-07",
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
          "Tamper-evident transaction history with chain verification (US-07 Screen 1). Chronological, read-only display of every state change from counterparty onboarding through settlement. Each entry includes timestamp, actor ID, IP/device fingerprint, previous hash, current hash, and chain-link validation status. Events: Feed Sync, Calculation Triggered, Risk Assessment, ASM Flag, Acknowledged, APPROVED.",
        technicalDescription:
          "Timeline view with vertical chain showing Onboarding → Screening → Risk → PO → Dispatch → Intake → Assay → Settlement. Nightly automated hash validation across all settled transactions. Any mismatch triggers immediate alert to CCO and FIU notification.",
        userStory: "US-07 Screen 1",
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
          "Automated compliance and reserve reporting (US-07 Screen 2). One-click generation of mandatory regulatory reports: FIU Suspicious Transaction Reports (STR/SAR), IMF SDDS reserve asset disclosures, LBMA Responsible Gold Guidance compliance summaries. Auto-populates from verified transaction data with validation checklist.",
        technicalDescription:
          "Report Type Selector with auto-population engine pulling KYC, risk tier, assay results, pricing, settlement, and allocation data. PDF preview with digital watermark. Submission tracking with acknowledgment receipt.",
        userStory: "US-07 Screen 2",
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
          "Multi-format export and digital signature attachment (US-07 Screen 3). Configurable export interface allowing auditors to select date ranges, transaction filters, output formats (JSON/CSV/XML), and field mappings. Attaches cryptographic digital signatures and chain verification certificates to every export package.",
        technicalDescription:
          "Format selector with drag-and-drop field mapping. Export queue showing pending, processing, and completed exports. SHA-256 manifest hash and CB-signed certificate attached to packages.",
        userStory: "US-07 Screen 3",
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
          "Retention countdown and audit readiness monitoring (US-07 Screen 4). Centralized compliance dashboard displaying retention countdowns, archival status, audit readiness scores (0-100), scheduled reports calendar, and system health indicators (CPU, Memory, Storage, Network). Enables proactive management of regulatory obligations and long-term data preservation.",
        technicalDescription:
          "Real-time dashboard with retention timer, SVG gauge for audit score, health indicator LEDs, alert log panel, and calendar view of upcoming FIU/IMF/LBMA reporting deadlines. Automated archival to WORM cold storage upon 5-year expiry.",
        userStory: "US-07 Screen 4",
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
          "Protected route guarded by a server-side requireAdmin() check in app/admin/layout.tsx. User operations run through server actions in app/admin/actions.ts (create via Better Auth, role updates and deletes scoped to admins). The access matrix is persisted in the role_page_access table and exposed to clients via /api/access/me, which drives both sidebar link filtering and URL enforcement in proxy.ts.",
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
    ],
    workflow: {
      title: "End-to-End Workflow",
      steps: [
        {
          phase: "1. Counterparty Onboarding",
          description: "Register new gold supplier with KYC documents",
          userStory: "US-01",
          route: "/onboarding",
        },
        {
          phase: "2. Compliance Screening",
          description:
            "Automated sanctions/PEP/adverse media checks with preliminary score",
          userStory: "US-01-bis",
          route: "/screening/[id]",
        },
        {
          phase: "3. Risk Assessment",
          description:
            "Comprehensive risk tier assignment with EDD for high-risk entities",
          userStory: "US-02",
          route: "/risk-management/[id]/assess",
        },
        {
          phase: "4. Purchase Order Creation",
          description: "Create gold acquisition order with LBMA pricing",
          userStory: "US-03",
          route: "/purchase-orders/new",
        },
        {
          phase: "5. Dual Approval",
          description:
            "Compliance gate and dual approval for large transactions",
          userStory: "US-03",
          route: "/purchase-orders/[id]",
        },
        {
          phase: "6. Pre-Shipment Dispatch",
          description:
            "Document validation, manifest check, and dispatch authorization",
          userStory: "US-04",
          route: "/dispatch/[id]",
        },
        {
          phase: "7. Vault Intake & Assay",
          description:
            "Receipt logging, seal verification, lab scheduling, purity verification",
          userStory: "US-05",
          route: "/vault-intake/[id]",
        },
        {
          phase: "8. Valuation & Settlement",
          description:
            "LBMA pricing, settlement calculation, dual-approval execution",
          userStory: "US-06",
          route: "/settlements/[id]",
        },
        {
          phase: "9. Reserve Allocation",
          description:
            "Gold weight posted to central bank reserve ledger with audit hash",
          userStory: "US-06",
          route: "/settlements/[id]",
        },
        {
          phase: "10. Immutable Audit Trail",
          description:
            "Tamper-evident transaction history with hash chain verification",
          userStory: "US-07",
          route: "/audit#audit-trail",
        },
        {
          phase: "11. Regulatory Reporting",
          description: "Auto-generated FIU/IMF/LBMA compliance reports",
          userStory: "US-07",
          route: "/audit#reports",
        },
        {
          phase: "12. Long-Term Archival",
          description: "5-year retention with WORM cold storage migration",
          userStory: "US-07",
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
          description: "US-04 Pre-shipment dispatch records",
          columns:
            "id, purchase_order_id, status, carrier_id, pickup_date, authorization_hash, dual_approval_complete",
        },
        {
          name: "dispatch_documents",
          description: "US-04 Export documents",
          columns:
            "id, dispatch_id, document_type, file_path, validated, validation_notes",
        },
        {
          name: "vault_intakes",
          description: "US-05 Vault receipt records",
          columns:
            "id, dispatch_id, tracking_id, seal_numbers, gross_weight_kg, net_weight_kg, operator_otp_verified, custody_log",
        },
        {
          name: "assay_samples",
          description: "US-05 Lab sample tracking",
          columns:
            "id, vault_intake_id, sample_id, lab_id, assay_method, sla_deadline, status",
        },
        {
          name: "assay_results",
          description: "US-05 Purity verification",
          columns:
            "id, assay_sample_id, au_purity, ag_content, cu_content, fe_content, pure_au_weight_kg, certificate_path",
        },
        {
          name: "settlements",
          description: "US-06 Valuation & settlement records",
          columns:
            "id, vault_intake_id, lbma_fixing_type, lbma_rate, gross_value, total_deductions, net_payable, currency, status",
        },
        {
          name: "settlement_approvals",
          description: "US-06 Dual-approval records",
          columns:
            "id, settlement_id, approver_role, approver_name, otp_verified, approved_at",
        },
        {
          name: "reserve_allocations",
          description: "US-06 Reserve ledger entries",
          columns:
            "id, settlement_id, pure_au_weight_kg, reserve_account_id, valuation_date, entry_status, audit_hash",
        },
        {
          name: "audit_entries",
          description: "US-07 Immutable audit events",
          columns:
            "id, transaction_id, event_type, actor_id, actor_type, ip_address, device_fingerprint, previous_hash, current_hash, timestamp",
        },
        {
          name: "regulatory_reports",
          description: "US-07 Generated compliance reports",
          columns:
            "id, report_type, transaction_ids, format, digital_signature, submission_status, generated_at",
        },
        {
          name: "export_packages",
          description: "US-07 Data export records",
          columns:
            "id, export_format, field_mapping, date_range, manifest_hash, digital_signature, created_by, created_at",
        },
        {
          name: "retention_status",
          description: "US-07 Archival tracking",
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
        "Score de conformité préliminaire automatisé (US-01)",
        "Workflow de due diligence basé sur le risque (US-02)",
        "Gestion des ordres d'achat avec double approbation (US-03)",
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
        userStory: "US-01 Écran 3",
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
        userStory: "US-01 Écran 1",
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
          "Tableau de bord de screening de conformité implémentant l'algorithme US-01 de Score de Conformité Préliminaire. Affiche les vérifications automatisées: Sanctions (porte bloquante), statut PPE (pondération 40%), Médias Défavorables (pondération 35%), et Risque Juridictionnel (pondération 25%). Calcule le score final et la classification de risque (LOW 0-25, MEDIUM 26-60, HIGH 61-99, BLOCKED 100).",
        technicalDescription:
          "Formulaire interactif permettant la modification manuelle des entrées de screening. Calcul du score en temps réel utilisant la formule pondérée. Visualisation du breakdown du score avec indicateurs de progression. Sauvegarde dans la table screening_results avec hash SHA-256 pour l'intégrité de l'audit.",
        userStory: "US-01, US-01-bis",
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
          "Tableau de bord pour l'attribution complète des niveaux de risque selon US-02. Affiche les contreparties en attente d'évaluation des risques, la distribution des niveaux de risque dans le portefeuille, et les exigences EDD (Due Diligence Renforcée). Point d'entrée pour les évaluations de risque détaillées.",
        technicalDescription:
          "Agrège les données de la table risk_assessments. Graphiques utilisant Recharts pour la visualisation de la distribution des niveaux. Liens vers /risk-management/[id]/assess pour les évaluations individuelles.",
        userStory: "US-02 Écran 2",
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
        id: "purchase-orders",
        name: "Ordres d'Achat",
        route: "/purchase-orders",
        icon: ShoppingCart,
        category: "Opérations",
        businessDescription:
          "Registre central de tous les ordres d'achat d'or. Suit le cycle de vie de la commande de Brouillon → Soumis → En attente d'approbation → Approuvé → En transit → Reçu. Affiche les valeurs estimées, les prix LBMA et le statut de livraison.",
        technicalDescription:
          "Composant DataTable récupérant depuis /api/purchase-orders avec JOINs vers counterparties pour les détails du fournisseur. Filtrage basé sur le statut et tri par date/valeur. Actions de ligne pour les opérations voir/modifier/annuler.",
        userStory: "US-03 Écran 4",
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
          "Module de documentation pré-expédition et validation de dispatch (US-04). Hub central pour la validation des documents d'exportation, manifestes d'expédition et dédouanement avant l'envoi de l'or. Suit le statut de validation depuis les documents en attente jusqu'à la confirmation finale de dispatch. Assure la conformité réglementaire avant le transfert vers la réception coffre.",
        technicalDescription:
          "Tableau de bord affichant toutes les validations de dispatch avec indicateurs de statut. Filtrable par statut (pending_docs, docs_validated, pending_authorization, dispatched, in_transit). Liens vers les pages détaillées du workflow de validation. Intégration avec la table purchase_orders pour les données PO.",
        userStory: "US-04",
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
          "Workflow de validation pré-expédition en quatre étapes implémentant US-04: (1) Upload & Validation des Documents - valide la licence d'export, le certificat d'origine, les docs de transport et l'assurance par rapport aux termes du PO; (2) Vérification Manifeste & Douanes - vérifie les tolérances de poids (±5%), les numéros de scellés et le pré-dédouanement; (3) Autorisation de Dispatch - assignation du transporteur avec double approbation pour les expéditions >$1M; (4) Confirmation de Dispatch - écran de succès avec ID de suivi et déclenchement du transfert vers US-05.",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans US-04. La validation des documents utilise une simulation OCR pour l'extraction des métadonnées. La jauge de tolérance de poids utilise une visualisation SVG en demi-cercle. La double approbation implémente le pattern signature + OTP. L'autorisation génère un hash SHA-256 pour l'immutabilité. Au dispatch, déclenche la transition vers le statut in_transit.",
        userStory: "US-04 Écran 1, 2, 3, 4",
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
          "Collecte par transporteur déclenche automatiquement la transition US-05",
        ],
      },
      {
        id: "vault-intake",
        name: "Réception Coffre",
        route: "/vault-intake",
        icon: Warehouse,
        category: "Opérations",
        businessDescription:
          "Réception physique de l'or et initiation de la chaîne de garde (US-05). Hub central pour l'enregistrement des réceptions au coffre depuis les expéditions dispatched. Suit le statut de réception depuis l'attente jusqu'à la fin de l'essai et le transfert vers le règlement. Intègre les données US-04 dispatch et alimente US-06 règlement.",
        technicalDescription:
          "Tableau de bord affichant toutes les réceptions avec indicateurs de statut. Filtrable par statut (pending_intake, received, assay_scheduled, assayed, pending_settlement). Liens vers les pages détaillées du workflow en 4 étapes. Intégration avec les tables dispatch_validations et purchase_orders.",
        userStory: "US-05",
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
          "Workflow de réception coffre en quatre étapes implémentant US-05: (1) Enregistrement Réception - recherche PO/tracking, vérification scellés vs manifeste, enregistrement poids brut/net avec jauge tolérance ±5%, upload preuves photos, authentification OTP opérateur; (2) Planification Essai - sélection labo ISO 17025 avec expiration accréditation, génération ID échantillon avec code-barres, sélection méthode Fire Assay/XRF, timeline suivi transporteur, timer compte à rebours SLA; (3) Vérification Pureté - upload certificat avec OCR, détail pureté (Au/Ag/Cu/Fe %), calcul poids or pur, comparaison variance avec bandes de tolérance; (4) Transfert Règlement - résumé allocation, transition statut (RECEIVED → ASSAYED → PENDING_SETTLEMENT), hash audit SHA-256, badge conformité LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans US-05. La jauge de tolérance de poids utilise une visualisation SVG en demi-cercle. Le sélecteur de labo valide l'accréditation ISO 17025. La barre de variance de pureté montre les seuils ±0.1g (vert), ±0.1-0.3g (jaune), >±0.3g (rouge). Au verrouillage, génère un hash SHA-256 immuable et déclenche le transfert US-06 règlement.",
        userStory: "US-05 Écran 1, 2, 3, 4",
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
- Déclenche valorisation US-06 avec poids Au pur
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
        userStory: "US-05",
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
          "Moteur de Valorisation, Règlement & Allocation (US-06). Hub central pour calculer la valeur finale de la transaction à partir des données d'essai vérifiées et des prix LBMA, exécuter les transferts de fonds à double approbation vers les contreparties, et allouer légalement le poids d'or pur dans le registre des réserves de la banque centrale. Support multi-devises (USD/EUR) avec verrouillage du taux FX.",
        technicalDescription:
          "Tableau de bord affichant tous les règlements avec indicateurs de statut. Filtrable par statut (pending_valuation, pending_review, pending_approval, executed, allocated). Liens vers les pages détaillées du workflow en 4 étapes. Intégration avec les tables vault_intakes, assays, et purchase_orders.",
        userStory: "US-06",
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
          "Workflow de règlement en quatre étapes implémentant US-06: (1) Moteur de Tarification & Valorisation - intégration fixing LBMA AM/PM, facteur d'ajustement de pureté, calcul prime/remise, timer de verrouillage de prix 15 minutes, sélection de devise (USD/EUR); (2) Calcul & Révision du Règlement - affichage valeur brute, tableau des déductions (logistique, assurance, frais d'essai, retenue à la source), coordonnées bancaires contrepartie (IBAN/SWIFT), liste de vérification; (3) Double Approbation & Exécution - résumé du règlement, slots OTP Officier Financier + Directeur Trésorerie, application de la séparation des fonctions, actions Approuver/Rejeter/Amender; (4) Confirmation d'Allocation - bannière de succès avec ID Règlement, entrée d'allocation de réserve (poids or, ID compte, date de valorisation, statut Posté & Verrouillé), certificat de transfert de titre, hash d'audit SHA-256, badge de conformité LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 étapes correspondant aux écrans US-06. Récupération en temps réel des taux LBMA avec compte à rebours de verrouillage de prix. La double approbation applique la séparation des fonctions (rôles RBAC différents). À l'exécution, génère un hash SHA-256 liant les enregistrements PO, Essai, Tarification, Règlement et Allocation. Entrée de réserve postée vers le registre central de la banque via API sécurisée.",
        userStory: "US-06 Écran 1, 2, 3, 4",
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
- Pas d'annulation permise dans ce module (corrections via US-07)
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
          "Moteur de Piste d'Audit Immuable & Export Réglementaire (US-07). Hub central pour les auditeurs et officiers de conformité pour récupérer l'historique des transactions inviolable, générer des rapports réglementaires (FIU STR/SAR, IMF SDDS, LBMA Disclosure), et exporter les données en plusieurs formats (JSON/CSV/XML) avec signature digitale. Applique les politiques de r��tention ≥5 ans selon LBMA RGG.",
        technicalDescription:
          "Interface à onglets avec 4 écrans: (1) Visualiseur de Piste d'Audit Immuable - timeline chronologique avec vérification de chaîne SHA-256; (2) Générateur de Rapports Réglementaires - auto-population depuis données vérifiées; (3) Configuration d'Export - mapping de format avec signature digitale; (4) Tableau de Bord Conformité - compte à rebours rétention, score préparation audit, indicateurs santé système.",
        userStory: "US-07",
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
          "Historique des transactions inviolable avec vérification de chaîne (US-07 Écran 1). Affichage chronologique en lecture seule de chaque changement d'état depuis l'intégration contrepartie jusqu'au règlement. Chaque entrée inclut horodatage, ID acteur, empreinte IP/appareil, hash précédent, hash actuel et statut de validation de lien de chaîne. Événements: Sync Feed, Calcul Déclenché, Évaluation Risque, Flag ASM, Reconnu, APPROUVÉ.",
        technicalDescription:
          "Vue timeline avec chaîne verticale montrant Intégration → Screening → Risque → OA → Dispatch → Réception → Essai → Règlement. Validation de hash automatisée nocturne sur toutes les transactions réglées. Toute discordance déclenche alerte immédiate au DCO et notification FIU.",
        userStory: "US-07 Écran 1",
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
          "Reporting de conformité et réserves automatisé (US-07 Écran 2). Génération en un clic de rapports réglementaires obligatoires: Rapports de Transaction Suspecte FIU (STR/SAR), divulgations d'actifs de réserve IMF SDDS, résumés de conformité LBMA Responsible Gold Guidance. Auto-population depuis données de transaction vérifiées avec liste de validation.",
        technicalDescription:
          "Sélecteur de Type de Rapport avec moteur d'auto-population tirant KYC, niveau de risque, résultats d'essai, tarification, règlement et données d'allocation. Prévisualisation PDF avec filigrane digital. Suivi de soumission avec accusé de réception.",
        userStory: "US-07 Écran 2",
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
          "Export multi-format et pièce jointe signature digitale (US-07 Écran 3). Interface d'export configurable permettant aux auditeurs de sélectionner plages de dates, filtres de transaction, formats de sortie (JSON/CSV/XML), et mappings de champs. Attache signatures digitales cryptographiques et certificats de vérification de chaîne à chaque package d'export.",
        technicalDescription:
          "Sélecteur de format avec mapping de champs glisser-déposer. File d'export montrant exports en attente, en cours et complétés. Hash de manifeste SHA-256 et certificat signé CB attachés aux packages.",
        userStory: "US-07 Écran 3",
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
          "Compte à rebours de rétention et surveillance préparation audit (US-07 Écran 4). Tableau de bord conformité centralisé affichant comptes à rebours de rétention, statut d'archivage, scores de préparation audit (0-100), calendrier des rapports planifiés, et indicateurs de santé système (CPU, Mémoire, Stockage, Réseau). Permet gestion proactive des obligations réglementaires et préservation données long terme.",
        technicalDescription:
          "Tableau de bord temps réel avec timer de rétention, jauge SVG pour score audit, LEDs indicateurs de santé, panneau journal d'alertes, et vue calendrier des échéances de reporting FIU/IMF/LBMA. Archivage automatisé vers stockage froid WORM à expiration des 5 ans.",
        userStory: "US-07 Écran 4",
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
          "Route protégée par une vérification serveur requireAdmin() dans app/admin/layout.tsx. Les opérations sur les utilisateurs passent par des Server Actions (app/admin/actions.ts) : création via Better Auth, changement de profil et suppression réservés aux admins. La matrice d'accès est persistée dans la table role_page_access et exposée aux clients via /api/access/me, qui pilote à la fois le filtrage des liens de la barre latérale et le blocage des URL dans proxy.ts.",
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
    ],
    workflow: {
      title: "Workflow de Bout en Bout",
      steps: [
        {
          phase: "1. Intégration Contrepartie",
          description:
            "Enregistrer nouveau fournisseur d'or avec documents KYC",
          userStory: "US-01",
          route: "/onboarding",
        },
        {
          phase: "2. Screening de Conformité",
          description:
            "Vérifications automatisées sanctions/PPE/médias défavorables avec score préliminaire",
          userStory: "US-01-bis",
          route: "/screening/[id]",
        },
        {
          phase: "3. Évaluation des Risques",
          description:
            "Attribution complète du niveau de risque avec EDD pour entités à haut risque",
          userStory: "US-02",
          route: "/risk-management/[id]/assess",
        },
        {
          phase: "4. Création Ordre d'Achat",
          description: "Créer ordre d'acquisition d'or avec prix LBMA",
          userStory: "US-03",
          route: "/purchase-orders/new",
        },
        {
          phase: "5. Double Approbation",
          description:
            "Porte de conformité et double approbation pour grandes transactions",
          userStory: "US-03",
          route: "/purchase-orders/[id]",
        },
        {
          phase: "6. Dispatch Pré-Expédition",
          description:
            "Validation des documents, vérification du manifeste et autorisation de dispatch",
          userStory: "US-04",
          route: "/dispatch/[id]",
        },
        {
          phase: "7. Réception Coffre & Essai",
          description:
            "Enregistrement réception, vérification scellés, planification labo, vérification pureté",
          userStory: "US-05",
          route: "/vault-intake/[id]",
        },
        {
          phase: "8. Valorisation & Règlement",
          description:
            "Tarification LBMA, calcul du règlement, exécution à double approbation",
          userStory: "US-06",
          route: "/settlements/[id]",
        },
        {
          phase: "9. Allocation aux Réserves",
          description:
            "Poids d'or posté au registre des réserves de la banque centrale avec hash d'audit",
          userStory: "US-06",
          route: "/settlements/[id]",
        },
        {
          phase: "10. Piste d'Audit Immuable",
          description:
            "Historique des transactions inviolable avec vérification de chaîne de hash",
          userStory: "US-07",
          route: "/audit#audit-trail",
        },
        {
          phase: "11. Reporting Réglementaire",
          description: "Rapports de conformité FIU/IMF/LBMA auto-générés",
          userStory: "US-07",
          route: "/audit#reports",
        },
        {
          phase: "12. Archivage Long Terme",
          description:
            "Rétention 5 ans avec migration vers stockage froid WORM",
          userStory: "US-07",
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
          description: "US-04 Enregistrements dispatch pré-expédition",
          columns:
            "id, purchase_order_id, status, carrier_id, pickup_date, authorization_hash, dual_approval_complete",
        },
        {
          name: "dispatch_documents",
          description: "US-04 Documents d'export",
          columns:
            "id, dispatch_id, document_type, file_path, validated, validation_notes",
        },
        {
          name: "vault_intakes",
          description: "US-05 Enregistrements réception coffre",
          columns:
            "id, dispatch_id, tracking_id, seal_numbers, gross_weight_kg, net_weight_kg, operator_otp_verified, custody_log",
        },
        {
          name: "assay_samples",
          description: "US-05 Suivi échantillons labo",
          columns:
            "id, vault_intake_id, sample_id, lab_id, assay_method, sla_deadline, status",
        },
        {
          name: "assay_results",
          description: "US-05 Vérification pureté",
          columns:
            "id, assay_sample_id, au_purity, ag_content, cu_content, fe_content, pure_au_weight_kg, certificate_path",
        },
        {
          name: "settlements",
          description: "US-06 Enregistrements valorisation & règlement",
          columns:
            "id, vault_intake_id, lbma_fixing_type, lbma_rate, gross_value, total_deductions, net_payable, currency, status",
        },
        {
          name: "settlement_approvals",
          description: "US-06 Enregistrements double approbation",
          columns:
            "id, settlement_id, approver_role, approver_name, otp_verified, approved_at",
        },
        {
          name: "reserve_allocations",
          description: "US-06 Entrées registre réserves",
          columns:
            "id, settlement_id, pure_au_weight_kg, reserve_account_id, valuation_date, entry_status, audit_hash",
        },
        {
          name: "audit_entries",
          description: "US-07 Événements d'audit immuables",
          columns:
            "id, transaction_id, event_type, actor_id, actor_type, ip_address, device_fingerprint, previous_hash, current_hash, timestamp",
        },
        {
          name: "regulatory_reports",
          description: "US-07 Rapports conformité générés",
          columns:
            "id, report_type, transaction_ids, format, digital_signature, submission_status, generated_at",
        },
        {
          name: "export_packages",
          description: "US-07 Enregistrements export données",
          columns:
            "id, export_format, field_mapping, date_range, manifest_hash, digital_signature, created_by, created_at",
        },
        {
          name: "retention_status",
          description: "US-07 Suivi archivage",
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

export default function DocumentationPage() {
  const { language, t } = useLanguage();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  const content =
    language === "fr" ? documentationSections.fr : documentationSections.en;
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
                        <div className="flex flex-col items-center p-3 rounded-lg border bg-card min-w-[140px]">
                          <Badge variant="outline" className="mb-2">
                            {step.userStory}
                          </Badge>
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
                        <ScrollArea className="h-[600px]">
                          <div className="space-y-1 p-4 pt-0">
                            {(language === "fr"
                              ? ["Principal", "Opérations", "Système"]
                              : ["Main", "Operations", "System"]
                            )
                              .filter((cat) =>
                                content.pages.some((p) => p.category === cat),
                              )
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
                              <Badge variant="outline">
                                {selectedPageData.userStory}
                              </Badge>
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
                          <div className="flex flex-col items-center justify-center h-[500px] text-center">
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
