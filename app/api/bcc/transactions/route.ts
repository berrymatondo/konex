import { NextResponse } from "next/server"

import { ensureBccTables } from "@/lib/bcc-db"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureBccTables()
    const rows = await sql`
      SELECT po.*,
        EXISTS (
          SELECT 1 FROM bcc_receipt_assays r
          WHERE r.purchase_order_id IN (po.id, po.reference)
            AND r.status IN ('confirmed', 'completed', 'approved')
        ) AS receipt_confirmed,
        EXISTS (
          SELECT 1 FROM bcc_pricing_settlements s
          WHERE s.purchase_order_id IN (po.id, po.reference)
            AND s.status IN ('confirmed', 'completed', 'approved')
        ) AS settlement_confirmed,
        EXISTS (
          SELECT 1 FROM bcc_custody_confirmations c
          WHERE c.purchase_order_id IN (po.id, po.reference)
            AND c.status IN ('confirmed', 'completed', 'approved')
        ) AS custody_confirmed
      FROM bcc_purchase_orders po
      ORDER BY po.updated_at DESC, po.created_at DESC
    `
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("BCC transactions error", error)
    return NextResponse.json({ error: "Unable to load BCC transactions" }, { status: 500 })
  }
}
