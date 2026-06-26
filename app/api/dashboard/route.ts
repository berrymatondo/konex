import { NextResponse } from "next/server";
import { sql, ensureTablesExist } from "@/lib/db";
import { getSessionUser, getCounterpartyScope } from "@/lib/session-user";

interface PurchaseOrderWithCounterparty {
  id: string;
  tracking_id: string | null;
  counterparty_id: string;
  legal_name: string;
  status: string;
  estimated_weight_kg: number;
  purity_factor: number;
  total_estimated_value: number;
  currency: string;
  created_at: string;
}

interface CountResult {
  count: string;
}

interface SumResult {
  total: string | null;
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    
    // Check for query params
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";
    const poLimit = showAll ? 100 : 10;

    // Counterparty-profile users only see stats/transactions for their counterparty.
    const scope = getCounterpartyScope(await getSessionUser());
    if (scope === null) {
      return NextResponse.json({
        stats: { activeCounterparties: 0, pendingPOs: 0, goldInTransit: 0, monthlyAcquisitions: 0 },
        transactions: [],
      });
    }
    const isScoped = scope !== undefined;

    const [
      activeResult,
      pendingPOsResult,
      purchaseOrders,
      goldInTransitResult,
      monthlyResult,
    ] = await Promise.all([
      (isScoped
        ? sql`SELECT COUNT(*) as count FROM counterparties WHERE status = 'active' AND id = ${scope}`
        : sql`SELECT COUNT(*) as count FROM counterparties WHERE status = 'active'`) as unknown as Promise<CountResult[]>,
      (isScoped
        ? sql`SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('submitted', 'pending_compliance', 'pending_finance') AND counterparty_id = ${scope}`
        : sql`SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('submitted', 'pending_compliance', 'pending_finance')`) as unknown as Promise<CountResult[]>,
      (isScoped
        ? sql`
          SELECT po.*, c.legal_name 
          FROM purchase_orders po 
          LEFT JOIN counterparties c ON po.counterparty_id = c.id 
          WHERE po.counterparty_id = ${scope}
          ORDER BY po.created_at DESC 
          LIMIT ${poLimit}
        `
        : sql`
          SELECT po.*, c.legal_name 
          FROM purchase_orders po 
          LEFT JOIN counterparties c ON po.counterparty_id = c.id 
          ORDER BY po.created_at DESC 
          LIMIT ${poLimit}
        `) as unknown as Promise<PurchaseOrderWithCounterparty[]>,
      (isScoped
        ? sql`SELECT COALESCE(SUM(estimated_weight_kg), 0) as total FROM purchase_orders WHERE status = 'in_transit' AND counterparty_id = ${scope}`
        : sql`SELECT COALESCE(SUM(estimated_weight_kg), 0) as total FROM purchase_orders WHERE status = 'in_transit'`) as unknown as Promise<SumResult[]>,
      (isScoped
        ? sql`
          SELECT COALESCE(SUM(estimated_weight_kg), 0) as total 
          FROM purchase_orders 
          WHERE status IN ('approved', 'delivered', 'completed') 
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND counterparty_id = ${scope}
        `
        : sql`
          SELECT COALESCE(SUM(estimated_weight_kg), 0) as total 
          FROM purchase_orders 
          WHERE status IN ('approved', 'delivered', 'completed') 
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        `) as unknown as Promise<SumResult[]>,
    ]);

    return NextResponse.json({
      stats: {
        activeCounterparties: parseInt(activeResult[0]?.count || "0"),
        pendingPOs: parseInt(pendingPOsResult[0]?.count || "0"),
        goldInTransit: parseFloat(goldInTransitResult[0]?.total || "0"),
        monthlyAcquisitions: parseFloat(monthlyResult[0]?.total || "0"),
      },
      transactions: purchaseOrders.map((po) => ({
        id: po.id,
        counterpartyId: po.counterparty_id,
        counterpartyName: po.legal_name || "Unknown",
        type: "purchase",
        referenceNumber: po.tracking_id ?? po.id,
        goldWeight: parseFloat(String(po.estimated_weight_kg || 0)),
        goldPurity: parseFloat(String((po.purity_factor || 0.88) * 100)),
        totalValue: parseFloat(String(po.total_estimated_value || 0)),
        currency: po.currency || "USD",
        status: po.status,
        createdAt: po.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
