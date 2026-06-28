import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql, ensureTablesExist, ensurePurchaseOrderTermsColumns, PurchaseOrder } from "@/lib/db";
import { getSessionUser, getCounterpartyScope } from "@/lib/session-user";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function generateTrackingId(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `PO-${year}${month}-${random}`;
}

export async function GET() {
  try {
    await ensureTablesExist();

    // Backfill: promote POs whose manifest was already validated by the BCC
    // to the distinct 'manifest_validated' status. Wrapped in DO so it silently
    // skips when the manifest table doesn't exist yet (fresh installs).
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'counterparty_manifests'
        ) THEN
          UPDATE purchase_orders po
          SET status = 'manifest_validated'
          WHERE po.status = 'accepted'
            AND EXISTS (
              SELECT 1 FROM counterparty_manifests cm
              WHERE cm.purchase_order_id = po.id AND cm.status = 'accepted'
            );
        END IF;
      END $$
    `;

    // Counterparty-profile users only see purchase orders for their counterparty.
    const scope = getCounterpartyScope(await getSessionUser());
    if (scope === null) {
      return NextResponse.json([]);
    }

    // Counterparties only see POs that have been approved (or further).
    // Statuses below 'approved' (draft, submitted) are internal BCC workflow.
    // Counterparty sees POs from "approved" onwards — never draft/submitted (internal BCC states).
    const COUNTERPARTY_VISIBLE_STATUSES = [
      'approved', 'sent_to_counterparty', 'accepted', 'manifest_validated',
      'in_transit', 'delivered', 'negotiating', 'pending_settlement',
      'declined', 'cancelled',
    ];

    const purchaseOrders = (scope === undefined
      ? await sql`
          SELECT po.*, c.legal_name as counterparty_name, c.risk_level as counterparty_risk_level
          FROM purchase_orders po
          LEFT JOIN counterparties c ON po.counterparty_id = c.id
          ORDER BY po.created_at DESC
        `
      : await sql`
          SELECT po.*, c.legal_name as counterparty_name, c.risk_level as counterparty_risk_level
          FROM purchase_orders po
          LEFT JOIN counterparties c ON po.counterparty_id = c.id
          WHERE po.counterparty_id = ${scope}
            AND po.status = ANY(${COUNTERPARTY_VISIBLE_STATUSES})
          ORDER BY po.created_at DESC
        `) as (PurchaseOrder & { counterparty_name: string; counterparty_risk_level: string | null })[];

    // Get approvals for each PO
    const result = await Promise.all(
      purchaseOrders.map(async (po) => {
        const approvals = await sql`
          SELECT * FROM po_approvals WHERE purchase_order_id = ${po.id}
        `;
        
        return {
          id: po.id,
          counterpartyId: po.counterparty_id,
          counterpartyName: po.counterparty_name,
          counterpartyRiskLevel: po.counterparty_risk_level,
          status: po.status,
          estimatedWeightKg: po.estimated_weight_kg,
          goldType: po.gold_type,
          assayRange: po.assay_range,
          incoterms: po.incoterms,
          deliveryVaultId: po.delivery_vault_id,
          expectedDispatchDate: po.expected_dispatch_date,
          notes: po.notes,
          lbmaPricePerOz: po.lbma_price_per_oz,
          purityFactor: po.purity_factor,
          premiumDiscount: po.premium_discount,
          logisticsCost: po.logistics_cost,
          totalEstimatedValue: po.total_estimated_value,
          currency: po.currency,
          priceLockExpiry: po.price_lock_expiry,
          trackingId: po.tracking_id,
          createdBy: po.created_by,
          createdAt: po.created_at,
          submittedAt: po.submitted_at,
          approvedAt: po.approved_at,
          approvals: approvals.map((a: Record<string, unknown>) => ({
            id: a.id,
            approverRole: a.approver_role,
            approverName: a.approver_name,
            decision: a.decision,
            comments: a.comments,
            decidedAt: a.decided_at,
          })),
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    await ensurePurchaseOrderTermsColumns();
    
    const body = await request.json();
    const {
      counterpartyId,
      estimatedWeightKg,
      goldType,
      assayRange,
      incoterms,
      deliveryVaultId,
      expectedDispatchDate,
      notes,
      lbmaPricePerOz,
      purityFactor,
      premiumDiscount,
      logisticsCost,
      totalEstimatedValue,
      currency,
      priceLockExpiry,
      status,
      // Tolerance, delivery window end and desired payment terms
      tolerancePercent,
      deliveryWindowEnd,
      paymentUsdCdfSplit,
      paymentTiming,
      paymentTerm,
      prepaymentPercent,
      cdfFxBasis,
    } = body;

    // Validate required fields - for drafts, only counterpartyId is required
    if (!counterpartyId) {
      return NextResponse.json(
        { error: "Missing counterparty" },
        { status: 400 }
      );
    }
    
    // For submitted orders, validate all required fields
    if (status === "submitted") {
      const missingFields: string[] = [];
      if (!estimatedWeightKg || estimatedWeightKg <= 0) missingFields.push("Estimated Weight");
      if (!goldType) missingFields.push("Gold Type");
      if (!incoterms) missingFields.push("Incoterms");
      if (!deliveryVaultId) missingFields.push("Delivery Vault");
      if (!expectedDispatchDate) missingFields.push("Desired Delivery Window Start");
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required fields: ${missingFields.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const poId = generateId("po");
    // Always generate a unique tracking_id — even for drafts — so display fallbacks are never needed.
    // Retry up to 3 times on the rare event of a collision (8 hex chars = 4B unique values).
    let trackingId = generateTrackingId();
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await sql`SELECT 1 FROM purchase_orders WHERE tracking_id = ${trackingId} LIMIT 1`;
      if (existing.length === 0) break;
      trackingId = generateTrackingId();
    }

    await sql`
      INSERT INTO purchase_orders (
        id, counterparty_id, status, estimated_weight_kg, gold_type, assay_range,
        incoterms, delivery_vault_id, expected_dispatch_date, notes,
        lbma_price_per_oz, purity_factor, premium_discount, logistics_cost,
        total_estimated_value, currency, price_lock_expiry, tracking_id,
        created_by, submitted_at,
        tolerance_percent, delivery_window_end, payment_usd_cdf_split,
        payment_timing, payment_term, prepayment_percent, cdf_fx_basis
      ) VALUES (
        ${poId}, ${counterpartyId}, ${status || 'draft'}, ${estimatedWeightKg}, ${goldType}, ${assayRange || null},
        ${incoterms}, ${deliveryVaultId}, ${expectedDispatchDate || null}, ${notes || null},
        ${lbmaPricePerOz || null}, ${purityFactor || null}, ${premiumDiscount || 0}, ${logisticsCost || 0},
        ${totalEstimatedValue || null}, ${currency || 'USD'}, ${priceLockExpiry || null}, ${trackingId},
        ${'compliance_officer'}, ${status === 'submitted' ? new Date().toISOString() : null},
        ${tolerancePercent ?? null}, ${deliveryWindowEnd || null}, ${paymentUsdCdfSplit || null},
        ${paymentTiming || null}, ${paymentTerm || null}, ${prepaymentPercent ?? null}, ${cdfFxBasis || null}
      )
    `;

    return NextResponse.json({ id: poId, trackingId }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to create purchase order";
    let errorDetails: string[] = [];
    
    if (error instanceof Error) {
      // Check for common database errors
      if (error.message.includes("violates foreign key constraint")) {
        if (error.message.includes("counterparty_id")) {
          errorMessage = "Invalid counterparty selected";
          errorDetails.push("The selected counterparty does not exist or has been deleted");
        } else if (error.message.includes("delivery_vault_id")) {
          errorMessage = "Invalid delivery vault selected";
          errorDetails.push("The selected delivery vault does not exist");
        }
      } else if (error.message.includes("violates not-null constraint")) {
        errorMessage = "Missing required field";
        errorDetails.push("A required field is missing or empty");
      } else if (error.message.includes("duplicate key")) {
        errorMessage = "Duplicate entry";
        errorDetails.push("A purchase order with this ID already exists");
      } else if (error.message.includes("connection")) {
        errorMessage = "Database connection error";
        errorDetails.push("Unable to connect to the database. Please try again later.");
      } else {
        // Log the actual error for debugging
        console.error("Detailed error:", error.message);
        errorDetails.push("An unexpected error occurred. Please try again or contact support.");
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        code: "CREATE_PO_ERROR"
      },
      { status: 500 }
    );
  }
}
