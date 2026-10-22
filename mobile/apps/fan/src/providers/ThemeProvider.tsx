import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  themes,
  applyTheme,
  DEFAULT_THEME_ID,
  type ThemeDefinition,
  getActiveTheme,
} from '../config/themeConfig';

export const THEME_STORAGE_KEY = 'global-theme';

export interface ThemeContextValue {
  theme: ThemeDefinition;
  themeId: string;
  setTheme: (id: string) => Promise<void>;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getActiveTheme(),
  themeId: DEFAULT_THEME_ID,
  setTheme: async () => {},
  themes,
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored && themes.some((t) => t.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return DEFAULT_THEME_ID;
  });

  const [theme, setThemeState] = useState<ThemeDefinition>(() => {
    return applyTheme(themeId);
  });

  // Restore on mount for cross-platform persistence (AsyncStorage for native and web)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && themes.some((t) => t.id === saved) && mounted) {
          const applied = applyTheme(saved);
          setThemeIdState(saved);
          setThemeState(applied);
        }
      } catch (err) {
        console.warn('[ThemeProvider] Failed to load theme from storage', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback(async (newId: string) => {
    const nextTheme = themes.find((t) => t.id === newId);
    if (!nextTheme) return;

    // Apply globally (sets CSS variables on web and updates active theme in memory)
    const applied = applyTheme(newId);
    setThemeIdState(newId);
    setThemeState(applied);

    // Save to storage
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newId);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, newId);
      }
    } catch (err) {
      console.warn('[ThemeProvider] Failed to persist theme', err);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}
