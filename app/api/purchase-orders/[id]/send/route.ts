import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"
import { buildPurchaseOrderPDFArrayBuffer } from "@/lib/pdf-generator"
import { sendPurchaseOrderEmail } from "@/lib/email"

// POST: emails the purchase order PDF to the counterparty's user account email.
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

    // Prefer the email of the user account linked to this counterparty.
    let recipientEmail: string | null = null
    let recipientName: string = (po.counterparty_contact as string | null) || (po.counterparty_name as string | null) || "Contrepartie"
    if (po.counterparty_id) {
      const users = await sql`
        SELECT email, name FROM "user" WHERE counterparty_id = ${po.counterparty_id as string} LIMIT 1
      `
      if (users.length > 0 && users[0].email) {
        recipientEmail = users[0].email as string
        recipientName = (users[0].name as string | null) || recipientName
      }
    }
    // Fall back to the counterparty's primary email if no linked user account.
    if (!recipientEmail) {
      recipientEmail = (po.counterparty_email as string | null) || null
    }

    if (po.status === "draft") {
      return NextResponse.json(
        { error: "Un bon de commande en brouillon ne peut pas être transmis à la contrepartie." },
        { status: 400 },
      )
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Aucune adresse email trouvée pour cette contrepartie." },
        { status: 400 },
      )
    }

    const reference = (po.tracking_id as string | null) || `PO-${id.slice(0, 8).toUpperCase()}`
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
      {
        title: "Ordre d'Achat / Purchase Order",
        filename: `${reference}.pdf`,
      },
    )

    const result = await sendPurchaseOrderEmail({
      to: recipientEmail,
      name: recipientName,
      reference,
      pdf: Buffer.from(arrayBuffer),
      filename: `${reference}.pdf`,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ ok: true, email: recipientEmail })
  } catch (error) {
    console.error("Error sending purchase order email:", error)
    return NextResponse.json({ error: "Échec de l'envoi de l'email." }, { status: 500 })
  }
}
