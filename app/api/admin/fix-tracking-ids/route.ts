import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";

function generateTrackingId(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `PO-${year}${month}-${random}`;
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Find all POs that have no tracking_id
    const missing = await sql`
      SELECT id FROM purchase_orders WHERE tracking_id IS NULL ORDER BY created_at ASC
    ` as { id: string }[];

    let fixed = 0;
    const errors: string[] = [];

    for (const po of missing) {
      // Retry up to 5 times to find a non-colliding ID
      let trackingId = "";
      let ok = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateTrackingId();
        const exists = await sql`
          SELECT 1 FROM purchase_orders WHERE tracking_id = ${candidate} LIMIT 1
        `;
        if (exists.length === 0) {
          trackingId = candidate;
          ok = true;
          break;
        }
      }

      if (!ok) {
        errors.push(`Could not generate unique ID for PO ${po.id}`);
        continue;
      }

      await sql`
        UPDATE purchase_orders SET tracking_id = ${trackingId} WHERE id = ${po.id}
      `;
      fixed++;
    }

    // Also detect and fix duplicate tracking_ids (keep the first one, regenerate for the rest)
    const duplicates = await sql`
      SELECT tracking_id, array_agg(id ORDER BY created_at ASC) AS ids
      FROM purchase_orders
      WHERE tracking_id IS NOT NULL
      GROUP BY tracking_id
      HAVING count(*) > 1
    ` as { tracking_id: string; ids: string[] }[];

    let deduped = 0;
    for (const dup of duplicates) {
      // Skip the first occurrence (ids[0]), regenerate for the rest
      for (const poId of dup.ids.slice(1)) {
        let trackingId = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generateTrackingId();
          const exists = await sql`
            SELECT 1 FROM purchase_orders WHERE tracking_id = ${candidate} LIMIT 1
          `;
          if (exists.length === 0) {
            trackingId = candidate;
            break;
          }
        }
        if (!trackingId) {
          errors.push(`Could not deduplicate PO ${poId}`);
          continue;
        }
        await sql`
          UPDATE purchase_orders SET tracking_id = ${trackingId} WHERE id = ${poId}
        `;
        deduped++;
      }
    }

    return NextResponse.json({
      success: true,
      fixed,
      deduped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error fixing tracking IDs:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
