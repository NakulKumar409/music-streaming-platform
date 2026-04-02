import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1000,
  duration: "30s",
};

export default function () {
  // Test 1: Featured Artists API
  const featuredRes = http.get("http://localhost:8000/api/v1/fan/artists/featured");
  check(featuredRes, {
    "featured artists status is 200": (r) => r.status === 200,
  });

  // Test 2: Search API
  const searchRes = http.get("http://localhost:8000/api/v1/fan/artists/search?q=test");
  check(searchRes, {
    "search status is 200": (r) => r.status === 200,
  });

  // Test 3: Home Feed API
  const homeRes = http.get("http://localhost:8000/api/v1/fan/content");
  check(homeRes, {
    "home feed status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
