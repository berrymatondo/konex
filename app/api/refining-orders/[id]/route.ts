import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureTablesExist();
    await ensureRefiningOrdersTable();
    const { id } = await context.params;
    const rows = await sql`
      SELECT ro.*, po.tracking_id AS purchase_order_reference,
             po.lbma_price_per_oz, seller.legal_name AS counterparty_name,
             refinery.legal_name AS refinery_name,
             refinery.lbma_good_delivery_status,
             (
               SELECT cm.manifest_reference
               FROM counterparty_manifests cm
               WHERE cm.purchase_order_id = po.id
               ORDER BY cm.attempt_number DESC, cm.created_at DESC LIMIT 1
             ) AS lot_reference
      FROM refining_orders ro
      JOIN purchase_orders po ON po.id = ro.purchase_order_id
      LEFT JOIN counterparties seller ON seller.id = po.counterparty_id
      LEFT JOIN counterparties refinery ON refinery.id = ro.refinery_id
      WHERE ro.id = ${id} OR ro.reference = ${id}
      LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
    const row = rows[0];
    return NextResponse.json({
      id: row.id,
      reference: row.reference,
      status: row.status,
      purchaseOrderReference: row.purchase_order_reference,
      lotReference: row.lot_reference,
      counterpartyName: row.counterparty_name,
      refineryName: row.refinery_name,
      lbmaGoodDeliveryStatus: row.lbma_good_delivery_status,
      targetFineness: row.target_fineness,
      turnaroundDays: Number(row.turnaround_days),
      fee: Number(row.fee),
      feeUnit: row.fee_unit,
      expectedLossPercent: Number(row.expected_loss_percent),
      inputGrossWeightKg: Number(row.input_gross_weight_kg),
      inputFineGoldKg: Number(row.input_fine_gold_kg),
      expectedOutturnKg: Number(row.expected_outturn_kg),
      goldPricePerOz: Number(row.lbma_price_per_oz) || 0,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error("Error fetching refining order:", error);
    return NextResponse.json({ error: "Failed to fetch refining order" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await ensureTablesExist();
    await ensureRefiningOrdersTable();
    const { id } = await context.params;
    const rows = await sql`
      DELETE FROM refining_orders
      WHERE id = ${id} OR reference = ${id}
      RETURNING id, reference
    `;

    if (!rows.length) {
      return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: rows[0].id, reference: rows[0].reference });
  } catch (error) {
    console.error("Error deleting refining order:", error);
    return NextResponse.json({ error: "Failed to delete refining order" }, { status: 500 });
  }
}
