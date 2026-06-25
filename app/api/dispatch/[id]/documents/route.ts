import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData()
    const file = formData.get('file') as File
    const docType = formData.get('docType') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!docType) {
      return NextResponse.json({ error: 'No document type provided' }, { status: 400 })
    }

    // Create a unique path for the document
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'pdf'
    const pathname = `dispatch/${id}/${docType}_${timestamp}.${extension}`

    // Upload to Vercel Blob (private storage for sensitive documents)
    const blob = await put(pathname, file, {
      access: 'private',
    })

    // Ensure table exists
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

    // Save document reference to database (upsert to handle re-uploads)
    await sql`
      INSERT INTO dispatch_documents (dispatch_id, doc_type, file_name, blob_pathname, status, uploaded_at)
      VALUES (${id}, ${docType}, ${file.name}, ${blob.pathname}, 'uploaded', NOW())
      ON CONFLICT (dispatch_id, doc_type) 
      DO UPDATE SET 
        file_name = ${file.name},
        blob_pathname = ${blob.pathname},
        status = 'uploaded',
        uploaded_at = NOW()
    `;

    return NextResponse.json({ 
      success: true,
      pathname: blob.pathname,
      docType,
      fileName: file.name,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// GET endpoint to retrieve saved documents for a dispatch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Ensure table exists first
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

    const documents = await sql`
      SELECT doc_type, file_name, blob_pathname, status, uploaded_at, validated_at
      FROM dispatch_documents
      WHERE dispatch_id = ${id}
    `;

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
