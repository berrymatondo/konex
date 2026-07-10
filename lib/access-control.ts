import { sql } from "@/lib/db"
import { ASSIGNABLE_PAGES } from "@/lib/pages"
import type { UserRole } from "@/lib/roles"
import { listRoles } from "@/lib/roles-store"

/**
 * Default page access per role, used to seed `role_page_access` the first
 * time the table is created. `admin` is intentionally omitted here because
 * admins bypass access checks entirely.
 */
const DEFAULT_ACCESS: Record<Exclude<UserRole, "admin">, string[]> = {
  compliance_officer: [
    "dashboard",
    "counterparties",
    "onboarding",
    "approval-queue",
    "screening",
    "documentation",
    "reports",
    "audit",
    "settings",
  ],
  risk_manager: [
    "dashboard",
    "risk-management",
    "monetary-policy",
    "counterparties",
    "reports",
    "audit",
    "documentation",
    "settings",
  ],
  counterparty: [
    "transactions",
    "counterparties",
    "purchase-orders",
    "documentation",
    "settings",
  ],
}

let accessInitialized = false

/** Creates the access table and seeds defaults on first use. */
export async function ensureAccessTableExists() {
  if (accessInitialized) return

  await sql`
    CREATE TABLE IF NOT EXISTS role_page_access (
      role text NOT NULL,
      page_key text NOT NULL,
      PRIMARY KEY (role, page_key)
    )
  `

  // Always insert defaults with ON CONFLICT DO NOTHING so that new page-keys
  // added to DEFAULT_ACCESS are seeded on next cold start without wiping
  // any rows that were manually added or removed via the Admin panel.
  for (const [role, keys] of Object.entries(DEFAULT_ACCESS)) {
    for (const key of keys) {
      await sql`
        INSERT INTO role_page_access (role, page_key)
        VALUES (${role}, ${key})
        ON CONFLICT (role, page_key) DO NOTHING
      `
    }
  }

  // Market Oversight (dashboard) must never be accessible to counterparty
  // roles. Remove any legacy rows that may exist from older seeds, then
  // ensure the transactions page (their landing page) is granted instead.
  await sql`
    DELETE FROM role_page_access
    WHERE page_key = 'dashboard'
      AND role IN (
        SELECT role FROM role_page_access
        WHERE role ILIKE '%contrepart%' OR role ILIKE '%counterpart%'
        UNION SELECT 'counterparty'
      )
  `
  await sql`
    INSERT INTO role_page_access (role, page_key)
    SELECT role, 'transactions' FROM role_page_access
    WHERE (role ILIKE '%contrepart%' OR role ILIKE '%counterpart%' OR role = 'counterparty')
      AND role NOT IN (
        SELECT role FROM role_page_access WHERE page_key = 'transactions'
      )
    ON CONFLICT (role, page_key) DO NOTHING
  `

  accessInitialized = true
}

/** Returns the set of page keys a role may access. Admin gets every assignable page. */
export async function getAllowedPageKeys(role: string): Promise<string[]> {
  await ensureAccessTableExists()

  if (role === "admin") {
    return ASSIGNABLE_PAGES.map((p) => p.key)
  }

  const rows = await sql`
    SELECT page_key FROM role_page_access WHERE role = ${role}
  `
  return rows.map((r) => r.page_key as string)
}

/** Replaces the full set of allowed pages for a role. */
export async function setRoleAccess(role: string, pageKeys: string[]) {
  await ensureAccessTableExists()

  const validKeys = pageKeys.filter((k) => ASSIGNABLE_PAGES.some((p) => p.key === k))

  await sql`DELETE FROM role_page_access WHERE role = ${role}`
  for (const key of validKeys) {
    await sql`
      INSERT INTO role_page_access (role, page_key)
      VALUES (${role}, ${key})
      ON CONFLICT (role, page_key) DO NOTHING
    `
  }
}

/** Returns the full matrix: { role: pageKey[] } for every configurable (non-admin) role. */
export async function getFullMatrix(): Promise<Record<string, string[]>> {
  await ensureAccessTableExists()

  // Seed an empty entry for every configurable role so newly created roles
  // (with no access rows yet) still appear in the matrix.
  const roles = await listRoles()
  const matrix: Record<string, string[]> = {}
  for (const role of roles) {
    if (role.key === "admin") continue
    matrix[role.key] = []
  }

  const rows = await sql`SELECT role, page_key FROM role_page_access`
  for (const row of rows) {
    const role = row.role as string
    if (role === "admin") continue
    if (!matrix[role]) matrix[role] = []
    matrix[role].push(row.page_key as string)
  }
  return matrix
}
