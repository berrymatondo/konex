import { NextResponse } from "next/server"
import { sql, createAuditLog } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"
import { createNotification } from "@/lib/notifications"
import { sendManifestSubmissionEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/base-url"
import { randomUUID } from "crypto"

const OZ_TO_GRAM = 31.1035

const DOC_TYPES = [
  "export_permit",
  "assay_certificate",
  "chain_of_custody",
  "carrier_waybill",
  "lbma_rgg",
  "minamata",
] as const

async function ensureManifestTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS counterparty_manifests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      counterparty_id TEXT NOT NULL,
      attempt_number INT NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      shipment_date DATE,
      carrier TEXT,
      waybill_number TEXT,
      departure_location TEXT,
      destination_vault TEXT,
      incoterms TEXT,
      seal_number TEXT,
      total_bars INT,
      total_gross_weight_kg NUMERIC(12,3),
      total_fine_oz NUMERIC(12,3),
      po_fine_oz NUMERIC(12,3),
      variance_percent NUMERIC(8,4),
      bars_json JSONB DEFAULT '[]',
      declarant_name TEXT,
      declarant_title TEXT,
      declaration_accepted_at TIMESTAMP WITH TIME ZONE,
      review_notes TEXT,
      reason_code TEXT,
      internal_notes TEXT,
      failed_doc_types JSONB DEFAULT '[]',
      reviewed_at TIMESTAMP WITH TIME ZONE,
      reviewed_by TEXT,
      submitted_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  // Idempotent column additions for existing tables
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS reason_code TEXT`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS internal_notes TEXT`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS failed_doc_types JSONB DEFAULT '[]'`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS manifest_reference TEXT`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS expected_arrival_date DATE`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS seal_number_secondary TEXT`
  await sql`ALTER TABLE counterparty_manifests ADD COLUMN IF NOT EXISTS current_step INT DEFAULT 0`

  // Backfill: promote any PO that is still 'accepted' but whose manifest was
  // already validated by the BCC to the new 'manifest_validated' status.
  await sql`
    UPDATE purchase_orders po
    SET status = 'manifest_validated'
    WHERE po.status = 'accepted'
      AND EXISTS (
        SELECT 1 FROM counterparty_manifests cm
        WHERE cm.purchase_order_id = po.id AND cm.status = 'accepted'
      )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS manifest_documents (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      manifest_id TEXT NOT NULL REFERENCES counterparty_manifests(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_data BYTEA,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
}

/** Copies documents that are NOT in failedDocTypes from one manifest to another. */
async function copyCarriedForwardDocs(
  fromManifestId: string,
  toManifestId: string,
  failedDocTypes: string[],
) {
  for (const docType of DOC_TYPES) {
    if (failedDocTypes.includes(docType)) continue
    const newDocId = `mfst-doc-${Date.now()}-${randomUUID().slice(0, 8)}`
    await sql`
      INSERT INTO manifest_documents (id, manifest_id, doc_type, file_name, file_data, mime_type, status, uploaded_at)
      SELECT ${newDocId}, ${toManifestId}, doc_type, file_name, file_data, mime_type, 'pending', CURRENT_TIMESTAMP
      FROM manifest_documents
      WHERE manifest_id = ${fromManifestId} AND doc_type = ${docType}
      LIMIT 1
    `
  }
}

/** Returns the current draft manifest for a PO, or null. */
async function findDraft(purchaseOrderId: string) {
  const rows = await sql`
    SELECT id FROM counterparty_manifests
    WHERE purchase_order_id = ${purchaseOrderId} AND status = 'draft'
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0].id as string) : null
}

