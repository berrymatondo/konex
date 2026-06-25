import { NextResponse } from "next/server";
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
        po.tracking_id as po_reference
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

    return NextResponse.json(result[0]);
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
    const { status, paymentReference, notes } = body;

    // Get current settlement for audit
    const current = await sql`SELECT * FROM settlements WHERE id = ${id}`;
    if (current.length === 0) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    const previousStatus = current[0].status;

    // Update settlement
    const result = await sql`
      UPDATE settlements
      SET 
        status = COALESCE(${status}, status),
        payment_reference = COALESCE(${paymentReference}, payment_reference),
        notes = COALESCE(${notes}, notes),
        paid_at = ${status === 'paid' || status === 'allocated' ? new Date().toISOString() : null}
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
      details: { paymentReference, notes },
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
