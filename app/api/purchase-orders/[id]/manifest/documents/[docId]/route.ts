import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSessionUser } from "@/lib/session-user"

// GET: download a single manifest document (agents, admins, or the owning counterparty)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, docId } = await params

  // Verify the document belongs to a manifest for this PO and the requester has access
  const rows = await sql`
    SELECT d.file_name, d.file_data, d.mime_type, m.counterparty_id
    FROM manifest_documents d
    JOIN counterparty_manifests m ON m.id = d.manifest_id
    WHERE d.id = ${docId}
      AND m.purchase_order_id = ${id}
  `

  if (rows.length === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const doc = rows[0]

  // Counterparty users may only download documents for their own manifests
  if (sessionUser.role === "counterparty" && sessionUser.counterpartyId !== doc.counterparty_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!doc.file_data) {
    return NextResponse.json({ error: "No file data" }, { status: 404 })
  }

  const buffer = Buffer.isBuffer(doc.file_data) ? doc.file_data : Buffer.from(doc.file_data)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": (doc.mime_type as string) || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.file_name}"`,
      "Content-Length": buffer.length.toString(),
    },
  })
}
