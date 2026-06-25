import { NextResponse } from "next/server";
import { sql, ensureTablesExist } from "@/lib/db";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateBatchNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ASSAY-${year}${month}${day}-${random}`;
}

export async function GET() {
  try {
    await ensureTablesExist();

    const assays = await sql`
      SELECT a.*, 
             c.legal_name as counterparty_name,
             po.tracking_id as po_tracking_id
      FROM assays a
      LEFT JOIN counterparties c ON a.counterparty_id = c.id
      LEFT JOIN purchase_orders po ON a.purchase_order_id = po.id
      ORDER BY a.created_at DESC
    `;

    return NextResponse.json(assays.map((a: Record<string, unknown>) => ({
      id: a.id,
      purchaseOrderId: a.purchase_order_id,
      poTrackingId: a.po_tracking_id,
      counterpartyId: a.counterparty_id,
      counterpartyName: a.counterparty_name,
      batchNumber: a.batch_number,
      grossWeightKg: parseFloat(a.gross_weight_kg as string) || 0,
      netWeightKg: a.net_weight_kg ? parseFloat(a.net_weight_kg as string) : null,
      purityPercentage: a.purity_percentage ? parseFloat(a.purity_percentage as string) : null,
      fineGoldWeightKg: a.fine_gold_weight_kg ? parseFloat(a.fine_gold_weight_kg as string) : null,
      assayMethod: a.assay_method,
      laboratory: a.laboratory,
      assayDate: a.assay_date,
      status: a.status,
      certificateUrl: a.certificate_url,
      notes: a.notes,
      createdAt: a.created_at,
      verifiedAt: a.verified_at,
      verifiedBy: a.verified_by,
    })));
  } catch (error) {
    console.error("Error fetching assays:", error);
    return NextResponse.json(
      { error: "Failed to fetch assays" },
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
      counterpartyId,
      grossWeightKg,
      netWeightKg,
      purityPercentage,
      assayMethod,
      laboratory,
      assayDate,
      notes,
    } = body;

    if (!counterpartyId || !grossWeightKg) {
      return NextResponse.json(
        { error: "Counterparty ID and gross weight are required" },
        { status: 400 }
      );
    }

    const assayId = generateId("assay");
    const batchNumber = generateBatchNumber();
    
    // Calculate fine gold weight if purity is provided
    const fineGoldWeightKg = purityPercentage && netWeightKg 
      ? (parseFloat(netWeightKg) * parseFloat(purityPercentage)).toFixed(3)
      : null;

    await sql`
      INSERT INTO assays (
        id, purchase_order_id, counterparty_id, batch_number,
        gross_weight_kg, net_weight_kg, purity_percentage, fine_gold_weight_kg,
        assay_method, laboratory, assay_date, notes, status
      ) VALUES (
        ${assayId},
        ${purchaseOrderId || null},
        ${counterpartyId},
        ${batchNumber},
        ${grossWeightKg},
        ${netWeightKg || null},
        ${purityPercentage || null},
        ${fineGoldWeightKg},
        ${assayMethod || null},
        ${laboratory || null},
        ${assayDate || null},
        ${notes || null},
        'pending'
      )
    `;

    return NextResponse.json({
      id: assayId,
      batchNumber,
      status: 'pending',
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating assay:", error);
    return NextResponse.json(
      { error: "Failed to create assay" },
      { status: 500 }
    );
  }
}
