// Shared end-to-end test harness for the Gold Acquisition app.
//
// Provides:
//   - a cookie-aware HTTP client (one per simulated user/role)
//   - Better Auth sign-up / sign-in helpers
//   - direct DB helpers (Neon) to assign roles the sign-up form forbids
//     (admin, counterparty) and to clean up test data afterwards
//   - reusable scenario builders (counterparty, purchase order)
//   - a tiny assertion runner with colored pass/fail reporting
//
// Run scripts that import this with:  node --env-file=.env.development.local <script>
// so DATABASE_URL and friends are available.

import { neon } from "@neondatabase/serverless";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Every record this harness creates is tagged with this marker so cleanup can
// find and remove exactly what the tests produced (and nothing else).
export const E2E_TAG = "E2E_TEST";
export const E2E_EMAIL_DOMAIN = "e2e.test.local";
export const DEFAULT_PASSWORD = "E2ePassw0rd!";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run with: node --env-file=.env.development.local <script>",
  );
}

export const sql = neon(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Assertion runner
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

const results = { passed: 0, failed: 0, failures: [] };

export function section(title) {
  console.log(`\n${C.bold}${C.cyan}== ${title} ==${C.reset}`);
}

export function pass(message) {
  results.passed++;
  console.log(`  ${C.green}✓${C.reset} ${message}`);
}

export function fail(message, detail) {
  results.failed++;
  results.failures.push(message);
  console.log(`  ${C.red}✗ ${message}${C.reset}`);
  if (detail !== undefined) {
    console.log(`    ${C.gray}${typeof detail === "string" ? detail : JSON.stringify(detail)}${C.reset}`);
  }
}

export function info(message) {
  console.log(`  ${C.gray}• ${message}${C.reset}`);
}

/** Asserts a condition is truthy. */
export function assert(condition, message, detail) {
  if (condition) pass(message);
  else fail(message, detail);
  return Boolean(condition);
}

/** Asserts actual === expected. */
export function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  if (ok) pass(message);
  else fail(message, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}

/** Prints the summary and returns the process exit code (0 ok, 1 failures). */
export function summary() {
  const total = results.passed + results.failed;
  console.log(
    `\n${C.bold}Summary:${C.reset} ${C.green}${results.passed} passed${C.reset}, ` +
      `${results.failed ? C.red : C.gray}${results.failed} failed${C.reset} (${total} checks)`,
  );
  if (results.failed > 0) {
    console.log(`${C.red}Failed checks:${C.reset}`);
    for (const f of results.failures) console.log(`  - ${f}`);
  }
  return results.failed > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Cookie-aware HTTP client
// ---------------------------------------------------------------------------

/**
 * Creates an isolated HTTP client that persists cookies between requests,
 * simulating a single browser/user session.
 */
export function createClient(label = "client") {
  const jar = new Map();

  function storeCookies(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || value === "deleted") jar.delete(name);
      else jar.set(name, value);
    }
  }

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async function request(method, path, body) {
    // Better Auth enforces a CSRF check that requires a trusted Origin header;
    // BASE_URL (http://localhost:3000) is listed in auth trustedOrigins.
    const headers = { Origin: BASE_URL };
    const cookie = cookieHeader();
    if (cookie) headers["Cookie"] = cookie;
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const response = await fetch(url, { method, headers, body: payload });
    storeCookies(response);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.ok, json, text };
  }

  return {
    label,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
    hasSession: () => jar.size > 0,
  };
}

// ---------------------------------------------------------------------------
// Auth + role helpers
// ---------------------------------------------------------------------------

let userCounter = 0;
const createdUserIds = new Set();

