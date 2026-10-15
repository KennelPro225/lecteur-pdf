"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { loadPdfJs, renderCover, type PDFDoc } from "@/lib/pdf";
import { IconAa, IconBack, IconExitFullscreen, IconFullscreen, IconList } from "@/components/icons";
import { PageRenderer } from "./pageRenderer";
import {
  THEMES,
  formatDuration,
  loadLocalPosition,
  loadSettings,
  loadSpeed,
  recordPageTime,
  saveLocalPosition,
  saveSettings,
  ZOOM_LEVELS,
  type ReaderSettings,
} from "./settings";
import { chapterAt, loadToc, type TocItem } from "./toc";
import TocDrawer from "./TocDrawer";
import SettingsPopover from "./SettingsPopover";

export type ReaderProps = {
  bookId: string;
  title: string;
  fileUrl: string;
  coverUrl: string;
  initialPage: number;
  serverUpdatedAt: number | null;
  knownPageCount: number | null;
  isOwner: boolean;
};

type InfoMode = "page" | "chapter" | "book";
const INFO_MODES: InfoMode[] = ["page", "chapter", "book"];
const STAGE_PAD = 12;

export default function Reader({
  bookId,
  title,
  fileUrl,
  coverUrl,
  initialPage,
  serverUpdatedAt,
  knownPageCount,
  isOwner,
}: ReaderProps) {
  // ---------- state ----------
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [doc, setDoc] = useState<PDFDoc | null>(null);
  const [numPages, setNumPages] = useState(knownPageCount ?? 0);
  const [page, setPage] = useState(() => {
    // Most recent position wins: this device (localStorage) vs. server (other devices).
    const local = loadLocalPosition(bookId);
    if (local && (!serverUpdatedAt || local.t > serverUpdatedAt)) return local.page;
    return initialPage;
  });
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chrome, setChrome] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocLoading, setTocLoading] = useState(true);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const [infoMode, setInfoMode] = useState<InfoMode>("page");
  const [speed, setSpeed] = useState(loadSpeed);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const slotA = useRef<HTMLDivElement>(null);
  const slotB = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PageRenderer | null>(null);
  const genRef = useRef(0);
  const shownRef = useRef<number | null>(null);
  const lastTurnRef = useRef(0);

  const theme = THEMES[settings.theme];
  const spreadAvailable = !!size && size.w >= 900 && size.w > size.h;
  const spread = settings.spread && spreadAvailable;
  const clampPage = useCallback((p: number) => Math.min(Math.max(1, p), Math.max(1, numPages)), [numPages]);

  // ---------- page arithmetic (single / spread) ----------
  const spreadStart = useCallback((p: number) => (p <= 1 ? 1 : p % 2 === 0 ? p : p - 1), []);
  const visiblePages = useCallback(
    (p: number) => {
      if (!spread) return [p];
      const s = spreadStart(p);
      return s === 1 ? [1] : [s, s + 1].filter((n) => n <= numPages);
    },
    [spread, spreadStart, numPages],
  );
  const nextStart = useCallback(
    (p: number) => (spread ? (spreadStart(p) === 1 ? 2 : spreadStart(p) + 2) : p + 1),
    [spread, spreadStart],
  );
  const prevStart = useCallback(
    (p: number) => (spread ? (spreadStart(p) <= 3 ? 1 : spreadStart(p) - 2) : p - 1),
    [spread, spreadStart],
  );

  const visible = visiblePages(page);
  const lastVisible = visible[visible.length - 1];
  const percent = numPages ? Math.round((lastVisible / numPages) * 100) : 0;

  // ---------- navigation ----------
  const goTo = useCallback(
    (p: number, opts?: { jump?: boolean }) => {
      if (!numPages) return;
      const target = clampPage(p);
      if (opts?.jump) setReturnTo((r) => r ?? page);
      setPage(target);
    },
    [clampPage, numPages, page],
  );

  const next = useCallback(() => {
    if (!numPages) return;
    const n = nextStart(page);
    if (n > numPages) return;
    const now = performance.now();
    if (lastTurnRef.current) setSpeed(recordPageTime((now - lastTurnRef.current) / 1000));
    lastTurnRef.current = now;
    setPage(n);
    setChrome(false);
  }, [nextStart, numPages, page]);

  const prev = useCallback(() => {
    const n = prevStart(page);
    if (n < 1) return;
    lastTurnRef.current = performance.now();
    setPage(n);
    setChrome(false);
  }, [page, prevStart]);

  // ---------- settings persistence ----------
  useEffect(() => saveSettings(settings), [settings]);

  // ---------- load document ----------
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        const loadingTask = pdfjs.getDocument({ url: fileUrl });
        task = loadingTask;
        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (total) setLoadProgress(Math.min(1, loaded / total));
        };
        const d = await loadingTask.promise;
        if (cancelled) return;
        rendererRef.current = new PageRenderer(d);
        setNumPages(d.numPages);
        setPage((p) => Math.min(Math.max(1, p), d.numPages));
        setDoc(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Impossible d'ouvrir ce document.");
      }
    })();
    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      void task?.destroy();
    };
  }, [fileUrl]);

  // ---------- table of contents (background) ----------
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    loadToc(doc)
      .then((items) => !cancelled && setToc(items))
      .catch(() => {})
      .finally(() => !cancelled && setTocLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // ---------- generate cover for older books (owner only, once) ----------
  useEffect(() => {
    if (!doc || !isOwner) return;
    let cancelled = false;
    const run = async () => {
      const head = await fetch(coverUrl);
      if (head.ok || cancelled) return;
      const blob = await renderCover(doc);
      if (blob && !cancelled) await fetch(`/api/books/${bookId}/cover`, { method: "POST", body: blob });
    };
    const id = setTimeout(() => void run().catch(() => {}), 2500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [doc, isOwner, coverUrl, bookId]);

  // ---------- measure stage ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(100, r.width - STAGE_PAD * 2), h: Math.max(100, r.height - STAGE_PAD * 2) });
    };
    measure();
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(measure, 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  // ---------- render visible pages + prefetch neighbours ----------
  useEffect(() => {
    const r = rendererRef.current;
    if (!doc || !r || !size) return;
    const layoutChanged = r.setLayout({
      w: size.w,
      h: size.h,
      fit: settings.fit,
      zoom: settings.zoom ?? 100,
      cols: spread ? 2 : 1,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const pages = visiblePages(page);
    const gen = ++genRef.current;

    const mount = (canvases: HTMLCanvasElement[]) => {
      if (gen !== genRef.current) return;
      slotA.current?.replaceChildren(canvases[0]);
      if (canvases[1]) slotB.current?.replaceChildren(canvases[1]);
      else slotB.current?.replaceChildren();
      const prevShown = shownRef.current;
      shownRef.current = pages[0];
      if (settings.fit === "width") stageRef.current?.scrollTo({ top: 0 });
      // subtle Kindle-like page-turn motion for adjacent pages
      const delta = prevShown == null ? 0 : pages[0] - prevShown;
      if (!layoutChanged && delta !== 0 && Math.abs(delta) <= 2 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const dir = delta > 0 ? 1 : -1;
        spreadRef.current?.animate(
          [
            { transform: `translateX(${dir * 28}px)`, opacity: 0.35 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 180, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
      }
    };

    const neighbours = [nextStart(page), nextStart(nextStart(page)), prevStart(page)]
      .filter((n) => n >= 1 && n <= numPages)
      .flatMap((n) => visiblePages(n));
    r.retain(new Set([...pages, ...neighbours]));

    const prefetch = async () => {
      for (const n of neighbours) {
        if (gen !== genRef.current) return;
        await new Promise<void>((res) =>
          "requestIdleCallback" in window ? requestIdleCallback(() => res(), { timeout: 300 }) : setTimeout(res, 16),
        );
        if (gen !== genRef.current) return;
        await r.render(n).catch(() => {});
      }
    };

    const cached = pages.map((n) => r.get(n));
    if (cached.every(Boolean)) {
      mount(cached as HTMLCanvasElement[]);
      void prefetch();
      return;
    }
    const spinner = setTimeout(() => gen === genRef.current && setBusy(true), 150);
    Promise.all(pages.map((n) => r.render(n)))
      .then((canvases) => {
        mount(canvases);
        void prefetch();
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(spinner);
        if (gen === genRef.current) setBusy(false);
      });
    return () => clearTimeout(spinner);
  }, [doc, size, page, settings.fit, settings.zoom, spread, visiblePages, nextStart, prevStart, numPages]);

  // ---------- progress sync ----------
  const dirtyRef = useRef(false);
  const latestRef = useRef({ page, numPages });
  const flush = useCallback(
    (beacon: boolean) => {
      const { page: p, numPages: total } = latestRef.current;
      if (!dirtyRef.current || !total) return;
      dirtyRef.current = false;
      const body = JSON.stringify({ bookId, page: p, pageCount: total });
      if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/progress", body);
      else void fetch("/api/progress", { method: "PUT", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    },
    [bookId],
  );

  useEffect(() => {
    if (!doc) return;
    latestRef.current = { page, numPages };
    saveLocalPosition(bookId, page);
    dirtyRef.current = true;
    const t = setTimeout(() => flush(false), 800);
    return () => clearTimeout(t);
  }, [doc, page, numPages, bookId, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [flush]);

  // ---------- keep the screen awake while reading ----------
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => {});
    };
  }, []);

  // ---------- fullscreen ----------
  useEffect(() => {
    const on = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range") return;
      if (e.key === "Escape") {
        if (tocOpen) setTocOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else setChrome(false);
        return;
      }
      if (tocOpen || settingsOpen) return;
      if (target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") goTo(1);
      else if (e.key === "End") goTo(numPages);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setSettings((s) => {
          const cur = s.zoom ?? 100;
          const nextZ = ZOOM_LEVELS.find((z) => z > cur) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
          return { ...s, zoom: nextZ };
        });
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setSettings((s) => {
          const cur = s.zoom ?? 100;
          const prevZ = [...ZOOM_LEVELS].reverse().find((z) => z < cur) ?? ZOOM_LEVELS[0];
          return { ...s, zoom: prevZ };
        });
      } else if (e.key === "0") {
        setSettings((s) => ({ ...s, zoom: 100 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, numPages, tocOpen, settingsOpen, toggleFullscreen]);

  // ---------- tap zones & swipe ----------
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = performance.now() - start.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
      if (dx < 0) next();
      else prev();
      return;
    }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || dt > 600) return; // drag / scroll / long-press
    if (window.getSelection()?.toString()) return;
    const w = window.innerWidth;
    if (e.clientX < w * 0.28) prev();
    else if (e.clientX > w * 0.72) next();
    else setChrome((c) => !c);
  };

  // ---------- derived info ----------
  const { current: chapter, nextPage: nextChapterPage } = useMemo(() => chapterAt(toc, page), [toc, page]);
  const shownPage = scrub ?? page;
  const scrubChapter = useMemo(() => (scrub != null ? chapterAt(toc, scrub).current : null), [toc, scrub]);
  const secPerPage = speed && speed.n >= 3 ? speed.ema : null;

  const infoText = (() => {
    if (!numPages) return "";
    if (infoMode === "page") return `Page ${lastVisible} sur ${numPages}`;
    if (!secPerPage) return "Apprentissage de votre vitesse de lecture…";
    if (infoMode === "chapter") {
      if (!nextChapterPage) return `${formatDuration((numPages - lastVisible) * secPerPage)} restantes dans le livre`;
      return `${formatDuration(Math.max(1, nextChapterPage - lastVisible - 1) * secPerPage)} restantes dans le chapitre`;
    }
    return `${formatDuration((numPages - lastVisible) * secPerPage)} restantes dans le livre`;
  })();
  const cycleInfo = () => setInfoMode((m) => INFO_MODES[(INFO_MODES.indexOf(m) + 1) % INFO_MODES.length]);

  const commitScrub = () => {
    if (scrub == null) return;
    if (scrub !== page) goTo(scrub, { jump: true });
    setScrub(null);
  };

  const iconBtn = "grid place-items-center w-10 h-10 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors";

  const isZoomedOrWidth = (settings.zoom ?? 100) > 100 || settings.fit === "width";

  // ---------- render ----------
  return (
    <div
      className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ background: theme.bg, color: theme.fg, transition: "background-color .25s, color .25s" }}
    >
      {/* Stage */}
      <div
        ref={stageRef}
        className={`relative flex-1 min-h-0 ${isZoomedOrWidth ? "overflow-auto overscroll-contain" : "overflow-hidden"}`}
        style={{ padding: STAGE_PAD, paddingTop: `calc(env(safe-area-inset-top) + ${STAGE_PAD}px)`, touchAction: isZoomedOrWidth ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointer.current = null)}
      >
        <div
          ref={spreadRef}
          className={`flex justify-center min-w-full ${settings.fit === "page" && (settings.zoom ?? 100) <= 100 ? "items-center h-full" : "items-start min-h-full py-2"}`}
        >
          <div ref={slotA} style={theme.pageStyle} className={spread && visible.length === 2 ? "shadow-[inset_-12px_0_16px_-12px_rgba(0,0,0,.25)]" : ""} />
          <div ref={slotB} style={theme.pageStyle} />
        </div>

        {/* Initial loading: show the cover while pdf.js warms up */}
        {!doc && !error && (
          <div className="absolute inset-0 grid place-items-center p-8">
            <div className="flex flex-col items-center gap-5 w-full max-w-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                className="w-full aspect-[2/3] object-cover rounded-md shadow-xl animate-pulse"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: theme.border }}>
                <div
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${Math.max(8, loadProgress * 100)}%`, background: theme.fg }}
                />
              </div>
              <p className="text-sm text-center line-clamp-2" style={{ color: theme.sub }}>{title}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <p className="font-semibold">Impossible d&apos;ouvrir ce livre</p>
              <p className="text-sm mt-1" style={{ color: theme.sub }}>{error}</p>
              <Link href="/" className="inline-block mt-4 rounded-full px-4 py-2 text-sm border" style={{ borderColor: theme.border }}>
                Retour à la bibliothèque
              </Link>
            </div>
          </div>
        )}
        {busy && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" />
          </div>
        )}
      </div>

      {/* Always-visible discreet footer (Kindle style) */}
      <footer
        className="h-9 shrink-0 flex items-center justify-between px-4 text-[11px] tabular-nums pb-[env(safe-area-inset-bottom)] box-content"
        style={{ color: theme.sub }}
      >
        <button onClick={cycleInfo} className="truncate text-left hover:opacity-80 py-2" aria-label="Changer l'indicateur de progression">
          {infoText}
        </button>
        <span className="shrink-0 pl-3">{numPages ? `${percent} %` : ""}</span>
      </footer>

      {/* Top chrome */}
      <div
        className={`absolute inset-x-0 top-0 z-30 border-b backdrop-blur-md transition-all duration-200 pt-[env(safe-area-inset-top)] ${chrome ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
        style={{ background: theme.chrome, borderColor: theme.border }}
      >
        <div className="h-14 flex items-center gap-1 px-2">
          <Link href="/" className={iconBtn} aria-label="Bibliothèque">
            <IconBack />
          </Link>
          <div className="flex-1 min-w-0 px-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            {chapter && <p className="text-xs truncate" style={{ color: theme.sub }}>{chapter.title}</p>}
          </div>
          <button className={iconBtn} aria-label="Sommaire" onClick={() => setTocOpen(true)}>
            <IconList />
          </button>
          <button className={iconBtn} aria-label="Affichage" onClick={() => setSettingsOpen((o) => !o)}>
            <div className="relative">
              <IconAa />
              {(settings.zoom ?? 100) !== 100 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full bg-accent text-white leading-tight">
                  {settings.zoom}%
                </span>
              )}
            </div>
          </button>
          <button className={`${iconBtn} hidden sm:grid`} aria-label="Plein écran" onClick={toggleFullscreen}>
            {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
          </button>
        </div>
      </div>

      {/* Bottom chrome */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 border-t backdrop-blur-md transition-all duration-200 pb-[env(safe-area-inset-bottom)] ${chrome ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
        style={{ background: theme.chrome, borderColor: theme.border }}
      >
        <div className="max-w-3xl mx-auto px-5 pt-3 pb-4">
          {scrub != null && (
            <div className="text-center text-xs mb-2 truncate" style={{ color: theme.sub }}>
              {scrubChapter ? `${scrubChapter.title} · ` : ""}Page {scrub}
            </div>
          )}
          <input
            type="range"
            min={1}
            max={Math.max(1, numPages)}
            value={shownPage}
            disabled={!numPages}
            aria-label="Progression"
            className="kindle-range w-full"
            style={{ ["--pct" as string]: `${numPages > 1 ? ((shownPage - 1) / (numPages - 1)) * 100 : 0}%`, ["--thumb-ring" as string]: theme.bg, color: theme.fg }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs tabular-nums" style={{ color: theme.sub }}>
            <span>
              Page {lastVisible} sur {numPages || "…"}
            </span>
            {returnTo != null && returnTo !== page ? (
              <button
                className="rounded-full border px-3 py-1 font-medium"
                style={{ borderColor: theme.border, color: theme.fg }}
                onClick={() => {
                  setPage(returnTo);
                  setReturnTo(null);
                }}
              >
                ← Revenir à la page {returnTo}
              </button>
            ) : (
              <span>{percent} % lu</span>
            )}
          </div>
        </div>
      </div>

      <TocDrawer
        open={tocOpen}
        toc={toc}
        loading={tocLoading && !!doc}
        currentChapter={chapter}
        theme={settings.theme}
        title={title}
        onClose={() => setTocOpen(false)}
        onGo={(p) => {
          goTo(p, { jump: true });
          setTocOpen(false);
          setChrome(false);
        }}
      />
      <SettingsPopover
        open={settingsOpen}
        settings={settings}
        spreadAvailable={spreadAvailable}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
