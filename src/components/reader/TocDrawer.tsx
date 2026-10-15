"use client";
import { useEffect, useRef } from "react";
import { IconClose } from "@/components/icons";
import type { TocItem } from "./toc";
import { THEMES, type Theme } from "./settings";

export default function TocDrawer({
  open,
  toc,
  loading,
  currentChapter,
  theme,
  title,
  onClose,
  onGo,
}: {
  open: boolean;
  toc: TocItem[];
  loading: boolean;
  currentChapter: TocItem | null;
  theme: Theme;
  title: string;
  onClose: () => void;
  onGo: (page: number) => void;
}) {
  const t = THEMES[theme];
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute left-0 top-0 bottom-0 w-[86%] max-w-sm flex flex-col shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: t.bg, color: t.fg }}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 border-b" style={{ borderColor: t.border }}>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider" style={{ color: t.sub }}>Sommaire</p>
            <p className="font-semibold truncate">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 rounded-full hover:bg-black/5">
            <IconClose />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 overscroll-contain">
          {loading && <p className="px-5 py-4 text-sm" style={{ color: t.sub }}>Chargement…</p>}
          {!loading && toc.length === 0 && (
            <p className="px-5 py-4 text-sm" style={{ color: t.sub }}>Ce document ne contient pas de sommaire.</p>
          )}
          {toc.map((item, i) => {
            const active = item === currentChapter;
            return (
              <button
                key={i}
                ref={active ? activeRef : undefined}
                disabled={item.page == null}
                onClick={() => item.page != null && onGo(item.page)}
                className="relative w-full flex items-baseline gap-3 py-2.5 pr-5 text-left hover:bg-black/5 disabled:opacity-40"
                style={{ paddingLeft: `${1.25 + item.depth * 1}rem`, fontWeight: active ? 600 : item.depth === 0 ? 500 : 400 }}
              >
                {active && <span className="absolute left-0 w-1 h-5 rounded-r bg-accent" />}
                <span className={`flex-1 ${item.depth > 0 ? "text-sm" : ""}`}>{item.title}</span>
                {item.page != null && (
                  <span className="text-xs tabular-nums" style={{ color: t.sub }}>{item.page}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
