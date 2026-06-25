import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS security_incidents (
      id text PRIMARY KEY,
      shipment_id text NOT NULL,
      incident_type text NOT NULL,
      declared_seal text,
      physical_seal text,
      description text,
      raised_by text,
      raised_at timestamp with time zone DEFAULT now(),
      checklist_items jsonb DEFAULT '[]'::jsonb,
      carrier_statement text,
      officer_observations text,
      supporting_docs jsonb DEFAULT '[]'::jsonb,
      photos jsonb DEFAULT '[]'::jsonb,
      resolution text,
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

  const rows = await sql`SELECT * FROM security_incidents WHERE shipment_id = ${id} ORDER BY raised_at DESC`
  return NextResponse.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTable()

  const body = await req.json()
  const incidentId = `sec_${Date.now()}`

  await sql`
    INSERT INTO security_incidents (
      id, shipment_id, incident_type, declared_seal, physical_seal, description,
      raised_by, checklist_items, carrier_statement, officer_observations,
      supporting_docs, photos, resolution, resolution_notes, resolved_by, resolved_at
    ) VALUES (
      ${incidentId}, ${id}, ${body.incidentType ?? "seal_mismatch"},
      ${body.declaredSeal ?? null}, ${body.physicalSeal ?? null},
      ${body.description ?? null}, ${sessionUser.id},
      ${JSON.stringify(body.checklistItems ?? [])}::jsonb,
      ${body.carrierStatement ?? null}, ${body.officerObservations ?? null},
      ${JSON.stringify(body.supportingDocs ?? [])}::jsonb,
      ${JSON.stringify(body.photos ?? [])}::jsonb,
      ${body.resolution ?? null}, ${body.resolutionNotes ?? null},
      ${body.resolution ? sessionUser.id : null},
      ${body.resolution ? new Date().toISOString() : null}
    )
    ON CONFLICT (id) DO UPDATE SET
      resolution = EXCLUDED.resolution,
      resolution_notes = EXCLUDED.resolution_notes,
      resolved_by = EXCLUDED.resolved_by,
      resolved_at = EXCLUDED.resolved_at,
      updated_at = now()
  `

  if (body.resolution === "breach_confirmed") {
    await sql`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ${id}`
  } else if (body.resolution === "cleared_admin" || body.resolution === "cleared_documented") {
    await sql`UPDATE purchase_orders SET status = 'in_transit' WHERE id = ${id}`
  }

  return NextResponse.json({ id: incidentId, shipmentId: id, resolution: body.resolution })
}
