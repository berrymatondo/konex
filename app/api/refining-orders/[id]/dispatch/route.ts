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
    const { id } = await context.params;
    const body = await request.json();
    const requiredStrings = [body.packaging, body.carrier, body.transportMode, body.dispatchAt, body.insurer, body.coverage];
    const seals = Array.isArray(body.seals) ? body.seals.map(String).map((seal: string) => seal.trim()).filter(Boolean) : [];

    if (!Number.isInteger(body.pieces) || body.pieces <= 0 || !Number.isFinite(body.dispatchWeightKg) || body.dispatchWeightKg <= 0 || requiredStrings.some((value) => !String(value || "").trim()) || !seals.length || !body.documentNames?.manifest || !body.documentNames?.sealCertificate) {
      return NextResponse.json({ error: "Required dispatch information is incomplete" }, { status: 400 });
    }

    const orders = await sql`
      SELECT id, reference, status, input_gross_weight_kg
      FROM refining_orders
      WHERE id = ${id} OR reference = ${id}
      LIMIT 1
    `;
    if (!orders.length) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
    const order = orders[0];
    if (!["approved", "dispatched", "in_refining"].includes(String(order.status))) {
      return NextResponse.json({ error: "The refining order has not been fully approved" }, { status: 409 });
    }
    if (Math.abs(Number(order.input_gross_weight_kg) - Number(body.dispatchWeightKg)) >= 0.0005) {
      return NextResponse.json({ error: "Dispatch weight does not match the refining order" }, { status: 400 });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS refining_order_dispatches (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        refining_order_id TEXT NOT NULL UNIQUE REFERENCES refining_orders(id) ON DELETE CASCADE,
        details JSONB NOT NULL,
        confirmed_by TEXT NOT NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const details = JSON.stringify({ ...body, seals });
    const dispatches = await sql`
      INSERT INTO refining_order_dispatches (refining_order_id, details, confirmed_by)
      VALUES (${order.id}, ${details}::jsonb, ${user.id})
      ON CONFLICT (refining_order_id) DO UPDATE SET
        details = EXCLUDED.details,
        confirmed_by = EXCLUDED.confirmed_by,
        confirmed_at = CURRENT_TIMESTAMP
      RETURNING id, confirmed_at
    `;
    await sql`
      UPDATE refining_orders
      SET status = 'in_refining', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${order.id}
    `;

    return NextResponse.json({
      ok: true,
      status: "in_refining",
      reference: order.reference,
      dispatchId: dispatches[0].id,
      confirmedAt: dispatches[0].confirmed_at,
    });
  } catch (error) {
    console.error("Error confirming refining dispatch:", error);
    return NextResponse.json({ error: "Failed to confirm dispatch" }, { status: 500 });
  }
}
