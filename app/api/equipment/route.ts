import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS vault_equipment (
      id text PRIMARY KEY,
      name text NOT NULL,
      type text NOT NULL,
      method text,
      location text,
      status text DEFAULT 'active',
      serial_number text,
      manufacturer text,
      model text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS accreditation_records (
      id text PRIMARY KEY,
      equipment_id text NOT NULL,
      body text NOT NULL,
      accreditation_number text,
      valid_from date,
      valid_to date,
      cert_doc_id text,
      created_at timestamp with time zone DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS equipment_calibrations (
      id text PRIMARY KEY,
      equipment_id text NOT NULL,
      calibrated_at timestamp with time zone,
      calibration_interval_days integer DEFAULT 365,
      cert_number text,
      certified_by text,
      next_due_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now()
    )
  `
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureTables()

  const equipment = await sql`SELECT * FROM vault_equipment ORDER BY type, name`
  const accreditations = await sql`SELECT * FROM accreditation_records ORDER BY valid_to DESC`
  const calibrations = await sql`SELECT * FROM equipment_calibrations ORDER BY calibrated_at DESC`

  return NextResponse.json({ equipment, accreditations, calibrations })
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  await ensureTables()

  const body = await req.json()

  if (body.action === "add_accreditation") {
    const accId = `acc_${Date.now()}`
    await sql`
      INSERT INTO accreditation_records (id, equipment_id, body, accreditation_number, valid_from, valid_to, cert_doc_id)
      VALUES (${accId}, ${body.equipmentId}, ${body.body}, ${body.accreditationNumber ?? null},
              ${body.validFrom ?? null}, ${body.validTo ?? null}, ${body.certDocId ?? null})
    `
    return NextResponse.json({ id: accId })
  }

  if (body.action === "add_calibration") {
    const calId = `cal_${Date.now()}`
    const nextDue = body.calibratedAt && body.intervalDays
      ? new Date(new Date(body.calibratedAt).getTime() + body.intervalDays * 86400000).toISOString()
      : null
    await sql`
      INSERT INTO equipment_calibrations (id, equipment_id, calibrated_at, calibration_interval_days, cert_number, certified_by, next_due_at)
      VALUES (${calId}, ${body.equipmentId}, ${body.calibratedAt ?? null},
              ${body.intervalDays ?? 365}, ${body.certNumber ?? null},
              ${body.certifiedBy ?? null}, ${nextDue})
    `
    return NextResponse.json({ id: calId })
  }

  // Add equipment
  const equipId = `eq_${Date.now()}`
  await sql`
    INSERT INTO vault_equipment (id, name, type, method, location, status, serial_number, manufacturer, model)
    VALUES (${equipId}, ${body.name}, ${body.type}, ${body.method ?? null},
            ${body.location ?? null}, ${body.status ?? "active"},
            ${body.serialNumber ?? null}, ${body.manufacturer ?? null}, ${body.model ?? null})
  `
  return NextResponse.json({ id: equipId })
}

export async function PUT(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  await ensureTables()
  const body = await req.json()

  await sql`
    UPDATE vault_equipment SET
      name = ${body.name}, type = ${body.type}, method = ${body.method ?? null},
      location = ${body.location ?? null}, status = ${body.status ?? "active"},
      serial_number = ${body.serialNumber ?? null}, manufacturer = ${body.manufacturer ?? null},
      model = ${body.model ?? null}, updated_at = now()
    WHERE id = ${body.id}
  `
  return NextResponse.json({ id: body.id })
}
