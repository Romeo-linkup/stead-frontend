// src/platform/api.js — platform admin API helper
import { API_URL } from '../config.js';

const PLATFORM_TOKEN_KEY = 'stead_platform_token';

export function getPlatformToken() {
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformToken() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export async function platformFetch(path, { method = 'GET', body } = {}) {
  const token = getPlatformToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearPlatformToken();
    window.location.hash = '#/platform/login';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function platformFetchBlob(path) {
  const token = getPlatformToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers });

  if (res.status === 401) {
    clearPlatformToken();
    window.location.hash = '#/platform/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.blob();
}
