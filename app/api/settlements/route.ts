import { NextResponse } from "next/server";
import { sql, ensureTablesExist, createAuditLog } from "@/lib/db";

function generateSettlementReference(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `STL-${year}${month}${day}-${random}`;
}

export async function GET() {
  try {
    await ensureTablesExist();

    const settlements = await sql`
      SELECT s.*, 
             c.legal_name as counterparty_name,
             po.tracking_id as po_tracking_id,
             a.batch_number as assay_batch_number
      FROM settlements s
      LEFT JOIN counterparties c ON s.counterparty_id = c.id
      LEFT JOIN purchase_orders po ON s.purchase_order_id = po.id
      LEFT JOIN assays a ON s.assay_id = a.id
      ORDER BY s.initiated_at DESC
    `;

    return NextResponse.json(
      settlements.map((s: Record<string, unknown>) => ({
        id: s.id,
        purchaseOrderId: s.purchase_order_id,
        assayId: s.assay_id,
        counterpartyId: s.counterparty_id,
        counterpartyName: s.counterparty_name,
        poTrackingId: s.po_tracking_id,
        assayBatchNumber: s.assay_batch_number,
        settlementReference: s.settlement_reference,
        fineGoldWeightKg: parseFloat(s.fine_gold_weight_kg as string) || 0,
        settlementPricePerOz: parseFloat(s.settlement_price_per_oz as string) || 0,
        totalAmount: parseFloat(s.total_amount as string) || 0,
        currency: s.currency,
        paymentMethod: s.payment_method,
        bankReference: s.bank_reference,
        status: s.status,
        initiatedAt: s.initiated_at,
        approvedAt: s.approved_at,
        approvedBy: s.approved_by,
        completedAt: s.completed_at,
        notes: s.notes,
      }))
    );
  } catch (error) {
    console.error("Error fetching settlements:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();

    const body = await request.json();
    const {
      purchaseOrderId,
      assayId,
      counterpartyId,
      fineGoldWeightKg,
      settlementPricePerOz,
      currency = "USD",
      paymentMethod,
      notes,
    } = body;

    // If counterpartyId is not provided but purchaseOrderId is, get it from the PO
    let finalCounterpartyId = counterpartyId;
    if (!finalCounterpartyId && purchaseOrderId) {
      const poResult = await sql`
        SELECT counterparty_id FROM purchase_orders WHERE id = ${purchaseOrderId}
      `;
      if (poResult.length > 0) {
        finalCounterpartyId = poResult[0].counterparty_id;
      }
    }

    if (!fineGoldWeightKg || !settlementPricePerOz) {
      return NextResponse.json(
        { error: "Weight and price are required" },
        { status: 400 }
      );
    }

    const settlementReference = generateSettlementReference();
    
    // Calculate total: weight in kg * 32.1507 oz/kg * price per oz
    const totalAmount = fineGoldWeightKg * 32.1507 * settlementPricePerOz;

    const result = await sql`
      INSERT INTO settlements (
        purchase_order_id, assay_id, counterparty_id, settlement_reference,
        fine_gold_weight_kg, settlement_price_per_oz, total_amount, currency,
        payment_method, notes, status
      ) VALUES (
        ${purchaseOrderId || null}, ${assayId || null}, ${finalCounterpartyId || null},
        ${settlementReference}, ${fineGoldWeightKg}, ${settlementPricePerOz},
        ${totalAmount}, ${currency}, ${paymentMethod || null}, ${notes || null},
        'pending'
      )
      RETURNING *
    `;

    // Create audit log entry
    await createAuditLog({
      entityType: 'settlement',
      entityId: result[0].id,
      action: 'settlement_created',
      newStatus: 'pending',
      details: {
        settlementReference,
        purchaseOrderId,
        fineGoldWeightKg,
        totalAmount,
        currency,
      },
      performedBy: 'vault_operator',
    });

    // Also log audit for PO if linked
    if (purchaseOrderId) {
      await createAuditLog({
        entityType: 'purchase_order',
        entityId: purchaseOrderId,
        action: 'settlement_initiated',
        previousStatus: 'delivered',
        newStatus: 'pending_settlement',
        details: {
          settlementId: result[0].id,
          settlementReference,
        },
        performedBy: 'vault_operator',
      });
    }

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating settlement:", error);
    return NextResponse.json(
      { error: "Failed to create settlement" },
      { status: 500 }
    );
  }
}
