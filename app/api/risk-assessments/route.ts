import { NextResponse } from "next/server";
import { sql, ensureTablesExist, RiskAssessment } from "@/lib/db";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateRiskTier(score: number): string {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    
    const { searchParams } = new URL(request.url);
    const counterpartyId = searchParams.get("counterpartyId");
    
    let assessments;
    
    if (counterpartyId) {
      assessments = await sql`
        SELECT ra.*, c.legal_name as counterparty_name, c.country_of_incorporation
        FROM risk_assessments ra
        LEFT JOIN counterparties c ON ra.counterparty_id = c.id
        WHERE ra.counterparty_id = ${counterpartyId}
        ORDER BY ra.assessed_at DESC
      ` as (RiskAssessment & { counterparty_name: string; country_of_incorporation: string })[];
    } else {
      assessments = await sql`
        SELECT ra.*, c.legal_name as counterparty_name, c.country_of_incorporation
        FROM risk_assessments ra
        LEFT JOIN counterparties c ON ra.counterparty_id = c.id
        ORDER BY ra.assessed_at DESC
      ` as (RiskAssessment & { counterparty_name: string; country_of_incorporation: string })[];
    }

    return NextResponse.json(
      assessments.map((a) => ({
        id: a.id,
        counterpartyId: a.counterparty_id,
        counterpartyName: a.counterparty_name,
        countryOfIncorporation: a.country_of_incorporation,
        riskTier: a.risk_tier,
        overallScore: a.overall_score,
        countryRiskScore: a.country_risk_score,
        sourceRiskScore: a.source_risk_score,
        pepRiskScore: a.pep_risk_score,
        volumeRiskScore: a.volume_risk_score,
        eddRequired: a.edd_required,
        eddStatus: a.edd_status,
        policyAcknowledged: a.policy_acknowledged,
        policyAcknowledgedAt: a.policy_acknowledged_at,
        assessedBy: a.assessed_by,
        assessedAt: a.assessed_at,
        notes: a.notes,
      }))
    );
  } catch (error) {
    console.error("Error fetching risk assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk assessments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    
    const body = await request.json();
    const {
      counterpartyId,
      countryRiskScore,
      sourceRiskScore,
      pepRiskScore,
      volumeRiskScore,
      sourceType,
      isCAHRA,
      mercuryFlag,
      eddRequired: clientEddRequired,
      policyAcknowledged,
      notes,
    } = body;

    // Calculate overall score per US-02 algorithm:
    // Country Risk (30%), Source Type (25%), UBO/PEP (20%), Volume/History (15%), Feed Confidence (10%)
    let rawScore = 
      (countryRiskScore || 0) * 0.30 + 
      (sourceRiskScore || 0) * 0.25 + 
      (pepRiskScore || 0) * 0.20 + 
      (volumeRiskScore || 0) * 0.15 +
      50 * 0.10; // Feed confidence assumed 50%
    
    // Add bonuses per US-02 algorithm
    if (mercuryFlag) rawScore += 15;
    if (isCAHRA) rawScore += 20;
    
    const overallScore = Math.min(100, Math.round(rawScore));
    
    const riskTier = calculateRiskTier(overallScore);
    // EDD required for HIGH/CRITICAL or ASM/Mercury exposure per US-02
    const eddRequired = riskTier === "high" || riskTier === "critical" || mercuryFlag || clientEddRequired;

    const assessmentId = generateId("ra");

    await sql`
      INSERT INTO risk_assessments (
        id, counterparty_id, risk_tier, overall_score,
        country_risk_score, source_risk_score, pep_risk_score, volume_risk_score,
        edd_required, edd_status, policy_acknowledged, policy_acknowledged_at, assessed_by, notes
      ) VALUES (
        ${assessmentId}, ${counterpartyId}, ${riskTier}, ${overallScore},
        ${countryRiskScore || null}, ${sourceRiskScore || null}, ${pepRiskScore || null}, ${volumeRiskScore || null},
        ${eddRequired}, ${eddRequired ? 'pending' : null}, ${policyAcknowledged || false}, ${policyAcknowledged ? new Date().toISOString() : null}, ${'compliance_officer'}, ${notes || null}
      )
    `;

    // Update counterparty risk level
    await sql`
      UPDATE counterparties SET risk_level = ${riskTier} WHERE id = ${counterpartyId}
    `;

    // Build audit reason with flags
    let auditReason = notes || 'Risk assessment created';
    if (mercuryFlag) auditReason += ' [ASM/Mercury Flag]';
    if (isCAHRA) auditReason += ' [CAHRA Zone]';
    if (eddRequired) auditReason += ' [EDD Required]';

    // Add audit log entry
    await sql`
      INSERT INTO risk_audit_log (id, counterparty_id, action, new_tier, reason, performed_by)
      VALUES (${generateId("ral")}, ${counterpartyId}, 'assessment_created', ${riskTier}, ${auditReason}, ${'compliance_officer'})
    `;

    return NextResponse.json({ 
      id: assessmentId, 
      riskTier, 
      overallScore,
      eddRequired 
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating risk assessment:", error);
    return NextResponse.json(
      { error: "Failed to create risk assessment" },
      { status: 500 }
    );
  }
}
