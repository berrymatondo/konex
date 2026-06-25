import { NextResponse } from "next/server";
import { sql, ensureTablesExist } from "@/lib/db";

export async function GET() {
  try {
    await ensureTablesExist();
    
    const auditLog = await sql`
      SELECT ral.*, c.legal_name as counterparty_name
      FROM risk_audit_log ral
      LEFT JOIN counterparties c ON ral.counterparty_id = c.id
      ORDER BY ral.performed_at DESC
      LIMIT 100
    `;

    return NextResponse.json(
      auditLog.map((entry) => ({
        id: entry.id,
        counterpartyId: entry.counterparty_id,
        counterpartyName: entry.counterparty_name,
        action: entry.action,
        previousTier: entry.previous_tier,
        newTier: entry.new_tier,
        reason: entry.reason,
        performedBy: entry.performed_by,
        performedAt: entry.performed_at,
      }))
    );
  } catch (error) {
    console.error("Error fetching risk audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk audit log" },
      { status: 500 }
    );
  }
}
