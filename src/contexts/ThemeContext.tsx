import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'theme';

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: ThemeMode) {
  const isDark =
    theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  return isDark;
}

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    return readStoredTheme();
  });
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return applyTheme(readStoredTheme());
  });

  useEffect(() => {
    setIsDark(applyTheme(theme));
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(applyTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const currentlyDark =
        prev === 'dark' || (prev === 'system' && getSystemPrefersDark());
      return currentlyDark ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({ theme, isDark, setTheme, toggle }),
    [theme, isDark, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
