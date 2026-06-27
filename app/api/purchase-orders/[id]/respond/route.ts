import { NextResponse } from "next/server"
import { sql, createAuditLog, ensurePurchaseOrderResponseColumns } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"
import { createNotification } from "@/lib/notifications"
import { sendCounterpartyResponseEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/base-url"
import { randomUUID } from "crypto"

const DECISION_TO_STATUS: Record<string, string> = {
  accept: "accepted",
  negotiate: "negotiating",
  decline: "declined",
}

function generateDocumentId() {
  return `doc-${Date.now()}-${randomUUID()}`
}

async function ensureResponseDocumentStorage() {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      counterparty_id TEXT NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT,
      file_data BYTEA,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TIMESTAMP WITH TIME ZONE
    )
  `
  await sql`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS file_data BYTEA,
      ADD COLUMN IF NOT EXISTS mime_type TEXT
  `
}

// GET: returns the purchase order for the counterparty response portal. Scoped
// so a counterparty user can only read an order addressed to its counterparty.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    await ensurePurchaseOrderResponseColumns()
    const rows = await sql`
      SELECT po.*, c.legal_name AS counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }
    const po = rows[0]

    // Counterparty users may only view their own orders.
    if (sessionUser.role === "counterparty" && sessionUser.counterpartyId !== po.counterparty_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(po)
  } catch (error) {
    console.error("Error loading purchase order for response:", error)
    return NextResponse.json({ error: "Failed to load purchase order" }, { status: 500 })
  }
}

