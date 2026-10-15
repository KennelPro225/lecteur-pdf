"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconClose, IconPlus, IconUpload } from "@/components/icons";
import { loadPdfJs, renderCover } from "@/lib/pdf";

type Prepared = { cover: Blob | null; pageCount: number | null };

/** Reads the PDF locally to extract a cover and the page count (max ~5 s). */
async function prepare(file: File): Promise<Prepared> {
  const work = (async () => {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const doc = await task.promise;
      return { cover: await renderCover(doc), pageCount: doc.numPages };
    } finally {
      void task.destroy();
    }
  })();
  const timeout = new Promise<Prepared>((r) => setTimeout(() => r({ cover: null, pageCount: null }), 5000));
  return Promise.race([work, timeout]).catch(() => ({ cover: null, pageCount: null }));
}

const titleFromFile = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*-\s*z-lib\.org.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

export default function UploadForm({ variant = "button" }: { variant?: "button" | "hero" }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Promise<Prepared> | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && progress == null && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, progress]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const reset = () => {
    setTitle("");
    setFile(null);
    setPreview(null);
    setPrepared(null);
    setProgress(null);
    setError("");
    setIsPublic(false);
  };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setError("");
    setFile(f);
    setTitle((t) => t || titleFromFile(f.name));
    const p = prepare(f);
    setPrepared(p);
    void p.then((r) => r.cover && setPreview(URL.createObjectURL(r.cover)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || progress != null) return;
    setProgress(0);
    const { cover, pageCount } = (await prepared) ?? { cover: null, pageCount: null };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("visibility", isPublic ? "public" : "private");
    if (pageCount) fd.append("pageCount", String(pageCount));
    if (cover) fd.append("cover", cover, "cover.webp");
    // XHR (not fetch) to get upload progress events.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(ev.loaded / ev.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setProgress(null);
        try {
          setError(JSON.parse(xhr.responseText).error ?? "Échec de l'envoi");
        } catch {
          setError("Échec de l'envoi");
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Erreur réseau");
    };
    xhr.send(fd);
  };

  return (
    <>
      {variant === "hero" ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 font-medium hover:bg-stone-700 transition-colors"
        >
          <IconPlus width={18} height={18} /> Ajouter mon premier livre
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper pl-3 pr-4 py-2 text-sm font-medium hover:bg-stone-700 transition-colors shrink-0"
        >
          <IconPlus width={18} height={18} /> Ajouter
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => progress == null && setOpen(false)} />
          <form
            onSubmit={submit}
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] flex flex-col gap-4 animate-[slideUp_.2s_ease-out]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un livre</h2>
              <button type="button" aria-label="Fermer" onClick={() => progress == null && setOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-stone-100">
                <IconClose width={20} height={20} />
              </button>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 cursor-pointer transition-colors ${dragging ? "border-accent bg-orange-50" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}
            >
              <div className="w-16 aspect-[2/3] shrink-0 rounded bg-stone-100 overflow-hidden grid place-items-center text-stone-400 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <IconUpload />}
              </div>
              <div className="min-w-0 text-sm">
                {file ? (
                  <>
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-stone-500">{(file.size / 1024 / 1024).toFixed(1)} Mo · cliquer pour changer</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Déposez un PDF ici</p>
                    <p className="text-stone-500">ou cliquez pour parcourir</p>
                  </>
                )}
              </div>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-stone-600">Titre</span>
              <input
                className="rounded-xl border border-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300"
                placeholder="Titre du livre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Partager avec la communauté
                <span className="block text-xs text-stone-500">Visible dans « Explorer »</span>
              </span>
              <input type="checkbox" className="peer sr-only" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <span className="relative w-11 h-6 shrink-0 rounded-full bg-stone-300 peer-checked:bg-accent transition-colors after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              disabled={!file || progress != null}
              className="relative overflow-hidden rounded-xl bg-ink text-paper py-3 font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {progress != null && (
                <span className="absolute inset-y-0 left-0 bg-white/20 transition-[width]" style={{ width: `${progress * 100}%` }} />
              )}
              <span className="relative">
                {progress == null ? "Ajouter à ma bibliothèque" : progress < 1 ? `Envoi… ${Math.round(progress * 100)} %` : "Finalisation…"}
              </span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
