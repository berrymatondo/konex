import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await sql`
      SELECT 
        po.id,
        po.tracking_id,
        po.status,
        po.estimated_weight_kg,
        po.total_estimated_value,
        po.currency,
        po.delivery_vault_id,
        po.counterparty_id,
        po.created_at,
        c.legal_name as counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const po = result[0];

    // Also load the most recent saved reception record for this PO (if any),
    // so the page can re-hydrate seals, net weight, OTP and photo evidence.
    let reception: Record<string, unknown> | null = null;
    try {
      const receptionRows = await sql`
        SELECT seal1, seal2, manifest_match, gross_weight_kg, net_weight_kg,
               weight_variance, otp_code, photo_evidence, operator_id, vault_location,
               selected_po_id, po_reference, sample_id, lab_id, assay_method,
               au_purity, ag_purity, cu_purity, fe_purity, pure_gold_weight, po_estimate,
               validation_status, certificate_pathname, certificate_file_name, updated_at
        FROM vault_receptions
        WHERE po_id = ${id}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      reception = receptionRows[0] ?? null;
    } catch {
      // Table may not exist yet on a fresh database — ignore and return PO data only.
      reception = null;
    }

    return NextResponse.json({
      id: po.id,
      poReference: po.tracking_id || `PO-${String(po.id).slice(0, 8).toUpperCase()}`,
      trackingId: po.tracking_id || `TRK-${String(po.id).slice(0, 6)}`,
      counterpartyId: po.counterparty_id,
      counterpartyName: po.counterparty_name || "Unknown",
      grossWeightKg: parseFloat(String(po.estimated_weight_kg || 0)),
      status: po.status,
      poValue: parseFloat(String(po.total_estimated_value || 0)),
      currency: po.currency || "USD",
      vaultLocation: po.delivery_vault_id || "Default Vault",
      // Saved reception fields (null when no reception has been recorded yet)
      reception: reception
        ? {
            seal1: reception.seal1 ?? null,
            seal2: reception.seal2 ?? null,
            manifestMatch: reception.manifest_match ?? null,
            grossWeightKg: reception.gross_weight_kg != null ? parseFloat(String(reception.gross_weight_kg)) : null,
            netWeightKg: reception.net_weight_kg != null ? parseFloat(String(reception.net_weight_kg)) : null,
            otpCode: reception.otp_code ?? null,
            photoEvidence: reception.photo_evidence ?? [],
            operatorId: reception.operator_id ?? null,
            vaultLocation: reception.vault_location ?? null,
            selectedPoId: reception.selected_po_id ?? null,
            poReference: reception.po_reference ?? null,
            sampleId: reception.sample_id ?? null,
            labId: reception.lab_id ?? null,
            assayMethod: reception.assay_method ?? null,
            auPurity: reception.au_purity != null ? parseFloat(String(reception.au_purity)) : null,
            agPurity: reception.ag_purity != null ? parseFloat(String(reception.ag_purity)) : null,
            cuPurity: reception.cu_purity != null ? parseFloat(String(reception.cu_purity)) : null,
            fePurity: reception.fe_purity != null ? parseFloat(String(reception.fe_purity)) : null,
            pureGoldWeight: reception.pure_gold_weight != null ? parseFloat(String(reception.pure_gold_weight)) : null,
            poEstimate: reception.po_estimate != null ? parseFloat(String(reception.po_estimate)) : null,
            validationStatus: reception.validation_status ?? null,
            certificatePathname: reception.certificate_pathname ?? null,
            certificateFileName: reception.certificate_file_name ?? null,
            updatedAt: reception.updated_at ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching vault intake detail:", error);
    return NextResponse.json({ error: "Failed to fetch intake" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status) {
      await sql`
        UPDATE purchase_orders 
        SET status = ${status}
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating vault intake:", error);
    return NextResponse.json({ error: "Failed to update intake" }, { status: 500 });
  }
}