/** Saves provided document files onto a manifest (replaces existing for that doc_type). */
async function storeDocuments(manifestId: string, formData: FormData) {
  for (const docType of DOC_TYPES) {
    const file = formData.get(`doc_${docType}`)
    if (!(file instanceof File) || file.size === 0) continue

    const allowed = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowed.includes(file.type) || file.size > 20 * 1024 * 1024) continue

    // Replace any existing document of that type for this manifest
    await sql`
      DELETE FROM manifest_documents
      WHERE manifest_id = ${manifestId} AND doc_type = ${docType}
    `

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const docId = `mfst-doc-${Date.now()}-${randomUUID().slice(0, 8)}`

    await sql`
      INSERT INTO manifest_documents (id, manifest_id, doc_type, file_name, file_data, mime_type, status)
      VALUES (
        ${docId}, ${manifestId}, ${docType}, ${file.name},
        decode(${base64}, 'base64'), ${file.type}, 'pending'
      )
    `
  }
}

function parseBars(raw: string) {
  try {
    return JSON.parse(raw) as Array<{ barNumber: string; grossWeightKg: number; fineness: number; fineOz: number }>
  } catch {
    return []
  }
}

function computeTotals(bars: ReturnType<typeof parseBars>, poWeightKg: number, poPurity: number) {
  const totalBars = bars.length
  const totalGrossWeightKg = bars.reduce((s, b) => s + Number(b.grossWeightKg || 0), 0)
  const totalFineOz = bars.reduce((s, b) => s + Number(b.fineOz || 0), 0)
  const poFineOz = Math.floor(((poWeightKg * poPurity * 1000) / OZ_TO_GRAM) * 1000) / 1000
  const variancePercent = poFineOz > 0 ? ((totalFineOz - poFineOz) / poFineOz) * 100 : 0
  return { totalBars, totalGrossWeightKg, totalFineOz, poFineOz, variancePercent }
}

