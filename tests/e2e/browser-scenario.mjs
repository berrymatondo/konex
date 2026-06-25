// End-to-end BROWSER scenario driven through the real UI with agent-browser.
//
// Covers the key user-visible journeys we built/fixed:
//   1. Counterparty profile sees the dedicated "Tableau de bord contrepartie"
//      with current orders and human-readable gold-type labels.
//   2. Compliance officer does NOT see the "Onboarding" button in the approval
//      queue (cannot create a counterparty from there).
//   3. Admin DOES see the "Onboarding" button in the approval queue.
//
// Data is seeded via the API (harness) and removed afterwards.
//
// Run:  node --env-file=.env.development.local tests/e2e/browser-scenario.mjs
// Requires the dev server running and the `agent-browser` CLI on PATH.

import { execFileSync } from "node:child_process";
import {
  BASE_URL,
  DEFAULT_PASSWORD,
  createUser,
  cleanup,
  completeCounterpartyPayload,
  purchaseOrderPayload,
  section,
  assert,
  fail,
  info,
  summary,
} from "./lib/harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- agent-browser CLI wrappers -------------------------------------------

function browser(args) {
  return execFileSync("agent-browser", args, { encoding: "utf8" }).trim();
}

function open(path) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  browser(["open", url]);
}

/** Evaluates JS in the page and returns the parsed result (JSON when possible). */
function evalJs(js) {
  const out = browser(["eval", js]);
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

/** Signs in through the app's own auth endpoint, returning the resolved role. */
async function signIn(email) {
  // Sign out any previous session first, then sign in with these credentials.
  evalJs(`fetch('/api/auth/sign-out',{method:'POST'}).then(()=>'ok').catch(()=>'ok')`);
  await sleep(300);
  const res = evalJs(
    `fetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},` +
      `body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(DEFAULT_PASSWORD)}})})` +
      `.then(r=>r.json()).then(d=>d.user?d.user.role:('ERR:'+JSON.stringify(d)))`,
  );
  await sleep(800);
  return res;
}

async function main() {
  console.log(`\nRunning BROWSER scenario against ${BASE_URL}`);
  await cleanup();

  let admin, compliance, counterparty, cpId;

  try {
    // -------------------------------------------------------------------
    section("Seed: counterparty with an active order + role accounts");
    // -------------------------------------------------------------------
    admin = await createUser({ role: "admin" });

    const cpRes = await admin.client.post(
      "/api/counterparties",
      completeCounterpartyPayload({ status: "active" }),
    );
    cpId = cpRes.json?.id;
    assert(cpRes.status === 201 && Boolean(cpId), "seeded active counterparty");

    const poRes = await admin.client.post(
      "/api/purchase-orders",
      purchaseOrderPayload(cpId, { goldType: "dore_bars", status: "submitted" }),
    );
    assert(poRes.status === 201, "seeded a submitted purchase order (dore_bars)");

    compliance = await createUser({ role: "compliance_officer" });
    counterparty = await createUser({ role: "counterparty", counterpartyId: cpId });

    // Prime the browser on a same-origin page so fetch() runs against the app.
    open("/sign-in");
    await sleep(1500);

    // -------------------------------------------------------------------
    section("Journey 1: Counterparty dashboard");
    // -------------------------------------------------------------------
    const cpRole = await signIn(counterparty.email);
    assert(cpRole === "counterparty", `counterparty signed in (role=${cpRole})`);
    open("/");
    await sleep(3500); // allow SWR to load purchase orders

    const heading = evalJs(
      `(()=>{const el=[...document.querySelectorAll('h1,h2')].find(e=>/Tableau de bord contrepartie/i.test(e.textContent));return el?el.textContent.trim():'NOT_FOUND';})()`,
    );
    assert(
      typeof heading === "string" && /Tableau de bord contrepartie/i.test(heading),
      "counterparty dashboard title is shown",
      heading,
    );

    const hasCurrentOrders = evalJs(
      `[...document.querySelectorAll('h2')].some(e=>/Commandes actuelles/i.test(e.textContent))`,
    );
    assert(hasCurrentOrders === true, "'Commandes actuelles' section is rendered");

    // Gold-type label fix: the readable label shows, not the raw key.
    const bodyText = evalJs(`document.body.innerText`);
    const text = typeof bodyText === "string" ? bodyText : "";
    assert(text.includes("Lingots Doré"), "gold type shows readable label 'Lingots Doré'");
    assert(!text.includes("dore_bars"), "raw gold-type key 'dore_bars' is NOT shown");

    // -------------------------------------------------------------------
    section("Journey 2: Compliance officer cannot onboard from the queue");
    // -------------------------------------------------------------------
    const compRole = await signIn(compliance.email);
    assert(compRole === "compliance_officer", `compliance signed in (role=${compRole})`);
    open("/approval-queue");
    await sleep(3000);

    const compTitle = evalJs(
      `[...document.querySelectorAll('h1,h2')].some(e=>/Approval Queue|file d'approbation/i.test(e.textContent))`,
    );
    assert(compTitle === true, "approval queue page loaded for compliance officer");

    const compOnboardLinks = evalJs(
      `document.querySelectorAll('main a[href="/onboarding"]').length`,
    );
    assert(compOnboardLinks === 0, "Onboarding button is HIDDEN for compliance officer", compOnboardLinks);

    // -------------------------------------------------------------------
    section("Journey 3: Admin can onboard from the queue");
    // -------------------------------------------------------------------
    const adminRole = await signIn(admin.email);
    assert(adminRole === "admin", `admin signed in (role=${adminRole})`);
    open("/approval-queue");
    await sleep(3000);

    const adminOnboardLinks = evalJs(
      `document.querySelectorAll('main a[href="/onboarding"]').length`,
    );
    assert(adminOnboardLinks >= 1, "Onboarding button is VISIBLE for admin", adminOnboardLinks);
  } catch (err) {
    fail("unexpected error during browser scenario", err?.message || String(err));
  } finally {
    section("Teardown: remove all E2E data");
    const removed = await cleanup();
    info(`cleaned ${removed.counterparties} counterparties and ${removed.users} users`);
  }

  process.exit(summary());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
