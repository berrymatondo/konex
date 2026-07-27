// Manual verification script: drives the real US-05 vault-intake API against a
// real, currently-in-system purchase order (GAC-TRK-MRQK0ZXU) through all 5 steps.
// Not part of the repo's own e2e suite — ad hoc verification for this session.
//
// Run: node --env-file=.env tests/e2e/tmp-vault-intake-real-test.mjs
// TEMPORARY — deleted after this verification run, not part of the repo's test suite.

import {
  BASE_URL,
  createUser,
  sql,
  section,
  assert,
  assertEqual,
  info,
  summary,
} from "./lib/harness.mjs";

const PO_ID = "po-1784376674644-496014ef"; // GAC-TRK-MRQK0ZXU — manifest_validated, 4 real bars

async function main() {
  console.log(`\nRunning vault-intake real-data verification against ${BASE_URL}`);
  console.log(`Target PO: ${PO_ID} (GAC-TRK-MRQK0ZXU)`);

  const before = await sql`SELECT id, status FROM purchase_orders WHERE id = ${PO_ID}`;
  info(`PO status before test: ${before[0]?.status}`);

  let admin;
  try {
    // -----------------------------------------------------------------------
    section("Setup: authenticated admin (only role with /vault-intake page access)");
    // -----------------------------------------------------------------------
    admin = await createUser({ role: "admin", name: "E2E Vault Test Admin" });
    assert(admin.client.hasSession(), "admin signed in");

    // -----------------------------------------------------------------------
    section("Step 0: GET /api/vault-intake/[id] — real manifest surfaces correctly");
    // -----------------------------------------------------------------------
    const initial = await admin.client.get(`/api/vault-intake/${PO_ID}`);
    assertEqual(initial.status, 200, "GET vault-intake detail succeeds");
    const m = initial.json?.manifest;
    assert(Boolean(m), "manifest block is present in the response");
    assertEqual(m?.sealPrimaryDeclared, "TE-4450-C", "manifest.sealPrimaryDeclared matches counterparty_manifests.seal_number");
    assertEqual(m?.sealSecondaryDeclared, null, "manifest.sealSecondaryDeclared is null (no secondary seal was declared)");
    assertEqual(m?.totalBars, 4, "manifest.totalBars = 4");
    assertEqual(m?.carrier, "Malca-Amit", "manifest.carrier = Malca-Amit");
    assert(Array.isArray(m?.bars) && m.bars.length === 4, "manifest.bars has 4 entries", m?.bars);
    assertEqual(m?.bars?.[0]?.barNumber, "BAR-001", "first bar serial is BAR-001");
    assertEqual(m?.bars?.[0]?.grossWeightKg, 4, "first bar declared gross weight is 4kg");
    assertEqual(m?.bars?.[0]?.fineness, 999.1, "first bar declared fineness is 999.1‰");
    assert(Math.abs((m?.poFineOz ?? 0) - 506.615) < 0.001, "manifest.poFineOz = 506.615", m?.poFineOz);
    assertEqual(initial.json?.reception, null, "no prior reception record exists yet for this PO");

    // -----------------------------------------------------------------------
    section("Step 1: POST full 5-section reception payload (mirrors buildReceptionPayload())");
    // -----------------------------------------------------------------------
    const barRecords = m.bars.map((b, i) => ({
      serial: b.barNumber,
      manifestWeightG: b.grossWeightKg * 1000,
      vaultGrossWeightG: String(b.grossWeightKg * 1000 - (i === 1 ? 8 : 0)), // BAR-002 gets a small -8g variance
      manifestFineness: b.fineness,
      vaultFineness: String(b.fineness - (i === 2 ? 0.05 : 0)), // BAR-003 gets a tiny within-tolerance diff
    }));
    const totalVaultFineG = barRecords.reduce((s, b) => {
      const g = parseFloat(b.vaultGrossWeightG), f = parseFloat(b.vaultFineness);
      return s + Math.floor(((g * f) / 1000) * 1000) / 1000;
    }, 0);
    const poFineWeightG = m.poFineOz * 31.1035;

    const payload = {
      poId: PO_ID,
      selectedPoId: PO_ID,
      poReference: "GAC-TRK-MRQK0ZXU",
      trackingId: "GAC-TRK-MRQK0ZXU",
      counterpartyName: "Test counterparty (real data run)",
      seal1: m.sealPrimaryDeclared, // physical matches declared -> verified
      seal2: "", // no secondary declared
      sealVerified: true,
      manifestMatch: true,
      grossWeightKg: 15.8,
      netWeightKg: 15.75,
      vaultLocation: "LON-VLT-07B",
      operatorId: "vault_operator",
      otpCode: "482913",
      photoEvidence: [],
      arrivalDate: "2026-07-26",
      arrivalTime: "09:15",
      receivedBy: "E2E Vault Test Admin",
      carrierName: m.carrier,
      carrierRepPresent: "K. Mbala",
      conditionOnArrival: "good",
      barCountExpected: m.totalBars,
      barCountReceived: m.totalBars,
      sealVerifications: [
        { role: "primary", declared: m.sealPrimaryDeclared, physical: m.sealPrimaryDeclared, condition: "intact", match: true },
        { role: "secondary", declared: "", physical: "", condition: null, match: null },
      ],
      witnessName: "M. Kalonji",
      holdingBay: "HB-02",
      containerOpened: true,
      barsTransferred: true,
      scaleId: "VLT-SCALE-01",
      weighingScheduledAt: "2026-07-26T10:00",
      labId: "lab_a",
      assayMethod: "fire_assay",
      accreditationNumber: "ACC-2025-0012",
      expectedResultsAt: "2026-07-27T10:00",
      sampleId: `SAMP-${PO_ID}-2026`,
      barRecords,
      pureGoldWeight: totalVaultFineG,
      poEstimate: poFineWeightG,
      validationStatus: "passed",
      certificatePathname: null,
      certificateFileName: null,
      declarationMeasurements: true,
      declarationAssay: true,
      declarationCompliance: true,
    };

    const postRes = await admin.client.post("/api/vault-intake", payload);
    assertEqual(postRes.status, 201, "POST /api/vault-intake succeeds (201)", postRes.text);

    // -----------------------------------------------------------------------
    section("Step 2: GET again — every new field round-trips (no silent data loss)");
    // -----------------------------------------------------------------------
    const after = await admin.client.get(`/api/vault-intake/${PO_ID}`);
    const r = after.json?.reception;
    assert(Boolean(r), "reception record now exists");
    assertEqual(r?.arrivalDate, "2026-07-26", "arrivalDate persisted");
    assertEqual(r?.arrivalTime, "09:15", "arrivalTime persisted");
    assertEqual(r?.carrierRepPresent, "K. Mbala", "carrierRepPresent persisted (previously silently dropped)");
    assertEqual(r?.conditionOnArrival, "good", "conditionOnArrival persisted");
    assertEqual(r?.barCountExpected, 4, "barCountExpected persisted");
    assertEqual(r?.barCountReceived, 4, "barCountReceived persisted");
    assert(Array.isArray(r?.sealVerifications) && r.sealVerifications.length === 2, "sealVerifications (2 seals) persisted", r?.sealVerifications);
    assertEqual(r?.sealVerifications?.[0]?.declared, "TE-4450-C", "primary seal declared value round-trips inside sealVerifications");
    assertEqual(r?.witnessName, "M. Kalonji", "witnessName persisted (previously silently dropped)");
    assertEqual(r?.holdingBay, "HB-02", "holdingBay persisted (previously silently dropped)");
    assertEqual(r?.containerOpened, true, "containerOpened persisted (previously silently dropped)");
    assertEqual(r?.barsTransferred, true, "barsTransferred persisted (previously silently dropped)");
    assertEqual(r?.scaleId, "VLT-SCALE-01", "scaleId persisted (previously silently dropped)");
    assertEqual(r?.weighingScheduledAt, "2026-07-26T10:00", "weighingScheduledAt persisted (previously silently dropped)");
    assertEqual(r?.accreditationNumber, "ACC-2025-0012", "accreditationNumber persisted (previously silently dropped)");
    assertEqual(r?.expectedResultsAt, "2026-07-27T10:00", "expectedResultsAt persisted (previously silently dropped)");
    assert(Array.isArray(r?.barRecords) && r.barRecords.length === 4, "barRecords (4 bars) persisted (previously silently dropped)", r?.barRecords);
    assertEqual(r?.barRecords?.[0]?.serial, "BAR-001", "bar 1 serial round-trips");
    assertEqual(r?.barRecords?.[1]?.vaultGrossWeightG, "3992", "bar 2 vault weight (with induced variance) round-trips");
    assert(Math.abs((r?.pureGoldWeight ?? 0) - totalVaultFineG) < 0.01, "pureGoldWeight (computed fine weight total) persisted", r?.pureGoldWeight);
    assert(Math.abs((r?.poEstimate ?? 0) - poFineWeightG) < 0.5, "poEstimate (manifest PO fine weight in g) persisted", r?.poEstimate);
    assertEqual(r?.validationStatus, "passed", "validationStatus persisted");
    assertEqual(r?.declarationMeasurements, true, "declarationMeasurements persisted (previously silently dropped)");
    assertEqual(r?.declarationAssay, true, "declarationAssay persisted (previously silently dropped)");
    assertEqual(r?.declarationCompliance, true, "declarationCompliance persisted (previously silently dropped)");

    // -----------------------------------------------------------------------
    section("Step 3: side effects — PO status + audit log");
    // -----------------------------------------------------------------------
    const poAfter = await sql`SELECT status FROM purchase_orders WHERE id = ${PO_ID}`;
    assertEqual(poAfter[0]?.status, "delivered", "purchase_order.status transitioned to 'delivered'");
    const auditRows = await sql`
      SELECT action, previous_status, new_status, performed_by FROM audit_log
      WHERE entity_id = ${PO_ID} AND action = 'vault_received'
      ORDER BY performed_at DESC LIMIT 1
    `;
    assert(auditRows.length === 1, "audit_log has a 'vault_received' entry", auditRows[0]);

    // -----------------------------------------------------------------------
    section("Step 4: list endpoint reflects the reception");
    // -----------------------------------------------------------------------
    const listRes = await admin.client.get("/api/vault-intake");
    const listed = (listRes.json ?? []).find((i) => i.id === PO_ID);
    assert(Boolean(listed), "PO now appears in GET /api/vault-intake list", listRes.status);

    // -----------------------------------------------------------------------
    section("Step 5: settlement handoff (Section 5 lock)");
    // -----------------------------------------------------------------------
    const settleRes = await admin.client.post("/api/settlements", {
      purchaseOrderId: PO_ID,
      counterpartyId: null,
      fineGoldWeightKg: totalVaultFineG / 1000,
      settlementPricePerOz: 2650,
      currency: "USD",
      paymentMethod: "wire_transfer",
      notes: "E2E real-data verification run",
    });
    assert(settleRes.status === 201 || settleRes.status === 200, "POST /api/settlements succeeds", `${settleRes.status} ${settleRes.text}`);

    const putRes = await admin.client.put(`/api/purchase-orders/${PO_ID}`, { status: "pending_settlement" });
    assert(putRes.ok, "PO status updated to pending_settlement", putRes.status);
    const poFinal = await sql`SELECT status FROM purchase_orders WHERE id = ${PO_ID}`;
    assertEqual(poFinal[0]?.status, "pending_settlement", "purchase_order.status = pending_settlement after handoff");
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
  } finally {
    section("Cleanup: remove only the test admin user (real PO/reception data is left as-is for inspection)");
    if (admin?.userId) {
      await sql`DELETE FROM account WHERE "userId" = ${admin.userId}`;
      await sql`DELETE FROM session WHERE "userId" = ${admin.userId}`;
      await sql`DELETE FROM "user" WHERE id = ${admin.userId}`;
      info(`removed test admin user ${admin.email}`);
    }
  }

  process.exit(summary());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
