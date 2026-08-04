import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser, isCounterpartyProfile } from "@/lib/session-user";

function reference() {
  return `GAC-REF-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function serialize(row: Record<string, unknown>) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderReference: row.purchase_order_reference,
    lotReference: row.lot_reference,
    counterpartyName: row.counterparty_name,
    refineryId: row.refinery_id,
    refineryName: row.refinery_name,
    targetFineness: row.target_fineness,
    inputGrossWeightKg: Number(row.input_gross_weight_kg),
    inputFineGoldKg: Number(row.input_fine_gold_kg),
    expectedOutturnKg: Number(row.expected_outturn_kg),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    await ensureTablesExist();
    await ensureRefiningOrdersTable();
    const rows = await sql`
      SELECT ro.*, po.tracking_id AS purchase_order_reference,
             NULL::text AS lot_reference, seller.legal_name AS counterparty_name,
             refinery.legal_name AS refinery_name
      FROM refining_orders ro
      JOIN purchase_orders po ON po.id = ro.purchase_order_id
      LEFT JOIN counterparties seller ON seller.id = po.counterparty_id
      LEFT JOIN counterparties refinery ON refinery.id = ro.refinery_id
      ORDER BY ro.created_at DESC
    `;
    return NextResponse.json(rows.map((row) => serialize(row as Record<string, unknown>)));
  } catch (error) {
    console.error("Error fetching refining orders:", error);
    return NextResponse.json({ error: "Failed to fetch refining orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isCounterpartyProfile(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureTablesExist();
    await ensureRefiningOrdersTable();

    const body = await request.json();
    const required = ["purchaseOrderId", "refineryId", "targetFineness", "turnaroundDays", "fee", "feeUnit", "expectedLossPercent", "inputGrossWeightKg", "inputFineGoldKg", "expectedOutturnKg"];
    if (required.some((key) => body[key] === undefined || body[key] === null || body[key] === "")) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const refinery = await sql`SELECT id FROM counterparties WHERE id = ${body.refineryId} AND counterparty_type = 'refinery' AND status = ANY(${["approved", "active"]}) LIMIT 1`;
    if (!refinery.length) return NextResponse.json({ error: "Invalid refinery" }, { status: 400 });

    let rows;
    if (body.id) {
      rows = await sql`
        UPDATE refining_orders SET
          purchase_order_id = ${body.purchaseOrderId}, refinery_id = ${body.refineryId},
          target_fineness = ${body.targetFineness}, turnaround_days = ${Number(body.turnaroundDays)},
          fee = ${Number(body.fee)}, fee_unit = ${body.feeUnit},
          expected_loss_percent = ${Number(body.expectedLossPercent)},
          input_gross_weight_kg = ${Number(body.inputGrossWeightKg)},
          input_fine_gold_kg = ${Number(body.inputFineGoldKg)},
          expected_outturn_kg = ${Number(body.expectedOutturnKg)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${body.id} RETURNING *
      `;
      if (!rows.length) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
    } else {
      rows = await sql`
        INSERT INTO refining_orders (
          reference, purchase_order_id, refinery_id, target_fineness, turnaround_days,
          fee, fee_unit, expected_loss_percent, input_gross_weight_kg,
          input_fine_gold_kg, expected_outturn_kg, created_by
        ) VALUES (
          ${reference()}, ${body.purchaseOrderId}, ${body.refineryId}, ${body.targetFineness},
          ${Number(body.turnaroundDays)}, ${Number(body.fee)}, ${body.feeUnit},
          ${Number(body.expectedLossPercent)}, ${Number(body.inputGrossWeightKg)},
          ${Number(body.inputFineGoldKg)}, ${Number(body.expectedOutturnKg)}, ${user.id}
        ) RETURNING *
      `;
    }
    return NextResponse.json(serialize(rows[0] as Record<string, unknown>), { status: body.id ? 200 : 201 });
  } catch (error) {
    console.error("Error saving refining order:", error);
    return NextResponse.json({ error: "Failed to save refining order" }, { status: 500 });
  }
}
