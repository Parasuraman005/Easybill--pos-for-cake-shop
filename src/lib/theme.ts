export type ThemePresetId = 'navy-teal' | 'charcoal-orange' | 'emerald-white' | 'midnight-gold';

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentBorder: string;
  accentText: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarBorder: string;
  sidebarActive: string;
  headerBg: string;
  headerBorder: string;
  btnSecondaryBg: string;
  btnSecondaryText: string;
  btnSecondaryBorder: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  tagline: string;
  styleBadge: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
  previewPalette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'navy-teal',
    name: 'Navy & Teal',
    tagline: 'Corporate · Professional · Modern',
    styleBadge: 'Corporate & Modern',
    description: 'Clean deep navy structure balanced with high-clarity teal accents. Engineered for high-speed retail checkout & professional enterprise reporting.',
    previewPalette: {
      primary: '#142D4E',
      accent: '#0F766E',
      background: '#F8FAFC',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#142D4E',
      primaryHover: '#0E223D',
      secondary: '#1E3E68',
      accent: '#0F766E',
      accentHover: '#0D645E',
      accentLight: '#F0FDFA',
      accentBorder: '#99F6E4',
      accentText: '#0F766E',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      text: '#142D4E',
      textMuted: '#64748B',
      sidebarBg: '#142D4E',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#1E3E68',
      sidebarActive: '#0F766E',
      headerBg: 'rgba(255, 255, 255, 0.95)',
      headerBorder: '#E2E8F0',
      btnSecondaryBg: '#F1F5F9',
      btnSecondaryText: '#142D4E',
      btnSecondaryBorder: '#E2E8F0',
    },
    dark: {
      primary: '#0F1D27',
      primaryHover: '#0A151D',
      secondary: '#1A3346',
      accent: '#2DD4BF',
      accentHover: '#14B8A6',
      accentLight: 'rgba(45, 212, 191, 0.15)',
      accentBorder: 'rgba(45, 212, 191, 0.3)',
      accentText: '#2DD4BF',
      bg: '#0A131A',
      surface: '#12222E',
      border: '#1F384C',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      sidebarBg: '#0F1D27',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#1A3346',
      sidebarActive: '#2DD4BF',
      headerBg: 'rgba(18, 34, 46, 0.95)',
      headerBorder: '#1F384C',
      btnSecondaryBg: '#1A3346',
      btnSecondaryText: '#F8FAFC',
      btnSecondaryBorder: '#1F384C',
    },
  },
  {
    id: 'charcoal-orange',
    name: 'Charcoal & Orange',
    tagline: 'Retail · Bold · Premium',
    styleBadge: 'Retail & Bold',
    description: 'High-contrast charcoal surfaces with energetic warm orange highlights. Crafted for fast visual scanning and dynamic counter billing.',
    previewPalette: {
      primary: '#242424',
      accent: '#F97316',
      background: '#F5F5F4',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#242424',
      primaryHover: '#171717',
      secondary: '#383838',
      accent: '#F97316',
      accentHover: '#EA580C',
      accentLight: '#FFF7ED',
      accentBorder: '#FED7AA',
      accentText: '#C2410C',
      bg: '#F5F5F4',
      surface: '#FFFFFF',
      border: '#E7E5E4',
      text: '#242424',
      textMuted: '#78716C',
      sidebarBg: '#242424',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#383838',
      sidebarActive: '#F97316',
      headerBg: 'rgba(255, 255, 255, 0.95)',
      headerBorder: '#E7E5E4',
      btnSecondaryBg: '#F5F5F4',
      btnSecondaryText: '#242424',
      btnSecondaryBorder: '#E7E5E4',
    },
    dark: {
      primary: '#1A1A1A',
      primaryHover: '#121212',
      secondary: '#2E2E2E',
      accent: '#FB923C',
      accentHover: '#F97316',
      accentLight: 'rgba(251, 146, 60, 0.15)',
      accentBorder: 'rgba(251, 146, 60, 0.3)',
      accentText: '#FB923C',
      bg: '#121212',
      surface: '#1E1E1E',
      border: '#333333',
      text: '#F5F5F4',
      textMuted: '#A8A29E',
      sidebarBg: '#171717',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#2B2B2B',
      sidebarActive: '#FB923C',
      headerBg: 'rgba(30, 30, 30, 0.95)',
      headerBorder: '#333333',
      btnSecondaryBg: '#2E2E2E',
      btnSecondaryText: '#F5F5F4',
      btnSecondaryBorder: '#3A3A3A',
    },
  },
  {
    id: 'emerald-white',
    name: 'Emerald & White',
    tagline: 'Finance · Clean · Trustworthy',
    styleBadge: 'Finance & Clean',
    description: 'Crisp botanical emerald tones against clean mint-tinted surfaces. Evokes freshness, accounting precision, and organic artisan authenticity.',
    previewPalette: {
      primary: '#064E3B',
      accent: '#10B981',
      background: '#ECFDF5',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#064E3B',
      primaryHover: '#043A2C',
      secondary: '#065F46',
      accent: '#10B981',
      accentHover: '#059669',
      accentLight: '#ECFDF5',
      accentBorder: '#A7F3D0',
      accentText: '#047857',
      bg: '#ECFDF5',
      surface: '#FFFFFF',
      border: '#D1FAE5',
      text: '#064E3B',
      textMuted: '#4B5563',
      sidebarBg: '#064E3B',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#065F46',
      sidebarActive: '#10B981',
      headerBg: 'rgba(255, 255, 255, 0.95)',
      headerBorder: '#D1FAE5',
      btnSecondaryBg: '#F0FDF4',
      btnSecondaryText: '#064E3B',
      btnSecondaryBorder: '#D1FAE5',
    },
    dark: {
      primary: '#032B21',
      primaryHover: '#021F17',
      secondary: '#065F46',
      accent: '#34D399',
      accentHover: '#10B981',
      accentLight: 'rgba(52, 211, 153, 0.15)',
      accentBorder: 'rgba(52, 211, 153, 0.3)',
      accentText: '#34D399',
      bg: '#021812',
      surface: '#05382B',
      border: '#0B5943',
      text: '#ECFDF5',
      textMuted: '#9CA3AF',
      sidebarBg: '#032B21',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#065F46',
      sidebarActive: '#34D399',
      headerBg: 'rgba(5, 56, 43, 0.95)',
      headerBorder: '#0B5943',
      btnSecondaryBg: '#065F46',
      btnSecondaryText: '#ECFDF5',
      btnSecondaryBorder: '#0B5943',
    },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight & Gold',
    tagline: 'Luxury · Elegant · Premium',
    styleBadge: 'Luxury & Elegant',
    description: 'Deep midnight obsidian paired with warm champagne gold accents. Designed for bespoke wedding cake studios and luxury boutique bakeries.',
    previewPalette: {
      primary: '#111827',
      accent: '#D4A84F',
      background: '#F3F4F6',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#111827',
      primaryHover: '#0B0F19',
      secondary: '#1F2937',
      accent: '#D4A84F',
      accentHover: '#B88E3A',
      accentLight: '#FAF5E8',
      accentBorder: '#FDE68A',
      accentText: '#92400E',
      bg: '#F3F4F6',
      surface: '#FFFFFF',
      border: '#E5E7EB',
      text: '#111827',
      textMuted: '#6B7280',
      sidebarBg: '#111827',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#1F2937',
      sidebarActive: '#D4A84F',
      headerBg: 'rgba(255, 255, 255, 0.95)',
      headerBorder: '#E5E7EB',
      btnSecondaryBg: '#F3F4F6',
      btnSecondaryText: '#111827',
      btnSecondaryBorder: '#E5E7EB',
    },
    dark: {
      primary: '#0B0F17',
      primaryHover: '#070A0F',
      secondary: '#1A2332',
      accent: '#E2C17C',
      accentHover: '#D4A84F',
      accentLight: 'rgba(226, 193, 124, 0.15)',
      accentBorder: 'rgba(226, 193, 124, 0.3)',
      accentText: '#E2C17C',
      bg: '#06090E',
      surface: '#111827',
      border: '#243044',
      text: '#F3F4F6',
      textMuted: '#9CA3AF',
      sidebarBg: '#0B0F17',
      sidebarText: '#FFFFFF',
      sidebarBorder: '#1A2332',
      sidebarActive: '#E2C17C',
      headerBg: 'rgba(17, 24, 39, 0.95)',
      headerBorder: '#243044',
      btnSecondaryBg: '#1F2937',
      btnSecondaryText: '#F3F4F6',
      btnSecondaryBorder: '#2A374A',
    },
  },
];

