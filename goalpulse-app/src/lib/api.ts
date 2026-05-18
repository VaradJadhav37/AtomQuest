// src/lib/api.ts - Axios instance with JWT interceptor
import axios from 'axios';

const LOCAL_API_BASE_URL = 'http://localhost:3001';
const PRODUCTION_FALLBACK_API_BASE_URL = 'https://atomquest-ez9w.onrender.com';
const API_BASE_CACHE_KEY = 'gk_api_base_url';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const candidateProductionBaseUrls = Array.from(
  new Set(
    [
      import.meta.env.VITE_API_BASE_URL_PROD?.trim(),
      import.meta.env.VITE_API_BASE_URL?.trim(),
      PRODUCTION_FALLBACK_API_BASE_URL,
    ].filter(Boolean)
  )
).map(normalizeBaseUrl);

const localBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL?.trim() || LOCAL_API_BASE_URL
);

let resolvedBaseUrlPromise: Promise<string> | null = null;

async function probeBaseUrl(baseUrl: string) {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/health`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveBaseUrl() {
  if (import.meta.env.DEV) {
    return localBaseUrl;
  }

  if (typeof window === 'undefined') {
    return candidateProductionBaseUrls[0] || localBaseUrl;
  }

  const cachedBaseUrl = window.localStorage.getItem(API_BASE_CACHE_KEY)?.trim();
  if (cachedBaseUrl && (await probeBaseUrl(cachedBaseUrl))) {
    return normalizeBaseUrl(cachedBaseUrl);
  }

  if (cachedBaseUrl) {
    window.localStorage.removeItem(API_BASE_CACHE_KEY);
  }

  for (const candidate of candidateProductionBaseUrls) {
    if (await probeBaseUrl(candidate)) {
      window.localStorage.setItem(API_BASE_CACHE_KEY, candidate);
      return candidate;
    }
  }

  return candidateProductionBaseUrls[0] || localBaseUrl;
}

async function getBaseUrl() {
  if (!resolvedBaseUrlPromise) {
    resolvedBaseUrlPromise = resolveBaseUrl();
  }

  return resolvedBaseUrlPromise;
}

const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async cfg => {
  cfg.baseURL = await getBaseUrl();

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('gk_token') : null;
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  }

  const clerkEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('gk_clerk_email') : null;
  if (clerkEmail) {
    cfg.headers['x-goalkeeper-email'] = clerkEmail;
  }

  return cfg;
});

// Redirect to login on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && typeof localStorage !== 'undefined') {
      localStorage.removeItem('gk_token');
      localStorage.removeItem('gk_user');
      localStorage.removeItem('gk_clerk_email');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
