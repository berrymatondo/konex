import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureBccTables } from "@/lib/bcc-db"
import { getSessionUser } from "@/lib/session-user"
import { buildBccPurchaseOfferPDF } from "@/lib/pdf-generator"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureBccTables()
  const { id } = await params
  const rows = await sql`SELECT * FROM bcc_purchase_orders WHERE id=${id} LIMIT 1`
  const order = rows[0]
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (order.status !== "approved") return NextResponse.json({ error: "The purchase offer is available after submission" }, { status: 409 })
  const d = order.data || {}
  const language = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "fr"
  const pdf = buildBccPurchaseOfferPDF({ reference: order.reference, seller: d.seller || "—", contractReference: d.contractReference, targetKg: Number(d.targetKg || 0), goldType: d.goldType, centralPurity: Number(d.centralPurity || 0), benchmarkPriceUsdOz: Number(d.benchmarkPriceUsdOz || 0), premiumDiscount: Number(d.premiumDiscount || 0), currency: d.currency || "CDF", deliveryFrom: d.deliveryFrom, deliveryTo: d.deliveryTo, receivingVault: d.receivingVault, intendedDepositary: d.intendedDepositary, createdAt: order.created_at }, language)
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="OFFRE-${order.reference}.pdf"` } })
}
