import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST() {
  try {
    // Create dispatch_documents table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS dispatch_documents (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        dispatch_id TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        blob_pathname TEXT NOT NULL,
        status TEXT DEFAULT 'uploaded',
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        validated_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(dispatch_id, doc_type)
      )
    `;

    return NextResponse.json({ success: true, message: "dispatch_documents table created" });
  } catch (error) {
    console.error("Error creating dispatch_documents table:", error);
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
  }
}
