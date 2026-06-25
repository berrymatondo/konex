import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

// Auto-initialize database tables if they don't exist
let dbInitialized = false;

export async function ensureTablesExist() {
  if (dbInitialized) {
    return;
  }
  
  try {
    // Check if counterparties table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'counterparties'
      ) as exists
    `;
    
    const tableExists = result[0]?.exists;
    
    // Always run column migrations even if tables exist
    if (tableExists) {
      // Add missing columns to existing tables
      await sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counterparties' AND column_name = 'risk_level') THEN
            ALTER TABLE counterparties ADD COLUMN risk_level TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counterparties' AND column_name = 'screening_status') THEN
            ALTER TABLE counterparties ADD COLUMN screening_status TEXT;
          END IF;
        END $$;
      `;
      
      // Create purchase_orders table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE RESTRICT,
          status TEXT NOT NULL DEFAULT 'draft',
          estimated_weight_kg DECIMAL(10,3) NOT NULL,
          gold_type TEXT NOT NULL,
          assay_range TEXT,
          incoterms TEXT NOT NULL,
          delivery_vault_id TEXT NOT NULL,
          expected_dispatch_date DATE,
          notes TEXT,
          lbma_price_per_oz DECIMAL(10,2),
          purity_factor DECIMAL(5,4),
          premium_discount DECIMAL(10,2) DEFAULT 0,
          logistics_cost DECIMAL(10,2) DEFAULT 0,
          total_estimated_value DECIMAL(15,2),
          currency TEXT DEFAULT 'USD',
          price_lock_expiry TIMESTAMP WITH TIME ZONE,
          tracking_id TEXT UNIQUE,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          submitted_at TIMESTAMP WITH TIME ZONE,
          approved_at TIMESTAMP WITH TIME ZONE
        )
      `;

      // Draft POs may be saved with incomplete info, so these columns must be
      // nullable. Drop legacy NOT NULL constraints on existing tables (idempotent).
      await sql`
        DO $$
        BEGIN
          ALTER TABLE purchase_orders ALTER COLUMN estimated_weight_kg DROP NOT NULL;
          ALTER TABLE purchase_orders ALTER COLUMN gold_type DROP NOT NULL;
          ALTER TABLE purchase_orders ALTER COLUMN incoterms DROP NOT NULL;
          ALTER TABLE purchase_orders ALTER COLUMN delivery_vault_id DROP NOT NULL;
        EXCEPTION WHEN others THEN NULL;
        END $$;
      `;
      
      // Create po_approvals table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS po_approvals (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
          approver_role TEXT NOT NULL,
          approver_id TEXT,
          approver_name TEXT,
          decision TEXT NOT NULL,
          comments TEXT,
          decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Create assays table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS assays (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
          counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
          batch_number TEXT NOT NULL UNIQUE,
          gross_weight_kg DECIMAL(10,3) NOT NULL,
          net_weight_kg DECIMAL(10,3),
          purity_percentage DECIMAL(5,4),
          fine_gold_weight_kg DECIMAL(10,3),
          assay_method TEXT,
          laboratory TEXT,
          assay_date DATE,
          status TEXT NOT NULL DEFAULT 'pending',
          certificate_url TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          verified_at TIMESTAMP WITH TIME ZONE,
          verified_by TEXT
        )
      `;
      
      // Create settlements table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS settlements (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
          assay_id TEXT REFERENCES assays(id) ON DELETE SET NULL,
          counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
          settlement_reference TEXT NOT NULL UNIQUE,
          fine_gold_weight_kg DECIMAL(10,3) NOT NULL,
          settlement_price_per_oz DECIMAL(10,2) NOT NULL,
          total_amount DECIMAL(15,2) NOT NULL,
          currency TEXT DEFAULT 'USD',
          payment_method TEXT,
          bank_reference TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          approved_at TIMESTAMP WITH TIME ZONE,
          approved_by TEXT,
          completed_at TIMESTAMP WITH TIME ZONE,
          notes TEXT
        )
      `;
      
      // Continue to ensure all tables exist (including risk_assessments)
    }

    // Create tables if they don't exist (uses IF NOT EXISTS so safe to run always)
    await sql`
      CREATE TABLE IF NOT EXISTS counterparties (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        legal_name TEXT NOT NULL,
        trading_name TEXT,
        registration_number TEXT,
        tax_id TEXT,
        legal_form TEXT,
        country_of_incorporation TEXT NOT NULL,
        registered_address TEXT,
        primary_contact TEXT,
        primary_email TEXT,
        primary_phone TEXT,
        gold_source_types TEXT[] DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending_review',
        preliminary_score INTEGER,
        screening_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ubos (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        nationality TEXT,
        ownership_percent DECIMAL(5,2),
        is_pep BOOLEAN NOT NULL DEFAULT false,
        pep_details TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT,
        file_data BYTEA,
        mime_type TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Add missing columns if table was created before these columns existed
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_data') THEN
          ALTER TABLE documents ADD COLUMN file_data BYTEA;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'mime_type') THEN
          ALTER TABLE documents ADD COLUMN mime_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counterparties' AND column_name = 'risk_level') THEN
          ALTER TABLE counterparties ADD COLUMN risk_level TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counterparties' AND column_name = 'screening_status') THEN
          ALTER TABLE counterparties ADD COLUMN screening_status TEXT;
        END IF;
      END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS screening_results (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        check_type TEXT NOT NULL,
        result TEXT NOT NULL,
        details JSONB,
        checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        weight_kg DECIMAL(10,3) NOT NULL,
        purity DECIMAL(5,4) NOT NULL,
        price_per_gram DECIMAL(10,2) NOT NULL,
        total_value DECIMAL(15,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Risk Management tables (US-02)
    await sql`
      CREATE TABLE IF NOT EXISTS risk_assessments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        risk_tier TEXT NOT NULL,
        overall_score INTEGER NOT NULL,
        country_risk_score INTEGER,
        source_risk_score INTEGER,
        pep_risk_score INTEGER,
        volume_risk_score INTEGER,
        edd_required BOOLEAN DEFAULT false,
        edd_status TEXT,
        policy_acknowledged BOOLEAN DEFAULT false,
        policy_acknowledged_at TIMESTAMP WITH TIME ZONE,
        policy_acknowledged_by TEXT,
        assessed_by TEXT,
        assessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS risk_audit_log (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        previous_tier TEXT,
        new_tier TEXT,
        reason TEXT,
        performed_by TEXT,
        performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // General audit log for all workflow actions
    await sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT,
        details JSONB,
        performed_by TEXT DEFAULT 'system',
        performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Purchase Order tables (US-03)
    await sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'draft',
        estimated_weight_kg DECIMAL(10,3) NOT NULL,
        gold_type TEXT NOT NULL,
        assay_range TEXT,
        incoterms TEXT NOT NULL,
        delivery_vault_id TEXT NOT NULL,
        expected_dispatch_date DATE,
        notes TEXT,
        lbma_price_per_oz DECIMAL(10,2),
        purity_factor DECIMAL(5,4),
        premium_discount DECIMAL(10,2) DEFAULT 0,
        logistics_cost DECIMAL(10,2) DEFAULT 0,
        total_estimated_value DECIMAL(15,2),
        currency TEXT DEFAULT 'USD',
        price_lock_expiry TIMESTAMP WITH TIME ZONE,
        tracking_id TEXT UNIQUE,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP WITH TIME ZONE,
        approved_at TIMESTAMP WITH TIME ZONE
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS po_approvals (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        approver_role TEXT NOT NULL,
        approver_id TEXT,
        approver_name TEXT,
        decision TEXT NOT NULL,
        comments TEXT,
        decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert sample data
    await sql`
      INSERT INTO counterparties (id, legal_name, trading_name, registration_number, tax_id, legal_form, country_of_incorporation, registered_address, primary_contact, primary_email, primary_phone, gold_source_types, status, preliminary_score)
      VALUES 
        ('cp-001', 'Aureum Mining Corp', 'Aureum Gold', 'REG-2024-001', 'TAX-AU-001', 'Corporation', 'Switzerland', '123 Gold Street, Zurich', 'Hans Mueller', 'contact@aureum.ch', '+41 44 123 4567', ARRAY['LSM'], 'active', 85),
        ('cp-002', 'Golden Horizon Ltd', 'Golden Horizon', 'REG-2024-002', 'TAX-GH-002', 'Limited Company', 'United Kingdom', '456 Precious Lane, London', 'James Wilson', 'info@goldenhorizon.uk', '+44 20 7946 0958', ARRAY['ASM', 'Recycled'], 'pending_review', 62),
        ('cp-003', 'Refined Metals SA', 'Refined Metals', 'REG-2024-003', 'TAX-RM-003', 'SA', 'Belgium', '789 Refinery Road, Antwerp', 'Marie Dubois', 'contact@refinedmetals.be', '+32 3 234 5678', ARRAY['Recycled'], 'active', 92)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO transactions (id, counterparty_id, type, weight_kg, purity, price_per_gram, total_value, status)
      VALUES 
        ('tx-001', 'cp-001', 'acquisition', 25.500, 0.9999, 62.50, 1593750.00, 'completed'),
        ('tx-002', 'cp-003', 'acquisition', 15.750, 0.9995, 62.45, 983587.50, 'completed'),
        ('tx-003', 'cp-001', 'acquisition', 42.000, 0.9999, 62.55, 2627100.00, 'in_transit')
      ON CONFLICT (id) DO NOTHING
    `;

    dbInitialized = true;
    console.log("[v0] Database tables created successfully");
  } catch (error) {
    console.error("[v0] Error initializing database:", error);
    throw error;
  }
}

export interface Counterparty {
  id: string;
  legal_name: string;
  trading_name: string | null;
  registration_number: string | null;
  tax_id: string | null;
  legal_form: string | null;
  country_of_incorporation: string;
  registered_address: string | null;
  primary_contact: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  gold_source_types: string[];
  status: string;
  preliminary_score: number | null;
  screening_date: string | null;
  created_at: string;
  updated_at: string;
}

// Idempotent migration ensuring the counterparty-response columns exist on the
// purchase_orders table of whichever database DATABASE_URL points to. Safe to
// call on every request; the single ALTER ... IF NOT EXISTS is a no-op once
// applied.
let poResponseColumnsReady = false;
export async function ensurePurchaseOrderResponseColumns() {
  if (poResponseColumnsReady) return;
  await sql`
    ALTER TABLE purchase_orders
      ADD COLUMN IF NOT EXISTS sent_to_counterparty_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS cp_response text,
      ADD COLUMN IF NOT EXISTS cp_responded_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS cp_comment text,
      ADD COLUMN IF NOT EXISTS cp_lot_reference text,
      ADD COLUMN IF NOT EXISTS cp_proposed_weight_kg numeric,
      ADD COLUMN IF NOT EXISTS cp_proposed_purity numeric,
      ADD COLUMN IF NOT EXISTS cp_gold_form text,
      ADD COLUMN IF NOT EXISTS cp_lot_availability text,
      ADD COLUMN IF NOT EXISTS cp_lot_available_date date,
      ADD COLUMN IF NOT EXISTS cp_lot_location text,
      ADD COLUMN IF NOT EXISTS cp_assay_certificate_url text,
      ADD COLUMN IF NOT EXISTS cp_assay_certificate_file_name text,
      ADD COLUMN IF NOT EXISTS cp_proposed_dispatch_date date,
      ADD COLUMN IF NOT EXISTS cp_estimated_delivery_date date,
      ADD COLUMN IF NOT EXISTS cp_proposed_premium numeric
  `;
  poResponseColumnsReady = true;
}

// Idempotent migration ensuring the desired delivery-window and payment-terms
// columns exist on purchase_orders. These capture every field shown on the
// new/edit purchase order forms so nothing is dropped on save.
let poTermsColumnsReady = false;
export async function ensurePurchaseOrderTermsColumns() {
  if (poTermsColumnsReady) return;
  await sql`
    ALTER TABLE purchase_orders
      ADD COLUMN IF NOT EXISTS tolerance_percent numeric,
      ADD COLUMN IF NOT EXISTS delivery_window_end date,
      ADD COLUMN IF NOT EXISTS payment_usd_cdf_split text,
      ADD COLUMN IF NOT EXISTS payment_timing text,
      ADD COLUMN IF NOT EXISTS payment_term text,
      ADD COLUMN IF NOT EXISTS prepayment_percent numeric,
      ADD COLUMN IF NOT EXISTS cdf_fx_basis text
  `;
  poTermsColumnsReady = true;
}

// Audit log helper function
export async function createAuditLog(params: {
  entityType: string;
  entityId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  details?: Record<string, unknown>;
  performedBy?: string;
}) {
  const { entityType, entityId, action, previousStatus, newStatus, details, performedBy } = params;
  
  try {
    await sql`
      INSERT INTO audit_log (entity_type, entity_id, action, previous_status, new_status, details, performed_by)
      VALUES (
        ${entityType},
        ${entityId},
        ${action},
        ${previousStatus || null},
        ${newStatus || null},
        ${details ? JSON.stringify(details) : null}::jsonb,
        ${performedBy || 'system'}
      )
    `;
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

export interface UBO {
  id: string;
  counterparty_id: string;
  full_name: string;
  nationality: string | null;
  ownership_percent: number | null;
  is_pep: boolean;
  pep_details: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  counterparty_id: string;
  type: string;
  file_name: string;
  file_url: string | null;
  file_data?: Buffer | null;
  mime_type?: string | null;
  status: string;
  uploaded_at: string;
  verified_at: string | null;
}

export interface Transaction {
  id: string;
  counterparty_id: string;
  type: string;
  weight_kg: number;
  purity: number;
  price_per_gram: number;
  total_value: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ScreeningResult {
  id: string;
  counterparty_id: string;
  check_type: string;
  result: string;
  details: Record<string, unknown> | null;
  checked_at: string;
}

export interface PurchaseOrder {
  id: string;
  counterparty_id: string;
  status: string;
  estimated_weight_kg: number;
  gold_type: string;
  assay_range: string | null;
  incoterms: string;
  delivery_vault_id: string;
  expected_dispatch_date: string | null;
  notes: string | null;
  lbma_price_per_oz: number | null;
  purity_factor: number | null;
  premium_discount: number;
  logistics_cost: number;
  total_estimated_value: number | null;
  currency: string;
  price_lock_expiry: string | null;
  tracking_id: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
}

export interface POApproval {
  id: string;
  purchase_order_id: string;
  approver_role: string;
  approver_id: string | null;
  approver_name: string | null;
  decision: string;
  comments: string | null;
  decided_at: string;
}

export interface RiskAssessment {
  id: string;
  counterparty_id: string;
  risk_tier: string;
  overall_score: number;
  country_risk_score: number | null;
  source_risk_score: number | null;
  pep_risk_score: number | null;
  volume_risk_score: number | null;
  edd_required: boolean;
  edd_status: string | null;
  policy_acknowledged: boolean;
  policy_acknowledged_at: string | null;
  policy_acknowledged_by: string | null;
  assessed_by: string | null;
  assessed_at: string;
  notes: string | null;
}

export interface RiskAuditLog {
  id: string;
  counterparty_id: string;
  action: string;
  previous_tier: string | null;
  new_tier: string | null;
  reason: string | null;
  performed_by: string | null;
  performed_at: string;
}
