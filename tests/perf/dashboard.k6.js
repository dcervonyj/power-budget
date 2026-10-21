// k6 gate for GET /plans/:id/dashboard (CLN-017).
//
// setup() seeds its own fixture through the public API (register, plan, one item),
// so the gate runs against any empty backend: the CI e2e job points it at the
// stack the Playwright suite used. A small load on purpose: it catches a dashboard
// that errors or turns pathologically slow, not capacity.
//
//   k6 run -e K6_BASE_URL=http://localhost:3100 tests/perf/dashboard.k6.js
import http from 'k6/http';
import { check, fail, sleep } from 'k6';

export const options = {
  scenarios: {
    dashboard: { executor: 'constant-vus', vus: 5, duration: '20s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:dashboard}': ['p(95)<300', 'p(99)<800'],
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

export function setup() {
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

export default function (data) {
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
