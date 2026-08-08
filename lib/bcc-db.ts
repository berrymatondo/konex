import { sql } from "@/lib/db"

let initialized = false
const initializedTables = new Set<BccEntity>()
const tableInitializations = new Map<BccEntity, Promise<void>>()

export const BCC_ENTITIES = {
  "purchase-orders": "bcc_purchase_orders",
  "receipt-assay": "bcc_receipt_assays",
  "pricing-settlement": "bcc_pricing_settlements",
  custody: "bcc_custody_confirmations",
  valuation: "bcc_valuation_snapshots",
  "monetary-impact": "bcc_monetary_impacts",
  reports: "bcc_management_reports",
  "refining-orders": "bcc_refining_orders",
  audit: "bcc_audit_log",
} as const

export type BccEntity = keyof typeof BCC_ENTITIES

export function isBccEntity(value: string): value is BccEntity {
  return value in BCC_ENTITIES
}

/** Initializes only the table needed by a request, avoiding the full BCC schema
 * bootstrap on latency-sensitive list endpoints. Concurrent calls share one promise. */
export async function ensureBccTable(entity: BccEntity) {
  if (initialized || initializedTables.has(entity)) return
  const pending = tableInitializations.get(entity)
  if (pending) return pending
  const table = BCC_ENTITIES[entity]
  const initialization = (async () => {
    await sql(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        reference TEXT NOT NULL UNIQUE,
        purchase_order_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await Promise.all([
      sql(`CREATE INDEX IF NOT EXISTS ${table}_po_idx ON ${table} (purchase_order_id)`),
      sql(`CREATE INDEX IF NOT EXISTS ${table}_status_idx ON ${table} (status)`),
    ])
    initializedTables.add(entity)
  })()
  tableInitializations.set(entity, initialization)
  try { await initialization } finally { tableInitializations.delete(entity) }
}

export async function ensureBccTables() {
  if (initialized) return
  const definitions = Object.values(BCC_ENTITIES)
  await Promise.all(definitions.map(async (table) => {
    await sql(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        reference TEXT NOT NULL UNIQUE,
        purchase_order_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await Promise.all([
      sql(`CREATE INDEX IF NOT EXISTS ${table}_po_idx ON ${table} (purchase_order_id)`),
      sql(`CREATE INDEX IF NOT EXISTS ${table}_status_idx ON ${table} (status)`),
    ])
  }))
  await sql`
    CREATE TABLE IF NOT EXISTS bcc_purchase_order_reference_counter (
      counter_key TEXT PRIMARY KEY,
      last_number INTEGER NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`
    INSERT INTO bcc_purchase_order_reference_counter (counter_key, last_number)
    VALUES ('purchase_order', 51)
    ON CONFLICT (counter_key) DO UPDATE SET
      last_number = GREATEST(
        bcc_purchase_order_reference_counter.last_number,
        COALESCE((SELECT MAX(substring(reference from '([0-9]+)$')::integer) FROM bcc_purchase_orders), 0)
      )
  `
  initialized = true
}

export function bccReference(entity: BccEntity) {
  const prefix: Record<BccEntity, string> = {
    "purchase-orders": "BCC-PO", "receipt-assay": "BCC-RA", "pricing-settlement": "BCC-STL",
    custody: "BCC-CUS", valuation: "BCC-VAL", "monetary-impact": "BCC-MI",
    reports: "BCC-RPT", "refining-orders": "BCC-REF", audit: "BCC-AUD",
  }
  return `${prefix[entity]}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}
