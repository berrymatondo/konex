const KEY = "app.settings";

export const APP_SETTINGS_DEFAULTS = {
  usdcdf: 2888.50,
} as const;

export type AppSettings = { usdcdf: number };

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") return { ...APP_SETTINGS_DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...APP_SETTINGS_DEFAULTS };
    return { ...APP_SETTINGS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...APP_SETTINGS_DEFAULTS };
  }
}

export function writeAppSettings(patch: Partial<AppSettings>): void {
  const current = readAppSettings();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}
