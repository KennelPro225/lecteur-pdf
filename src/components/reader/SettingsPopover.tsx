"use client";
import { THEMES, ZOOM_LEVELS, type ReaderSettings, type Theme } from "./settings";

const SWATCH: Record<Theme, string> = { light: "#ffffff", sepia: "#f4ecd8", dark: "#1a1a1a" };

export default function SettingsPopover({
  open,
  settings,
  spreadAvailable,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: ReaderSettings;
  spreadAvailable: boolean;
  onChange: (s: ReaderSettings) => void;
  onClose: () => void;
}) {
  const t = THEMES[settings.theme];
  if (!open) return null;
  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm transition-colors ${active ? "font-semibold shadow-sm" : "opacity-70 hover:opacity-100"}`;

  const currentZoom = settings.zoom ?? 100;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Affichage"
        className="fixed z-50 right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border shadow-2xl p-4 space-y-5"
        style={{ background: t.bg, color: t.fg, borderColor: t.border }}
      >
        {/* Thème */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: t.sub }}>Thème</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(THEMES) as Theme[]).map((key) => (
              <button
                key={key}
                onClick={() => onChange({ ...settings, theme: key })}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs"
                style={{ outline: settings.theme === key ? `2px solid ${t.fg}` : `1px solid ${t.border}` }}
              >
                <span
                  className="w-10 h-10 rounded-full grid place-items-center font-serif text-base border"
                  style={{ background: SWATCH[key], color: THEMES[key].fg, borderColor: THEMES[key].border }}
                >
                  Aa
                </span>
                {THEMES[key].label}
              </button>
            ))}
          </div>
        </section>

        {/* Taille du texte & Zoom */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider" style={{ color: t.sub }}>
              Taille du texte · Zoom
            </p>
            <span className="text-xs font-semibold tabular-nums" style={{ color: t.fg }}>
              {currentZoom} %
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const prev = [...ZOOM_LEVELS].reverse().find((z) => z < currentZoom) ?? ZOOM_LEVELS[0];
                onChange({ ...settings, zoom: prev });
              }}
              disabled={currentZoom <= ZOOM_LEVELS[0]}
              aria-label="Réduire le zoom"
              className="w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm disabled:opacity-30 hover:bg-black/5 transition-colors shrink-0"
              style={{ borderColor: t.border }}
            >
              A-
            </button>
            <div className="flex-1 flex gap-0.5 items-center justify-between bg-black/5 dark:bg-white/5 rounded-xl p-1">
              {ZOOM_LEVELS.map((z) => (
                <button
                  key={z}
                  onClick={() => onChange({ ...settings, zoom: z })}
                  title={`${z}%`}
                  className="flex-1 py-1 rounded text-[10px] tabular-nums transition-colors"
                  style={{
                    background: currentZoom === z ? t.fg : "transparent",
                    color: currentZoom === z ? t.bg : t.sub,
                    fontWeight: currentZoom === z ? 600 : 400,
                  }}
                >
                  {z}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const next = ZOOM_LEVELS.find((z) => z > currentZoom) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
                onChange({ ...settings, zoom: next });
              }}
              disabled={currentZoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              aria-label="Agrandir le zoom"
              className="w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-base disabled:opacity-30 hover:bg-black/5 transition-colors shrink-0"
              style={{ borderColor: t.border }}
            >
              A+
            </button>
          </div>
          {currentZoom !== 100 && (
            <div className="mt-1.5 flex justify-end">
              <button
                onClick={() => onChange({ ...settings, zoom: 100 })}
                className="text-[11px] underline underline-offset-2 opacity-75 hover:opacity-100"
                style={{ color: t.sub }}
              >
                Rétablir 100 % (Normal)
              </button>
            </div>
          )}
        </section>

        {/* Ajustement */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: t.sub }}>Ajustement</p>
          <div className="flex gap-1 rounded-xl p-1" style={{ background: `color-mix(in srgb, ${t.fg} 8%, transparent)` }}>
            <button
              className={segBtn(settings.fit === "page")}
              style={settings.fit === "page" ? { background: t.bg } : undefined}
              onClick={() => onChange({ ...settings, fit: "page" })}
            >
              Page entière
            </button>
            <button
              className={segBtn(settings.fit === "width")}
              style={settings.fit === "width" ? { background: t.bg } : undefined}
              onClick={() => onChange({ ...settings, fit: "width" })}
            >
              Largeur
            </button>
          </div>
        </section>

        {/* Double page */}
        <section>
          <label className={`flex items-center justify-between gap-3 text-sm ${spreadAvailable ? "" : "opacity-50"}`}>
            <span>
              Double page
              <span className="block text-xs" style={{ color: t.sub }}>
                {spreadAvailable ? "Comme un livre ouvert" : "Disponible sur grand écran en paysage"}
              </span>
            </span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={settings.spread}
              onChange={(e) => onChange({ ...settings, spread: e.target.checked })}
            />
            <span
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              style={{ background: settings.spread ? "#e47911" : `color-mix(in srgb, ${t.fg} 25%, transparent)` }}
            />
          </label>
        </section>
      </div>
    </>
  );
}
