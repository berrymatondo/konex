import { NextResponse } from "next/server";
import { sql, ensureTablesExist, createAuditLog } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    const assays = await sql`
      SELECT a.*, 
             c.legal_name as counterparty_name,
             c.country_of_incorporation as counterparty_country,
             c.status as counterparty_status,
             po.tracking_id as po_tracking_id,
             po.status as po_status
      FROM assays a
      LEFT JOIN counterparties c ON a.counterparty_id = c.id
      LEFT JOIN purchase_orders po ON a.purchase_order_id = po.id
      WHERE a.id = ${id}
    `;

    if (assays.length === 0) {
      return NextResponse.json({ error: "Assay not found" }, { status: 404 });
    }

    const a = assays[0];
    return NextResponse.json({
      id: a.id,
      purchaseOrderId: a.purchase_order_id,
      poTrackingId: a.po_tracking_id,
      poStatus: a.po_status,
      counterpartyId: a.counterparty_id,
      counterpartyName: a.counterparty_name,
      counterpartyCountry: a.counterparty_country,
      counterpartyStatus: a.counterparty_status,
      batchNumber: a.batch_number,
      grossWeightKg: parseFloat(a.gross_weight_kg) || 0,
      netWeightKg: a.net_weight_kg ? parseFloat(a.net_weight_kg) : null,
      purityPercentage: a.purity_percentage ? parseFloat(a.purity_percentage) : null,
      fineGoldWeightKg: a.fine_gold_weight_kg ? parseFloat(a.fine_gold_weight_kg) : null,
      assayMethod: a.assay_method,
      laboratory: a.laboratory,
      assayDate: a.assay_date,
      status: a.status,
      certificateUrl: a.certificate_url,
      notes: a.notes,
      createdAt: a.created_at,
      verifiedAt: a.verified_at,
      verifiedBy: a.verified_by,
    });
  } catch (error) {
    console.error("Error fetching assay:", error);
    return NextResponse.json(
      { error: "Failed to fetch assay" },
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

    const {
      netWeightKg,
      purityPercentage,
      assayMethod,
      laboratory,
      assayDate,
      notes,
      status,
      certificateUrl,
      verifiedBy,
    } = body;

    // Get current status for audit log
    const currentAssay = await sql`SELECT status, batch_number FROM assays WHERE id = ${id}`;
    const previousStatus = currentAssay[0]?.status;
    const batchNumber = currentAssay[0]?.batch_number;

    // Calculate fine gold weight if purity and net weight are provided
    let fineGoldWeightKg = null;
    if (purityPercentage !== undefined && netWeightKg !== undefined) {
      fineGoldWeightKg = (parseFloat(netWeightKg) * parseFloat(purityPercentage)).toFixed(3);
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: Record<string, unknown> = {};

    if (netWeightKg !== undefined) {
      updates.push("net_weight_kg = ${netWeightKg}");
      values.netWeightKg = netWeightKg;
    }
    if (purityPercentage !== undefined) {
      updates.push("purity_percentage = ${purityPercentage}");
      values.purityPercentage = purityPercentage;
    }
    if (fineGoldWeightKg !== null) {
      updates.push("fine_gold_weight_kg = ${fineGoldWeightKg}");
      values.fineGoldWeightKg = fineGoldWeightKg;
    }
    if (assayMethod !== undefined) {
      updates.push("assay_method = ${assayMethod}");
      values.assayMethod = assayMethod;
    }
    if (laboratory !== undefined) {
      updates.push("laboratory = ${laboratory}");
      values.laboratory = laboratory;
    }
    if (assayDate !== undefined) {
      updates.push("assay_date = ${assayDate}");
      values.assayDate = assayDate;
    }
    if (notes !== undefined) {
      updates.push("notes = ${notes}");
      values.notes = notes;
    }
    if (certificateUrl !== undefined) {
      updates.push("certificate_url = ${certificateUrl}");
      values.certificateUrl = certificateUrl;
    }
    if (status !== undefined) {
      updates.push("status = ${status}");
      values.status = status;
      
      if (status === "verified") {
        updates.push("verified_at = CURRENT_TIMESTAMP");
        if (verifiedBy) {
          updates.push("verified_by = ${verifiedBy}");
          values.verifiedBy = verifiedBy;
        }
      }
    }

    // Execute update with specific fields
    await sql`
      UPDATE assays SET
        net_weight_kg = COALESCE(${netWeightKg ?? null}, net_weight_kg),
        purity_percentage = COALESCE(${purityPercentage ?? null}, purity_percentage),
        fine_gold_weight_kg = COALESCE(${fineGoldWeightKg}, fine_gold_weight_kg),
        assay_method = COALESCE(${assayMethod ?? null}, assay_method),
        laboratory = COALESCE(${laboratory ?? null}, laboratory),
        assay_date = COALESCE(${assayDate ?? null}, assay_date),
        notes = COALESCE(${notes ?? null}, notes),
        certificate_url = COALESCE(${certificateUrl ?? null}, certificate_url),
        status = COALESCE(${status ?? null}, status),
        verified_at = CASE WHEN ${status} = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END,
        verified_by = CASE WHEN ${status} = 'verified' THEN ${verifiedBy ?? 'system'} ELSE verified_by END
      WHERE id = ${id}
    `;

    // Create audit log
    if (status && status !== previousStatus) {
      await createAuditLog({
        entityType: "assay",
        entityId: id,
        action: `assay_${status}`,
        previousStatus,
        newStatus: status,
        details: {
          batchNumber,
          purityPercentage,
          fineGoldWeightKg,
          laboratory,
        },
        performedBy: verifiedBy || "system",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating assay:", error);
    return NextResponse.json(
      { error: "Failed to update assay" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    await sql`DELETE FROM assays WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assay:", error);
    return NextResponse.json(
      { error: "Failed to delete assay" },
      { status: 500 }
    );
  }
}
