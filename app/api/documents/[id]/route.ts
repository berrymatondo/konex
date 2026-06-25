import { NextResponse } from "next/server";
import { sql, Document, ensureTablesExist } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    const documents = await sql`
      SELECT id, counterparty_id, type, file_name, file_data, mime_type, status, uploaded_at, verified_at
      FROM documents 
      WHERE id = ${id}
    ` as (Document & { file_data: Buffer })[];

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const doc = documents[0];

    if (!doc.file_data) {
      return NextResponse.json(
        { error: "Document has no file data" },
        { status: 404 }
      );
    }

    // Return the binary file
    return new NextResponse(doc.file_data, {
      headers: {
        "Content-Type": doc.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${doc.file_name}"`,
        "Content-Length": doc.file_data.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    await sql`DELETE FROM documents WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
