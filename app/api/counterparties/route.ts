import { NextResponse } from "next/server";
import { sql, Counterparty, UBO, Document, ensureTablesExist } from "@/lib/db";
import { getSessionUser, getCounterpartyScope, isCounterpartyProfile } from "@/lib/session-user";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function GET() {
  try {
    await ensureTablesExist();

    // Counterparty-profile users only see their own associated counterparty.
    const scope = getCounterpartyScope(await getSessionUser());
    if (scope === null) {
      return NextResponse.json([]);
    }

    const counterparties = (scope === undefined
      ? await sql`SELECT * FROM counterparties ORDER BY created_at DESC`
      : await sql`SELECT * FROM counterparties WHERE id = ${scope} ORDER BY created_at DESC`) as Counterparty[];

    // Fetch related data for each counterparty
    const counterpartiesWithRelations = await Promise.all(
      counterparties.map(async (cp) => {
        const ubos = await sql`
          SELECT * FROM ubos WHERE counterparty_id = ${cp.id}
        ` as UBO[];
        
        const documents = await sql`
          SELECT id, counterparty_id, type, file_name, status, uploaded_at, verified_at
          FROM documents WHERE counterparty_id = ${cp.id}
        ` as Document[];

        return {
          id: cp.id,
          legalName: cp.legal_name,
          tradingName: cp.trading_name,
          registrationNumber: cp.registration_number,
          taxId: cp.tax_id,
          legalForm: cp.legal_form,
          countryOfIncorporation: cp.country_of_incorporation,
          registeredAddress: cp.registered_address,
          primaryContact: cp.primary_contact,
          primaryEmail: cp.primary_email,
          primaryPhone: cp.primary_phone,
          goldSourceTypes: cp.gold_source_types || [],
          status: cp.status,
          preliminaryScore: cp.preliminary_score,
          screeningDate: cp.screening_date,
          createdAt: cp.created_at,
          updatedAt: cp.updated_at,
          ubos: ubos.map((u) => ({
            id: u.id,
            fullName: u.full_name,
            nationality: u.nationality,
            ownershipPercent: u.ownership_percent,
            isPEP: u.is_pep,
            pepDetails: u.pep_details,
          })),
          documents: documents.map((d: Document) => ({
            id: d.id,
            type: d.type,
            fileName: d.file_name,
            fileUrl: `/api/documents/${d.id}`,
            status: d.status,
            uploadedAt: d.uploaded_at,
          })),
        };
      })
    );

    return NextResponse.json(counterpartiesWithRelations);
  } catch (error) {
    console.error("Error fetching counterparties:", error);
    return NextResponse.json(
      { error: "Failed to fetch counterparties" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();

    // Counterparty-profile users have read-only access; they cannot create.
    if (isCounterpartyProfile(await getSessionUser())) {
      return NextResponse.json(
        { error: "Forbidden: counterparty profiles cannot create counterparties" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = generateId("cp");

    await sql`
      INSERT INTO counterparties (
        id, legal_name, trading_name, registration_number, tax_id,
        legal_form, country_of_incorporation, registered_address,
        primary_contact, primary_email, primary_phone,
        gold_source_types, status, preliminary_score
      ) VALUES (
        ${id}, ${body.legalName}, ${body.tradingName || null}, 
        ${body.registrationNumber || null}, ${body.taxId || null},
        ${body.legalForm || null}, ${body.countryOfIncorporation},
        ${body.registeredAddress || null}, ${body.primaryContact || null},
        ${body.primaryEmail || null}, ${body.primaryPhone || null},
        ${body.goldSourceTypes || []}, ${body.status || "draft"},
        ${Math.floor(Math.random() * 40) + 60}
      )
    `;

    // Insert UBOs if provided
    if (body.ubos && body.ubos.length > 0) {
      for (const ubo of body.ubos) {
        const uboId = generateId("ubo");
        await sql`
          INSERT INTO ubos (id, counterparty_id, full_name, nationality, ownership_percent, is_pep, pep_details)
          VALUES (${uboId}, ${id}, ${ubo.fullName}, ${ubo.nationality || null}, 
                  ${ubo.ownershipPercent || null}, ${ubo.isPEP || false}, ${ubo.pepDetails || null})
        `;
      }
    }

    // Insert documents if provided
    if (body.documents && body.documents.length > 0) {
      for (const doc of body.documents) {
        const docId = generateId("doc");
        await sql`
          INSERT INTO documents (id, counterparty_id, type, file_name, status)
          VALUES (${docId}, ${id}, ${doc.type}, ${doc.fileName}, 'pending')
        `;
      }
    }

    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (error) {
    console.error("Error creating counterparty:", error);
    return NextResponse.json(
      { error: "Failed to create counterparty" },
      { status: 500 }
    );
  }
}
