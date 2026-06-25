import { NextResponse } from "next/server";
import { sql, createAuditLog } from "@/lib/db";

// Ensure the vault receptions table exists (created against the app's own database)
async function ensureReceptionTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS vault_receptions (
      id text PRIMARY KEY,
      po_id text,
      po_reference text,
      tracking_id text,
      counterparty_name text,
      seal1 text,
      seal2 text,
      manifest_match boolean DEFAULT false,
      gross_weight_kg numeric,
      net_weight_kg numeric,
      weight_variance numeric,
      vault_location text,
      operator_id text,
      otp_code text,
      photo_evidence jsonb DEFAULT '[]'::jsonb,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `;
  // Add columns for tables created before these fields existed
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS otp_code text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS photo_evidence jsonb DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS selected_po_id text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS sample_id text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS lab_id text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS assay_method text`;
  // Assay results (screen 3)
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS au_purity numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS ag_purity numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS cu_purity numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS fe_purity numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS pure_gold_weight numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS po_estimate numeric`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS validation_status text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS certificate_pathname text`;
  await sql`ALTER TABLE vault_receptions ADD COLUMN IF NOT EXISTS certificate_file_name text`;
}

export async function GET() {
  try {
    // Fetch purchase orders that are in_transit or delivered (ready for vault intake)
    const result = await sql`
      SELECT 
        po.id,
        po.tracking_id,
        po.status,
        po.estimated_weight_kg,
        po.total_estimated_value,
        po.currency,
        po.delivery_vault_id,
        po.created_at,
        c.legal_name as counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.status IN ('in_transit', 'delivered')
      ORDER BY po.created_at DESC
    `;

    const intakes = result.map((po: Record<string, unknown>) => ({
      id: po.id,
      poReference: po.tracking_id || `PO-${String(po.id).slice(0, 8).toUpperCase()}`,
      trackingId: po.tracking_id || `TRK-${String(po.id).slice(0, 6)}`,
      counterpartyName: po.counterparty_name || "Unknown",
      grossWeightKg: parseFloat(String(po.estimated_weight_kg || 0)),
      netWeightKg: null,
      weightVariance: null,
      status: po.status === "in_transit" ? "pending_reception" : "received",
      sealVerified: false,
      manifestMatch: false,
      receivedAt: po.created_at,
      operatorId: null,
      vaultLocation: po.delivery_vault_id || "Default Vault",
      poValue: parseFloat(String(po.total_estimated_value || 0)),
      currency: po.currency || "USD",
    }));

    return NextResponse.json(intakes);
  } catch (error) {
    console.error("Error fetching vault intakes:", error);
    return NextResponse.json({ error: "Failed to fetch vault intakes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const weightVariance =
      body.netWeightKg && body.grossWeightKg
        ? ((Number(body.netWeightKg) - Number(body.grossWeightKg)) / Number(body.grossWeightKg)) * 100
        : null;

    const receptionId = `vlt_${Date.now()}`;
    // The shipped PO actually chosen in the dropdown (falls back to the route PO)
    const selectedPoId = body.selectedPoId ?? body.poId ?? null;

    // Persist the reception record in its own table (keyed by PO so re-saves update)
    await ensureReceptionTable();
    await sql`
      INSERT INTO vault_receptions (
        id, po_id, selected_po_id, po_reference, tracking_id, counterparty_name,
        seal1, seal2, manifest_match, gross_weight_kg, net_weight_kg,
        weight_variance, vault_location, operator_id, otp_code, photo_evidence,
        sample_id, lab_id, assay_method,
        au_purity, ag_purity, cu_purity, fe_purity, pure_gold_weight, po_estimate,
        validation_status, certificate_pathname, certificate_file_name, updated_at
      ) VALUES (
        ${receptionId}, ${body.poId ?? null}, ${selectedPoId}, ${body.poReference ?? null},
        ${body.trackingId ?? null}, ${body.counterpartyName ?? null},
        ${body.seal1 ?? null}, ${body.seal2 ?? null}, ${body.manifestMatch ?? false},
        ${body.grossWeightKg ?? null}, ${body.netWeightKg ?? null}, ${weightVariance},
        ${body.vaultLocation ?? null}, ${body.operatorId ?? "vault_operator"},
        ${body.otpCode ?? null}, ${JSON.stringify(body.photoEvidence ?? [])}::jsonb,
        ${body.sampleId ?? null}, ${body.labId ?? null}, ${body.assayMethod ?? null},
        ${body.auPurity ?? null}, ${body.agPurity ?? null}, ${body.cuPurity ?? null},
        ${body.fePurity ?? null}, ${body.pureGoldWeight ?? null}, ${body.poEstimate ?? null},
        ${body.validationStatus ?? null}, ${body.certificatePathname ?? null},
        ${body.certificateFileName ?? null}, now()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // Update the selected shipped purchase order status to "delivered" when received at vault
    if (selectedPoId) {
      await sql`
        UPDATE purchase_orders 
        SET status = 'delivered'
        WHERE id = ${selectedPoId}
      `;

      // Create audit log entry
      await createAuditLog({
        entityType: 'purchase_order',
        entityId: selectedPoId,
        action: 'vault_received',
        previousStatus: 'in_transit',
        newStatus: 'delivered',
        details: {
          grossWeightKg: body.grossWeightKg,
          netWeightKg: body.netWeightKg,
          sealVerified: body.sealVerified,
          manifestMatch: body.manifestMatch,
          vaultLocation: body.vaultLocation,
        },
        performedBy: body.operatorId || 'vault_operator',
      });
    }
    
    const newIntake = {
      id: receptionId,
      poReference: body.poReference,
      trackingId: body.trackingId,
      counterpartyName: body.counterpartyName || "Unknown",
      grossWeightKg: body.grossWeightKg,
      netWeightKg: body.netWeightKg,
      weightVariance,
      status: "received",
      sealVerified: body.sealVerified || false,
      manifestMatch: body.manifestMatch || false,
      receivedAt: new Date().toISOString(),
      operatorId: body.operatorId || "System",
      vaultLocation: body.vaultLocation || "LON-VLT-RB",
    };

    return NextResponse.json(newIntake, { status: 201 });
  } catch (error) {
    console.error("Error creating vault intake:", error);
    return NextResponse.json(
      { error: "Failed to create vault intake" },
      { status: 500 }
    );
  }
}
