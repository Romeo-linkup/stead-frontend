// src/shared/api.js — thin fetch wrapper that attaches the bearer token
// and throws a readable Error on non-2xx responses.
import { API_URL } from '../config.js';
import { getToken, logout } from '../auth/session.js';

export async function apiFetch(path, { method = 'GET', body, auth = true, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 && auth) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
