import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

const PHASE_MAP: Record<string, number> = {
  draft: 1,
  submitted: 2,
  rejected: 2,
  approved: 3,
  sent_to_counterparty: 3,
  accepted: 4,
  declined: 4,
  manifest_validated: 5,
  in_transit: 6,
  delivered: 6,
  negotiating: 6,
  pending_settlement: 7,
  cancelled: 0,
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role === "counterparty") {
    return NextResponse.json({ error: "Accès réservé aux agents." }, { status: 403 })
  }

  const rows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM purchase_orders
    GROUP BY status
  `

  const counts: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    const status = row.status as string
    const count = Number(row.count)
    counts[status] = count
    total += count
  }

  // Aggregate by phase
  const byPhase: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  for (const [status, count] of Object.entries(counts)) {
    const phase = PHASE_MAP[status] ?? -1
    if (phase >= 0) byPhase[phase] = (byPhase[phase] || 0) + count
  }

  // Critical states (blocked flows)
  const critical = ["rejected", "declined", "cancelled"]
  const criticalCount = critical.reduce((s, st) => s + (counts[st] || 0), 0)

  // Active pipeline (excludes terminal states)
  const terminal = ["pending_settlement", "cancelled", "rejected", "declined"]
  const activeCount = total - terminal.reduce((s, st) => s + (counts[st] || 0), 0)

  return NextResponse.json({ counts, total, byPhase, criticalCount, activeCount })
}
