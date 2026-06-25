import { NextResponse } from "next/server";
import { sql, createAuditLog, ensurePurchaseOrderTermsColumns, ensurePurchaseOrderResponseColumns } from "@/lib/db";
import { notifyCounterparty } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await sql`
      SELECT 
        po.*,
        c.legal_name as counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      status, 
      approvedAt, 
      trackingId, 
      notes, 
      approval,
      // Draft update fields
      counterpartyId,
      estimatedWeightKg,
      goldType,
      assayRange,
      incoterms,
      deliveryVaultId,
      expectedDispatchDate,
      lbmaPricePerOz,
      purityFactor,
      premiumDiscount,
      logisticsCost,
      totalEstimatedValue,
      currency,
      priceLockExpiry,
      // Tolerance, delivery window end and desired payment terms
      tolerancePercent,
      deliveryWindowEnd,
      paymentUsdCdfSplit,
      paymentTiming,
      paymentTerm,
      prepaymentPercent,
      cdfFxBasis,
    } = body;

    const now = new Date().toISOString();

    // Record approval if provided
    if (approval) {
      const approvalId = generateId("appr");
      await sql`
        INSERT INTO po_approvals (
          id, purchase_order_id, approver_role, approver_name, approver_id, decision, comments, decided_at
        ) VALUES (
          ${approvalId}, ${id}, ${approval.role}, ${approval.name}, ${approval.userId || 'system'}, 
          ${approval.decision}, ${approval.comments || null}, ${now}
        )
      `;
    }

    // Check if this is a full draft update (has counterpartyId)
    if (counterpartyId) {
      // If submitting, validate pricing has been applied
      if (status === 'submitted' && !priceLockExpiry) {
        return NextResponse.json(
          { error: "Cannot submit: LBMA price has not been locked. Please apply pricing first." },
          { status: 400 }
        );
      }
      if ((status === 'submitted' || status === 'approved') && !expectedDispatchDate) {
        return NextResponse.json(
          {
            error:
              status === 'approved'
                ? "Cannot approve: desired delivery window start date is required."
                : "Cannot submit: desired delivery window start date is required.",
          },
          { status: 400 }
        );
      }

      await ensurePurchaseOrderTermsColumns();
      await ensurePurchaseOrderResponseColumns();

      // When the BCC re-submits an order the counterparty sent back for
      // negotiation, clear the prior counterparty response so the dual-approval
      // and counterparty-response flow restarts cleanly.
      const resubmitting = status === 'submitted';

      await sql`
        UPDATE purchase_orders SET
          counterparty_id = ${counterpartyId},
          estimated_weight_kg = ${estimatedWeightKg},
          gold_type = ${goldType},
          assay_range = ${assayRange || null},
          incoterms = ${incoterms},
          delivery_vault_id = ${deliveryVaultId},
          expected_dispatch_date = ${expectedDispatchDate || null},
          notes = ${notes || null},
          lbma_price_per_oz = ${lbmaPricePerOz || null},
          purity_factor = ${purityFactor || null},
          premium_discount = ${premiumDiscount || 0},
          logistics_cost = ${logisticsCost || 0},
          total_estimated_value = ${totalEstimatedValue || null},
          currency = ${currency || 'USD'},
          price_lock_expiry = ${priceLockExpiry || null},
          status = ${status || 'draft'},
          submitted_at = ${status === 'submitted' ? now : null},
          tolerance_percent = ${tolerancePercent ?? null},
          delivery_window_end = ${deliveryWindowEnd || null},
          payment_usd_cdf_split = ${paymentUsdCdfSplit || null},
          payment_timing = ${paymentTiming || null},
          payment_term = ${paymentTerm || null},
          prepayment_percent = ${prepaymentPercent ?? null},
          cdf_fx_basis = ${cdfFxBasis || null}
        WHERE id = ${id}
      `;

      if (resubmitting) {
        await sql`
          UPDATE purchase_orders SET
            cp_response = NULL,
            cp_responded_at = NULL,
            cp_comment = NULL,
            sent_to_counterparty_at = NULL
          WHERE id = ${id}
        `;
      }
    }
    // Update purchase order based on status changes
    else if (status === "approved") {
      const existingPO = await sql`SELECT expected_dispatch_date FROM purchase_orders WHERE id = ${id}`;
      if (existingPO.length === 0) {
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
      }
      if (!existingPO[0].expected_dispatch_date) {
        return NextResponse.json(
          { error: "Cannot approve: desired delivery window start date is required." },
          { status: 400 }
        );
      }

      const generatedTrackingId = trackingId || `GAC-TRK-${Date.now().toString(36).toUpperCase()}`;
      await sql`
        UPDATE purchase_orders 
        SET 
          status = ${status},
          approved_at = ${approvedAt || now},
          tracking_id = ${generatedTrackingId}
        WHERE id = ${id}
      `;

      // Notify the counterparty user(s) that their purchase order was approved.
      try {
        const poRows = await sql`SELECT counterparty_id FROM purchase_orders WHERE id = ${id}`;
        const counterpartyId = poRows[0]?.counterparty_id as string | undefined;
        if (counterpartyId) {
          const reference = `PO-${id.slice(0, 8).toUpperCase()}`;
          await notifyCounterparty({
            counterpartyId,
            title: `Bon de commande ${reference} approuvé`,
            message: `Votre bon de commande ${reference} a été approuvé et soumis. Référence de suivi : ${generatedTrackingId}.`,
            type: "success",
            link: `/purchase-orders/${id}`,
          });
        }
      } catch (notifyError) {
        // A notification failure must not block the approval itself.
        console.error("Error notifying counterparty of approval:", notifyError);
      }
    } else if (status === "rejected") {
      await sql`
        UPDATE purchase_orders 
        SET 
          status = ${status},
          notes = COALESCE(notes, '') || ' [REJECTED: ' || ${notes || "No reason provided"} || ']'
        WHERE id = ${id}
      `;
    } else if (status === "in_transit") {
      await sql`
        UPDATE purchase_orders 
        SET status = ${status}
        WHERE id = ${id}
      `;
    } else if (status === "dispatched") {
      await sql`
        UPDATE purchase_orders 
        SET status = ${status}
        WHERE id = ${id}
      `;
    } else if (status === "submitted") {
      // Validate that pricing has been applied before allowing submission
      const existingPO = await sql`SELECT lbma_price_per_oz, price_lock_expiry, expected_dispatch_date FROM purchase_orders WHERE id = ${id}`;
      if (existingPO.length === 0) {
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
      }
      if (!existingPO[0].lbma_price_per_oz || !existingPO[0].price_lock_expiry) {
        return NextResponse.json(
          { error: "Cannot submit: LBMA price has not been locked. Please edit the PO and apply pricing first." },
          { status: 400 }
        );
      }
      if (!existingPO[0].expected_dispatch_date) {
        return NextResponse.json(
          { error: "Cannot submit: desired delivery window start date is required." },
          { status: 400 }
        );
      }
      await sql`
        UPDATE purchase_orders 
        SET status = ${status}, submitted_at = ${now}
        WHERE id = ${id}
      `;
    } else if (status === "cancelled") {
      await ensurePurchaseOrderResponseColumns();

      const existingPO = await sql`
        SELECT status, cp_response
        FROM purchase_orders
        WHERE id = ${id}
      `;

      if (existingPO.length === 0) {
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
      }

      const previousStatus = existingPO[0].status as string;
      const counterpartyResponse = existingPO[0].cp_response as string | null;

      if (previousStatus === "accepted" || counterpartyResponse === "accept") {
        return NextResponse.json(
          { error: "Cannot cancel: counterparty has already accepted this purchase order." },
          { status: 400 }
        );
      }

      if (previousStatus !== "sent_to_counterparty") {
        return NextResponse.json(
          { error: "Cannot cancel: purchase order must be sent to the counterparty first." },
          { status: 400 }
        );
      }

      const cancellationNote = notes || "Cancelled by agent before counterparty acceptance";

      await sql`
        UPDATE purchase_orders
        SET
          status = 'cancelled',
          notes = COALESCE(notes, '') || ' [CANCELLED: ' || ${cancellationNote} || ']'
        WHERE id = ${id}
      `;

      await createAuditLog({
        entityType: 'purchase_order',
        entityId: id,
        action: 'purchase_order_cancelled',
        previousStatus,
        newStatus: 'cancelled',
        details: { notes: cancellationNote },
        performedBy: approval?.name || 'system',
      });
    } else if (status) {
      // Get previous status for audit log
      const prevResult = await sql`SELECT status FROM purchase_orders WHERE id = ${id}`;
      const previousStatus = prevResult[0]?.status;

      await sql`
        UPDATE purchase_orders 
        SET status = ${status}
        WHERE id = ${id}
      `;

      // Create audit log entry for status change
      await createAuditLog({
        entityType: 'purchase_order',
        entityId: id,
        action: `status_changed_to_${status}`,
        previousStatus,
        newStatus: status,
        details: { notes },
        performedBy: approval?.name || 'system',
      });
    }

    // Fetch updated record with approvals
    const result = await sql`
      SELECT * FROM purchase_orders WHERE id = ${id}
    `;

    const approvals = await sql`
      SELECT * FROM po_approvals WHERE purchase_order_id = ${id} ORDER BY decided_at ASC
    `;

    return NextResponse.json({
      ...result[0],
      approvals: approvals.map((a: Record<string, unknown>) => ({
        id: a.id,
        approverRole: a.approver_role,
        approverName: a.approver_name,
        decision: a.decision,
        comments: a.comments,
        decidedAt: a.decided_at,
      })),
    });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if the PO is in draft status
    const existing = await sql`
      SELECT status FROM purchase_orders WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (existing[0].status !== "draft") {
      return NextResponse.json(
        { error: "Only draft purchase orders can be deleted" },
        { status: 400 }
      );
    }

    // Delete the purchase order
    await sql`DELETE FROM purchase_orders WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
