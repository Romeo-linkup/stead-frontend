const STORAGE_KEY = 'stead-theme';

export function getThemePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (error) {
    // Storage may be unavailable; fall back to the system preference.
  }
  return 'system';
}

export function setThemePreference(pref) {
  const value = pref === 'system' || pref === 'light' || pref === 'dark' ? pref : 'system';

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    // Ignore write failures if storage is unavailable.
  }

  applyTheme(value);
  window.dispatchEvent(new CustomEvent('stead-theme-change', { detail: { preference: value } }));
}

export function applyTheme(pref = getThemePreference()) {
  const preference = pref === 'system' || pref === 'light' || pref === 'dark' ? pref : 'system';
  const isDark = preference === 'dark' || (preference === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  return isDark ? 'dark' : 'light';
}

export function initTheme() {
  applyTheme(getThemePreference());

  if (!window.matchMedia) return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
    }
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleChange);
  }
}
