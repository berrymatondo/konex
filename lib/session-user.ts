import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

export interface SessionUser {
  id: string
  role: string
  counterpartyId: string | null
}

/**
 * Resolves the current authenticated user along with the counterparty it is
 * linked to (if any). Used by API routes to scope data for counterparty-profile
 * users. Returns null when there is no valid session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const user = session.user as { id: string; role?: string }

  // counterparty_id lives on the "user" table (added via a lazy migration in
  // the admin actions). Guard against older DBs where the column is absent.
  let counterpartyId: string | null = null
  try {
    const rows = await sql`SELECT counterparty_id FROM "user" WHERE id = ${user.id} LIMIT 1`
    counterpartyId = (rows[0]?.counterparty_id as string | null) ?? null
  } catch {
    counterpartyId = null
  }

  return {
    id: user.id,
    role: user.role ?? "compliance_officer",
    counterpartyId,
  }
}

/**
 * A counterparty-profile user only sees data tied to its own counterparty.
 * Returns the counterparty id to scope by, or undefined for unrestricted users.
 * When the user is a counterparty profile with no association, returns null,
 * which callers should treat as "no data".
 */
export function getCounterpartyScope(user: SessionUser | null): string | null | undefined {
  if (user && user.role === "counterparty") {
    return user.counterpartyId // string (scoped) or null (no association -> empty)
  }
  return undefined // not scoped
}

/**
 * True when the user holds the counterparty profile. Such users have read-only
 * access to counterparties and must not create or delete them.
 */
export function isCounterpartyProfile(user: SessionUser | null): boolean {
  return user?.role === "counterparty"
}
