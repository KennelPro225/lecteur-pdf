export type Theme = "light" | "sepia" | "dark";
export type Fit = "page" | "width";
export type ReaderSettings = { theme: Theme; fit: Fit; spread: boolean; zoom: number };

export const ZOOM_LEVELS = [75, 90, 100, 115, 130, 150, 175, 200] as const;
export const DEFAULT_SETTINGS: ReaderSettings = { theme: "light", fit: "page", spread: false, zoom: 100 };
const KEY = "folio:reader-settings";

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export const THEMES: Record<
  Theme,
  { label: string; bg: string; fg: string; sub: string; chrome: string; border: string; pageStyle: React.CSSProperties }
> = {
  light: {
    label: "Blanc",
    bg: "#ffffff",
    fg: "#1c1917",
    sub: "#78716c",
    chrome: "rgba(255,255,255,0.94)",
    border: "#e7e5e4",
    pageStyle: {},
  },
  sepia: {
    label: "Sépia",
    bg: "#f4ecd8",
    fg: "#5b4636",
    sub: "#8b7660",
    chrome: "rgba(244,236,216,0.96)",
    border: "#e3d6b8",
    pageStyle: { mixBlendMode: "multiply" },
  },
  dark: {
    label: "Nuit",
    bg: "#1a1a1a",
    fg: "#e7e5e4",
    sub: "#a8a29e",
    chrome: "rgba(30,30,30,0.96)",
    border: "#333333",
    pageStyle: { filter: "invert(0.9) hue-rotate(180deg)" },
  },
};

// ---------- reading speed (Kindle-like "time left") ----------
const SPEED_KEY = "folio:speed";
type Speed = { ema: number; n: number };

export function loadSpeed(): Speed | null {
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    return raw ? (JSON.parse(raw) as Speed) : null;
  } catch {
    return null;
  }
}

export function recordPageTime(seconds: number): Speed | null {
  if (seconds < 3 || seconds > 600) return loadSpeed();
  const prev = loadSpeed();
  const next: Speed = prev ? { ema: prev.ema * 0.85 + seconds * 0.15, n: prev.n + 1 } : { ema: seconds, n: 1 };
  try {
    localStorage.setItem(SPEED_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function formatDuration(seconds: number) {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

// ---------- local position cache ----------
const posKey = (bookId: string) => `folio:pos:${bookId}`;

export function loadLocalPosition(bookId: string): { page: number; t: number } | null {
  try {
    const raw = localStorage.getItem(posKey(bookId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalPosition(bookId: string, page: number) {
  try {
    localStorage.setItem(posKey(bookId), JSON.stringify({ page, t: Date.now() }));
  } catch {}
}

