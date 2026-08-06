import { NextResponse } from "next/server";

import { ensureTablesExist, sql } from "@/lib/db";

const REPORT_TYPES = new Set([
  "acquisition-summary",
  "counterparty-overview",
  "gold-inventory",
  "settlement-report",
  "compliance-audit",
  "risk-assessment",
]);

const number = (value: unknown) => Number(value) || 0;
const text = (value: unknown, fallback = "—") => String(value || fallback);

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    const params = new URL(request.url).searchParams;
    const type = params.get("type") || "";
    const start = params.get("start");
    const end = params.get("end");

    if (!REPORT_TYPES.has(type) || !start || !end) {
      return NextResponse.json({ error: "Invalid report parameters" }, { status: 400 });
    }

    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T23:59:59.999Z`);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate > endDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    if (type === "acquisition-summary") {
      const [totals, statuses, counterparties] = await Promise.all([
        sql`SELECT COUNT(*) count, COALESCE(SUM(estimated_weight_kg), 0) weight,
                   COALESCE(SUM(total_estimated_value), 0) value
            FROM purchase_orders WHERE created_at BETWEEN ${startDate} AND ${endDate}`,
        sql`SELECT status, COUNT(*) count, COALESCE(SUM(estimated_weight_kg), 0) weight,
                   COALESCE(SUM(total_estimated_value), 0) value
            FROM purchase_orders WHERE created_at BETWEEN ${startDate} AND ${endDate}
            GROUP BY status ORDER BY count DESC`,
        sql`SELECT COALESCE(c.legal_name, 'Unknown') name, COUNT(*) count,
                   COALESCE(SUM(po.estimated_weight_kg), 0) weight,
                   COALESCE(SUM(po.total_estimated_value), 0) value
            FROM purchase_orders po LEFT JOIN counterparties c ON c.id = po.counterparty_id
            WHERE po.created_at BETWEEN ${startDate} AND ${endDate}
            GROUP BY c.legal_name ORDER BY value DESC LIMIT 10`,
      ]);
      return NextResponse.json({
        totalPurchaseOrders: number(totals[0]?.count), totalWeightKg: number(totals[0]?.weight),
        totalValue: number(totals[0]?.value), currency: "USD",
        byStatus: statuses.map(r => ({ status: text(r.status), count: number(r.count), weight: number(r.weight), value: number(r.value) })),
        byCounterparty: counterparties.map(r => ({ name: text(r.name), count: number(r.count), weight: number(r.weight), value: number(r.value) })),
      });
    }

    if (type === "counterparty-overview") {
      const [totals, risks, countries, recent] = await Promise.all([
        sql`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status IN ('active','approved')) active,
                   COUNT(*) FILTER (WHERE status NOT IN ('active','approved','rejected','blocked')) pending
            FROM counterparties WHERE created_at <= ${endDate}`,
        sql`SELECT COALESCE(risk_level, 'unassessed') tier, COUNT(*) count FROM counterparties
            WHERE created_at <= ${endDate} GROUP BY risk_level ORDER BY count DESC`,
        sql`SELECT COALESCE(country_of_incorporation, 'Unknown') country, COUNT(*) count FROM counterparties
            WHERE created_at <= ${endDate} GROUP BY country_of_incorporation ORDER BY count DESC LIMIT 8`,
        sql`SELECT legal_name name, country_of_incorporation country, status,
                   created_at::date::text date FROM counterparties
            WHERE created_at BETWEEN ${startDate} AND ${endDate} ORDER BY created_at DESC LIMIT 10`,
      ]);
      return NextResponse.json({
        totalCounterparties: number(totals[0]?.total), activeCounterparties: number(totals[0]?.active),
        pendingOnboarding: number(totals[0]?.pending),
        byRiskTier: risks.map(r => ({ tier: text(r.tier), count: number(r.count), color: riskColor(text(r.tier)) })),
        byCountry: countries.map(r => ({ country: text(r.country), count: number(r.count) })),
        recentOnboarded: recent.map(r => ({ name: text(r.name), country: text(r.country), status: text(r.status), date: text(r.date) })),
      });
    }

    if (type === "gold-inventory") {
      const rows = await sql`SELECT COALESCE(po.delivery_vault_id, 'Unassigned') vault,
                    COALESCE(po.gold_type, 'Unknown') source, COALESCE(a.net_weight_kg, a.gross_weight_kg, 0) weight,
                    COALESCE(a.purity_percentage, po.purity_factor, 0) purity,
                    COALESCE(po.total_estimated_value, 0) value
             FROM assays a JOIN purchase_orders po ON po.id = a.purchase_order_id
             WHERE a.assay_date BETWEEN ${startDate}::date AND ${endDate}::date
               AND a.status IN ('completed','approved','verified')`;
      const byVault = aggregate(rows, "vault");
      const bySource = aggregate(rows, "source").map(r => ({ source: r.label, weightKg: r.weightKg, value: r.value }));
      const purityGroups = new Map<string, number>();
      for (const row of rows) {
        const p = number(row.purity); const normalized = p <= 1 ? p * 100 : p;
        const label = normalized >= 99.99 ? "99.99%+" : normalized >= 99.95 ? "99.95–99.98%" : normalized >= 99.9 ? "99.90–99.94%" : "< 99.90%";
        purityGroups.set(label, (purityGroups.get(label) || 0) + number(row.weight));
      }
      const totalWeightKg = rows.reduce((sum, row) => sum + number(row.weight), 0);
      return NextResponse.json({ totalWeightKg, totalValue: rows.reduce((s, r) => s + number(r.value), 0), currency: "USD",
        byVault: byVault.map(r => ({ vault: r.label, weightKg: r.weightKg, value: r.value })), bySource,
        byPurity: [...purityGroups].map(([purity, weightKg]) => ({ purity, weightKg, percentage: totalWeightKg ? weightKg / totalWeightKg * 100 : 0 })) });
    }

    if (type === "settlement-report") {
      const rows = await sql`SELECT s.settlement_reference id, COALESCE(c.legal_name, 'Unknown') counterparty,
                    s.total_amount amount, s.status, s.initiated_at::date::text date, s.currency
             FROM settlements s LEFT JOIN counterparties c ON c.id = s.counterparty_id
             WHERE s.initiated_at BETWEEN ${startDate} AND ${endDate} ORDER BY s.initiated_at DESC`;
      const grouped = new Map<string, { count: number; amount: number }>();
      for (const r of rows) { const key = text(r.status); const old = grouped.get(key) || { count: 0, amount: 0 }; grouped.set(key, { count: old.count + 1, amount: old.amount + number(r.amount) }); }
      const paid = rows.filter(r => ['completed','paid','allocated'].includes(text(r.status).toLowerCase())).reduce((s,r) => s + number(r.amount), 0);
      return NextResponse.json({ totalSettlements: rows.length, totalPaid: paid,
        totalPending: rows.reduce((s,r) => s + number(r.amount), 0) - paid, currency: text(rows[0]?.currency, "USD"),
        byStatus: [...grouped].map(([status, v]) => ({ status, ...v })),
        recentSettlements: rows.slice(0, 12).map(r => ({ id: text(r.id), counterparty: text(r.counterparty), amount: number(r.amount), status: text(r.status), date: text(r.date) })) });
    }

    if (type === "compliance-audit") {
      const rows = await sql`SELECT c.legal_name counterparty, c.status,
                    COALESCE(MAX(sr.result) FILTER (WHERE LOWER(sr.check_type) LIKE '%sanction%'), 'N/A') sanctions,
                    CASE WHEN BOOL_OR(u.is_pep) THEN 'Hit' ELSE 'Clear' END pep,
                    COUNT(DISTINCT sr.id) screening_count
             FROM counterparties c LEFT JOIN screening_results sr ON sr.counterparty_id = c.id AND sr.checked_at BETWEEN ${startDate} AND ${endDate}
             LEFT JOIN ubos u ON u.counterparty_id = c.id GROUP BY c.id, c.legal_name, c.status HAVING COUNT(sr.id) > 0 ORDER BY c.legal_name`;
      const isHit = (v: unknown) => /hit|match|positive|blocked/i.test(text(v, ""));
      return NextResponse.json({ totalScreenings: rows.reduce((s,r) => s + number(r.screening_count), 0),
        sanctionsHits: rows.filter(r => isHit(r.sanctions)).length, pepHits: rows.filter(r => isHit(r.pep)).length,
        clearedCounterparties: rows.filter(r => !isHit(r.sanctions) && !isHit(r.pep)).length,
        pendingReview: rows.filter(r => /pending|review/i.test(text(r.status))).length,
        screeningResults: rows.slice(0, 12).map(r => ({ counterparty: text(r.counterparty), sanctions: text(r.sanctions), pep: text(r.pep), status: text(r.status) })) });
    }

    const rows = await sql`SELECT DISTINCT ON (ra.counterparty_id) c.legal_name counterparty, ra.risk_tier,
                  ra.edd_required, COALESCE(ra.edd_status, 'Pending') edd_status, ra.assessed_at::date::text assessed_date
           FROM risk_assessments ra LEFT JOIN counterparties c ON c.id = ra.counterparty_id
           WHERE ra.assessed_at BETWEEN ${startDate} AND ${endDate} ORDER BY ra.counterparty_id, ra.assessed_at DESC`;
    const bucket = (tier: unknown) => /critical|high|tier.?[34]/i.test(text(tier)) ? "high" : /medium|tier.?2/i.test(text(tier)) ? "medium" : "low";
    const counts = { high: 0, medium: 0, low: 0 }; rows.forEach(r => counts[bucket(r.risk_tier)]++);
    return NextResponse.json({ totalAssessed: rows.length, highRisk: counts.high, mediumRisk: counts.medium, lowRisk: counts.low,
      pendingEDD: rows.filter(r => r.edd_required && !/complete/i.test(text(r.edd_status))).length,
      riskDistribution: Object.entries(counts).map(([tier, count]) => ({ tier, count, percentage: rows.length ? count / rows.length * 100 : 0, color: tier === 'high' ? 'red' : tier === 'medium' ? 'yellow' : 'green' })),
      eddStatus: rows.filter(r => r.edd_required).slice(0, 12).map(r => ({ counterparty: text(r.counterparty), riskTier: text(r.risk_tier), eddStatus: text(r.edd_status), dueDate: text(r.assessed_date) })) });
  } catch (error) {
    console.error("Report data error:", error);
    return NextResponse.json({ error: "Unable to load report data" }, { status: 500 });
  }
}

function riskColor(tier: string) { return /critical|high|tier.?[34]/i.test(tier) ? "red" : /medium|tier.?2/i.test(tier) ? "orange" : "green"; }
function aggregate(rows: Record<string, unknown>[], key: string) {
  const result = new Map<string, { weightKg: number; value: number }>();
  for (const row of rows) { const label = text(row[key]); const old = result.get(label) || { weightKg: 0, value: 0 }; result.set(label, { weightKg: old.weightKg + number(row.weight), value: old.value + number(row.value) }); }
  return [...result].map(([label, values]) => ({ label, ...values })).sort((a,b) => b.weightKg - a.weightKg);
}