// POST: records the counterparty's response (accept / negotiate / decline),
// including any counter-proposal on the proposed lot, then notifies the BCC.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    await ensurePurchaseOrderResponseColumns()
    const contentType = request.headers.get("content-type") || ""
    let body: Record<string, unknown>
    let assayCertificateFile: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
      const file = formData.get("assayCertificate")
      assayCertificateFile = file instanceof File && file.size > 0 ? file : null
    } else {
      body = await request.json()
    }

    const {
      decision,
      comment,
      lotReference,
      proposedWeightKg,
      proposedPurity,
      goldForm,
      lotAvailability,
      lotAvailableDate,
      lotLocation,
      assayCertificateUrl,
      assayCertificateFileName,
      proposedDispatchDate,
      estimatedDeliveryDate,
      proposedPremium,
    } = body as Record<string, unknown>

    // "save" persists the counterparty's draft lot fields without recording a
    // decision, changing the status, or notifying the BCC.
    const isSaveDraft = String(decision) === "save"

    const status = isSaveDraft ? null : DECISION_TO_STATUS[String(decision)]
    if (!isSaveDraft && !status) {
      return NextResponse.json(
        { error: "Décision invalide. Utilisez save, accept, negotiate ou decline." },
        { status: 400 },
      )
    }

    const rows = await sql`
      SELECT po.counterparty_id, po.status, po.created_by, po.tracking_id,
             c.legal_name AS counterparty_name
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }
    const po = rows[0]

    // Only the addressed counterparty may respond.
    if (sessionUser.role === "counterparty" && sessionUser.counterpartyId !== po.counterparty_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // The counterparty may respond once the order has been submitted or
    // explicitly transmitted, or is already under negotiation.
    if (!["submitted", "approved", "sent_to_counterparty", "negotiating"].includes(po.status as string)) {
      return NextResponse.json(
        { error: "Ce bon de commande n'est pas encore disponible pour réponse." },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const num = (v: unknown) => (v === "" || v == null ? null : Number(v))
    const str = (v: unknown) => (v == null || v === "" ? null : String(v))
    let savedAssayCertificateUrl = str(assayCertificateUrl)
    let savedAssayCertificateFileName = str(assayCertificateFileName)

    if (assayCertificateFile) {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"]
      if (!allowedTypes.includes(assayCertificateFile.type)) {
        return NextResponse.json({ error: "Only PDF, JPG or PNG files are allowed" }, { status: 400 })
      }
      if (assayCertificateFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "File must be 10MB or smaller" }, { status: 400 })
      }

      await ensureResponseDocumentStorage()
      const docId = generateDocumentId()
      const buffer = Buffer.from(await assayCertificateFile.arrayBuffer())
      const base64Data = buffer.toString("base64")

      await sql`
        INSERT INTO documents (id, counterparty_id, type, file_name, file_data, mime_type, status)
        VALUES (
          ${docId},
          ${po.counterparty_id as string},
          'purchase_order_assay_certificate',
          ${assayCertificateFile.name},
          decode(${base64Data}, 'base64'),
          ${assayCertificateFile.type || "application/octet-stream"},
          'pending'
        )
      `

      savedAssayCertificateUrl = `/api/documents/${docId}`
      savedAssayCertificateFileName = assayCertificateFile.name
    }

    // Draft save: only the proposed-lot fields are persisted.
    if (isSaveDraft) {
      await sql`
        UPDATE purchase_orders SET
          cp_lot_reference = ${str(lotReference)},
          cp_proposed_weight_kg = ${num(proposedWeightKg)},
          cp_proposed_purity = ${num(proposedPurity)},
          cp_gold_form = ${str(goldForm)},
          cp_lot_availability = ${str(lotAvailability)},
          cp_lot_available_date = ${str(lotAvailableDate)},
          cp_lot_location = ${str(lotLocation)},
          cp_assay_certificate_url = ${savedAssayCertificateUrl},
          cp_assay_certificate_file_name = ${savedAssayCertificateFileName},
          cp_proposed_dispatch_date = ${str(proposedDispatchDate)},
          cp_estimated_delivery_date = ${str(estimatedDeliveryDate)},
          cp_proposed_premium = ${num(proposedPremium)},
          cp_comment = ${str(comment)}
        WHERE id = ${id}
      `
      await createAuditLog({
        action: "purchase_order_response_draft_saved",
        entityType: "purchase_order",
        entityId: String(id),
        performedBy: sessionUser.id,
        details: { reference: po.tracking_id || id },
      }).catch(() => {})
      return NextResponse.json({
        ok: true,
        saved: true,
        assayCertificateUrl: savedAssayCertificateUrl,
        assayCertificateFileName: savedAssayCertificateFileName,
      })
    }

    await sql`
      UPDATE purchase_orders SET
        status = ${status},
        cp_response = ${String(decision)},
        cp_responded_at = ${now},
        cp_comment = ${str(comment)},
        cp_lot_reference = ${str(lotReference)},
        cp_proposed_weight_kg = ${num(proposedWeightKg)},
        cp_proposed_purity = ${num(proposedPurity)},
        cp_gold_form = ${str(goldForm)},
        cp_lot_availability = ${str(lotAvailability)},
        cp_lot_available_date = ${str(lotAvailableDate)},
        cp_lot_location = ${str(lotLocation)},
        cp_assay_certificate_url = ${savedAssayCertificateUrl},
        cp_assay_certificate_file_name = ${savedAssayCertificateFileName},
        cp_proposed_dispatch_date = ${str(proposedDispatchDate)},
        cp_estimated_delivery_date = ${str(estimatedDeliveryDate)},
        cp_proposed_premium = ${num(proposedPremium)}
      WHERE id = ${id}
    `

    // Notify the relevant BCC users. `created_by` may hold either a real
    // user id or a role key (e.g. "compliance_officer"), so resolve it to
    // actual user ids before inserting notifications — notifications.user_id
    // has a foreign key to user.id and rejects role strings.
    try {
      const createdBy = (po.created_by as string | null) ?? null
      const reference = po.tracking_id || `PO-${id.slice(0, 8).toUpperCase()}`
      const label =
        decision === "accept"
          ? "acceptée"
          : decision === "negotiate"
            ? "négociée"
            : "déclinée"

      // Users matching the creator id directly, agents, or admins.
      const recipients = await sql`
        SELECT DISTINCT id, email, name FROM "user"
        WHERE id = ${createdBy}
           OR role = 'agent'
           OR role = 'admin'
      `
      const link = `${getBaseUrl()}/purchase-orders/${id}`
      const counterpartyName = (po.counterparty_name as string | null) || undefined

      await Promise.all(
        recipients.flatMap((r: Record<string, unknown>) => {
          const tasks: Promise<unknown>[] = [
            createNotification({
              userId: r.id as string,
              title: `Réponse de la contrepartie — ${reference}`,
              message: `La contrepartie a ${label} la demande d'achat ${reference}.`,
              type: decision === "accept" ? "success" : decision === "decline" ? "error" : "warning",
              link: `/purchase-orders/${id}`,
            }),
          ]
          // Email the BCC agent about the decision.
          if (r.email) {
            tasks.push(
              sendCounterpartyResponseEmail({
                to: r.email as string,
                agentName: (r.name as string | null) || undefined,
                counterpartyName,
                reference,
                decision: decision as "accept" | "negotiate" | "decline",
                comment: str(comment),
                link,
              }),
            )
          }
          return tasks
        }),
      )
    } catch (notifyError) {
      console.error("Error notifying BCC of counterparty response:", notifyError)
    }

    await createAuditLog({
      entityType: "purchase_order",
      entityId: id,
      action: `counterparty_${decision}`,
      previousStatus: po.status as string,
      newStatus: status as string,
      details: { comment: str(comment) },
      performedBy: sessionUser.id,
    })

    return NextResponse.json({ ok: true, status })
  } catch (error) {
    console.error("Error recording counterparty response:", error)
    return NextResponse.json({ error: "Échec de l'enregistrement de la réponse." }, { status: 500 })
  }
}
