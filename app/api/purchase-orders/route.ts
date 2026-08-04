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

export async function GET(request: Request) {
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

    // Counterparties only see POs that have been explicitly sent to them.
    // 'approved' is an internal BCC state; the PO becomes visible only once
    // the BCC submits it to the counterparty (→ sent_to_counterparty).
    const COUNTERPARTY_VISIBLE_STATUSES = [
      'sent_to_counterparty', 'accepted', 'manifest_validated',
      'in_transit', 'delivered', 'negotiating', 'pending_settlement',
      'declined', 'cancelled',
    ];

    let purchaseOrders = (scope === undefined
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

    // The refining-order picker must not offer purchase orders that already
    // have a settlement record. A validated manifest is the minimum workflow
    // state required before refining can begin. Other PO screens keep the full list.
    if (new URL(request.url).searchParams.get("excludeSettled") === "true" && purchaseOrders.length > 0) {
      const REFINING_ELIGIBLE_STATUSES = [
        "manifest_validated",
        "in_transit",
        "delivered",
        "pending_settlement",
      ];
      purchaseOrders = purchaseOrders.filter((po) => REFINING_ELIGIBLE_STATUSES.includes(po.status));

      const settledRows = await sql`
        SELECT DISTINCT purchase_order_id
        FROM settlements
        WHERE purchase_order_id = ANY(${purchaseOrders.map((po) => po.id)})
      `;
      const settledIds = new Set(settledRows.map((row) => String(row.purchase_order_id)));
      purchaseOrders = purchaseOrders.filter((po) => !settledIds.has(po.id));
    }

    // Optional vault/manifest details used by workflows that must list every PO.
    // Keep the main list available on a fresh database where those workflow
    // tables may not have been initialized yet.
    const sourceDetails = new Map<
      string,
      {
        lotReference: string | null;
        deliveredAt: string | null;
        receivedGrossWeightKg: number | null;
        receivedPurity: number | null;
      }
    >();

    if (purchaseOrders.length > 0) {
      try {
        const detailRows = await sql`
          SELECT
            po.id,
            (
              SELECT cm.manifest_reference
              FROM counterparty_manifests cm
              WHERE cm.purchase_order_id = po.id
              ORDER BY cm.attempt_number DESC, cm.created_at DESC
              LIMIT 1
            ) AS lot_reference,
            (
              SELECT vr.arrival_date
              FROM vault_receptions vr
              WHERE vr.po_id = po.id OR vr.selected_po_id = po.id
              ORDER BY vr.updated_at DESC
              LIMIT 1
            ) AS delivered_at,
            COALESCE(
              (
                SELECT vr.gross_weight_kg
                FROM vault_receptions vr
                WHERE vr.po_id = po.id OR vr.selected_po_id = po.id
                ORDER BY vr.updated_at DESC
                LIMIT 1
              ),
              (
                SELECT cm.total_gross_weight_kg
                FROM counterparty_manifests cm
                WHERE cm.purchase_order_id = po.id
                ORDER BY cm.attempt_number DESC, cm.created_at DESC
                LIMIT 1
              )
            ) AS received_gross_weight_kg,
            (
              SELECT vr.au_purity
              FROM vault_receptions vr
              WHERE vr.po_id = po.id OR vr.selected_po_id = po.id
              ORDER BY vr.updated_at DESC
              LIMIT 1
            ) AS received_purity
          FROM purchase_orders po
          WHERE po.id = ANY(${purchaseOrders.map((po) => po.id)})
        `;

        for (const row of detailRows) {
          sourceDetails.set(String(row.id), {
            lotReference: row.lot_reference ? String(row.lot_reference) : null,
            deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
            receivedGrossWeightKg:
              row.received_gross_weight_kg == null
                ? null
                : Number(row.received_gross_weight_kg),
            receivedPurity:
              row.received_purity == null ? null : Number(row.received_purity),
          });
        }
      } catch (error) {
        console.warn("Optional PO source details are unavailable:", error);
      }
    }

    // Get approvals for each PO
    const result = await Promise.all(
      purchaseOrders.map(async (po) => {
        const sourceDetail = sourceDetails.get(po.id);
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
          assayFee: po.assay_fee,
          sourceRefinerId: po.source_refiner_id,
          declaredFinenessPromille: po.declared_fineness_promille,
          expectedRefiningRequired: po.expected_refining_required,
          totalEstimatedValue: po.total_estimated_value,
          currency: po.currency,
          priceLockExpiry: po.price_lock_expiry,
          trackingId: po.tracking_id,
          lotReference: sourceDetail?.lotReference ?? null,
          deliveredAt: sourceDetail?.deliveredAt ?? null,
          receivedGrossWeightKg: sourceDetail?.receivedGrossWeightKg ?? null,
          receivedPurity: sourceDetail?.receivedPurity ?? null,
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
  const sessionUser = await getSessionUser();
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
      assayFee,
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
      sourceRefinerId,
      declaredFinenessPromille,
    } = body;

    // Validate required fields - for drafts, only counterpartyId is required
    if (!counterpartyId) {
      return NextResponse.json(
        { error: "Missing counterparty" },
        { status: 400 }
      );
    }

    let sourceRefinerIsGoodDelivery = false;
    if (sourceRefinerId) {
      const refinerRows = await sql`
        SELECT id, lbma_good_delivery_status FROM counterparties
        WHERE id = ${sourceRefinerId}
          AND counterparty_type = 'refinery'
          AND status IN ('approved', 'active')
        LIMIT 1
      `;
      if (refinerRows.length === 0) {
        return NextResponse.json({ error: "Invalid or unapproved source refiner" }, { status: 400 });
      }
      sourceRefinerIsGoodDelivery = refinerRows[0].lbma_good_delivery_status === "accredited";
    }

    if (declaredFinenessPromille != null && (declaredFinenessPromille <= 0 || declaredFinenessPromille > 1000)) {
      return NextResponse.json({ error: "Declared fineness must be between 0 and 1000‰" }, { status: 400 });
    }
    const computedRefiningRequired = goldType === "refined_bars"
      ? !(sourceRefinerIsGoodDelivery && Number(declaredFinenessPromille) >= 995)
      : true;
    
    // For submitted orders, validate all required fields
    if (status === "submitted") {
      const missingFields: string[] = [];
      if (!estimatedWeightKg || estimatedWeightKg <= 0) missingFields.push("Estimated Weight");
      if (!goldType) missingFields.push("Gold Type");
      if (!incoterms) missingFields.push("Incoterms");
      if (!deliveryVaultId) missingFields.push("Delivery Vault");
      if (!expectedDispatchDate) missingFields.push("Desired Delivery Window Start");
      if (goldType === "refined_bars" && (!declaredFinenessPromille || declaredFinenessPromille <= 0)) {
        missingFields.push("Declared Fineness");
      }
      
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
        lbma_price_per_oz, purity_factor, premium_discount, logistics_cost, assay_fee,
        total_estimated_value, currency, price_lock_expiry, tracking_id,
        created_by, submitted_at,
        tolerance_percent, delivery_window_end, payment_usd_cdf_split,
        payment_timing, payment_term, prepayment_percent, cdf_fx_basis,
        source_refiner_id, declared_fineness_promille, expected_refining_required
      ) VALUES (
        ${poId}, ${counterpartyId}, ${status || 'draft'}, ${estimatedWeightKg}, ${goldType}, ${assayRange || null},
        ${incoterms}, ${deliveryVaultId}, ${expectedDispatchDate || null}, ${notes || null},
        ${lbmaPricePerOz || null}, ${purityFactor || null}, ${premiumDiscount || 0}, ${logisticsCost || 0}, ${assayFee || 0},
        ${totalEstimatedValue || null}, ${currency || 'USD'}, ${priceLockExpiry || null}, ${trackingId},
        ${sessionUser?.id ?? null}, ${status === 'submitted' ? new Date().toISOString() : null},
        ${tolerancePercent ?? null}, ${deliveryWindowEnd || null}, ${paymentUsdCdfSplit || null},
        ${paymentTiming || null}, ${paymentTerm || null}, ${prepaymentPercent ?? null}, ${cdfFxBasis || null},
        ${sourceRefinerId || null}, ${declaredFinenessPromille ?? null}, ${computedRefiningRequired}
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
