const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL. Define it in mobile/.env before running or building the app.'
  );
}

export const API_HOST_BASE_URL = rawApiUrl.replace(/\/+$/, '');
