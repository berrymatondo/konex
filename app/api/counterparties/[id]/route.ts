import { NextResponse } from "next/server";
import { sql, Counterparty, UBO, Document, ScreeningResult, ensureTablesExist } from "@/lib/db";
import { getSessionUser, isCounterpartyProfile } from "@/lib/session-user";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    const counterparties = await sql`
      SELECT * FROM counterparties WHERE id = ${id}
    ` as Counterparty[];

    if (counterparties.length === 0) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    const cp = counterparties[0];

    const ubos = await sql`
      SELECT * FROM ubos WHERE counterparty_id = ${id}
    ` as UBO[];

    const documents = await sql`
      SELECT id, counterparty_id, type, file_name, status, uploaded_at, verified_at
      FROM documents WHERE counterparty_id = ${id}
    ` as Document[];

    const screeningResults = await sql`
      SELECT * FROM screening_results WHERE counterparty_id = ${id}
    ` as ScreeningResult[];

    const counterparty = {
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
      screeningResults: screeningResults.map((s) => ({
        id: s.id,
        checkType: s.check_type,
        result: s.result,
        details: s.details,
        checkedAt: s.checked_at,
      })),
    };

    return NextResponse.json(counterparty);
  } catch (error) {
    console.error("Error fetching counterparty:", error);
    return NextResponse.json(
      { error: "Failed to fetch counterparty" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;
    const body = await request.json();

    // Check if this is a simple status update (approval/rejection)
    if (body.status && !body.legalName) {
      await sql`
        UPDATE counterparties SET
          status = ${body.status},
          updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true });
    }

    // Full update
    await sql`
      UPDATE counterparties SET
        legal_name = ${body.legalName},
        trading_name = ${body.tradingName || null},
        registration_number = ${body.registrationNumber || null},
        tax_id = ${body.taxId || null},
        legal_form = ${body.legalForm || null},
        country_of_incorporation = ${body.countryOfIncorporation},
        registered_address = ${body.registeredAddress || null},
        primary_contact = ${body.primaryContact || null},
        primary_email = ${body.primaryEmail || null},
        primary_phone = ${body.primaryPhone || null},
        gold_source_types = ${body.goldSourceTypes || []},
        status = ${body.status},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Update UBOs if provided
    if (body.ubos && Array.isArray(body.ubos)) {
      // Delete existing UBOs
      await sql`DELETE FROM ubos WHERE counterparty_id = ${id}`;
      
      // Insert new UBOs
      for (const ubo of body.ubos) {
        if (ubo.fullName && ubo.fullName.trim()) {
          const uboId = `ubo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await sql`
            INSERT INTO ubos (id, counterparty_id, full_name, nationality, ownership_percent, is_pep, pep_details)
            VALUES (
              ${uboId},
              ${id},
              ${ubo.fullName},
              ${ubo.nationality || null},
              ${ubo.ownershipPercent || 0},
              ${ubo.isPEP || false},
              ${ubo.pepDetails || null}
            )
          `;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating counterparty:", error);
    return NextResponse.json(
      { error: "Failed to update counterparty" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();

    // Counterparty-profile users have read-only access; they cannot delete.
    if (isCounterpartyProfile(await getSessionUser())) {
      return NextResponse.json(
        { error: "Forbidden: counterparty profiles cannot delete counterparties" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Delete related records first (handled by CASCADE, but being explicit)
    await sql`DELETE FROM screening_results WHERE counterparty_id = ${id}`;
    await sql`DELETE FROM documents WHERE counterparty_id = ${id}`;
    await sql`DELETE FROM ubos WHERE counterparty_id = ${id}`;
    await sql`DELETE FROM transactions WHERE counterparty_id = ${id}`;
    await sql`DELETE FROM counterparties WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting counterparty:", error);
    return NextResponse.json(
      { error: "Failed to delete counterparty" },
      { status: 500 }
    );
  }
}
