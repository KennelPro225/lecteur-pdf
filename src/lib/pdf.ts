"use client";
import type * as PdfJs from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | null = null;

/** Lazily loads pdf.js (kept out of the initial bundle) and wires the local worker. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}

/** Start downloading pdf.js + worker ahead of time (e.g. on hover). */
export function prefetchPdfJs() {
  void loadPdfJs();
}

export type PDFDoc = PdfJs.PDFDocumentProxy;

/** Renders page 1 of a PDF into a small WebP blob, used as a book cover. */
export async function renderCover(doc: PDFDoc, width = 360): Promise<Blob | null> {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.8));
}

