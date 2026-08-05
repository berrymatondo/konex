import { NextResponse } from "next/server";
import { ensureRefiningOrdersTable, ensureTablesExist, sql } from "@/lib/db";
import { getSessionUser, isCounterpartyProfile } from "@/lib/session-user";

async function initialize() {
  await ensureTablesExist();
  await ensureRefiningOrdersTable();
  await sql`
    CREATE TABLE IF NOT EXISTS refining_order_outturns (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      refining_order_id TEXT NOT NULL UNIQUE REFERENCES refining_orders(id) ON DELETE CASCADE,
      receipt JSONB,
      outturn JSONB,
      verification JSONB,
      status TEXT NOT NULL DEFAULT 'awaiting_receipt',
      updated_by TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE refining_order_outturns ADD COLUMN IF NOT EXISTS verification JSONB`;
}

async function findOrder(id: string, user: Awaited<ReturnType<typeof getSessionUser>>) {
  const rows = await sql`
    SELECT ro.id, ro.reference, ro.status, ro.refinery_id, po.counterparty_id
    FROM refining_orders ro
    JOIN purchase_orders po ON po.id = ro.purchase_order_id
    WHERE ro.id = ${id} OR ro.reference = ${id}
    LIMIT 1
  `;
  if (!rows.length) return { error: NextResponse.json({ error: "Refining order not found" }, { status: 404 }) };
  const order = rows[0];
  if (isCounterpartyProfile(user) && user?.counterpartyId !== order.refinery_id && user?.counterpartyId !== order.counterparty_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { order };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await initialize();
    const { id } = await context.params;
    const found = await findOrder(id, user);
    if (found.error) return found.error;
    const rows = await sql`SELECT receipt, outturn, verification, status, updated_at FROM refining_order_outturns WHERE refining_order_id = ${found.order.id} LIMIT 1`;
    return NextResponse.json(rows[0] || { receipt: null, outturn: null, status: "awaiting_receipt", updated_at: null });
  } catch (error) {
    console.error("Error loading refining outturn:", error);
    return NextResponse.json({ error: "Failed to load outturn" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await initialize();
    const { id } = await context.params;
    const found = await findOrder(id, user);
    if (found.error) return found.error;
    const order = found.order;
    const body = await request.json();
    const action = String(body.action || "");

    if (["save_verification", "accept_outturn", "raise_exception"].includes(action)) {
      if (isCounterpartyProfile(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const records = await sql`SELECT outturn FROM refining_order_outturns WHERE refining_order_id = ${order.id} LIMIT 1`;
      if (!records[0]?.outturn) return NextResponse.json({ error: "No submitted outturn to verify" }, { status: 409 });
      const verifiedBars = Array.isArray(body.verifiedBars) ? body.verifiedBars : [];
      if (action !== "save_verification" && verifiedBars.length === 0) return NextResponse.json({ error: "Verified bar results are required" }, { status: 400 });
      if (action === "raise_exception" && !String(body.note || "").trim()) return NextResponse.json({ error: "An exception note is required" }, { status: 400 });
      const verification = JSON.stringify({ verifiedBars, note: String(body.note || "").trim(), override: Boolean(body.override), overrideReason: body.overrideReason || null, secondSignoff: Boolean(body.secondSignoff), decision: action === "accept_outturn" ? "accepted" : action === "raise_exception" ? "exception" : "draft", verifiedBy: user.id, verifiedAt: new Date().toISOString() });
      const nextStatus = action === "accept_outturn" ? "classification_pending" : action === "raise_exception" ? "exception" : "under_verification";
      await sql`UPDATE refining_order_outturns SET verification = ${verification}::jsonb, status = ${nextStatus}, updated_by = ${user.id}, updated_at = CURRENT_TIMESTAMP WHERE refining_order_id = ${order.id}`;
      if (action !== "save_verification") await sql`UPDATE refining_orders SET status = ${nextStatus}, updated_at = CURRENT_TIMESTAMP WHERE id = ${order.id}`;
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    if (action === "confirm_receipt") {
      const weight = Number(body.receivedWeightKg);
      if (!Number.isFinite(weight) || weight <= 0 || !body.receivedDate || body.sealsIntact !== true) {
        return NextResponse.json({ error: "Receipt weight, date and intact-seal confirmation are required" }, { status: 400 });
      }
      const receipt = JSON.stringify({ receivedWeightKg: weight, receivedDate: body.receivedDate, sealsIntact: true });
      await sql`
        INSERT INTO refining_order_outturns (refining_order_id, receipt, status, updated_by)
        VALUES (${order.id}, ${receipt}::jsonb, 'receipt_confirmed', ${user.id})
        ON CONFLICT (refining_order_id) DO UPDATE SET receipt = EXCLUDED.receipt, status = 'receipt_confirmed', updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
      `;
      await sql`UPDATE refining_orders SET status = 'in_refining', updated_at = CURRENT_TIMESTAMP WHERE id = ${order.id}`;
      return NextResponse.json({ ok: true, status: "receipt_confirmed" });
    }

    if (action === "save_draft" || action === "submit_outturn") {
      const bars = Array.isArray(body.bars) ? body.bars : [];
      if (action === "submit_outturn" && (!String(body.certificateNumber || "").trim() || !body.outturnDate || !String(body.certificateFileName || "").trim() || bars.length === 0)) {
        return NextResponse.json({ error: "Certificate number, date, PDF and at least one bar are required" }, { status: 400 });
      }
      const normalizedBars = bars.map((bar: Record<string, unknown>) => ({ serial: String(bar.serial || "").trim(), grossKg: Number(bar.grossKg), fineness: Number(bar.fineness) }));
      if (action === "submit_outturn" && normalizedBars.some((bar: { serial: string; grossKg: number; fineness: number }) => !bar.serial || !Number.isFinite(bar.grossKg) || bar.grossKg <= 0 || !Number.isFinite(bar.fineness) || bar.fineness <= 0 || bar.fineness > 1000)) {
        return NextResponse.json({ error: "Every refined bar must have a serial, gross weight and valid fineness" }, { status: 400 });
      }
      const outturn = JSON.stringify({ certificateNumber: String(body.certificateNumber || "").trim(), outturnDate: body.outturnDate || null, certificateFileName: body.certificateFileName || null, bars: normalizedBars });
      const nextStatus = action === "submit_outturn" ? "submitted" : "draft";
      await sql`
        INSERT INTO refining_order_outturns (refining_order_id, outturn, status, updated_by)
        VALUES (${order.id}, ${outturn}::jsonb, ${nextStatus}, ${user.id})
        ON CONFLICT (refining_order_id) DO UPDATE SET outturn = EXCLUDED.outturn, status = ${nextStatus}, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
      `;
      if (action === "submit_outturn") await sql`UPDATE refining_orders SET status = 'outturn_received', updated_at = CURRENT_TIMESTAMP WHERE id = ${order.id}`;
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error saving refining outturn:", error);
    return NextResponse.json({ error: "Failed to save outturn" }, { status: 500 });
  }
}