// ─── GET ─────────────────────────────────────────────────────────────────────
// Returns the latest manifest for a PO — draft or submitted — with document
// metadata (no binary data). Returns null when none exists yet.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await ensureManifestTables()

  const poRows = await sql`SELECT counterparty_id FROM purchase_orders WHERE id = ${id}`
  if (poRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (sessionUser.role === "counterparty" && sessionUser.counterpartyId !== poRows[0].counterparty_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Counterparty: draft first (so they can resume), then submitted.
  // Agents/admins: non-draft first (so they see what was submitted for review).
  const isCounterpartyUser = sessionUser.role === "counterparty"
  const rows = isCounterpartyUser
    ? await sql`
        SELECT m.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', d.id,
                'doc_type', d.doc_type,
                'file_name', d.file_name,
                'status', d.status,
                'rejection_reason', d.rejection_reason,
                'uploaded_at', d.uploaded_at
              ) ORDER BY d.uploaded_at
            ) FILTER (WHERE d.id IS NOT NULL),
            '[]'
          ) AS documents
        FROM counterparty_manifests m
        LEFT JOIN manifest_documents d ON d.manifest_id = m.id
        WHERE m.purchase_order_id = ${id}
        GROUP BY m.id
        ORDER BY
          CASE WHEN m.status = 'draft' THEN 0 ELSE 1 END,
          m.attempt_number DESC
        LIMIT 1
      `
    : await sql`
        SELECT m.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', d.id,
                'doc_type', d.doc_type,
                'file_name', d.file_name,
                'status', d.status,
                'rejection_reason', d.rejection_reason,
                'uploaded_at', d.uploaded_at
              ) ORDER BY d.uploaded_at
            ) FILTER (WHERE d.id IS NOT NULL),
            '[]'
          ) AS documents
        FROM counterparty_manifests m
        LEFT JOIN manifest_documents d ON d.manifest_id = m.id
        WHERE m.purchase_order_id = ${id}
          AND m.status != 'draft'
        GROUP BY m.id
        ORDER BY m.attempt_number DESC
        LIMIT 1
      `

  if (rows.length === 0) return NextResponse.json(null)
  const row = rows[0] as Record<string, unknown>
  if (isCounterpartyUser) delete row.internal_notes
  return NextResponse.json(row)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// Saves or updates a draft manifest. No declaration required. Can be called at
// any step to persist progress. Only document types where a new file is
// provided are updated; previously saved documents are kept as-is.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role !== "counterparty") {
    return NextResponse.json({ error: "Seules les contreparties peuvent sauvegarder un manifeste." }, { status: 403 })
  }

  const { id } = await params
  await ensureManifestTables()

  const poRows = await sql`
    SELECT po.counterparty_id, po.status, po.estimated_weight_kg, po.purity_factor
    FROM purchase_orders po
    WHERE po.id = ${id}
  `
  if (poRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const po = poRows[0]

  if (sessionUser.counterpartyId !== po.counterparty_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (po.status !== "accepted") {
    return NextResponse.json(
      { error: "La sauvegarde n'est possible que pour un bon de commande accepté." },
      { status: 400 },
    )
  }

  const formData = await request.formData()
  const manifestRef = (formData.get("manifestRef") as string | null) || null
  const shipmentDate = (formData.get("shipmentDate") as string | null) || null
  const expectedArrival = (formData.get("expectedArrival") as string | null) || null
  const carrier = (formData.get("carrier") as string | null) || null
  const waybillNumber = (formData.get("waybillNumber") as string | null) || null
  const departureLocation = (formData.get("departureLocation") as string | null) || null
  const destinationVault = (formData.get("destinationVault") as string | null) || null
  const incoterms = (formData.get("incoterms") as string | null) || null
  const sealNumber = (formData.get("sealNumber") as string | null) || null
  const sealNumberSecondary = (formData.get("sealNumberSecondary") as string | null) || null
  const barsJsonRaw = (formData.get("barsJson") as string | null) || "[]"
  const declarantName = (formData.get("declarantName") as string | null) || null
  const declarantTitle = (formData.get("declarantTitle") as string | null) || null
  const currentStepRaw = formData.get("currentStep")
  const currentStep = currentStepRaw != null ? Number(currentStepRaw) : 0

  const bars = parseBars(barsJsonRaw)
  const { totalBars, totalGrossWeightKg, totalFineOz, poFineOz, variancePercent } = computeTotals(
    bars,
    Number(po.estimated_weight_kg || 0),
    Number(po.purity_factor || 0.9995),
  )

  const now = new Date().toISOString()
  const existingDraftId = await findDraft(id)

  let manifestId: string

  if (existingDraftId) {
    // Update the existing draft
    await sql`
      UPDATE counterparty_manifests SET
        manifest_reference = ${manifestRef},
        shipment_date = ${shipmentDate},
        expected_arrival_date = ${expectedArrival},
        carrier = ${carrier},
        waybill_number = ${waybillNumber},
        departure_location = ${departureLocation},
        destination_vault = ${destinationVault},
        incoterms = ${incoterms},
        seal_number = ${sealNumber},
        seal_number_secondary = ${sealNumberSecondary},
        total_bars = ${totalBars},
        total_gross_weight_kg = ${totalGrossWeightKg},
        total_fine_oz = ${totalFineOz},
        po_fine_oz = ${poFineOz},
        variance_percent = ${variancePercent},
        bars_json = ${barsJsonRaw}::jsonb,
        declarant_name = ${declarantName},
        declarant_title = ${declarantTitle},
        current_step = ${currentStep},
        updated_at = ${now}
      WHERE id = ${existingDraftId}
    `
    manifestId = existingDraftId
  } else {
    // Check for a returned manifest (resubmission flow): carry forward rejection context + non-failed docs
    const returnedRows = await sql`
      SELECT id, failed_doc_types, review_notes, reason_code FROM counterparty_manifests
      WHERE purchase_order_id = ${id} AND status = 'returned'
      ORDER BY attempt_number DESC LIMIT 1
    `
    const returnedManifest = returnedRows.length > 0 ? (returnedRows[0] as Record<string, unknown>) : null

    let failedTypes: string[] = []
    if (returnedManifest) {
      const rawFailed = returnedManifest.failed_doc_types
      if (Array.isArray(rawFailed)) failedTypes = rawFailed as string[]
      else if (typeof rawFailed === "string") {
        try { failedTypes = JSON.parse(rawFailed) } catch { /* ignore */ }
      }
    }

    const inheritedReviewNotes = (returnedManifest?.review_notes as string | null) ?? null
    const inheritedReasonCode = (returnedManifest?.reason_code as string | null) ?? null
    const inheritedFailedDocTypes = JSON.stringify(failedTypes)

    // Create a new draft
    manifestId = `mfst-${Date.now()}-${randomUUID().slice(0, 8)}`
    await sql`
      INSERT INTO counterparty_manifests (
        id, purchase_order_id, counterparty_id, attempt_number, status,
        manifest_reference, shipment_date, expected_arrival_date, carrier,
        waybill_number, departure_location, destination_vault, incoterms,
        seal_number, seal_number_secondary,
        total_bars, total_gross_weight_kg, total_fine_oz, po_fine_oz, variance_percent,
        bars_json, declarant_name, declarant_title, current_step,
        review_notes, reason_code, failed_doc_types,
        created_at, updated_at
      ) VALUES (
        ${manifestId}, ${id}, ${sessionUser.counterpartyId as string}, 1, 'draft',
        ${manifestRef}, ${shipmentDate}, ${expectedArrival}, ${carrier},
        ${waybillNumber}, ${departureLocation}, ${destinationVault}, ${incoterms},
        ${sealNumber}, ${sealNumberSecondary},
        ${totalBars}, ${totalGrossWeightKg}, ${totalFineOz}, ${poFineOz}, ${variancePercent},
        ${barsJsonRaw}::jsonb, ${declarantName}, ${declarantTitle}, ${currentStep},
        ${inheritedReviewNotes}, ${inheritedReasonCode}, ${inheritedFailedDocTypes}::jsonb,
        ${now}, ${now}
      )
    `

    // Copy non-failed documents from the returned manifest (resubmission)
    if (returnedManifest) {
      await copyCarriedForwardDocs(returnedManifest.id as string, manifestId, failedTypes)
    }
  }

  // Save only the document types that have new files in this request
  await storeDocuments(manifestId, formData)

  // Return the updated document list so the client can refresh its saved-doc state
  const docRows = await sql`
    SELECT doc_type, file_name, uploaded_at
    FROM manifest_documents
    WHERE manifest_id = ${manifestId}
    ORDER BY uploaded_at
  `

  await createAuditLog({
    entityType: "manifest",
    entityId: manifestId,
    action: "manifest_draft_saved",
    details: { purchaseOrderId: id, totalBars },
    performedBy: sessionUser.id,
  })

  return NextResponse.json({ ok: true, manifestId, savedAt: now, documents: docRows })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Final submission. Validates the declaration, promotes the draft (if any) to
// 'submitted', carries over any previously saved documents for types where no
// new file is provided, then notifies agents.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (sessionUser.role !== "counterparty") {
    return NextResponse.json(
      { error: "Seules les contreparties peuvent soumettre un manifeste." },
      { status: 403 },
    )
  }

  const { id } = await params
  await ensureManifestTables()

  const poRows = await sql`
    SELECT po.counterparty_id, po.status, po.tracking_id, po.created_by,
           po.estimated_weight_kg, po.purity_factor,
           c.legal_name AS counterparty_name
    FROM purchase_orders po
    LEFT JOIN counterparties c ON c.id = po.counterparty_id
    WHERE po.id = ${id}
  `
  if (poRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const po = poRows[0]

  if (sessionUser.counterpartyId !== po.counterparty_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (po.status !== "accepted") {
    return NextResponse.json(
      { error: "Le manifeste ne peut être soumis que pour un bon de commande accepté." },
      { status: 400 },
    )
  }

  // Prevent resubmission while a manifest is already pending review
  const pendingRows = await sql`
    SELECT id FROM counterparty_manifests
    WHERE purchase_order_id = ${id} AND status = 'submitted'
    LIMIT 1
  `
  if (pendingRows.length > 0) {
    return NextResponse.json(
      { error: "Un manifeste est déjà en attente d'examen. Attendez la décision avant de resoumettre." },
      { status: 400 },
    )
  }

  const formData = await request.formData()
  const manifestRef = (formData.get("manifestRef") as string | null) || null
  const shipmentDate = (formData.get("shipmentDate") as string | null) || null
  const expectedArrival = (formData.get("expectedArrival") as string | null) || null
  const carrier = (formData.get("carrier") as string | null) || null
  const waybillNumber = (formData.get("waybillNumber") as string | null) || null
  const departureLocation = (formData.get("departureLocation") as string | null) || null
  const destinationVault = (formData.get("destinationVault") as string | null) || null
  const incoterms = (formData.get("incoterms") as string | null) || null
  const sealNumber = (formData.get("sealNumber") as string | null) || null
  const sealNumberSecondary = (formData.get("sealNumberSecondary") as string | null) || null
  const barsJsonRaw = (formData.get("barsJson") as string | null) || "[]"
  const declarantName = (formData.get("declarantName") as string | null) || null
  const declarantTitle = (formData.get("declarantTitle") as string | null) || null
  const declarationAccepted = formData.get("declarationAccepted") === "true"

  if (!declarationAccepted) {
    return NextResponse.json({ error: "La déclaration doit être acceptée avant soumission." }, { status: 400 })
  }

  const bars = parseBars(barsJsonRaw)
  const { totalBars, totalGrossWeightKg, totalFineOz, poFineOz, variancePercent } = computeTotals(
    bars,
    Number(po.estimated_weight_kg || 0),
    Number(po.purity_factor || 0.9995),
  )

  const now = new Date().toISOString()

  // Find the current draft (if any) to reuse its documents and determine attempt number
  const existingDraftId = await findDraft(id)

  // Attempt number = max existing + 1 (including any previous submissions)
  const attemptRow = await sql`
    SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt
    FROM counterparty_manifests
    WHERE purchase_order_id = ${id} AND status != 'draft'
  `
  const attemptNumber = Number(attemptRow[0]?.max_attempt || 0) + 1

  let manifestId: string

  if (existingDraftId) {
    // Promote the existing draft to 'submitted'
    await sql`
      UPDATE counterparty_manifests SET
        status = 'submitted',
        attempt_number = ${attemptNumber},
        manifest_reference = ${manifestRef},
        shipment_date = ${shipmentDate},
        expected_arrival_date = ${expectedArrival},
        carrier = ${carrier},
        waybill_number = ${waybillNumber},
        departure_location = ${departureLocation},
        destination_vault = ${destinationVault},
        incoterms = ${incoterms},
        seal_number = ${sealNumber},
        seal_number_secondary = ${sealNumberSecondary},
        total_bars = ${totalBars},
        total_gross_weight_kg = ${totalGrossWeightKg},
        total_fine_oz = ${totalFineOz},
        po_fine_oz = ${poFineOz},
        variance_percent = ${variancePercent},
        bars_json = ${barsJsonRaw}::jsonb,
        declarant_name = ${declarantName},
        declarant_title = ${declarantTitle},
        declaration_accepted_at = ${now},
        submitted_at = ${now},
        updated_at = ${now}
      WHERE id = ${existingDraftId}
    `
    manifestId = existingDraftId
  } else {
    // No draft: check for a returned manifest to copy carried-forward docs from
    const returnedRows = await sql`
      SELECT id, failed_doc_types FROM counterparty_manifests
      WHERE purchase_order_id = ${id} AND status = 'returned'
      ORDER BY attempt_number DESC LIMIT 1
    `
    const returnedManifest = returnedRows.length > 0 ? (returnedRows[0] as Record<string, unknown>) : null
    let failedTypes: string[] = []
    if (returnedManifest) {
      const rawFailed = returnedManifest.failed_doc_types
      if (Array.isArray(rawFailed)) failedTypes = rawFailed as string[]
      else if (typeof rawFailed === "string") {
        try { failedTypes = JSON.parse(rawFailed) } catch { /* ignore */ }
      }
    }

    manifestId = `mfst-${Date.now()}-${randomUUID().slice(0, 8)}`
    await sql`
      INSERT INTO counterparty_manifests (
        id, purchase_order_id, counterparty_id, attempt_number, status,
        manifest_reference, shipment_date, expected_arrival_date, carrier,
        waybill_number, departure_location, destination_vault, incoterms,
        seal_number, seal_number_secondary,
        total_bars, total_gross_weight_kg, total_fine_oz, po_fine_oz, variance_percent,
        bars_json, declarant_name, declarant_title, declaration_accepted_at,
        submitted_at, created_at, updated_at
      ) VALUES (
        ${manifestId}, ${id}, ${sessionUser.counterpartyId as string}, ${attemptNumber}, 'submitted',
        ${manifestRef}, ${shipmentDate}, ${expectedArrival}, ${carrier},
        ${waybillNumber}, ${departureLocation}, ${destinationVault}, ${incoterms},
        ${sealNumber}, ${sealNumberSecondary},
        ${totalBars}, ${totalGrossWeightKg}, ${totalFineOz}, ${poFineOz}, ${variancePercent},
        ${barsJsonRaw}::jsonb, ${declarantName}, ${declarantTitle}, ${now},
        ${now}, ${now}, ${now}
      )
    `

    if (returnedManifest) {
      await copyCarriedForwardDocs(returnedManifest.id as string, manifestId, failedTypes)
    }
  }

  // Store new/replacement documents; previously saved ones are kept via the draft
  await storeDocuments(manifestId, formData)

  // Notify the agent assigned to the PO (created_by) and the Banque Centrale (admins)
  try {
    const reference = (po.tracking_id as string | null) || `PO-${id.slice(0, 8).toUpperCase()}`
    const link = `${getBaseUrl()}/purchase-orders/${id}`
    const cpName = (po.counterparty_name as string | null) || "La contrepartie"
    const createdBy = (po.created_by as string | null) ?? null

    // Targets: the specific agent who owns this PO + all admins (Banque Centrale)
    const recipients = await sql`
      SELECT DISTINCT id, email, name, role FROM "user"
      WHERE id = ${createdBy}
         OR role = 'admin'
    `

    await Promise.all(
      recipients.flatMap((r: Record<string, unknown>) => {
        const tasks: Promise<unknown>[] = [
          createNotification({
            userId: r.id as string,
            title: `Manifeste soumis — ${reference}`,
            message: `${cpName} a soumis le manifeste d'expédition pour ${reference} (tentative n°${attemptNumber}).`,
            type: "info",
            link: `/purchase-orders/${id}`,
          }),
        ]
        if (r.email) {
          tasks.push(
            sendManifestSubmissionEmail({
              to: r.email as string,
              recipientName: (r.name as string | null) || undefined,
              recipientRole: (r.role as string | null) || "agent",
              counterpartyName: cpName,
              reference,
              attemptNumber,
              totalBars,
              totalFineOz,
              variancePercent,
              link,
            }),
          )
        }
        return tasks
      }),
    )
  } catch (notifyError) {
    console.error("Error notifying recipients of manifest submission:", notifyError)
  }

  await createAuditLog({
    entityType: "manifest",
    entityId: manifestId,
    action: "manifest_submitted",
    details: {
      purchaseOrderId: id,
      attemptNumber,
      totalBars,
      totalFineOz,
      variancePercent: Number(variancePercent.toFixed(4)),
    },
    performedBy: sessionUser.id,
  })

  return NextResponse.json({ ok: true, manifestId, attemptNumber })
}
