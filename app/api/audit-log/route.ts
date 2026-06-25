import { NextResponse } from "next/server";
import { sql, ensureTablesExist, createAuditLog } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || searchParams.get("entity_type");
    const entityId = searchParams.get("entityId") || searchParams.get("entity_id");
    const limit = parseInt(searchParams.get("limit") || "100");

    let auditLogs;
    
    if (entityType && entityId) {
      // Filter by specific entity
      auditLogs = await sql`
        SELECT * FROM audit_log
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `;
    } else if (entityId) {
      // Filter by entity ID only (across all types)
      auditLogs = await sql`
        SELECT * FROM audit_log
        WHERE entity_id = ${entityId}
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `;
    } else if (entityType) {
      // Filter by entity type only
      auditLogs = await sql`
        SELECT * FROM audit_log
        WHERE entity_type = ${entityType}
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Get all audit logs
      auditLogs = await sql`
        SELECT * FROM audit_log
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json(
      auditLogs.map((entry) => ({
        id: entry.id,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        action: entry.action,
        previous_status: entry.previous_status,
        new_status: entry.new_status,
        details: entry.details,
        performed_by: entry.performed_by,
        performed_at: entry.performed_at,
      }))
    );
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    
    const body = await request.json();
    const { entityType, entityId, action, previousStatus, newStatus, details, performedBy } = body;

    if (!entityType || !entityId || !action) {
      return NextResponse.json(
        { error: "entityType, entityId, and action are required" },
        { status: 400 }
      );
    }

    await createAuditLog({
      entityType,
      entityId,
      action,
      previousStatus,
      newStatus,
      details,
      performedBy,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 }
    );
  }
}
