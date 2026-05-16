import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const PLAN_ID = __ENV.K6_PLAN_ID || '';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export default function () {
  const res = http.get(`${BASE_URL}/plans/${PLAN_ID}/dashboard`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.1);
}
