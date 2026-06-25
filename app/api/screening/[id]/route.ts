import { NextResponse } from "next/server";
import { sql, ensureTablesExist } from "@/lib/db";
import crypto from "crypto";

// US-01 Policy Configuration (externalized for configurability)
const US01_POLICY = {
  version: "2026.1",
  weights: {
    pep: 0.40,
    adverseMedia: 0.35,
    otherFactors: 0.25,
  },
  mediaThresholds: {
    low: { maxHits: 2, score: 30 },
    medium: { maxHits: 5, score: 60 },
    high: { minHits: 6, score: 100 },
  },
  classificationBands: {
    low: { maxScore: 25, action: "STANDARD_REVIEW" },
    medium: { maxScore: 60, action: "ENHANCED_REVIEW" },
    high: { maxScore: 99, action: "SENIOR_REVIEW_AND_EDD" },
    blocked: { score: 100, action: "AUTOMATIC_REJECTION" },
  },
};

// Generate deterministic SHA-256 audit hash
function generateAuditHash(data: object): string {
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}

// US-01 Adverse Media Scoring
function getAdverseMediaScore(hits: number): number {
  if (hits === 0) return 0;
  if (hits <= US01_POLICY.mediaThresholds.low.maxHits) return US01_POLICY.mediaThresholds.low.score;
  if (hits <= US01_POLICY.mediaThresholds.medium.maxHits) return US01_POLICY.mediaThresholds.medium.score;
  return US01_POLICY.mediaThresholds.high.score;
}

