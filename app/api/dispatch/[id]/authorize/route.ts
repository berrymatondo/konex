import { NextResponse } from "next/server";
import { sql, createAuditLog } from "@/lib/db";
import crypto from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { carrier, pickupDate, approvals } = body;

  try {
    // Generate dispatch ID and tracking ID
    const year = new Date().getFullYear();
    const dispatchId = `DISP-${year}-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;
    const trackingId = `TRK-${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;

    // Generate authorization hash (SHA-256)
    const authPayload = JSON.stringify({
      dispatchId,
      carrier,
      pickupDate,
      approvals,
      timestamp: new Date().toISOString(),
    });
    const authorizationHash = crypto.createHash("sha256").update(authPayload).digest("hex");

    // Update purchase order status to "dispatched" and set tracking_id
    await sql`
      UPDATE purchase_orders 
      SET 
        status = 'dispatched',
        tracking_id = ${trackingId}
      WHERE id = ${id}
    `;

    // Persist carrier, pickup date and final status on the manifest record
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
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `;
    await sql`
      INSERT INTO dispatch_manifests (dispatch_id, carrier, pickup_date, status, updated_at)
      VALUES (${id}, ${carrier ?? null}, ${pickupDate ?? null}, 'dispatched', now())
      ON CONFLICT (dispatch_id) DO UPDATE SET
        carrier = COALESCE(${carrier ?? null}, dispatch_manifests.carrier),
        pickup_date = COALESCE(${pickupDate ?? null}, dispatch_manifests.pickup_date),
        status = 'dispatched',
        updated_at = now()
    `;

    // Create audit log entry
    await createAuditLog({
      entityType: 'purchase_order',
      entityId: id,
      action: 'dispatch_authorized',
      previousStatus: 'approved',
      newStatus: 'dispatched',
      details: {
        dispatchId,
        trackingId,
        carrier,
        pickupDate,
        authorizationHash: authorizationHash.substring(0, 16),
      },
      performedBy: 'compliance_officer',
    });

    // Log audit entry
    console.log(`[US-04] Dispatch authorized: ${dispatchId}, PO: ${id}, Tracking: ${trackingId}, Hash: ${authorizationHash.substring(0, 16)}...`);

    const result = {
      dispatchId,
      trackingId,
      status: "dispatched",
      carrier,
      pickupDate,
      approvals: approvals.map((a: { approver: string; method: string }) => ({
        ...a,
        timestamp: new Date().toISOString(),
      })),
      authorizationHash,
      authorizedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error authorizing dispatch:", error);
    return NextResponse.json({ error: "Failed to authorize dispatch" }, { status: 500 });
  }
}
