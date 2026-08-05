import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTablesExist();
  await ensureRefiningOrdersTable();
  await sql`CREATE TABLE IF NOT EXISTS refining_order_classifications (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, refining_order_id TEXT NOT NULL UNIQUE REFERENCES refining_orders(id) ON DELETE CASCADE, classification TEXT NOT NULL, verified_fine_kg NUMERIC NOT NULL, output_fineness NUMERIC NOT NULL, reason TEXT, note TEXT, classified_by TEXT NOT NULL, classified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
  const rows = await sql`
    SELECT roc.id, ro.reference AS order_reference, po.tracking_id AS po_reference,
           refinery.legal_name AS refinery_name, refinery.lbma_good_delivery_status,
           roc.verified_fine_kg, roc.reason, roc.classified_at,
           (SELECT cm.manifest_reference FROM counterparty_manifests cm WHERE cm.purchase_order_id = po.id ORDER BY cm.created_at DESC LIMIT 1) AS lot_reference
    FROM refining_order_classifications roc
    JOIN refining_orders ro ON ro.id = roc.refining_order_id
    JOIN purchase_orders po ON po.id = ro.purchase_order_id
    LEFT JOIN counterparties refinery ON refinery.id = ro.refinery_id
    WHERE roc.classification = 'non_monetary'
    ORDER BY roc.classified_at DESC
  `;
  return NextResponse.json(rows.map((row, index) => ({
    reference: `NMH-${new Date(row.classified_at).getFullYear()}-${String(rows.length - index).padStart(4, "0")}`,
    order: row.order_reference,
    lot: row.lot_reference || "—",
    po: row.po_reference || "—",
    refiner: row.refinery_name || "—",
    gdStatus: row.lbma_good_delivery_status || "not_accredited",
    fineKg: Number(row.verified_fine_kg),
    reason: row.reason || "Reserve eligibility criteria not met",
    since: new Date(row.classified_at).toISOString().slice(0, 10),
    status: "held",
  })));
}
