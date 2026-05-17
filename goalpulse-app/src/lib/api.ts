// src/lib/api.ts — Axios instance with JWT interceptor
import axios from 'axios';

const baseURL =
  (import.meta.env.PROD
    ? import.meta.env.VITE_API_BASE_URL_PROD?.trim() || import.meta.env.VITE_API_BASE_URL?.trim()
    : import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001') ||
  'http://localhost:3001';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('gp_token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  }

  const clerkEmail = localStorage.getItem('gp_clerk_email');
  if (clerkEmail) {
    cfg.headers['x-goalpulse-email'] = clerkEmail;
  }
  return cfg;
});

// Redirect to login on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gp_token');
      localStorage.removeItem('gp_user');
      localStorage.removeItem('gp_clerk_email');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
