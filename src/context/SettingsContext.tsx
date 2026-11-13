import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from '../lib/api';
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
  loaded: boolean;
  reloadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AllSettings>) => Promise<AllSettings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const applyTheme = useCallback((theme: 'light' | 'dark') => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (token) {
        const data = await apiRequest<AllSettings>('/api/settings');
        setSettings(data);
        applyTheme(data.application?.theme || 'light');
      } else {
        const pub = await apiRequest<Pick<AllSettings, 'company' | 'application'>>('/api/settings/public');
        setSettings((prev) => ({
          ...prev,
          company: pub.company || prev.company,
          application: pub.application || prev.application,
        }));
        applyTheme(pub.application?.theme || 'light');
      }
    } catch {
      // keep defaults if unavailable
    } finally {
      setLoaded(true);
    }
  }, [applyTheme]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSettings = useCallback(
    async (partial: Partial<AllSettings>) => {
      const merged: AllSettings = {
        company: partial.company ?? settings.company,
        application: partial.application ?? settings.application,
        billing: partial.billing ?? settings.billing,
        printer: partial.printer ?? settings.printer,
      };
      const updated = await apiRequest<AllSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(merged),
      });
      setSettings(updated);
      applyTheme(updated.application?.theme || 'light');
      return updated;
    },
    [settings, applyTheme]
  );

  return (
    <SettingsContext.Provider value={{ settings, loaded, reloadSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
