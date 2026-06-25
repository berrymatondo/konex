import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS count_discrepancies (
      id text PRIMARY KEY,
      shipment_id text NOT NULL,
      expected_count integer,
      received_count integer,
      received_serials jsonb DEFAULT '[]'::jsonb,
      missing_serials jsonb DEFAULT '[]'::jsonb,
      extra_serials jsonb DEFAULT '[]'::jsonb,
      notes text,
      raised_by text,
      raised_at timestamp with time zone DEFAULT now(),
      resolution text,
      hold_duration_hours integer,
      hold_expires_at timestamp with time zone,
      resolution_notes text,
      resolved_by text,
      resolved_at timestamp with time zone,
      updated_at timestamp with time zone DEFAULT now()
    )
  `
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTable()

  const rows = await sql`SELECT * FROM count_discrepancies WHERE shipment_id = ${id} ORDER BY raised_at DESC`
  return NextResponse.json(rows[0] ?? null)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTable()

  const body = await req.json()
  const discId = `cd_${Date.now()}`

  const holdExpiresAt =
    body.resolution === "hold" && body.holdDurationHours
      ? new Date(Date.now() + body.holdDurationHours * 3600 * 1000).toISOString()
      : null

  await sql`
    INSERT INTO count_discrepancies (
      id, shipment_id, expected_count, received_count,
      received_serials, missing_serials, extra_serials, notes,
      raised_by, resolution, hold_duration_hours, hold_expires_at,
      resolution_notes, resolved_by, resolved_at
    ) VALUES (
      ${discId}, ${id},
      ${body.expectedCount ?? null}, ${body.receivedCount ?? null},
      ${JSON.stringify(body.receivedSerials ?? [])}::jsonb,
      ${JSON.stringify(body.missingSerials ?? [])}::jsonb,
      ${JSON.stringify(body.extraSerials ?? [])}::jsonb,
      ${body.notes ?? null}, ${sessionUser.id},
      ${body.resolution ?? null},
      ${body.holdDurationHours ?? null}, ${holdExpiresAt},
      ${body.resolutionNotes ?? null},
      ${body.resolution ? sessionUser.id : null},
      ${body.resolution ? new Date().toISOString() : null}
    )
    ON CONFLICT (id) DO UPDATE SET
      resolution = EXCLUDED.resolution,
      hold_duration_hours = EXCLUDED.hold_duration_hours,
      hold_expires_at = EXCLUDED.hold_expires_at,
      resolution_notes = EXCLUDED.resolution_notes,
      resolved_by = EXCLUDED.resolved_by,
      resolved_at = EXCLUDED.resolved_at,
      updated_at = now()
  `

  if (body.resolution === "partial_accepted") {
    await sql`UPDATE purchase_orders SET status = 'delivered' WHERE id = ${id}`
  } else if (body.resolution === "hold") {
    await sql`UPDATE purchase_orders SET status = 'in_transit' WHERE id = ${id}`
  } else if (body.resolution === "rejected") {
    await sql`UPDATE purchase_orders SET status = 'rejected' WHERE id = ${id}`
  }

  return NextResponse.json({ id: discId, shipmentId: id, resolution: body.resolution, holdExpiresAt })
}
