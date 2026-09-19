// src/config.js — single place to change the API base URL.
// No bundler is used (plain ES modules loaded directly by the browser),
// so this is a plain JS file rather than an env var.
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_URL = isLocal
  ? 'http://localhost:4000'
  : 'https://stead-backend-l92s.onrender.com';
