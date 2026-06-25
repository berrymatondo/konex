import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Ensure the manifest table exists (created against the app's own database)
async function ensureManifestTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dispatch_manifests (
      dispatch_id text PRIMARY KEY,
      net_weight_kg numeric,
      seal1 text,
      seal2 text,
      customs_origin_cleared boolean DEFAULT false,
      customs_dest_cleared boolean DEFAULT false,
      carrier text,
      pickup_date date,
      status text,
      approver1_signed boolean DEFAULT false,
      approver2_verified boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `;
  // Add approval columns for tables created before these fields existed
  await sql`ALTER TABLE dispatch_manifests ADD COLUMN IF NOT EXISTS approver1_signed boolean DEFAULT false`;
  await sql`ALTER TABLE dispatch_manifests ADD COLUMN IF NOT EXISTS approver2_verified boolean DEFAULT false`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Fetch purchase order with counterparty info
    const result = await sql`
      SELECT 
        po.id,
        po.tracking_id,
        po.counterparty_id,
        po.status,
        po.estimated_weight_kg,
        po.total_estimated_value,
        po.currency,
        po.incoterms,
        po.delivery_vault_id,
        po.approved_at,
        po.created_at,
        c.legal_name as counterparty_name,
        c.country_of_incorporation as origin_country
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
    }

    const po = result[0];

    // Fetch saved manifest/authorization data if it exists
    await ensureManifestTable();
    const manifestResult = await sql`
      SELECT 
        net_weight_kg,
        seal1,
        seal2,
        customs_origin_cleared,
        customs_dest_cleared,
        carrier,
        pickup_date,
        status,
        approver1_signed,
        approver2_verified
      FROM dispatch_manifests
      WHERE dispatch_id = ${id}
    `;

    const savedManifest = manifestResult.length > 0 ? manifestResult[0] : null;

    // Map PO to dispatch format
    const dispatch = {
      id: po.id,
      poId: po.tracking_id || `PO-${String(po.id).slice(0, 8).toUpperCase()}`,
      counterpartyId: po.counterparty_id,
      counterpartyName: po.counterparty_name || "Unknown",
      status: savedManifest?.status
        ? mapManifestStatusToDispatchStatus(savedManifest.status as string)
        : mapPOStatusToDispatchStatus(po.status as string),
      estimatedWeight: parseFloat(String(po.estimated_weight_kg || 0)),
      poValue: parseFloat(String(po.total_estimated_value || 0)),
      currency: po.currency || "USD",
      originCountry: po.origin_country || "Unknown",
      destinationVault: po.delivery_vault_id || "Swiss National Bank - Bern",
      documents: {
        export_license: { uploaded: false, valid: null },
        certificate_origin: { uploaded: false, valid: null },
        transport_docs: { uploaded: false, valid: null },
        insurance: { uploaded: false, valid: null },
      },
      manifest: savedManifest
        ? {
            netWeight: parseFloat(String(savedManifest.net_weight_kg || 0)),
            seal1: savedManifest.seal1 || "",
            seal2: savedManifest.seal2 || "",
            customsOriginCleared: savedManifest.customs_origin_cleared || false,
            customsDestCleared: savedManifest.customs_dest_cleared || false,
          }
        : null,
      carrier: savedManifest?.carrier || null,
      pickupDate: savedManifest?.pickup_date
        ? new Date(savedManifest.pickup_date as string).toISOString().split("T")[0]
        : null,
      approver1Signed: savedManifest?.approver1_signed || false,
      approver2Verified: savedManifest?.approver2_verified || false,
      trackingId: po.tracking_id || null,
      dispatchId: null,
      approvals: [],
    };

    return NextResponse.json(dispatch);
  } catch (error) {
    console.error("Error fetching dispatch:", error);
    return NextResponse.json({ error: "Failed to fetch dispatch" }, { status: 500 });
  }
}

function mapPOStatusToDispatchStatus(poStatus: string): string {
  switch (poStatus) {
    case "approved":
      return "pending_docs";
    case "dispatched":
      return "dispatched";
    case "in_transit":
      return "in_transit";
    default:
      return "pending_docs";
  }
}

function mapManifestStatusToDispatchStatus(manifestStatus: string): string {
  switch (manifestStatus) {
    case "pending_authorization":
      return "pending_authorization";
    case "dispatched":
      return "dispatched";
    case "in_transit":
      return "in_transit";
    default:
      return "pending_docs";
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const { manifest, status, carrier, pickupDate, approver1Signed, approver2Verified } = body;

    // Persist manifest and authorization fields when provided
    if (
      manifest ||
      status ||
      carrier ||
      pickupDate ||
      approver1Signed !== undefined ||
      approver2Verified !== undefined
    ) {
      await ensureManifestTable();
      await sql`
        INSERT INTO dispatch_manifests (
          dispatch_id,
          net_weight_kg,
          seal1,
          seal2,
          customs_origin_cleared,
          customs_dest_cleared,
          carrier,
          pickup_date,
          status,
          approver1_signed,
          approver2_verified,
          updated_at
        ) VALUES (
          ${id},
          ${manifest?.netWeight ?? null},
          ${manifest?.seal1 ?? null},
          ${manifest?.seal2 ?? null},
          ${manifest?.customsOriginCleared ?? false},
          ${manifest?.customsDestCleared ?? false},
          ${carrier ?? null},
          ${pickupDate ?? null},
          ${status ?? null},
          ${approver1Signed ?? false},
          ${approver2Verified ?? false},
          now()
        )
        ON CONFLICT (dispatch_id) DO UPDATE SET
          net_weight_kg = COALESCE(${manifest?.netWeight ?? null}, dispatch_manifests.net_weight_kg),
          seal1 = COALESCE(${manifest?.seal1 ?? null}, dispatch_manifests.seal1),
          seal2 = COALESCE(${manifest?.seal2 ?? null}, dispatch_manifests.seal2),
          customs_origin_cleared = COALESCE(${manifest?.customsOriginCleared ?? null}, dispatch_manifests.customs_origin_cleared),
          customs_dest_cleared = COALESCE(${manifest?.customsDestCleared ?? null}, dispatch_manifests.customs_dest_cleared),
          carrier = COALESCE(${carrier ?? null}, dispatch_manifests.carrier),
          pickup_date = COALESCE(${pickupDate ?? null}, dispatch_manifests.pickup_date),
          status = COALESCE(${status ?? null}, dispatch_manifests.status),
          approver1_signed = COALESCE(${approver1Signed ?? null}, dispatch_manifests.approver1_signed),
          approver2_verified = COALESCE(${approver2Verified ?? null}, dispatch_manifests.approver2_verified),
          updated_at = now()
      `;
    }

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    console.error("Error updating dispatch:", error);
    return NextResponse.json({ error: "Failed to update dispatch" }, { status: 500 });
  }
}
