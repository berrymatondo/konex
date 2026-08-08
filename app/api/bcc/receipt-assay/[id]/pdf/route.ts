import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureBccTables } from "@/lib/bcc-db"
import { getSessionUser } from "@/lib/session-user"
import { buildBccReceiptPDF } from "@/lib/pdf-generator"
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const user=await getSessionUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});await ensureBccTables();const {id}=await params;const rows=await sql`SELECT * FROM bcc_receipt_assays WHERE id=${id} LIMIT 1`,record=rows[0];if(!record)return NextResponse.json({error:"Not found"},{status:404});if(!["received","confirmed"].includes(record.status))return NextResponse.json({error:"PDF available only for received records"},{status:409});const lang=new URL(request.url).searchParams.get("lang")==="en"?"en":"fr";const pdf=buildBccReceiptPDF({reference:record.reference,purchaseOrder:record.purchase_order_id||"—",data:record.data||{},createdAt:record.created_at},lang);return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="RECEPTION-${record.reference}.pdf"`}})}
