import { NextResponse } from "next/server"

import { ensureBccTables } from "@/lib/bcc-db"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await ensureBccTables()
    const rows = await sql`
      UPDATE bcc_purchase_order_reference_counter
      SET last_number = last_number + 1, updated_at = CURRENT_TIMESTAMP
      WHERE counter_key = 'purchase_order'
      RETURNING last_number
    `
    const number = Number(rows[0]?.last_number)
    const year = new Date().getUTCFullYear()
    return NextResponse.json({ reference: `PO-${year}-${String(number).padStart(4, "0")}` })
  } catch (error) {
    console.error("BCC PO reference error", error)
    return NextResponse.json({ error: "Unable to generate PO reference" }, { status: 500 })
  }
}
