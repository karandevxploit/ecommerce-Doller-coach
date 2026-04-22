// file: load_test_local.js

import http from 'k6/http';
import { check, sleep } from 'k6';

// ---------- OPTIONS ----------
export const options = {
  scenarios: {
    ramping_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '3m', target: 2000 }, // 🔥 max safe for local
        { duration: '2m', target: 0 },
      ],
    },

    spike_test: {
      executor: 'constant-arrival-rate',
      rate: 200, // requests/sec
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 300,
      maxVUs: 2000,
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<700'],
    http_req_failed: ['rate<0.05'],
  },
};

// ---------- CONFIG ----------
const BASE_URL = 'http://localhost:8001';

// ---------- MAIN ----------
export default function () {
  const res = http.get(`${BASE_URL}/api/products`);

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1);
}