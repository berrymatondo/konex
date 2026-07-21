import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. PO
    const poRows = await sql`
      SELECT
        po.id, po.tracking_id, po.status, po.created_at, po.submitted_at,
        po.approved_at, po.sent_to_counterparty_at, po.cp_responded_at,
        po.estimated_weight_kg, po.currency, po.total_estimated_value,
        c.legal_name AS counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `;
    if (poRows.length === 0) {
      return NextResponse.json({ error: "PO not found" }, { status: 404 });
    }
    const po = poRows[0];

    // 2. Manifests (all attempts)
    let manifests: Record<string, unknown>[] = [];
    try {
      manifests = await sql`
        SELECT
          id, status, attempt_number, submitted_at, reviewed_at,
          shipment_date, carrier, waybill_number,
          total_gross_weight_kg, total_fine_oz, variance_percent,
          declarant_name, destination_vault
        FROM counterparty_manifests
        WHERE purchase_order_id = ${id}
        ORDER BY attempt_number ASC
      `;
    } catch { /* table may not exist yet */ }

    // 3. Vault reception
    let reception: Record<string, unknown> | null = null;
    try {
      const recRows = await sql`
        SELECT
          id, po_reference, tracking_id, gross_weight_kg, net_weight_kg,
          au_purity, pure_gold_weight, vault_location,
          validation_status, created_at, updated_at,
          sample_id, assay_method
        FROM vault_receptions
        WHERE selected_po_id = ${id} OR po_id = ${id}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      reception = recRows[0] ?? null;
    } catch { /* table may not exist yet */ }

    // 4. Settlement
    let settlement: Record<string, unknown> | null = null;
    try {
      const stlRows = await sql`
        SELECT
          id, settlement_reference, status, fine_gold_weight_kg,
          settlement_price_per_oz, total_amount, currency,
          payment_method, bank_reference, initiated_at,
          approved_at, completed_at, notes
        FROM settlements
        WHERE purchase_order_id = ${id}
        ORDER BY initiated_at DESC
        LIMIT 1
      `;
      settlement = stlRows[0] ?? null;
    } catch { /* table may not exist yet */ }

    // 5. Recent audit log (last 20 events for this PO)
    let auditLog: Record<string, unknown>[] = [];
    try {
      auditLog = await sql`
        SELECT action, previous_status, new_status, performed_by, performed_at, details
        FROM audit_log
        WHERE entity_id = ${id}
        ORDER BY performed_at DESC
        LIMIT 20
      `;
    } catch { /* table may not exist yet */ }

    return NextResponse.json({ po, manifests, reception, settlement, auditLog });
  } catch (error) {
    console.error("Error fetching PO trace:", error);
    return NextResponse.json({ error: "Failed to fetch trace" }, { status: 500 });
  }
}
