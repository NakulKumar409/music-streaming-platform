import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosHeaders } from 'axios';
import * as Sentry from '@sentry/react-native';
import { API_HOST_BASE_URL } from '../config/env';

export const API_BASE_URL = `${API_HOST_BASE_URL}/api/v1/fan`;
export const JWT_STORAGE_KEY = 'jwt';
export const USER_TOKEN_STORAGE_KEY = 'userToken';

const DEFAULT_TIMEOUT_MS = 30000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

export const apiV1 = axios.create({
  baseURL: `${API_HOST_BASE_URL}/api/v1/fan`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

export const contentApi = axios.create({
  baseURL: `${API_HOST_BASE_URL}/api/v1/content`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

export const searchApi = axios.create({
  baseURL: `${API_HOST_BASE_URL}/api/v1/search`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

function attachRetry(client: typeof api) {
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const config = error?.config as (typeof error.config & { __retryCount?: number }) | undefined;
      const status = error?.response?.status;

      if (status >= 500) {
        Sentry.captureException(error, { extra: { status, url: config?.url } });
      }

      if (!config) throw error;

      const retryCount = config.__retryCount ?? 0;
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message ?? ''));
      const isNetwork = !error?.response;

      if ((isTimeout || isNetwork) && retryCount < 1) {
        config.__retryCount = retryCount + 1;
        config.timeout = Math.max(Number(config.timeout ?? 0) || 0, 45000);
        return client.request(config);
      }

      throw error;
    }
  );
}

attachRetry(api);
attachRetry(apiV1);
attachRetry(searchApi);
attachRetry(contentApi);

api.interceptors.request.use(async (config) => {
  const token =
    (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(JWT_STORAGE_KEY));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

contentApi.interceptors.request.use(async (config) => {
  const token =
    (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(JWT_STORAGE_KEY));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

searchApi.interceptors.request.use(async (config) => {
  const token =
    (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(JWT_STORAGE_KEY));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

apiV1.interceptors.request.use(async (config) => {
  const token =
    (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(JWT_STORAGE_KEY));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});
