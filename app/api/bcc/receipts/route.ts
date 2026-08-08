import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const rows = await sql`
      SELECT id, reference, purchase_order_id, status, data, created_at, updated_at
      FROM bcc_receipt_assays
      ORDER BY created_at DESC
    `
    return NextResponse.json(rows, { headers: { "Cache-Control": "private, no-store, max-age=0" } })
  } catch (error) {
    console.error("BCC receipt list error", error)
    return NextResponse.json({ error: "Unable to load BCC receipts" }, { status: 500 })
  }
}
