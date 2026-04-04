import axios from "axios";
import * as Sentry from "@sentry/react";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: {}
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("artistToken");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status >= 500) {
      Sentry.captureException(error, { extra: { status, url: error.config?.url } });
    }
    return Promise.reject(error);
  }
);
