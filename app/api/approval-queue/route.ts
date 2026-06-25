import { NextResponse } from "next/server";
import { sql, Counterparty, UBO, ScreeningResult, Document, ensureTablesExist } from "@/lib/db";

export async function GET() {
  try {
    await ensureTablesExist();
    
    // Get counterparties pending review, screening, or blocked (Issue #5: blocked items should appear)
    const counterparties = await sql`
      SELECT * FROM counterparties 
      WHERE status IN ('pending_review', 'pending_screening', 'blocked', 'draft')
      ORDER BY created_at DESC
    ` as Counterparty[];

    const counterpartiesWithRelations = await Promise.all(
      counterparties.map(async (cp) => {
        const ubos = await sql`
          SELECT * FROM ubos WHERE counterparty_id = ${cp.id}
        ` as UBO[];

        const screeningResults = await sql`
          SELECT * FROM screening_results WHERE counterparty_id = ${cp.id}
        ` as ScreeningResult[];

        // Fetch documents for document count display
        const documents = await sql`
          SELECT * FROM documents WHERE counterparty_id = ${cp.id}
        ` as Document[];

        return {
          id: cp.id,
          legalName: cp.legal_name,
          tradingName: cp.trading_name,
          registrationNumber: cp.registration_number,
          countryOfIncorporation: cp.country_of_incorporation,
          goldSourceTypes: cp.gold_source_types || [],
          status: cp.status,
          preliminaryScore: cp.preliminary_score,
          createdAt: cp.created_at,
          ubos: ubos.map((u) => ({
            fullName: u.full_name,
            isPEP: u.is_pep,
          })),
          documents: documents.map((d) => ({
            id: d.id,
            type: d.type,
            fileName: d.file_name,
            status: d.status,
          })),
          screeningResults: screeningResults.map((s) => ({
            checkType: s.check_type,
            result: s.result,
          })),
        };
      })
    );

    return NextResponse.json(counterpartiesWithRelations);
  } catch (error) {
    console.error("Error fetching approval queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval queue" },
      { status: 500 }
    );
  }
}
