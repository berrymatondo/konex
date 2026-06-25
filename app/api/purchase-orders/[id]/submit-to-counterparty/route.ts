import { NextResponse } from "next/server"
import { sql, createAuditLog, ensurePurchaseOrderResponseColumns } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"
import { notifyCounterparty } from "@/lib/notifications"
import { sendCounterpartyOrderEmail } from "@/lib/email"
import { buildPurchaseOrderPDFArrayBuffer } from "@/lib/pdf-generator"
import { getBaseUrl } from "@/lib/base-url"

// POST: transmits an approved purchase order to the counterparty so they can
// accept, negotiate or decline it. Sends an email + in-app notification with a
// link to the response portal, and flips the PO status to sent_to_counterparty.
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

    const rows = await sql`
      SELECT po.*, c.legal_name AS counterparty_name, c.primary_email AS counterparty_email,
             c.primary_contact AS counterparty_contact
      FROM purchase_orders po
      LEFT JOIN counterparties c ON po.counterparty_id = c.id
      WHERE po.id = ${id}
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }
    const po = rows[0]

    // Only an approved (dual-approved) order can be transmitted.
    if (po.status !== "approved" && po.status !== "sent_to_counterparty") {
      return NextResponse.json(
        { error: "Le bon de commande doit être approuvé avant d'être soumis à la contrepartie." },
        { status: 400 },
      )
    }

    if (!po.counterparty_id) {
      return NextResponse.json({ error: "Aucune contrepartie associée à ce bon de commande." }, { status: 400 })
    }

    // Resolve the recipient: prefer the linked user account email.
    let recipientEmail: string | null = null
    let recipientName: string =
      (po.counterparty_contact as string | null) || (po.counterparty_name as string | null) || "Contrepartie"
    const users = await sql`
      SELECT email, name FROM "user" WHERE counterparty_id = ${po.counterparty_id as string} LIMIT 1
    `
    if (users.length > 0 && users[0].email) {
      recipientEmail = users[0].email as string
      recipientName = (users[0].name as string | null) || recipientName
    }
    if (!recipientEmail) {
      recipientEmail = (po.counterparty_email as string | null) || null
    }
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Aucune adresse email trouvée pour cette contrepartie." },
        { status: 400 },
      )
    }

    const reference = (po.tracking_id as string | null) || `PO-${id.slice(0, 8).toUpperCase()}`
    const respondUrl = `${getBaseUrl()}/purchase-orders/${id}/respond`
    const now = new Date().toISOString()

    // Attach the PO PDF for convenience.
    let pdf: Buffer | undefined
    try {
      const arrayBuffer = buildPurchaseOrderPDFArrayBuffer(
        {
          reference,
          counterpartyName: (po.counterparty_name as string | null) || "Unknown",
          status: po.status as string,
          estimatedWeight: Number.parseFloat(po.estimated_weight_kg) || 0,
          purityFactor: Number.parseFloat(po.purity_factor) || 0.88,
          totalValue: Number.parseFloat(po.total_estimated_value) || 0,
          currency: (po.currency as string) || "USD",
          incoterms: po.incoterms as string | undefined,
          deliveryVault: po.delivery_vault_id as string | undefined,
          createdAt: po.created_at as string,
        },
        { title: "Demande d'Achat / Purchase Order", filename: `${reference}.pdf` },
      )
      pdf = Buffer.from(arrayBuffer)
    } catch (pdfError) {
      console.error("Could not build PO PDF, sending email without attachment:", pdfError)
    }

    const emailResult = await sendCounterpartyOrderEmail({
      to: recipientEmail,
      name: recipientName,
      reference,
      respondUrl,
      goldType: (po.gold_type as string | null) || undefined,
      estimatedWeight: Number.parseFloat(po.estimated_weight_kg) || undefined,
      assayRange: (po.assay_range as string | null) || undefined,
      incoterms: (po.incoterms as string | null) || undefined,
      totalValue: Number.parseFloat(po.total_estimated_value) || undefined,
      currency: (po.currency as string) || "USD",
      pdf,
      filename: `${reference}.pdf`,
    })

    if (!emailResult.ok) {
      return NextResponse.json({ error: emailResult.error }, { status: 502 })
    }

    // Flip status and stamp the submission time.
    await sql`
      UPDATE purchase_orders
      SET status = 'sent_to_counterparty', sent_to_counterparty_at = ${now}
      WHERE id = ${id}
    `

    // In-app notification for the counterparty user(s), linking to the portal.
    try {
      await notifyCounterparty({
        counterpartyId: po.counterparty_id as string,
        title: `Nouvelle demande d'achat ${reference}`,
        message: `La Banque Centrale vous a transmis la demande d'achat ${reference}. Vous pouvez l'accepter, la négocier ou la décliner.`,
        type: "info",
        link: `/purchase-orders/${id}/respond`,
      })
    } catch (notifyError) {
      console.error("Error notifying counterparty of submission:", notifyError)
    }

    await createAuditLog({
      entityType: "purchase_order",
      entityId: id,
      action: "submitted_to_counterparty",
      previousStatus: po.status as string,
      newStatus: "sent_to_counterparty",
      details: { recipientEmail },
      performedBy: sessionUser.id,
    })

    return NextResponse.json({ ok: true, email: recipientEmail })
  } catch (error) {
    console.error("Error submitting purchase order to counterparty:", error)
    return NextResponse.json({ error: "Échec de la soumission à la contrepartie." }, { status: 500 })
  }
}
