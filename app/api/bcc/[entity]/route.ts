import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { BCC_ENTITIES, bccReference, ensureBccTable, isBccEntity } from "@/lib/bcc-db"
import { getSessionUser } from "@/lib/session-user"

async function context(params: Promise<{ entity: string }>, initialize = true) {
  const [user, { entity }] = await Promise.all([getSessionUser(), params])
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isBccEntity(entity)) return { error: NextResponse.json({ error: "Unknown BCC entity" }, { status: 404 }) }
  if (initialize) await ensureBccTable(entity)
  return { user, entity, table: BCC_ENTITIES[entity] }
}

export async function GET(_: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const ctx = await context(params, false)
    if (ctx.error) return ctx.error
    const rows = await sql(`SELECT id,reference,purchase_order_id,status,data,created_at,updated_at FROM ${ctx.table} ORDER BY created_at DESC`)
    return NextResponse.json(rows, { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } })
  } catch (error) {
    console.error("BCC list error", error)
    return NextResponse.json({ error: "Unable to load BCC records" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const ctx = await context(params)
    if (ctx.error) return ctx.error
    const body = await request.json()
    let reference = String(body.reference || bccReference(ctx.entity))
    const status = String(body.status || "draft")
    const purchaseOrderId = body.purchaseOrderId ? String(body.purchaseOrderId) : null
    const data = body.data && typeof body.data === "object" ? body.data : {}
    let rows
    if (ctx.entity === "purchase-orders" && body.recordId) {
      rows = await sql`
        UPDATE bcc_purchase_orders SET status=${status}, data=${JSON.stringify(data)}::jsonb,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=${String(body.recordId)} AND status <> 'approved' RETURNING *
      `
      if (!rows[0]) {
        const existing = await sql`SELECT status FROM bcc_purchase_orders WHERE id=${String(body.recordId)} LIMIT 1`
        if (existing[0]?.status === "approved") return NextResponse.json({ error: "A submitted purchase order cannot be edited" }, { status: 409 })
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
      }
    } else if (ctx.entity === "purchase-orders" && body.generateReference) {
      const year = new Date().getUTCFullYear().toString()
      rows = await sql`
        WITH locked AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(82426008)
        ), next_number AS (
          SELECT COALESCE(MAX(substring(reference from '([0-9]+)$')::integer), 0) + 1 AS value
          FROM bcc_purchase_orders, locked
          WHERE reference LIKE ${`PO-${year}-%`}
        )
        INSERT INTO bcc_purchase_orders (reference,purchase_order_id,status,data,created_by)
        SELECT ${`PO-${year}-`} || lpad(value::text, 4, '0'), ${purchaseOrderId}, ${status},
          ${JSON.stringify(data)}::jsonb, ${ctx.user.id}
        FROM next_number
        RETURNING *
      `
      reference = String(rows[0]?.reference || reference)
    } else {
      rows = await sql(
        `INSERT INTO ${ctx.table} (reference,purchase_order_id,status,data,created_by) VALUES ($1,$2,$3,$4::jsonb,$5)
         ON CONFLICT (reference) DO UPDATE SET purchase_order_id=EXCLUDED.purchase_order_id,status=EXCLUDED.status,data=EXCLUDED.data,updated_at=CURRENT_TIMESTAMP
         RETURNING *`,
        [reference, purchaseOrderId, status, JSON.stringify(data), ctx.user.id],
      )
    }
    if (ctx.entity !== "audit") {
      await ensureBccTable("audit")
      await sql(
        `INSERT INTO bcc_audit_log (reference,purchase_order_id,status,data,created_by) VALUES ($1,$2,'recorded',$3::jsonb,$4)`,
        [bccReference("audit"), purchaseOrderId, JSON.stringify({ action: "created", entity: ctx.entity, recordReference: reference }), ctx.user.id],
      )
    }
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error("BCC create error", error)
    return NextResponse.json({ error: "Unable to save BCC record" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const ctx = await context(params)
    if (ctx.error) return ctx.error
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const immutableClause = ctx.entity === "purchase-orders"
      ? " AND status <> 'approved'"
      : ctx.entity === "receipt-assay"
        ? " AND status NOT IN ('received','confirmed')"
        : ""
    const rows = await sql(
      `UPDATE ${ctx.table} SET status=$1,data=$2::jsonb,purchase_order_id=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4${immutableClause} RETURNING *`,
      [String(body.status || "draft"), JSON.stringify(body.data || {}), body.purchaseOrderId || null, String(body.id)],
    )
    if (ctx.entity === "purchase-orders" && !rows[0]) {
      const existing = await sql`SELECT status FROM bcc_purchase_orders WHERE id=${String(body.id)} LIMIT 1`
      if (existing[0]?.status === "approved") return NextResponse.json({ error: "A submitted purchase order cannot be edited" }, { status: 409 })
    }
    if (ctx.entity === "receipt-assay" && !rows[0]) {
      const existing = await sql`SELECT status FROM bcc_receipt_assays WHERE id=${String(body.id)} LIMIT 1`
      if (["received", "confirmed"].includes(String(existing[0]?.status))) return NextResponse.json({ error: "A received receipt cannot be edited" }, { status: 409 })
    }
    return NextResponse.json(rows[0] || null)
  } catch (error) {
    console.error("BCC update error", error)
    return NextResponse.json({ error: "Unable to update BCC record" }, { status: 500 })
  }
}