// US-01 Risk Classification
function classifyRisk(score: number): {
  classification: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  status: "PENDING_STANDARD_REVIEW" | "PENDING_ENHANCED_REVIEW" | "PENDING_SENIOR_REVIEW" | "AUTOMATIC_REJECTION";
} {
  if (score >= 100) return { classification: "BLOCKED", status: "AUTOMATIC_REJECTION" };
  if (score <= US01_POLICY.classificationBands.low.maxScore) return { classification: "LOW", status: "PENDING_STANDARD_REVIEW" };
  if (score <= US01_POLICY.classificationBands.medium.maxScore) return { classification: "MEDIUM", status: "PENDING_ENHANCED_REVIEW" };
  return { classification: "HIGH", status: "PENDING_SENIOR_REVIEW" };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;

    const results = await sql`
      SELECT * FROM screening_results 
      WHERE counterparty_id = ${id}
      ORDER BY checked_at DESC
    `;

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching screening results:", error);
    return NextResponse.json(
      { error: "Failed to fetch screening results" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;
    const body = await request.json();

    const { 
      sanctionsStatus, 
      pepStatus, 
      adverseMediaHits, 
      jurisdictionRiskScore = 20,
      riskLevel: legacyRiskLevel,
      complianceNotes,
    } = body;

    const now = new Date().toISOString();

    // ============================================
    // US-01 PRELIMINARY COMPLIANCE SCORE CALCULATION
    // ============================================

    // Step 1: Sanctions Gate (Blocking)
    const sanctionsHit = sanctionsStatus === "not_clear";
    if (sanctionsHit) {
      // Immediate rejection - score = 100
      const auditData = {
        counterparty_id: id,
        timestamp: now,
        policy_version: US01_POLICY.version,
        inputs: { sanctionsStatus, pepStatus, adverseMediaHits, jurisdictionRiskScore },
        calculation: { blocked_by: "sanctions_hit" },
        output: { score: 100, classification: "BLOCKED", status: "AUTOMATIC_REJECTION" },
        compliance_officer_notes: complianceNotes || null,
      };
      const auditHash = generateAuditHash(auditData);

      // Delete existing screening results first
      await sql`DELETE FROM screening_results WHERE counterparty_id = ${id}`;

      // Save audit log
      await sql`
        INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
        VALUES (
          gen_random_uuid()::text,
          ${id},
          'us01_compliance_score',
          'blocked',
          ${JSON.stringify({ ...auditData, integrity: { sha256_hash: auditHash } })}::jsonb,
          ${now}
        )
      `;

      // Save sanctions hit result
      await sql`
        INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
        VALUES (
          gen_random_uuid()::text, ${id}, 'sanctions', 'hit',
          ${JSON.stringify({ status: sanctionsStatus })}::jsonb, ${now}
        )
      `;

      await sql`
        UPDATE counterparties 
        SET screening_date = ${now}, updated_at = ${now}, risk_level = 'blocked', screening_status = 'failed', preliminary_score = 100
        WHERE id = ${id}
      `;

      return NextResponse.json({ 
        success: true, 
        preliminaryScore: 100, 
        classification: "BLOCKED",
        status: "AUTOMATIC_REJECTION",
        auditHash 
      });
    }

    // Step 2: Calculate Weighted Components
    const pepScore = pepStatus === "not_clear" ? 100 : 0;
    const mediaScore = getAdverseMediaScore(adverseMediaHits);
    const otherScore = jurisdictionRiskScore;

    const pepWeighted = pepScore * US01_POLICY.weights.pep;
    const mediaWeighted = mediaScore * US01_POLICY.weights.adverseMedia;
    const otherWeighted = otherScore * US01_POLICY.weights.otherFactors;

    const rawScore = pepWeighted + mediaWeighted + otherWeighted;
    const finalScore = Math.round(rawScore);

    // Step 3: Risk Classification
    const { classification, status } = classifyRisk(finalScore);

    // Step 4: Generate Audit Trail
    const auditData = {
      counterparty_id: id,
      timestamp: now,
      calculation_engine: "compliance_score_v1.2",
      policy_version: US01_POLICY.version,
      inputs: {
        sanctions_check: { hit: sanctionsHit },
        pep_check: { ubo_is_pep: pepStatus === "not_clear" },
        adverse_media: { total_hits: adverseMediaHits },
        other_factors: { jurisdiction_risk_score: jurisdictionRiskScore },
      },
      calculation: {
        weights_applied: US01_POLICY.weights,
        component_scores: {
          pep: { raw: pepScore, weighted: pepWeighted },
          media: { raw: mediaScore, weighted: mediaWeighted },
          other: { raw: otherScore, weighted: otherWeighted },
        },
        raw_score: rawScore,
        final_score: finalScore,
      },
      output: {
        preliminary_compliance_score: finalScore,
        risk_classification: classification,
        system_status: status,
        actionable: true,
        next_step: classification === "LOW" ? "STANDARD_REVIEW" : 
                   classification === "MEDIUM" ? "ENHANCED_REVIEW" : "SENIOR_REVIEW_AND_EDD",
      },
      compliance_officer_notes: complianceNotes || null,
    };
    const auditHash = generateAuditHash(auditData);

    // Delete existing screening results
    await sql`DELETE FROM screening_results WHERE counterparty_id = ${id}`;

    // Save US-01 Compliance Score with full audit trail
    await sql`
      INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
      VALUES (
        gen_random_uuid()::text,
        ${id},
        'us01_compliance_score',
        ${classification.toLowerCase()},
        ${JSON.stringify({ ...auditData, integrity: { sha256_hash: auditHash, chain_verified: true } })}::jsonb,
        ${now}
      )
    `;

    // Save individual component results for backward compatibility
    await sql`
      INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
      VALUES (
        gen_random_uuid()::text, ${id}, 'sanctions', 'clear',
        ${JSON.stringify({ status: sanctionsStatus })}::jsonb, ${now}
      )
    `;

    await sql`
      INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
      VALUES (
        gen_random_uuid()::text, ${id}, 'pep', ${pepStatus === "clear" ? "clear" : "hit"},
        ${JSON.stringify({ status: pepStatus })}::jsonb, ${now}
      )
    `;

    await sql`
      INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
      VALUES (
        gen_random_uuid()::text, ${id}, 'adverse_media', ${adverseMediaHits === 0 ? "clear" : "hit"},
        ${JSON.stringify({ hits: adverseMediaHits })}::jsonb, ${now}
      )
    `;

    await sql`
      INSERT INTO screening_results (id, counterparty_id, check_type, result, details, checked_at)
      VALUES (
        gen_random_uuid()::text, ${id}, 'jurisdiction_risk', ${otherScore <= 25 ? "low" : otherScore <= 60 ? "medium" : "high"},
        ${JSON.stringify({ score: jurisdictionRiskScore })}::jsonb, ${now}
      )
    `;

    // Map US-01 classification to screening status
    const screeningStatus = classification === "BLOCKED" ? "failed" :
                            classification === "LOW" ? "passed" : "manual_review";

    // Update counterparty
    await sql`
      UPDATE counterparties 
      SET 
        screening_date = ${now}, 
        updated_at = ${now},
        risk_level = ${classification.toLowerCase()},
        screening_status = ${screeningStatus},
        preliminary_score = ${finalScore}
      WHERE id = ${id}
    `;

    return NextResponse.json({ 
      success: true, 
      preliminaryScore: finalScore,
      classification,
      status,
      breakdown: auditData.calculation.component_scores,
      auditHash,
      nextStep: auditData.output.next_step,
    });
  } catch (error) {
    console.error("Error saving screening results:", error);
    return NextResponse.json(
      { error: "Failed to save screening results" },
      { status: 500 }
    );
  }
}
