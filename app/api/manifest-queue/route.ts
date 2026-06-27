import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role === "counterparty") {
    return NextResponse.json({ error: "Accès réservé aux agents." }, { status: 403 })
  }

  // Show ALL manifests (including drafts) so BCC can see the full picture
  const rows = await sql`
    SELECT
      m.id                          AS manifest_id,
      m.status,
      m.attempt_number,
      m.submitted_at,
      m.reviewed_at,
      m.reason_code,
      m.review_notes,
      m.failed_doc_types,
      m.declarant_name,
      m.waybill_number,
      m.carrier,
      m.shipment_date,
      m.destination_vault           AS delivery_vault_id,
      m.bars_json,
      m.created_at,
      m.updated_at,
      po.id                         AS po_id,
      po.tracking_id,
      po.estimated_weight_kg,
      po.purity_factor,
      po.incoterms,
      po.delivery_vault_id          AS po_vault,
      po.status                     AS po_status,
      c.id                          AS counterparty_id,
      c.legal_name                  AS counterparty_name,
      c.country_of_incorporation    AS counterparty_country,
      COALESCE(
        (SELECT COUNT(*) FROM counterparty_manifests m2
         WHERE m2.purchase_order_id = po.id AND m2.status = 'returned'),
        0
      )::int                        AS total_returns,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'doc_type', d.doc_type,
          'file_name', d.file_name,
          'uploaded_at', d.uploaded_at
        )) FROM manifest_documents d WHERE d.manifest_id = m.id),
        '[]'::json
      )                             AS documents,
      prev.failed_doc_types         AS prev_failed_doc_types
    FROM counterparty_manifests m
    JOIN purchase_orders po ON po.id = m.purchase_order_id
    LEFT JOIN counterparties c ON c.id = m.counterparty_id
    LEFT JOIN LATERAL (
      SELECT failed_doc_types
      FROM counterparty_manifests
      WHERE purchase_order_id = m.purchase_order_id
        AND attempt_number = m.attempt_number - 1
        AND status = 'returned'
      LIMIT 1
    ) prev ON true
    ORDER BY
      CASE m.status
        WHEN 'submitted' THEN 0
        WHEN 'returned'  THEN 1
        WHEN 'draft'     THEN 2
        ELSE 3
      END,
      m.attempt_number DESC,
      COALESCE(m.submitted_at, m.updated_at, m.created_at) ASC
  `

  const items = rows.map((r: Record<string, unknown>) => {
    const OZ_TO_GRAM = 31.1035
    const estKg = Number(r.estimated_weight_kg || 0)
    const purity = Number(r.purity_factor || 0.9995)
    const poFineOz = Math.floor((estKg * purity * 1000 / OZ_TO_GRAM) * 1000) / 1000

    let bars: { fineOz: number }[] = []
    try {
      const raw = typeof r.bars_json === "string" ? JSON.parse(r.bars_json) : r.bars_json
      if (Array.isArray(raw)) bars = raw
    } catch { /* ignore */ }
    const declaredFineOz = bars.reduce((s, b) => s + (b.fineOz || 0), 0)

    // SLA = 72 h for submitted manifests
    const receivedAt = r.submitted_at as string | null
    const slaDue = receivedAt ? new Date(new Date(receivedAt).getTime() + 72 * 60 * 60 * 1000) : null
    const slaPct = receivedAt && slaDue
      ? Math.min(100, Math.round(((Date.now() - new Date(receivedAt).getTime()) / (72 * 60 * 60 * 1000)) * 100))
      : 0
    const slaOverdue = slaDue ? Date.now() > slaDue.getTime() : false
    const totalReturns = Number(r.total_returns || 0)

    let replacedDocTypes: string[] = []
    try {
      const raw = r.prev_failed_doc_types
      replacedDocTypes = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : [])
    } catch { /* ignore */ }

    const docs: { doc_type: string; file_name: string; uploaded_at: string }[] =
      Array.isArray(r.documents) ? r.documents : []
    const carriedDocTypes = docs
      .map((d) => d.doc_type)
      .filter((dt) => !replacedDocTypes.includes(dt))

    const isResubmission = Number(r.attempt_number || 1) > 1
    const isFinalAttempt = Number(r.attempt_number || 1) >= 2

    let failedDocTypes: string[] = []
    try {
      const raw = r.failed_doc_types
      failedDocTypes = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : [])
    } catch { /* ignore */ }

    return {
      manifestId: r.manifest_id,
      status: r.status,
      attemptNumber: Number(r.attempt_number || 1),
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reasonCode: r.reason_code,
      reviewNotes: r.review_notes,
      failedDocTypes,
      declarantName: r.declarant_name,
      carrier: r.carrier,
      shipmentDate: r.shipment_date,
      waybillNumber: r.waybill_number,
      deliveryVaultId: r.delivery_vault_id || r.po_vault,
      poId: r.po_id,
      poStatus: r.po_status,
      trackingId: r.tracking_id,
      reference: (r.tracking_id as string | null) || `PO-${String(r.po_id).slice(0, 8).toUpperCase()}`,
      poFineOz,
      declaredFineOz: Math.round(declaredFineOz * 1000) / 1000,
      barCount: bars.length,
      incoterms: r.incoterms,
      counterpartyId: r.counterparty_id,
      counterpartyName: r.counterparty_name,
      counterpartyCountry: r.counterparty_country,
      documents: docs,
      replacedDocTypes,
      carriedDocTypes,
      isResubmission,
      isFinalAttempt,
      slaDueAt: slaDue?.toISOString() ?? null,
      slaPct,
      slaOverdue,
      totalReturns,
      isFlagged: totalReturns >= 1 && (r.status === "submitted"),
    }
  })

  const counts = {
    pending: items.filter((i) => i.status === "submitted").length,
    resubmissions: items.filter((i) => i.status === "submitted" && i.isResubmission).length,
    returned: items.filter((i) => i.status === "returned").length,
    accepted: items.filter((i) => i.status === "accepted").length,
    draft: items.filter((i) => i.status === "draft").length,
    slaWatch: items.filter((i) => i.status === "submitted" && i.slaPct >= 75 && !i.slaOverdue).length,
    slaOverdue: items.filter((i) => i.status === "submitted" && i.slaOverdue).length,
  }

  return NextResponse.json({ items, counts })
}
