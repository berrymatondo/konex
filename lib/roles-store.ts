import { sql } from "@/lib/db"
import { ROLE_LABELS } from "@/lib/roles"

export interface AppRole {
  key: string
  label: string
  /** System roles (admin + the two defaults) cannot be deleted. */
  isSystem: boolean
}

/** Roles seeded the first time the table is created. */
const SYSTEM_ROLES: { key: string; label: string }[] = [
  { key: "admin", label: ROLE_LABELS.admin },
  { key: "compliance_officer", label: ROLE_LABELS.compliance_officer },
  { key: "risk_manager", label: ROLE_LABELS.risk_manager },
  { key: "counterparty", label: ROLE_LABELS.counterparty },
]

const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key)

let rolesInitialized = false

/** Creates the role table and seeds the system roles on first use. */
export async function ensureRolesTableExists() {
  if (rolesInitialized) return

  await sql`
    CREATE TABLE IF NOT EXISTS app_role (
      role_key text PRIMARY KEY,
      label text NOT NULL,
      is_system boolean NOT NULL DEFAULT false
    )
  `

  for (const role of SYSTEM_ROLES) {
    await sql`
      INSERT INTO app_role (role_key, label, is_system)
      VALUES (${role.key}, ${role.label}, true)
      ON CONFLICT (role_key) DO NOTHING
    `
  }

  rolesInitialized = true
}

/** Builds a stable snake_case key from a free-text label. */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/** Returns every role, system roles first then custom roles alphabetically. */
export async function listRoles(): Promise<AppRole[]> {
  await ensureRolesTableExists()
  const rows = await sql`SELECT role_key, label, is_system FROM app_role`
  const roles = rows.map((r) => ({
    key: r.role_key as string,
    label: r.label as string,
    isSystem: Boolean(r.is_system),
  }))
  return roles.sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

/** Returns the set of valid role keys (used to validate user assignments). */
export async function getValidRoleKeys(): Promise<string[]> {
  const roles = await listRoles()
  return roles.map((r) => r.key)
}

/** Creates a new custom role from a label. Returns the created role or an error. */
export async function createRole(
  rawLabel: string,
): Promise<{ ok: true; role: AppRole } | { ok: false; error: string }> {
  await ensureRolesTableExists()

  const label = rawLabel.trim()
  if (label.length < 2) {
    return { ok: false, error: "Le nom du profil doit comporter au moins 2 caractères." }
  }

  let baseKey = slugify(label)
  if (!baseKey) {
    return { ok: false, error: "Le nom du profil est invalide." }
  }

  // Avoid collisions with existing keys by appending a counter.
  const existing = await sql`SELECT role_key FROM app_role`
  const existingKeys = new Set(existing.map((r) => r.role_key as string))
  let key = baseKey
  let counter = 2
  while (existingKeys.has(key)) {
    key = `${baseKey}_${counter}`
    counter++
  }

  await sql`
    INSERT INTO app_role (role_key, label, is_system)
    VALUES (${key}, ${label}, false)
  `

  return { ok: true, role: { key, label, isSystem: false } }
}

/** Deletes a custom role and its access rows. System roles are protected. */
export async function deleteRole(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureRolesTableExists()

  if (SYSTEM_ROLE_KEYS.includes(key)) {
    return { ok: false, error: "Les profils système ne peuvent pas être supprimés." }
  }

  // Block deletion while users are still assigned to this role.
  const inUse = await sql`SELECT COUNT(*)::int AS count FROM "user" WHERE role = ${key}`
  if ((inUse[0]?.count ?? 0) > 0) {
    return {
      ok: false,
      error: "Ce profil est encore attribué à des utilisateurs. Réassignez-les avant de le supprimer.",
    }
  }

  await sql`DELETE FROM role_page_access WHERE role = ${key}`
  await sql`DELETE FROM app_role WHERE role_key = ${key}`

  return { ok: true }
}
