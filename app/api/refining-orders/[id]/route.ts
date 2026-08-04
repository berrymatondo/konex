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
             COALESCE(po.lbma_price_per_oz, 5050) AS lbma_price_per_oz, seller.legal_name AS counterparty_name,
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
    const approvals = await sql`
      SELECT id, approver_id, approver_name, approver_role, decision, note, decided_at
      FROM refining_order_approvals
      WHERE refining_order_id = ${row.id}
      ORDER BY decided_at ASC
    `;
    let creatorName: string | null = null;
    let creatorRole: string | null = null;
    if (row.created_by) {
      const creators = await sql`SELECT name, role FROM "user" WHERE id = ${row.created_by} LIMIT 1`;
      creatorName = (creators[0]?.name as string | null) ?? null;
      creatorRole = (creators[0]?.role as string | null) ?? null;
    }
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
      createdByName: creatorName,
      createdByRole: creatorRole,
      createdAt: row.created_at,
      approvals: approvals.map((approval) => ({
        id: approval.id,
        approverId: approval.approver_id,
        approverName: approval.approver_name,
        approverRole: approval.approver_role,
        decision: approval.decision,
        note: approval.note,
        decidedAt: approval.decided_at,
      })),
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
