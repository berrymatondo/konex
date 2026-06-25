import { NextResponse } from "next/server";
import { sql, ensureTablesExist } from "@/lib/db";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function ensureDocumentColumns() {
  try {
    // Check if file_data column exists
    const columns = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'documents' AND column_name IN ('file_data', 'mime_type')
    `;
    
    const existingColumns = columns.map((c: { column_name: string }) => c.column_name);
    
    if (!existingColumns.includes('file_data')) {
      await sql`ALTER TABLE documents ADD COLUMN file_data BYTEA`;
    }
    if (!existingColumns.includes('mime_type')) {
      await sql`ALTER TABLE documents ADD COLUMN mime_type TEXT`;
    }
  } catch (error) {
    console.error("Error ensuring document columns:", error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    await ensureDocumentColumns();
    
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const counterpartyId = formData.get("counterpartyId") as string;
    const documentType = formData.get("documentType") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!counterpartyId) {
      return NextResponse.json(
        { error: "Counterparty ID is required" },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    const docId = generateId("doc");

    // Insert document with binary data
    await sql`
      INSERT INTO documents (id, counterparty_id, type, file_name, file_data, mime_type, status)
      VALUES (
        ${docId}, 
        ${counterpartyId}, 
        ${documentType}, 
        ${file.name}, 
        decode(${base64Data}, 'base64'),
        ${file.type},
        'pending'
      )
    `;

    return NextResponse.json({ 
      id: docId, 
      fileName: file.name,
      type: documentType,
      mimeType: file.type,
      size: file.size
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
