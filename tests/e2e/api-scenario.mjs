// End-to-end API scenario: "From counterparty onboarding to purchase order send".
//
// Exercises every role and the permission rules across the real /api routes:
//   admin, compliance_officer, risk_manager, counterparty.
//
// Run:  node --env-file=.env.development.local tests/e2e/api-scenario.mjs
// Requires the dev server running on E2E_BASE_URL (default http://localhost:3000).

import {
  BASE_URL,
  E2E_TAG,
  createUser,
  cleanup,
  completeCounterpartyPayload,
  purchaseOrderPayload,
  section,
  assert,
  assertEqual,
  fail,
  info,
  summary,
} from "./lib/harness.mjs";

async function main() {
  console.log(`\nRunning API scenario against ${BASE_URL}`);

  // Start from a clean slate in case a previous run was interrupted.
  await cleanup();

  let admin, compliance, risk, counterparty;
  let cpId, draftCpId, poDraftId, poSubmittedId;

  try {
    // -------------------------------------------------------------------
    section("Setup: create one authenticated user per role");
    // -------------------------------------------------------------------
    admin = await createUser({ role: "admin" });
    compliance = await createUser({ role: "compliance_officer" });
    risk = await createUser({ role: "risk_manager" });
    assert(admin.client.hasSession(), "admin signed in");
    assert(compliance.client.hasSession(), "compliance_officer signed in");
    assert(risk.client.hasSession(), "risk_manager signed in");

    // Verify each session resolves to the expected role via /api/access/me.
    const adminMe = await admin.client.get("/api/access/me");
    const compMe = await compliance.client.get("/api/access/me");
    const riskMe = await risk.client.get("/api/access/me");
    assertEqual(adminMe.json?.role, "admin", "access/me reports admin role");
    assertEqual(compMe.json?.role, "compliance_officer", "access/me reports compliance_officer role");
    assertEqual(riskMe.json?.role, "risk_manager", "access/me reports risk_manager role");
    assertEqual(adminMe.json?.isAdmin, true, "admin flagged as isAdmin");

    // -------------------------------------------------------------------
    section("Step 1: Compliance officer saves an incomplete DRAFT counterparty");
    // -------------------------------------------------------------------
    const draftPayload = completeCounterpartyPayload({
      // Intentionally incomplete: only the legal name + country, status draft.
      tradingName: undefined,
      registrationNumber: undefined,
      registeredAddress: undefined,
      primaryContact: undefined,
      primaryEmail: undefined,
      primaryPhone: undefined,
      ubos: [],
      status: "draft",
      legalName: `${E2E_TAG} Draft CP ${Date.now()}`,
    });
    const draftRes = await compliance.client.post("/api/counterparties", draftPayload);
    assertEqual(draftRes.status, 201, "incomplete draft counterparty is accepted (201)");
    draftCpId = draftRes.json?.id;
    assert(Boolean(draftCpId), "draft counterparty returned an id");

    // -------------------------------------------------------------------
    section("Step 2: Compliance officer completes & submits a counterparty for review");
    // -------------------------------------------------------------------
    const fullPayload = completeCounterpartyPayload();
    const createRes = await compliance.client.post("/api/counterparties", fullPayload);
    assertEqual(createRes.status, 201, "complete counterparty created (201)");
    cpId = createRes.json?.id;
    assert(Boolean(cpId), "counterparty returned an id");

    // Submit for review = status transition (round-trip persisted).
    const submitRes = await compliance.client.put(`/api/counterparties/${cpId}`, {
      status: "screening",
    });
    assert(submitRes.ok, "counterparty submit-for-review status update succeeds");
    const afterSubmit = await compliance.client.get(`/api/counterparties/${cpId}`);
    assertEqual(afterSubmit.json?.status, "screening", "counterparty status persisted as 'screening'");

    // -------------------------------------------------------------------
    section("Step 3: Risk manager assesses pending requests (incomplete CP too)");
    // -------------------------------------------------------------------
    // Decoupling fix: an assessment can be saved even for an incomplete record.
    const assessIncomplete = await risk.client.post("/api/risk-assessments", {
      counterpartyId: draftCpId,
      countryRiskScore: 50,
      sourceRiskScore: 40,
      pepRiskScore: 30,
      volumeRiskScore: 25,
      sourceType: "LSM",
      isCAHRA: false,
      mercuryFlag: false,
      eddRequired: false,
      policyAcknowledged: true,
      notes: `${E2E_TAG} assessment (incomplete CP)`,
    });
    assertEqual(assessIncomplete.status, 201, "risk assessment saved for INCOMPLETE counterparty (201)");

    const assessComplete = await risk.client.post("/api/risk-assessments", {
      counterpartyId: cpId,
      countryRiskScore: 50,
      sourceRiskScore: 50,
      pepRiskScore: 30,
      volumeRiskScore: 37,
      sourceType: "LSM",
      isCAHRA: false,
      mercuryFlag: false,
      eddRequired: false,
      policyAcknowledged: true,
      notes: `${E2E_TAG} assessment (complete CP)`,
    });
    assertEqual(assessComplete.status, 201, "risk assessment saved for complete counterparty (201)");
    info(`computed tier: ${assessComplete.json?.riskTier ?? "n/a"}, score: ${assessComplete.json?.overallScore ?? "n/a"}`);

    // Activate the (complete) counterparty so it can trade.
    await compliance.client.put(`/api/counterparties/${cpId}`, { status: "active" });
    const activated = await compliance.client.get(`/api/counterparties/${cpId}`);
    assertEqual(activated.json?.status, "active", "counterparty activated");

    // The assessment is retrievable for the counterparty.
    const assessList = await risk.client.get(`/api/risk-assessments?counterpartyId=${cpId}`);
    assert(Array.isArray(assessList.json) && assessList.json.length >= 1, "assessment retrievable via GET");

    // -------------------------------------------------------------------
    section("Step 4: Agent (admin privilege) saves a DRAFT purchase order");
    // -------------------------------------------------------------------
    // Draft-save fix: only a counterparty is required, other fields nullable.
    const poDraft = await admin.client.post("/api/purchase-orders", {
      counterpartyId: cpId,
      status: "draft",
      premiumDiscount: 0,
      logisticsCost: 2500,
      currency: "USD",
      notes: `${E2E_TAG} draft PO`,
    });
    assertEqual(poDraft.status, 201, "incomplete PO saved as draft (201)");
    poDraftId = poDraft.json?.id;
    assert(Boolean(poDraftId), "draft PO returned an id");

    // -------------------------------------------------------------------
    section("Step 5: Agent submits a complete purchase order for approval");
    // -------------------------------------------------------------------
    const poSubmit = await admin.client.post("/api/purchase-orders", purchaseOrderPayload(cpId));
    assertEqual(poSubmit.status, 201, "complete PO submitted for approval (201)");
    poSubmittedId = poSubmit.json?.id;
    assert(Boolean(poSubmittedId), "submitted PO returned an id");

    // -------------------------------------------------------------------
    section("Step 6: Send the purchase order PDF by email");
    // -------------------------------------------------------------------
    const sendRes = await admin.client.post(`/api/purchase-orders/${poSubmittedId}/send`, {});
    // 200 = email accepted by Resend; 502 = Resend rejected the test recipient.
    // Both prove the endpoint resolved a recipient and built the PDF. A 400
    // (no recipient) or 500 would be a genuine regression.
    assert(
      sendRes.status === 200 || sendRes.status === 502,
      "send endpoint resolved a recipient and attempted delivery (200 or 502)",
      `status ${sendRes.status}: ${sendRes.text}`,
    );
    if (sendRes.status === 200) {
      info(`PDF emailed to ${sendRes.json?.email}`);
      assert(Boolean(sendRes.json?.email), "send response includes recipient email");
    } else {
      info(`Resend rejected the test recipient (expected for @e2e.test.local): ${sendRes.json?.error ?? sendRes.text}`);
    }

    // -------------------------------------------------------------------
    section("Step 7: Counterparty profile — scoping & read-only permissions");
    // -------------------------------------------------------------------
    counterparty = await createUser({ role: "counterparty", counterpartyId: cpId });
    const cpMe = await counterparty.client.get("/api/access/me");
    assertEqual(cpMe.json?.role, "counterparty", "access/me reports counterparty role");

    // Scoped read: only their own counterparty is visible.
    const cpList = await counterparty.client.get("/api/counterparties");
    assert(Array.isArray(cpList.json), "counterparty GET returns a list");
    assertEqual(cpList.json.length, 1, "counterparty sees exactly their own record");
    assertEqual(cpList.json[0]?.id, cpId, "the visible record is the linked counterparty");

    // Forbidden writes.
    const cpCreate = await counterparty.client.post("/api/counterparties", completeCounterpartyPayload());
    assertEqual(cpCreate.status, 403, "counterparty profile CANNOT create counterparties (403)");
    const cpDelete = await counterparty.client.del(`/api/counterparties/${cpId}`);
    assertEqual(cpDelete.status, 403, "counterparty profile CANNOT delete counterparties (403)");

    // Admin/compliance see the created counterparty in their (unscoped) list.
    const adminList = await admin.client.get("/api/counterparties");
    assert(
      Array.isArray(adminList.json) && adminList.json.some((c) => c.id === cpId),
      "admin sees the created counterparty in the full list",
    );
  } catch (err) {
    fail("unexpected error during scenario", err?.stack || String(err));
  } finally {
    // -------------------------------------------------------------------
    section("Teardown: remove all E2E data");
    // -------------------------------------------------------------------
    const removed = await cleanup();
    info(`cleaned ${removed.counterparties} counterparties and ${removed.users} users`);
  }

  process.exit(summary());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
