import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureTablesExist();
    await ensureRefiningOrdersTable();

    const body = await request.json();
    if (!["approved", "returned", "rejected"].includes(body.decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }
    if (["returned", "rejected"].includes(body.decision) && !String(body.note || "").trim()) {
      return NextResponse.json({ error: "A decision note is required" }, { status: 400 });
    }

    const { id } = await context.params;
    const orders = await sql`
      SELECT ro.id, ro.status, ro.expected_outturn_kg,
             COALESCE(po.lbma_price_per_oz, 5050) AS gold_price_per_oz
      FROM refining_orders ro
      JOIN purchase_orders po ON po.id = ro.purchase_order_id
      WHERE ro.id = ${id} OR ro.reference = ${id} LIMIT 1
    `;
    if (!orders.length) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
    const order = orders[0];
    const consignmentValue = Number(order.expected_outturn_kg) * 32.1507466 * Number(order.gold_price_per_oz);
    const requiredApprovals = consignmentValue <= 500_000 ? 1 : consignmentValue <= 5_000_000 ? 2 : 3;

    const existing = await sql`
      SELECT decision FROM refining_order_approvals
      WHERE refining_order_id = ${order.id} AND approver_id = ${user.id}
      LIMIT 1
    `;
    if (existing[0]?.decision === "approved" && body.decision === "approved") {
      return NextResponse.json({ error: "You have already approved this order" }, { status: 409 });
    }
    const names = await sql`SELECT name FROM "user" WHERE id = ${user.id} LIMIT 1`;
    const approverName = String(names[0]?.name || user.id);

    const rows = await sql`
      INSERT INTO refining_order_approvals (
        refining_order_id, approver_id, approver_name, approver_role, decision, note
      ) VALUES (
        ${order.id}, ${user.id}, ${approverName}, ${user.role}, ${body.decision}, ${String(body.note || "").trim() || null}
      )
      ON CONFLICT (refining_order_id, approver_id) DO UPDATE SET
        decision = EXCLUDED.decision,
        note = EXCLUDED.note,
        approver_name = EXCLUDED.approver_name,
        approver_role = EXCLUDED.approver_role,
        decided_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const counts = await sql`
      SELECT COUNT(DISTINCT approver_id)::int AS count
      FROM refining_order_approvals
      WHERE refining_order_id = ${order.id} AND decision = 'approved'
    `;
    const approvedCount = Number(counts[0]?.count) || 0;
    const nextStatus = body.decision === "rejected"
      ? "rejected"
      : body.decision === "returned"
        ? "returned"
        : approvedCount >= requiredApprovals
          ? "approved"
          : "pending_approval";
    await sql`UPDATE refining_orders SET status = ${nextStatus}, updated_at = CURRENT_TIMESTAMP WHERE id = ${order.id}`;

    return NextResponse.json({ approval: rows[0], approvedCount, requiredApprovals, status: nextStatus });
  } catch (error) {
    console.error("Error recording refining approval:", error);
    return NextResponse.json({ error: "Failed to record approval decision" }, { status: 500 });
  }
}
