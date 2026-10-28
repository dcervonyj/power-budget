// k6 gate for GET /plans/:id/dashboard (CLN-017) and GET /transactions (CLN-060).
//
// Without K6_EMAIL, setup() seeds its own fixture through the public API (register, plan, one
// item) and only the dashboard scenario runs: an empty-history smoke gate, usable against any
// empty backend.
//
// With K6_EMAIL / K6_PASSWORD (the user from `pnpm -F @power-budget/backend db:seed:k6`: thousands
// of transactions with the SYNC-001 v2 columns, 70% mapped), the same dashboard scenario runs
// against that history and two GET /transactions scenarios are gated too: the first page and the
// `unmappedOnly` filter. That is the history-dependent cost (PERF-01, PERF-03, PERF-10) an empty
// fixture cannot show. CI always runs this variant.
//
//   k6 run -e K6_BASE_URL=http://localhost:3100 [-e K6_EMAIL=... -e K6_PASSWORD=...] \
//     tests/perf/dashboard.k6.js
import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const HISTORY = Boolean(__ENV.K6_EMAIL);

function scenario(exec) {
  return { executor: 'constant-vus', vus: 5, duration: '20s', exec };
}

// p95 limits: see tests/perf/sli-report.md ("GET /transactions gate") for the measured runs.
const TRANSACTIONS_P95_MS = Number(__ENV.K6_TRANSACTIONS_P95_MS || 150);

export const options = {
  scenarios: HISTORY
    ? {
        dashboard: scenario('dashboard'),
        transactions_first_page: scenario('transactionsFirstPage'),
        transactions_unmapped: scenario('transactionsUnmapped'),
      }
    : { dashboard: scenario('dashboard') },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:dashboard}': ['p(95)<300', 'p(99)<800'],
    ...(HISTORY
      ? {
          'http_req_duration{name:transactions_first_page}': [
            `p(95)<${TRANSACTIONS_P95_MS}`,
            'p(99)<800',
          ],
          'http_req_duration{name:transactions_unmapped}': [
            `p(95)<${TRANSACTIONS_P95_MS}`,
            'p(99)<800',
          ],
        }
      : {}),
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3100';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function post(path, body, token) {
  const headers = token ? { ...JSON_HEADERS, Authorization: `Bearer ${token}` } : JSON_HEADERS;

  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers });
}

function expectStatus(res, status, what) {
  if (res.status !== status) {
    fail(`${what}: ${res.status} ${res.body}`);
  }

  return res.json();
}

function loginAndFindPlan() {
  const auth = expectStatus(
    http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: __ENV.K6_EMAIL, password: __ENV.K6_PASSWORD }),
      { headers: { ...JSON_HEADERS, 'X-Forwarded-For': '10.254.0.3' } },
    ),
    201,
    'login',
  );
  const plans = expectStatus(
    http.get(`${BASE_URL}/plans`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }),
    200,
    'plans',
  );
  if (plans.length === 0) {
    fail('the seeded user has no plan: run db:seed:k6');
  }

  return { token: auth.accessToken, planId: plans[0].id };
}

export function setup() {
  if (HISTORY) {
    return loginAndFindPlan();
  }
  const email = `k6-${Date.now()}@e2e.test`;
  const auth = expectStatus(
    // Own client address: the e2e backend trusts X-Forwarded-For (TRUST_PROXY=true) and
    // the per-IP auth limit may already be used up by the Playwright run.
    http.post(`${BASE_URL}/auth/register`, JSON.stringify({ email, password: 'K6-Str0ng-Pass!' }), {
      headers: { ...JSON_HEADERS, 'X-Forwarded-For': '10.254.0.1' },
    }),
    201,
    'register',
  );
  const token = auth.accessToken;
  const today = new Date();
  const periodStart = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const plan = expectStatus(
    post(
      '/plans',
      {
        name: 'k6 plan',
        type: 'personal',
        periodKind: 'monthly',
        periodStart,
        baseCurrency: 'PLN',
      },
      token,
    ),
    201,
    'create plan',
  );
  const categories = expectStatus(
    http.get(`${BASE_URL}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
    200,
    'categories',
  );
  const expense = categories.find((category) => category.kind === 'expense');
  if (expense) {
    expectStatus(
      post(
        `/plans/${plan.id}/items`,
        { categoryId: expense.id, direction: 'expense', amountMinor: '50000', currency: 'PLN' },
        token,
      ),
      201,
      'add item',
    );
  }

  return { token, planId: plan.id };
}

export function dashboard(data) {
  const res = http.get(`${BASE_URL}/plans/${data.planId}/dashboard`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { name: 'dashboard' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'is the requested plan': (r) => r.status === 200 && r.json('planId') === data.planId,
  });

  sleep(0.1);
}

function listTransactions(data, name, query) {
  const res = http.get(`${BASE_URL}/transactions?${query}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { name },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'returns a full page': (r) => r.status === 200 && r.json('items').length === 50,
  });

  sleep(0.1);
}

export function transactionsFirstPage(data) {
  listTransactions(data, 'transactions_first_page', 'limit=50');
}

export function transactionsUnmapped(data) {
  listTransactions(data, 'transactions_unmapped', 'limit=50&unmappedOnly=true');
}
