import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { sql, ensureTablesExist, createAuditLog } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    const result = await sql`
      SELECT 
        s.*,
        c.legal_name as counterparty_name,
        c.country_of_incorporation as counterparty_jurisdiction,
        c.iban as counterparty_iban,
        c.swift_bic as counterparty_swift_bic,
        po.tracking_id as po_reference,
        COALESCE(s.logistics_cost, po.logistics_cost, 0) as settlement_logistics_cost,
        COALESCE(s.assay_fees, po.assay_fee, 0) as settlement_assay_fees,
        COALESCE(s.insurance_cost, 0) as settlement_insurance_cost,
        COALESCE(s.withholding_tax, 0) as settlement_withholding_tax
      FROM settlements s
      LEFT JOIN counterparties c ON s.counterparty_id = c.id
      LEFT JOIN purchase_orders po ON s.purchase_order_id = po.id
      WHERE s.id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    let settlement = result[0];
    if (!settlement.audit_hash) {
      const auditHash = createHash("sha256")
        .update(JSON.stringify({
          id: settlement.id,
          reference: settlement.settlement_reference,
          purchaseOrderId: settlement.purchase_order_id,
          fineGoldWeightKg: settlement.fine_gold_weight_kg,
          totalAmount: settlement.total_amount,
          currency: settlement.currency,
          initiatedAt: settlement.initiated_at,
        }))
        .digest("hex");

      await sql`UPDATE settlements SET audit_hash = ${auditHash} WHERE id = ${id}`;
      settlement = { ...settlement, audit_hash: auditHash };
    }

    return NextResponse.json(settlement);
  } catch (error) {
    console.error("Error fetching settlement:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlement" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;
    const body = await request.json();
    const { status, paymentReference, notes, deductions, auditHash } = body;

    // Get current settlement for audit
    const current = await sql`SELECT * FROM settlements WHERE id = ${id}`;
    if (current.length === 0) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    const previousStatus = current[0].status;
    const now = new Date().toISOString();

    // Update settlement using actual column names: bank_reference, approved_at, completed_at
    const result = await sql`
      UPDATE settlements
      SET
        status        = COALESCE(${status ?? null}, status),
        bank_reference = COALESCE(${paymentReference ?? null}, bank_reference),
        notes         = COALESCE(${notes ?? null}, notes),
        audit_hash    = COALESCE(${auditHash ?? null}, audit_hash),
        logistics_cost = COALESCE(${deductions?.logisticsCost ?? null}, logistics_cost),
        insurance_cost = COALESCE(${deductions?.insuranceCost ?? null}, insurance_cost),
        assay_fees = COALESCE(${deductions?.assayFees ?? null}, assay_fees),
        withholding_tax = COALESCE(${deductions?.withholdingTax ?? null}, withholding_tax),
        approved_at   = CASE WHEN ${status ?? null} = 'pending_approval' THEN ${now}::timestamptz ELSE approved_at END,
        completed_at  = CASE WHEN ${status ?? null} IN ('allocated','completed') THEN ${now}::timestamptz ELSE completed_at END
      WHERE id = ${id}
      RETURNING *
    `;

    // Create audit log
    await createAuditLog({
      entityType: 'settlement',
      entityId: id,
      action: `settlement_${status || 'updated'}`,
      previousStatus,
      newStatus: status || previousStatus,
      details: { bankReference: paymentReference, notes, deductions, auditHash },
      performedBy: 'finance_officer',
    });

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating settlement:", error);
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}
