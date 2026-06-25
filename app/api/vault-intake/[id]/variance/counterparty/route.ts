import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS variance_responses (
      id text PRIMARY KEY,
      variance_review_id text NOT NULL,
      shipment_id text,
      response_type text NOT NULL,
      response_notes text,
      supporting_docs jsonb DEFAULT '[]'::jsonb,
      submitted_by text,
      submitted_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`ALTER TABLE variance_responses ADD COLUMN IF NOT EXISTS shipment_id text`
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTable()

  const body = await req.json()
  const responseId = `vresp_${Date.now()}`

  await sql`
    INSERT INTO variance_responses (
      id, variance_review_id, shipment_id, response_type, response_notes,
      supporting_docs, submitted_by
    ) VALUES (
      ${responseId},
      ${body.varianceReviewId ?? id},
      ${id},
      ${body.responseType},
      ${body.responseNotes ?? null},
      ${JSON.stringify(body.supportingDocs ?? [])}::jsonb,
      ${sessionUser.id}
    )
  `

  if (body.responseType === "accept") {
    await sql`UPDATE purchase_orders SET status = 'pending_settlement' WHERE id = ${id}`
  } else if (body.responseType === "referee") {
    await sql`UPDATE purchase_orders SET status = 'negotiating' WHERE id = ${id}`
  } else if (body.responseType === "dispute") {
    await sql`UPDATE purchase_orders SET status = 'negotiating' WHERE id = ${id}`
  }

  return NextResponse.json({ id: responseId, responseType: body.responseType })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTable()

  const rows = await sql`SELECT * FROM variance_responses WHERE shipment_id = ${id} ORDER BY submitted_at DESC`
  return NextResponse.json(rows[0] ?? null)
}
