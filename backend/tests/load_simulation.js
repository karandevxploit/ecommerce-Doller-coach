import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 100 },  // Ramp up to 100 users (Initial Load)
        { duration: '1m', target: 500 },   // Stress to 500 concurrent (Local Stress)
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<200'], // 95% of requests must be below 200ms
        http_req_failed: ['rate<0.01'],    // Error rate must be < 1%
    },
};

const BASE_URL = 'http://localhost:8001/api';

export default function () {
    const selector = Math.random();

    // 1. Browsing (40%)
    if (selector < 0.40) {
        const res = http.get(`${BASE_URL}/products`);
        check(res, { 'browse status 200': (r) => r.status === 200 });
    } 
    // 2. Search (25%)
    else if (selector < 0.65) {
        const res = http.get(`${BASE_URL}/products?q=Scale`);
        check(res, { 'search status 200': (r) => r.status === 200 });
    }
    // 3. Add to Cart / Checkout Simulation (20%) - Simplified GET for read stress
    else if (selector < 0.85) {
        const res = http.get(`${BASE_URL}/orders`);
        check(res, { 'order listing 200': (r) => r.status === 200 });
    }
    // 4. Session / Profile (10%)
    else if (selector < 0.95) {
        const res = http.get(`${BASE_URL}/auth/profile`);
        // Likely 401 as we aren't logged in, but we test the middleware overhead
        check(res, { 'profile check': (r) => r.status === 401 || r.status === 200 });
    }
    // 5. Auth / Login (5%) - CPU BLOCKER TEST
    else {
        const payload = JSON.stringify({
            email: `tester${Math.floor(Math.random() * 50)}@scale.com`,
            password: 'ScaleTest123!',
        });
        const params = { headers: { 'Content-Type': 'application/json' } };
        const res = http.post(`${BASE_URL}/auth/login`, payload, params);
        check(res, { 'login attempt': (r) => r.status === 401 || r.status === 200 });
    }

    sleep(1);
}
