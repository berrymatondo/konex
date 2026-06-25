import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS referee_appointments (
      id text PRIMARY KEY,
      shipment_id text NOT NULL,
      variance_review_id text,
      referee_lab text NOT NULL,
      lbma_ref text,
      access_date date,
      deadline date,
      cost_borne_by text DEFAULT 'counterparty',
      notes text,
      approved_by text,
      approved_at timestamp with time zone,
      status text DEFAULT 'pending',
      created_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS referee_results (
      id text PRIMARY KEY,
      appointment_id text NOT NULL,
      shipment_id text,
      cert_number text,
      cert_date date,
      cert_doc_id text,
      fine_oz_per_bar jsonb DEFAULT '[]'::jsonb,
      total_fine_oz numeric,
      vs_vault_oz numeric,
      vs_declared_oz numeric,
      recorded_by text,
      recorded_at timestamp with time zone DEFAULT now()
    )
  `
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTables()

  const appointments = await sql`SELECT * FROM referee_appointments WHERE shipment_id = ${id} ORDER BY created_at DESC`
  const latest = appointments[0] ?? null

  let result = null
  if (latest) {
    const results = await sql`SELECT * FROM referee_results WHERE appointment_id = ${latest.id} ORDER BY recorded_at DESC`
    result = results[0] ?? null
  }

  return NextResponse.json({ appointment: latest, result, history: appointments })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTables()

  const body = await req.json()

  if (body.action === "record_result") {
    const resultId = `rr_${Date.now()}`
    await sql`
      INSERT INTO referee_results (
        id, appointment_id, shipment_id, cert_number, cert_date,
        fine_oz_per_bar, total_fine_oz, vs_vault_oz, vs_declared_oz, recorded_by
      ) VALUES (
        ${resultId}, ${body.appointmentId}, ${id},
        ${body.certNumber ?? null}, ${body.certDate ?? null},
        ${JSON.stringify(body.fineOzPerBar ?? [])}::jsonb,
        ${body.totalFineOz ?? null}, ${body.vsVaultOz ?? null},
        ${body.vsDeclaredOz ?? null}, ${sessionUser.id}
      )
    `
    await sql`UPDATE purchase_orders SET status = 'pending_settlement' WHERE id = ${id}`
    return NextResponse.json({ id: resultId, action: "result_recorded" })
  }

  // Create appointment
  const apptId = `ra_${Date.now()}`
  await sql`
    INSERT INTO referee_appointments (
      id, shipment_id, variance_review_id, referee_lab, lbma_ref,
      access_date, deadline, cost_borne_by, notes
    ) VALUES (
      ${apptId}, ${id}, ${body.varianceReviewId ?? null},
      ${body.refereeLab}, ${body.lbmaRef ?? null},
      ${body.accessDate ?? null}, ${body.deadline ?? null},
      ${body.costBorneBy ?? "counterparty"}, ${body.notes ?? null}
    )
  `

  return NextResponse.json({ id: apptId, action: "appointment_created" })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureTables()

  const body = await req.json()

  await sql`
    UPDATE referee_appointments
    SET status = ${body.status}, approved_by = ${sessionUser.id}, approved_at = now()
    WHERE id = ${body.appointmentId} AND shipment_id = ${id}
  `

  return NextResponse.json({ appointmentId: body.appointmentId, status: body.status })
}
