import axios from "axios";
import * as Sentry from "@sentry/react";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json"
  }
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let lastRateLimitAlertAt = 0;

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      localStorage.removeItem("adminToken");
      if (typeof window !== "undefined") {
        window.location.href = "/admin/login";
      }
    }

    if (status === 429) {
      const now = Date.now();
      if (now - lastRateLimitAlertAt > 10_000) {
        lastRateLimitAlertAt = now;
        if (typeof window !== "undefined") {
          window.alert("Too many requests. Please wait a few seconds and try again.");
        }
      }
    }

    if (status >= 500) {
      Sentry.captureException(error, { extra: { status, url: error.config?.url } });
    }

    return Promise.reject(error);
  }
);
