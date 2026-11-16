import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from '../lib/api';
import {
  applyThemeToDom,
  getStoredThemeMode,
  getStoredThemePreset,
  setStoredThemeMode,
  setStoredThemePreset,
  type ThemePresetId,
} from '../lib/theme';
import type { AllSettings } from '../types';

const DEFAULT_SETTINGS: AllSettings = {
  company: {
    name: 'Velvet Crumb Patisserie',
    logo: '',
    address: '42 Baker Street, Indiranagar, Bengaluru 560038',
    phone: '+91 98765 43210',
    email: 'hello@velvetcrumb.in',
    gstin: '29AABCV1234F1Z5',
  },
  application: {
    appName: 'Easy Bill',
    appLogo: '',
    theme: 'light',
    colorTheme: 'navy-teal',
    dateFormat: 'DD-MM-YYYY',
    currencySymbol: '₹',
  },
  billing: {
    billPrefix: 'EB',
    orderPrefix: 'ORD',
    gstEnabled: true,
    gstRate: 5,
    defaultPaymentMode: 'Cash',
    allowDiscount: true,
    maxDiscountPercent: 25,
    receiptFooter: 'Thank you for celebrating with us! Visit again.',
  },
  printer: {
    selectedPrinter: 'Epson TM-T82 Thermal',
    paperSize: '80mm',
    isConnected: true,
    autoPrint: true,
    copies: 1,
  },
};

interface SettingsContextValue {
  settings: AllSettings;
  colorTheme: ThemePresetId;
  themeMode: 'light' | 'dark';
  loaded: boolean;
  setColorTheme: (themeId: ThemePresetId) => Promise<void>;
  setThemeMode: (mode: 'light' | 'dark') => Promise<void>;
  reloadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AllSettings>) => Promise<AllSettings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AllSettings>(() => ({
    ...DEFAULT_SETTINGS,
    application: {
      ...DEFAULT_SETTINGS.application,
      theme: getStoredThemeMode(),
      colorTheme: getStoredThemePreset(),
    },
  }));
  const [colorTheme, setColorThemeState] = useState<ThemePresetId>(() => getStoredThemePreset());
  const [themeMode, setThemeModeState] = useState<'light' | 'dark'>(() => getStoredThemeMode());
  const [loaded, setLoaded] = useState(false);

  const applyTheme = useCallback((mode: 'light' | 'dark', presetId?: ThemePresetId) => {
    const activePreset = presetId || getStoredThemePreset();
    applyThemeToDom(activePreset, mode);
  }, []);

  // Initialize theme immediately on first client render
  useEffect(() => {
    const savedPreset = getStoredThemePreset();
    const savedMode = getStoredThemeMode();
    setColorThemeState(savedPreset);
    setThemeModeState(savedMode);
    applyTheme(savedMode, savedPreset);
  }, [applyTheme]);

  // Keep browser document title synchronized with Settings
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const appName = settings.application.appName || 'Easy Bill';
    const shopName = settings.company.name || '';
    document.title = shopName ? `${appName} — ${shopName}` : appName;
  }, [settings.application.appName, settings.company.name]);

  const reloadSettings = useCallback(async () => {
    try {
      const token = getStoredToken();
      let appTheme: 'light' | 'dark' = getStoredThemeMode();
      let appColorTheme: ThemePresetId = getStoredThemePreset();

      if (token) {
        const data = await apiRequest<AllSettings>('/api/settings');
        setSettings(data);
        if (data.application?.theme) {
          appTheme = data.application.theme;
          setStoredThemeMode(appTheme);
        }
        if (data.application?.colorTheme) {
          appColorTheme = data.application.colorTheme;
          setStoredThemePreset(appColorTheme);
        }
      } else {
        const pub = await apiRequest<Pick<AllSettings, 'company' | 'application'>>('/api/settings/public');
        setSettings((prev) => ({
          ...prev,
          company: pub.company || prev.company,
          application: pub.application || prev.application,
        }));
        if (pub.application?.theme) {
          appTheme = pub.application.theme;
          setStoredThemeMode(appTheme);
        }
        if (pub.application?.colorTheme) {
          appColorTheme = pub.application.colorTheme;
          setStoredThemePreset(appColorTheme);
        }
      }

      setColorThemeState(appColorTheme);
      setThemeModeState(appTheme);
      applyTheme(appTheme, appColorTheme);
    } catch {
      // keep defaults if unavailable
    } finally {
      setLoaded(true);
    }
  }, [applyTheme]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const setColorTheme = useCallback(
    async (themeId: ThemePresetId) => {
      setColorThemeState(themeId);
      setStoredThemePreset(themeId);
      applyThemeToDom(themeId, themeMode);

      const mergedApp = {
        ...settings.application,
        colorTheme: themeId,
        theme: themeMode,
      };
      setSettings((prev) => ({
        ...prev,
        application: {
          ...prev.application,
          colorTheme: themeId,
        },
      }));

      if (!getStoredToken()) return;
      try {
        await apiRequest<AllSettings>('/api/settings', {
          method: 'PUT',
          body: JSON.stringify({
            ...settings,
            application: mergedApp,
          }),
        });
      } catch {
        // local storage already updated
      }
    },
    [settings, themeMode]
  );

  const setThemeMode = useCallback(
    async (mode: 'light' | 'dark') => {
      setThemeModeState(mode);
      setStoredThemeMode(mode);
      applyThemeToDom(colorTheme, mode);

      const mergedApp = {
        ...settings.application,
        theme: mode,
        colorTheme,
      };
      setSettings((prev) => ({
        ...prev,
        application: {
          ...prev.application,
          theme: mode,
        },
      }));

      if (!getStoredToken()) return;
      try {
        await apiRequest<AllSettings>('/api/settings', {
          method: 'PUT',
          body: JSON.stringify({
            ...settings,
            application: mergedApp,
          }),
        });
      } catch {
        // local storage already updated
      }
    },
    [settings, colorTheme]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AllSettings>) => {
      const merged: AllSettings = {
        company: partial.company ?? settings.company,
        application: partial.application ?? settings.application,
        billing: partial.billing ?? settings.billing,
        printer: partial.printer ?? settings.printer,
      };

      const targetPreset = merged.application.colorTheme || colorTheme;
      const targetMode = merged.application.theme || themeMode;
      setStoredThemePreset(targetPreset);
      setStoredThemeMode(targetMode);
      setColorThemeState(targetPreset);
      setThemeModeState(targetMode);

      const updated = await apiRequest<AllSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(merged),
      });
      setSettings(updated);
      applyTheme(updated.application?.theme || targetMode, updated.application?.colorTheme || targetPreset);
      return updated;
    },
    [settings, colorTheme, themeMode, applyTheme]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        colorTheme,
        themeMode,
        loaded,
        setColorTheme,
        setThemeMode,
        reloadSettings,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
