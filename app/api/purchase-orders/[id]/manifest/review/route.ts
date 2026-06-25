import { NextResponse } from "next/server"
import { sql, createAuditLog } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"
import { createNotification, notifyCounterparty } from "@/lib/notifications"
import { sendManifestReviewEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/base-url"

// PUT: validate or return a submitted manifest (agents and admins only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (sessionUser.role === "counterparty") {
    return NextResponse.json({ error: "Seuls les agents et administrateurs peuvent examiner un manifeste." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = body.action as string | undefined
  // publicNotes is shown to the counterparty; internalNotes is audit-only
  const publicNotes = (body.publicNotes as string | null) || null
  const internalNotes = (body.internalNotes as string | null) || null
  const reasonCode = (body.reasonCode as string | null) || null
  const failedDocTypes = Array.isArray(body.failedDocTypes) ? (body.failedDocTypes as string[]) : []

  const VALID_REASON_CODES = ["missing_document", "weight_discrepancy", "chain_of_custody_gap", "other"]

  if (!["validate", "return"].includes(action ?? "")) {
    return NextResponse.json({ error: "Action invalide. Utilisez 'validate' ou 'return'." }, { status: 400 })
  }

  if (action === "return") {
    if (!reasonCode && !publicNotes?.trim()) {
      return NextResponse.json(
        { error: "Un code de motif ou une note publique est obligatoire pour le retour." },
        { status: 400 },
      )
    }
    if (reasonCode && !VALID_REASON_CODES.includes(reasonCode)) {
      return NextResponse.json({ error: "Code de motif invalide." }, { status: 400 })
    }
  }

  // Fetch the latest submitted manifest for this PO
  const manifestRows = await sql`
    SELECT m.id, m.status, m.attempt_number, m.counterparty_id,
           po.tracking_id, po.created_by,
           c.legal_name AS counterparty_name
    FROM counterparty_manifests m
    JOIN purchase_orders po ON po.id = m.purchase_order_id
    LEFT JOIN counterparties c ON c.id = m.counterparty_id
    WHERE m.purchase_order_id = ${id}
      AND m.status = 'submitted'
    ORDER BY m.attempt_number DESC
    LIMIT 1
  `

  if (manifestRows.length === 0) {
    return NextResponse.json({ error: "Aucun manifeste soumis trouvé pour ce bon de commande." }, { status: 404 })
  }

  const manifest = manifestRows[0]
  const newStatus = action === "validate" ? "accepted" : "returned"
  const now = new Date().toISOString()

  await sql`
    UPDATE counterparty_manifests SET
      status = ${newStatus},
      review_notes = ${publicNotes},
      reason_code = ${action === "return" ? reasonCode : null},
      internal_notes = ${internalNotes},
      failed_doc_types = ${JSON.stringify(action === "return" ? failedDocTypes : [])}::jsonb,
      reviewed_at = ${now},
      reviewed_by = ${sessionUser.id},
      updated_at = ${now}
    WHERE id = ${manifest.id as string}
  `

  const reference = (manifest.tracking_id as string | null) || `PO-${id.slice(0, 8).toUpperCase()}`
  const cpName = (manifest.counterparty_name as string | null) || "La contrepartie"
  const manifestLink = `${getBaseUrl()}/purchase-orders/${id}/manifest`

  // Check total rejections for escalation (after this one)
  let isFinalAttempt = false
  if (action === "return") {
    const countRows = await sql`
      SELECT COUNT(*) AS total_returns FROM counterparty_manifests
      WHERE purchase_order_id = ${id} AND status = 'returned'
    `
    isFinalAttempt = Number(countRows[0]?.total_returns || 0) >= 2
  }

  try {
    const returnReason = reasonCode || publicNotes
    await notifyCounterparty({
      counterpartyId: manifest.counterparty_id as string,
      title: action === "validate"
        ? `Manifeste validé — ${reference}`
        : `Manifeste retourné — ${reference}`,
      message: action === "validate"
        ? `Votre manifeste d'expédition pour ${reference} a été validé par la Banque Centrale.`
        : `Votre manifeste pour ${reference} a été retourné. Motif : ${returnReason}`,
      type: action === "validate" ? "success" : "warning",
      link: `/purchase-orders/${id}/manifest`,
    })

    const cpUsers = await sql`
      SELECT email, name FROM "user"
      WHERE counterparty_id = ${manifest.counterparty_id as string}
        AND email IS NOT NULL
    `
    await Promise.all(
      cpUsers.map((u: Record<string, unknown>) =>
        sendManifestReviewEmail({
          to: u.email as string,
          recipientName: (u.name as string | null) || undefined,
          counterpartyName: cpName,
          reference,
          action: action as "validate" | "return",
          reviewNotes: publicNotes,
          link: manifestLink,
        }),
      ),
    )

    const createdBy = (manifest.created_by as string | null) ?? null
    const internalRecipients = await sql`
      SELECT DISTINCT id FROM "user"
      WHERE id = ${createdBy} OR role = 'admin'
    `
    await Promise.all(
      internalRecipients.map((r: Record<string, unknown>) =>
        createNotification({
          userId: r.id as string,
          title: action === "validate"
            ? `Manifeste validé — ${reference}`
            : `Manifeste retourné à la contrepartie — ${reference}`,
          message: action === "validate"
            ? `Le manifeste de ${cpName} pour ${reference} a été validé.`
            : `Le manifeste de ${cpName} pour ${reference} a été retourné. Motif : ${returnReason}`,
          type: action === "validate" ? "success" : "warning",
          link: `/purchase-orders/${id}`,
        }),
      ),
    )

    // Escalate to trade managers on 2nd rejection
    if (isFinalAttempt) {
      const tradeManagers = await sql`SELECT id FROM "user" WHERE role = 'trade_manager'`
      if (tradeManagers.length > 0) {
        await Promise.all(
          tradeManagers.map((u: Record<string, unknown>) =>
            createNotification({
              userId: u.id as string,
              title: `Escalade requise — ${reference}`,
              message: `Le manifeste de ${cpName} pour ${reference} a été retourné 2 fois. Intervention du Trade Manager requise.`,
              type: "warning",
              link: `/purchase-orders/${id}`,
            }),
          ),
        )
      }
    }
  } catch (notifyErr) {
    console.error("Error sending manifest review notifications:", notifyErr)
  }

  await createAuditLog({
    entityType: "manifest",
    entityId: manifest.id as string,
    action: `manifest_${action}d`,
    previousStatus: "submitted",
    newStatus,
    details: {
      purchaseOrderId: id,
      publicNotes,
      reasonCode,
      failedDocTypes,
      reference,
      isFinalAttempt,
    },
    performedBy: sessionUser.id,
  })

  return NextResponse.json({ ok: true, status: newStatus, isFinalAttempt })
}
