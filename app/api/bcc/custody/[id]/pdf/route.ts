import {NextResponse} from "next/server"
import {sql} from "@/lib/db"
import {ensureBccTables} from "@/lib/bcc-db"
import {getSessionUser} from "@/lib/session-user"
import {buildBccCustodyPDF} from "@/lib/pdf-generator"
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){if(!await getSessionUser())return NextResponse.json({error:"Unauthorized"},{status:401});await ensureBccTables();const {id}=await params,rows=await sql`SELECT * FROM bcc_custody_confirmations WHERE id=${id} LIMIT 1`,r=rows[0];if(!r)return NextResponse.json({error:"Not found"},{status:404});if(!["confirmed","completed"].includes(r.status))return NextResponse.json({error:"PDF available only for confirmed records"},{status:409});const lang=new URL(request.url).searchParams.get("lang")==="en"?"en":"fr",pdf=buildBccCustodyPDF({reference:r.reference,purchaseOrder:r.data?.purchaseOrderReference||r.purchase_order_id||"—",data:r.data||{}},lang);return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="CONFIRMATION-${r.reference}.pdf"`}})}
