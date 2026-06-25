import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS variance_reviews (
      id text PRIMARY KEY,
      shipment_id text NOT NULL,
      po_fine_oz numeric,
      vault_fine_oz numeric,
      variance_oz numeric,
      variance_pct numeric,
      resolution text,
      lbma_fixing_reference text,
      adjusted_settlement_value numeric,
      notes text,
      cpt_notification_sent boolean DEFAULT false,
      resolved_by text,
      resolved_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS variance_responses (
      id text PRIMARY KEY,
      variance_review_id text NOT NULL,
      response_type text NOT NULL,
      response_notes text,
      supporting_docs jsonb DEFAULT '[]'::jsonb,
      submitted_by text,
      submitted_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS bar_variance_records (
      id text PRIMARY KEY,
      shipment_id text NOT NULL,
      bar_id text NOT NULL,
      bar_serial text,
      vault_fineness numeric,
      sgs_fineness numeric,
      divergence numeric,
      lbma_floor_pass boolean DEFAULT true,
      outcome text,
      notes text,
      actor_id text,
      created_at timestamp with time zone DEFAULT now()
    )
  `
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTables()

  const reviews = await sql`SELECT * FROM variance_reviews WHERE shipment_id = ${id} ORDER BY created_at DESC`
  const latest = reviews[0] ?? null

  let response = null
  if (latest) {
    const responses = await sql`SELECT * FROM variance_responses WHERE variance_review_id = ${latest.id} ORDER BY submitted_at DESC`
    response = responses[0] ?? null
  }

  const barRecords = await sql`SELECT * FROM bar_variance_records WHERE shipment_id = ${id} ORDER BY created_at DESC`

  return NextResponse.json({ review: latest, response, barRecords })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTables()

  const body = await req.json()
  const reviewId = `vr_${Date.now()}`

  const variancePct =
    body.poFineOz && body.vaultFineOz
      ? ((Number(body.vaultFineOz) - Number(body.poFineOz)) / Number(body.poFineOz)) * 100
      : null

  await sql`
    INSERT INTO variance_reviews (
      id, shipment_id, po_fine_oz, vault_fine_oz, variance_oz, variance_pct,
      resolution, lbma_fixing_reference, adjusted_settlement_value,
      notes, cpt_notification_sent, resolved_by, resolved_at
    ) VALUES (
      ${reviewId}, ${id},
      ${body.poFineOz ?? null}, ${body.vaultFineOz ?? null},
      ${body.varianceOz ?? null}, ${variancePct},
      ${body.resolution ?? null}, ${body.lbmaFixingReference ?? null},
      ${body.adjustedSettlementValue ?? null}, ${body.notes ?? null},
      ${body.cptNotificationSent ?? false},
      ${body.resolution ? sessionUser.id : null},
      ${body.resolution ? new Date().toISOString() : null}
    )
    ON CONFLICT (id) DO NOTHING
  `

  if (body.resolution === "accept") {
    await sql`UPDATE purchase_orders SET status = 'pending_settlement' WHERE id = ${id}`
  } else if (body.resolution === "renegotiate") {
    await sql`UPDATE purchase_orders SET status = 'negotiating' WHERE id = ${id}`
  } else if (body.resolution === "reject") {
    await sql`UPDATE purchase_orders SET status = 'rejected' WHERE id = ${id}`
  }

  return NextResponse.json({ id: reviewId, shipmentId: id, variancePct, resolution: body.resolution })
}
