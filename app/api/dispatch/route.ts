import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Fetch purchase orders that are approved, dispatched, or in_transit
    const result = await sql`
      SELECT 
        po.id,
        po.tracking_id,
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
      WHERE po.status IN ('approved', 'dispatched', 'in_transit')
      ORDER BY po.created_at DESC
    `;

    const dispatches = result.map((po: Record<string, unknown>) => ({
      id: po.id,
      poId: po.tracking_id || `PO-${String(po.id).slice(0, 8).toUpperCase()}`,
      counterpartyName: po.counterparty_name || "Unknown",
      status: mapPOStatusToDispatchStatus(po.status as string),
      estimatedWeight: parseFloat(String(po.estimated_weight_kg || 0)),
      poValue: parseFloat(String(po.total_estimated_value || 0)),
      currency: po.currency || "USD",
      originCountry: po.origin_country || "Unknown",
      destinationVault: po.delivery_vault_id || "Default Vault",
      carrier: po.status === "in_transit" ? "Brinks Global Logistics" : null,
      trackingId: po.tracking_id || null,
      createdAt: po.created_at,
      approvedAt: po.approved_at,
    }));

    return NextResponse.json(dispatches);
  } catch (error) {
    console.error("Error fetching dispatches:", error);
    return NextResponse.json({ error: "Failed to fetch dispatches" }, { status: 500 });
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poId, counterpartyId, counterpartyName, estimatedWeight, poValue, originCountry, destinationVault } = body;

    // Create new dispatch validation record
    const newDispatch = {
      id: `disp_${Date.now()}`,
      poId,
      counterpartyId,
      counterpartyName,
      status: "pending_docs",
      estimatedWeight,
      poValue,
      originCountry,
      destinationVault,
      documents: {
        export_license: { uploaded: false, valid: null },
        certificate_origin: { uploaded: false, valid: null },
        transport_docs: { uploaded: false, valid: null },
        insurance: { uploaded: false, valid: null },
      },
      manifest: null,
      carrier: null,
      pickupDate: null,
      trackingId: null,
      dispatchId: null,
      approvals: [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(newDispatch, { status: 201 });
  } catch (error) {
    console.error("Error creating dispatch:", error);
    return NextResponse.json({ error: "Failed to create dispatch" }, { status: 500 });
  }
}
