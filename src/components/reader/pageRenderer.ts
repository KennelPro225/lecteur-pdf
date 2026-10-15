import type { PDFDoc } from "@/lib/pdf";

export type Layout = {
  /** available CSS width / height for the visible page(s) */
  w: number;
  h: number;
  fit: "page" | "width";
  zoom: number;
  cols: 1 | 2;
  dpr: number;
};

type RenderTask = { cancel: () => void; promise: Promise<void> };

/** Max backing-store pixels per page canvas (keeps memory bounded on big screens). */
const MAX_PIXELS = 5_000_000;

/**
 * Renders PDF pages into detached canvases and keeps a small cache so that
 * turning to an already-rendered page is just a DOM swap (instant).
 */
export class PageRenderer {
  private cache = new Map<number, HTMLCanvasElement>();
  private inflight = new Map<number, Promise<HTMLCanvasElement>>();
  private tasks = new Map<number, RenderTask>();
  private layout: Layout | null = null;
  private key = "";

  constructor(private doc: PDFDoc) {}

  setLayout(layout: Layout) {
    const key = `${Math.round(layout.w)}x${Math.round(layout.h)}|${layout.fit}|${layout.zoom}|${layout.cols}|${layout.dpr}`;
    if (key === this.key) return false;
    this.clear();
    this.key = key;
    this.layout = layout;
    return true;
  }

  get(n: number) {
    return this.cache.get(n);
  }

  render(n: number): Promise<HTMLCanvasElement> {
    const cached = this.cache.get(n);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(n);
    if (pending) return pending;
    const key = this.key;
    const layout = this.layout;
    if (!layout) return Promise.reject(new Error("no layout"));

    const p = (async () => {
      const page = await this.doc.getPage(n);
      if (key !== this.key) throw new Error("stale");
      const base = page.getViewport({ scale: 1 });
      const availW = layout.w / layout.cols;
      const zoomFactor = (layout.zoom || 100) / 100;
      const baseScale = layout.fit === "page" ? Math.min(availW / base.width, layout.h / base.height) : availW / base.width;
      const scale = baseScale * zoomFactor;
      const cssW = Math.floor(base.width * scale);
      const cssH = Math.floor(base.height * scale);
      let ratio = layout.dpr;
      if (cssW * cssH * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (cssW * cssH));
      const viewport = page.getViewport({ scale: scale * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("no 2d context");
      const task = page.render({ canvas, canvasContext: ctx, viewport, background: "#ffffff" });
      this.tasks.set(n, task);
      try {
        await task.promise;
      } finally {
        if (this.tasks.get(n) === task) this.tasks.delete(n);
      }
      if (key !== this.key) {
        canvas.width = 0;
        throw new Error("stale");
      }
      this.cache.set(n, canvas);
      return canvas;
    })();

    this.inflight.set(n, p);
    p.catch(() => {}).finally(() => {
      if (this.inflight.get(n) === p) this.inflight.delete(n);
    });
    return p;
  }

  /** Drop cached canvases and cancel renders for pages that are not in `keep`. */
  retain(keep: Set<number>) {
    for (const [n, c] of this.cache) {
      if (!keep.has(n) && !c.isConnected) {
        c.width = 0;
        c.height = 0;
        this.cache.delete(n);
      }
    }
    for (const [n, t] of this.tasks) {
      if (!keep.has(n)) {
        t.cancel();
        this.tasks.delete(n);
      }
    }
  }

  clear() {
    for (const t of this.tasks.values()) t.cancel();
    this.tasks.clear();
    this.inflight.clear();
    for (const c of this.cache.values()) {
      if (!c.isConnected) {
        c.width = 0;
        c.height = 0;
      }
    }
    this.cache.clear();
  }

  destroy() {
    this.clear();
    this.layout = null;
  }
}

