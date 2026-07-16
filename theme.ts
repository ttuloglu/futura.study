export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'f-study-theme';
export const FORTALE_BACKGROUND_GRADIENT =
  'radial-gradient(circle at 17% 0%, rgba(80, 118, 172, 0.22), transparent 34%), radial-gradient(circle at 84% 9%, rgba(74, 112, 168, 0.18), transparent 34%), linear-gradient(180deg, #061224 0%, #0b2342 46%, #214c7a 100%)';

export function getStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export function toggleTheme(theme: AppTheme): AppTheme {
  return theme === 'dark' ? 'light' : 'dark';
}
