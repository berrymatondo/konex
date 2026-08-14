import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureBccTables } from "@/lib/bcc-db"
import { getSessionUser } from "@/lib/session-user"

async function authorize(){const user=await getSessionUser();if(!user)return false;await ensureBccTables();return true}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorize())return NextResponse.json({error:"Unauthorized"},{status:401})
  const {id}=await params
  const rows=await sql`SELECT * FROM bcc_pricing_settlements WHERE id=${id} LIMIT 1`
  return rows[0]?NextResponse.json(rows[0]):NextResponse.json({error:"Not found"},{status:404})
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorize())return NextResponse.json({error:"Unauthorized"},{status:401})
  const {id}=await params
  const rows=await sql`DELETE FROM bcc_pricing_settlements WHERE id=${id} AND status='saved' RETURNING id`
  return rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"A settled record cannot be deleted"},{status:409})
}
