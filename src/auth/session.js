// src/auth/session.js — token storage, logout, route guard.
const TOKEN_KEY = 'stead_token';
const PRE_TOKEN_KEY = 'stead_pre_token';

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setPreToken(preToken) {
  sessionStorage.setItem(PRE_TOKEN_KEY, preToken);
}
export function getPreToken() {
  return sessionStorage.getItem(PRE_TOKEN_KEY);
}
export function clearPreToken() {
  sessionStorage.removeItem(PRE_TOKEN_KEY);
}

// Decodes the JWT payload WITHOUT verifying it — fine for reading
// role/district_id to drive the UI, since the backend re-verifies on
// every real request. Never trust this for access control.
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (err) {
    return null;
  }
}

export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    clearToken();
    return null;
  }
  return payload; // { type, user_id, role, district_id, iat, exp }
}

export function logout() {
  clearToken();
  window.location.hash = '#/login';
}
