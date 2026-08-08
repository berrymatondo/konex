import { NextResponse } from "next/server"
import { ensureBccTables } from "@/lib/bcc-db"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureBccTables(); const { id } = await params
  const rows = await sql`SELECT * FROM bcc_purchase_orders WHERE id=${id} LIMIT 1`
  return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureBccTables(); const { id } = await params
  const found = await sql`SELECT reference,status FROM bcc_purchase_orders WHERE id=${id} LIMIT 1`
  if (!found[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (found[0].status === "approved") return NextResponse.json({ error: "An approved purchase order cannot be deleted" }, { status: 409 })
  const reference = String(found[0].reference)
  await Promise.all([
    sql`DELETE FROM bcc_receipt_assays WHERE purchase_order_id IN (${id},${reference})`,
    sql`DELETE FROM bcc_pricing_settlements WHERE purchase_order_id IN (${id},${reference})`,
    sql`DELETE FROM bcc_custody_confirmations WHERE purchase_order_id IN (${id},${reference})`,
    sql`DELETE FROM bcc_refining_orders WHERE purchase_order_id IN (${id},${reference})`,
  ])
  await sql`DELETE FROM bcc_purchase_orders WHERE id=${id}`
  return NextResponse.json({ ok: true })
}
