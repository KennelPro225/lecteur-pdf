"use client";
import { useState } from "react";
import { loadPdfJs, renderCover } from "@/lib/pdf";

const PALETTES = [
  ["#1e3a5f", "#3d6b99"],
  ["#5b2c2c", "#9a4a3c"],
  ["#2f4f3a", "#5d8a63"],
  ["#4a3b63", "#7d68a6"],
  ["#5c4421", "#a07a3c"],
  ["#263238", "#546e7a"],
  ["#6b2d4f", "#a8577f"],
  ["#1f4e4f", "#3f8b8c"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Generate at most one cover at a time so the library stays responsive.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

async function generateCover(id: string): Promise<string | null> {
  const pdfjs = await loadPdfJs();
  // Range requests + no streaming: only the bytes needed for page 1 are downloaded.
  const task = pdfjs.getDocument({ url: `/api/books/${id}/file`, disableStream: true, disableAutoFetch: true });
  try {
    const doc = await task.promise;
    const blob = await renderCover(doc);
    if (!blob) return null;
    void fetch(`/api/books/${id}/cover`, { method: "POST", body: blob }).catch(() => {});
    return URL.createObjectURL(blob);
  } finally {
    void task.destroy();
  }
}

export function FallbackCover({ id, title }: { id: string; title: string }) {
  const [a, b] = PALETTES[hash(id) % PALETTES.length];
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between p-3 text-white"
      style={{ background: `linear-gradient(150deg, ${a}, ${b})` }}
    >
      <div className="h-px bg-white/40" />
      <p className="font-serif text-[clamp(0.8rem,2.4vw,1.05rem)] leading-snug line-clamp-5 break-words">{title}</p>
      <div className="h-px bg-white/40" />
    </div>
  );
}

export default function BookCover({
  id,
  title,
  canGenerate,
  priority = false,
  className = "",
}: {
  id: string;
  title: string;
  canGenerate: boolean;
  priority?: boolean;
  className?: string;
}) {
  const [src, setSrc] = useState(`/api/books/${id}/cover`);
  const [state, setState] = useState<"loading" | "ok" | "fallback">("loading");

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[4px] bg-stone-200 shadow-[0_1px_2px_rgba(0,0,0,.12),0_6px_16px_-6px_rgba(0,0,0,.35)] ${className}`}>
      {state !== "ok" && <FallbackCover id={id} title={title} />}
      {state !== "fallback" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setState("ok")}
          onError={() => {
            setState("fallback");
            if (canGenerate && src.startsWith("/api/")) {
              void enqueue(() => generateCover(id))
                .then((url) => {
                  if (url) {
                    setSrc(url);
                    setState("loading");
                  }
                })
                .catch(() => {});
            }
          }}
        />
      )}
      {/* subtle spine highlight, like a real book */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/20 via-white/10 to-transparent" />
    </div>
  );
}