/** Builds a unique e2e email for a role. */
export function e2eEmail(role) {
  userCounter++;
  return `e2e_${role}_${Date.now()}_${userCounter}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * Creates a fresh authenticated user with the given app role. The Better Auth
 * sign-up form only allows self-assigning compliance_officer / risk_manager,
 * so for admin and counterparty we sign up then promote the role directly in
 * the database and re-sign-in to refresh the session.
 */
export async function createUser({ role, counterpartyId = null, name }) {
  const email = e2eEmail(role);
  const displayName = name ?? `E2E ${role}`;
  const client = createClient(role);

  const selfAssignable = role === "compliance_officer" || role === "risk_manager";
  const signUpRole = selfAssignable ? role : "compliance_officer";

  const signup = await client.post("/api/auth/sign-up/email", {
    email,
    password: DEFAULT_PASSWORD,
    name: displayName,
    role: signUpRole,
  });
  if (!signup.ok || !signup.json?.user?.id) {
    throw new Error(`sign-up failed for ${role}: ${signup.status} ${signup.text}`);
  }
  const userId = signup.json.user.id;
  createdUserIds.add(userId);

  // Promote to the real role (and link counterparty) when needed.
  if (!selfAssignable || counterpartyId) {
    await sql`
      UPDATE "user"
      SET role = ${role}, counterparty_id = ${counterpartyId}
      WHERE id = ${userId}
    `;
    // Re-sign-in so the session token reflects the updated role.
    const reSignIn = await client.post("/api/auth/sign-in/email", {
      email,
      password: DEFAULT_PASSWORD,
    });
    if (!reSignIn.ok) {
      throw new Error(`re-sign-in failed for ${role}: ${reSignIn.status} ${reSignIn.text}`);
    }
  }

  return { client, email, userId, role, password: DEFAULT_PASSWORD };
}

/** Links an existing user to a counterparty record (used after the CP exists). */
export async function linkUserToCounterparty(userId, counterpartyId) {
  await sql`UPDATE "user" SET counterparty_id = ${counterpartyId} WHERE id = ${userId}`;
}

// ---------------------------------------------------------------------------
// Scenario builders
// ---------------------------------------------------------------------------

/** Minimal valid "complete" counterparty payload, tagged for cleanup. */
export function completeCounterpartyPayload(overrides = {}) {
  const stamp = Date.now();
  return {
    legalName: `${E2E_TAG} Counterparty ${stamp}`,
    tradingName: `${E2E_TAG} Trading`,
    registrationNumber: `RC-${stamp}`,
    taxId: `TAX-${stamp}`,
    legalForm: "SARL",
    countryOfIncorporation: "Democratic Republic of Congo",
    registeredAddress: "123 Avenue du Test, Kinshasa",
    primaryContact: "Test Contact",
    primaryEmail: `cp_${stamp}@${E2E_EMAIL_DOMAIN}`,
    primaryPhone: "+243000000000",
    goldSourceTypes: ["LSM"],
    status: "draft",
    ubos: [
      {
        fullName: `${E2E_TAG} Owner`,
        nationality: "Congolese",
        ownershipPercent: 100,
        isPEP: false,
        pepDetails: "",
      },
    ],
    documents: [],
    ...overrides,
  };
}

/** Full purchase order payload ready for submission, tagged via notes. */
export function purchaseOrderPayload(counterpartyId, overrides = {}) {
  return {
    counterpartyId,
    estimatedWeightKg: 15,
    goldType: "dore_bars",
    assayRange: "85-92",
    incoterms: "DAP",
    deliveryVaultId: "vault-london",
    expectedDispatchDate: "2026-06-30",
    notes: `${E2E_TAG} purchase order`,
    lbmaPricePerOz: 2348.6,
    purityFactor: 0.89,
    premiumDiscount: 0,
    logisticsCost: 2500,
    totalEstimatedValue: 999884.46,
    currency: "USD",
    status: "submitted",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Removes every record tagged by this harness: purchase orders, risk
 * assessments, UBOs, documents, counterparties, and the e2e user accounts
 * (plus their auth rows). Safe to call multiple times.
 */
export async function cleanup() {
  // Counterparties created by the tests (tagged in legal_name).
  const cps = await sql`SELECT id FROM counterparties WHERE legal_name LIKE ${"%" + E2E_TAG + "%"}`;
  const cpIds = cps.map((r) => r.id);

  for (const cpId of cpIds) {
    await sql`DELETE FROM po_approvals WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE counterparty_id = ${cpId})`;
    await sql`DELETE FROM purchase_orders WHERE counterparty_id = ${cpId}`;
    await sql`DELETE FROM risk_audit_log WHERE counterparty_id = ${cpId}`;
    await sql`DELETE FROM risk_assessments WHERE counterparty_id = ${cpId}`;
    await sql`DELETE FROM ubos WHERE counterparty_id = ${cpId}`;
    await sql`DELETE FROM documents WHERE counterparty_id = ${cpId}`;
    await sql`DELETE FROM audit_log WHERE entity_id = ${cpId}`;
  }
  // Any stray POs tagged via notes (e.g. drafts without a tagged CP).
  await sql`DELETE FROM purchase_orders WHERE notes LIKE ${"%" + E2E_TAG + "%"}`;
  if (cpIds.length > 0) {
    await sql`DELETE FROM counterparties WHERE id = ANY(${cpIds})`;
  }

  // E2E user accounts and their auth rows.
  const users = await sql`SELECT id FROM "user" WHERE email LIKE ${"%@" + E2E_EMAIL_DOMAIN}`;
  for (const u of users) {
    await sql`DELETE FROM account WHERE "userId" = ${u.id}`;
    await sql`DELETE FROM session WHERE "userId" = ${u.id}`;
    await sql`DELETE FROM notifications WHERE user_id = ${u.id}`;
  }
  await sql`DELETE FROM "user" WHERE email LIKE ${"%@" + E2E_EMAIL_DOMAIN}`;

  return { counterparties: cpIds.length, users: users.length };
}
