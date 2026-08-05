import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser, isCounterpartyProfile } from "@/lib/session-user";

async function initialize() {
  await ensureTablesExist();
  await ensureRefiningOrdersTable();
  await sql`
    CREATE TABLE IF NOT EXISTS refining_order_classifications (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      refining_order_id TEXT NOT NULL UNIQUE REFERENCES refining_orders(id) ON DELETE CASCADE,
      classification TEXT NOT NULL,
      verified_fine_kg NUMERIC NOT NULL,
      output_fineness NUMERIC NOT NULL,
      reason TEXT,
      note TEXT,
      classified_by TEXT NOT NULL,
      classified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function loadOrder(id: string) {
  const rows = await sql`
    SELECT ro.id, ro.reference, refinery.lbma_good_delivery_status,
           roo.verification
    FROM refining_orders ro
    LEFT JOIN counterparties refinery ON refinery.id = ro.refinery_id
    LEFT JOIN refining_order_outturns roo ON roo.refining_order_id = ro.id
    WHERE ro.id = ${id} OR ro.reference = ${id}
    LIMIT 1
  `;
  return rows[0];
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initialize();
  const { id } = await context.params;
  const order = await loadOrder(id);
  if (!order) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
  const rows = await sql`SELECT classification, verified_fine_kg, output_fineness, reason, note, classified_at FROM refining_order_classifications WHERE refining_order_id = ${order.id} LIMIT 1`;
  return NextResponse.json(rows[0] || null);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isCounterpartyProfile(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await initialize();
  const { id } = await context.params;
  const order = await loadOrder(id);
  if (!order) return NextResponse.json({ error: "Refining order not found" }, { status: 404 });
  const verification = order.verification as { verifiedBars?: { grossKg: number; fineness: number }[] } | null;
  const bars = verification?.verifiedBars || [];
  if (!bars.length) return NextResponse.json({ error: "Verified outturn is required before classification" }, { status: 409 });
  const fineKg = bars.reduce((sum, bar) => sum + Number(bar.grossKg) * Number(bar.fineness) / 1000, 0);
  const fineness = Math.min(...bars.map((bar) => Number(bar.fineness)));
  const accredited = order.lbma_good_delivery_status === "accredited";
  const monetary = accredited && fineness >= 995;
  const classification = monetary ? "monetary" : "non_monetary";
  const reason = !accredited ? "Refiner not GD-accredited" : fineness < 995 ? "Sub-995 fineness" : null;
  const body = await request.json();
  await sql`
    INSERT INTO refining_order_classifications (refining_order_id, classification, verified_fine_kg, output_fineness, reason, note, classified_by)
    VALUES (${order.id}, ${classification}, ${fineKg}, ${fineness}, ${reason}, ${String(body.note || "").trim()}, ${user.id})
    ON CONFLICT (refining_order_id) DO UPDATE SET classification = EXCLUDED.classification, verified_fine_kg = EXCLUDED.verified_fine_kg, output_fineness = EXCLUDED.output_fineness, reason = EXCLUDED.reason, note = EXCLUDED.note, classified_by = EXCLUDED.classified_by, classified_at = CURRENT_TIMESTAMP
  `;
  const status = monetary ? "classified_monetary" : "classified_non_monetary";
  await sql`UPDATE refining_orders SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${order.id}`;
  await sql`UPDATE refining_order_outturns SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE refining_order_id = ${order.id}`;
  return NextResponse.json({ ok: true, classification, verifiedFineKg: fineKg, outputFineness: fineness, reason });
}
