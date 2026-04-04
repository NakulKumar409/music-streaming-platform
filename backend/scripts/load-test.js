import http from 'k6/http';
import { check, sleep } from 'k6';

// This script supports three phases defined by the user:
// Phase 1: 50 -> 100 users
// Phase 2: 200 -> 500 users
// Phase 3: 1000 users (Steady state)

export const options = {
  stages: JSON.parse(__ENV.STAGES || '[{"duration":"1m","target":50}]'),
  thresholds: {
    http_req_failed: ['rate<0.10'], // 10% allowed errors during stress
    http_req_duration: ['p(95)<3000'], 
  },
};

const BASE_URL = 'http://localhost:8000';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`, params);
  check(healthRes, { 'health status is 200': (r) => r.status === 200 });

  // 2. Home Feed
  const feedRes = http.get(`${BASE_URL}/api/v1/fan/content`, params);
  check(feedRes, { 'home feed status is 200': (r) => r.status === 200 });

  // 3. Artist List
  const artistRes = http.get(`${BASE_URL}/api/v1/fan/artists`, params);
  check(artistRes, { 'artist list status is 200': (r) => r.status === 200 });

  // 4. Featured Artists
  const featuredRes = http.get(`${BASE_URL}/api/v1/fan/artists/featured`, params);
  check(featuredRes, { 'featured status is 200': (r) => r.status === 200 });

  sleep(1);
}