export const THEME_STORAGE_KEY = 'easybill_color_theme';
export const THEME_MODE_STORAGE_KEY = 'easybill_theme_mode';

export function getStoredThemePreset(): ThemePresetId {
  if (typeof window === 'undefined') return 'navy-teal';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePresetId | null;
    if (stored && THEME_PRESETS.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'navy-teal';
}

export function setStoredThemePreset(themeId: ThemePresetId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore
  }
}

export function getStoredThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'light';
}

export function setStoredThemeMode(mode: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function applyThemeToDom(themeId: ThemePresetId, mode: 'light' | 'dark' = 'light'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Set data-theme attribute
  root.setAttribute('data-theme', themeId);
  root.classList.toggle('dark', mode === 'dark');

  // Find preset definition
  const preset = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
  const colors = mode === 'dark' ? preset.dark : preset.light;

  // Apply CSS variables directly to :root style for instant non-lagging reactivity
  root.style.setProperty('--eb-primary', colors.primary);
  root.style.setProperty('--eb-primary-hover', colors.primaryHover);
  root.style.setProperty('--eb-secondary', colors.secondary);
  root.style.setProperty('--eb-accent', colors.accent);
  root.style.setProperty('--eb-accent-hover', colors.accentHover);
  root.style.setProperty('--eb-accent-light', colors.accentLight);
  root.style.setProperty('--eb-accent-border', colors.accentBorder);
  root.style.setProperty('--eb-accent-text', colors.accentText);
  root.style.setProperty('--eb-bg', colors.bg);
  root.style.setProperty('--eb-surface', colors.surface);
  root.style.setProperty('--eb-border', colors.border);
  root.style.setProperty('--eb-text', colors.text);
  root.style.setProperty('--eb-text-muted', colors.textMuted);
  root.style.setProperty('--eb-sidebar-bg', colors.sidebarBg);
  root.style.setProperty('--eb-sidebar-text', colors.sidebarText);
  root.style.setProperty('--eb-sidebar-border', colors.sidebarBorder);
  root.style.setProperty('--eb-sidebar-active', colors.sidebarActive);
  root.style.setProperty('--eb-header-bg', colors.headerBg);
  root.style.setProperty('--eb-header-border', colors.headerBorder);
  root.style.setProperty('--eb-btn-secondary-bg', colors.btnSecondaryBg);
  root.style.setProperty('--eb-btn-secondary-text', colors.btnSecondaryText);
  root.style.setProperty('--eb-btn-secondary-border', colors.btnSecondaryBorder);

  // Sync selection highlight and caret colors
  root.style.setProperty('--eb-ring', colors.accent);
}
