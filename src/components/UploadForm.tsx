"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCheck, IconClose, IconPlus, IconUpload } from "@/components/icons";
import { loadPdfJs, renderCover } from "@/lib/pdf";
import { BOOK_CATEGORIES, parseTitleAndAuthorFromFilename, type UserCollection } from "@/lib/books";

type Prepared = {
  cover: Blob | null;
  pageCount: number | null;
  pdfTitle?: string;
  pdfAuthor?: string;
  fileHash?: string;
};

type DuplicateBookInfo = {
  id: string;
  title: string;
  author: string;
  category: string;
  visibility: string;
  pageCount: number | null;
  isOwner: boolean;
  canAttach: boolean;
};

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string | undefined> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {}
  return undefined;
}

/** Reads the PDF locally to extract a cover, page count, metadata (title/author) and SHA-256 hash (max ~5 s). */
async function prepare(file: File): Promise<Prepared> {
  const work = (async () => {
    const rawBuffer = await file.arrayBuffer();
    const fileHashPromise = computeSha256Hex(rawBuffer);
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(rawBuffer) });
    try {
      const doc = await task.promise;
      let pdfTitle: string | undefined;
      let pdfAuthor: string | undefined;
      try {
        const meta = await doc.getMetadata();
        const info = meta?.info as Record<string, unknown> | undefined;
        if (info && typeof info.Title === "string" && info.Title.trim()) {
          pdfTitle = info.Title.trim();
        }
        if (info && typeof info.Author === "string" && info.Author.trim()) {
          pdfAuthor = info.Author.trim();
        }
      } catch {}
      const [cover, fileHash] = await Promise.all([renderCover(doc), fileHashPromise]);
      return { cover, pageCount: doc.numPages, pdfTitle, pdfAuthor, fileHash };
    } finally {
      void task.destroy();
    }
  })();
  const timeout = new Promise<Prepared>((r) => setTimeout(() => r({ cover: null, pageCount: null }), 5000));
  return Promise.race([work, timeout]).catch(() => ({ cover: null, pageCount: null }));
}

export default function UploadForm({
  variant = "button",
  collections = [],
}: {
  variant?: "button" | "hero";
  collections?: UserCollection[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [fileHash, setFileHash] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string>("Roman & Fiction");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Promise<Prepared> | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{ reason: string; book: DuplicateBookInfo } | null>(null);
  const [attaching, setAttaching] = useState(false);
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

  // Live duplicate check when title, author, or fileHash changes
  useEffect(() => {
    if (!open) return;
    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const timer = setTimeout(async () => {
      if (!trimmedTitle && !fileHash) {
        setDuplicate(null);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (trimmedTitle) params.set("title", trimmedTitle);
        if (trimmedAuthor) params.set("author", trimmedAuthor);
        if (fileHash) params.set("hash", fileHash);
        const res = await fetch(`/api/books/check?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.exists && data.book) {
          setDuplicate({ reason: data.reason, book: data.book });
        } else {
          setDuplicate(null);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [open, title, author, fileHash]);

  const reset = () => {
    setTitle("");
    setAuthor("");
    setFileHash(undefined);
    setCategory("Roman & Fiction");
    setSelectedCollections([]);
    setFile(null);
    setPreview(null);
    setPrepared(null);
    setProgress(null);
    setError("");
    setDuplicate(null);
    setAttaching(false);
    setIsPublic(false);
  };

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setError("");
    setDuplicate(null);
    setFile(f);
    const parsedFromName = parseTitleAndAuthorFromFilename(f.name);
    setTitle((t) => t || parsedFromName.title);
    setAuthor((a) => a || parsedFromName.author);

    const p = prepare(f);
    setPrepared(p);
    void p.then((r) => {
      if (r.cover) setPreview(URL.createObjectURL(r.cover));
      if (r.fileHash) setFileHash(r.fileHash);
      if (r.pdfTitle && r.pdfTitle.length > 2 && !/\.pdf$/i.test(r.pdfTitle)) {
        setTitle((curr) => (curr === parsedFromName.title || !curr ? r.pdfTitle! : curr));
      }
      if (r.pdfAuthor && r.pdfAuthor.length > 1) {
        setAuthor((curr) => curr || r.pdfAuthor!);
      }
    });
  };

  const handleAttachExisting = async () => {
    if (!duplicate?.book || attaching) return;
    setAttaching(true);
    setError("");
    try {
      const res = await fetch("/api/books/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: duplicate.book.id,
          collectionIds: selectedCollections,
        }),
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Impossible de rattacher ce livre");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setAttaching(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || progress != null || duplicate) return;
    setProgress(0);
    setError("");
    const { cover, pageCount } = (await prepared) ?? { cover: null, pageCount: null };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("author", author.trim() || "Auteur inconnu");
    fd.append("category", category);
    fd.append("visibility", isPublic ? "public" : "private");
    for (const cid of selectedCollections) {
      fd.append("collectionIds", cid);
    }
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
          const resp = JSON.parse(xhr.responseText);
          if (xhr.status === 409 && resp.duplicate && resp.book) {
            setDuplicate({ reason: resp.reason, book: resp.book });
          } else {
            setError(resp.error ?? "Échec de l'envoi");
          }
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
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] flex flex-col gap-4 animate-[slideUp_.2s_ease-out] max-h-[90dvh] overflow-y-auto"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-600">Titre du livre</span>
                <input
                  required
                  className="rounded-xl border border-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  placeholder="Ex: Pensées pour moi-même"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-600">Auteur</span>
                <input
                  required
                  className="rounded-xl border border-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  placeholder="Ex: Marc Aurèle"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </label>
            </div>

            {duplicate && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 flex flex-col gap-2.5">
                <div>
                  <p className="font-semibold text-amber-900">
                    {duplicate.reason === "file_hash"
                      ? "Ce fichier PDF exact est déjà présent sur l'application"
                      : "Un livre avec ce même titre et cet auteur existe déjà"}
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    « <span className="font-medium">{duplicate.book.title}</span> » par{" "}
                    <span className="font-medium">{duplicate.book.author}</span> ({duplicate.book.category})
                  </p>
                </div>

                {duplicate.book.canAttach ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!duplicate.book.isOwner && (
                      <button
                        type="button"
                        onClick={handleAttachExisting}
                        disabled={attaching}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-paper px-3 py-2 text-xs font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
                      >
                        <IconCheck width={14} height={14} />
                        {attaching ? "Rattachement…" : "Rattacher à ma bibliothèque"}
                      </button>
                    )}
                    <Link
                      href={`/reader/${duplicate.book.id}`}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 transition-colors"
                    >
                      Ouvrir et lire maintenant →
                    </Link>
                  </div>
                ) : (
                  <p className="text-amber-800">
                    Ce livre a déjà été importé en mode privé sur la plateforme. Les doublons ne sont pas autorisés.
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-stone-600">Catégorie du livre</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300"
              >
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {collections.length > 0 && (
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-600">Ajouter à mes listes de lecture</span>
                <div className="flex flex-wrap gap-1.5">
                  {collections.map((col) => {
                    const active = selectedCollections.includes(col.id);
                    return (
                      <button
                        type="button"
                        key={col.id}
                        onClick={() => toggleCollection(col.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          active
                            ? "bg-ink text-paper border-ink"
                            : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                        }`}
                      >
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
              disabled={!file || progress != null || Boolean(duplicate)}
              className="relative overflow-hidden rounded-xl bg-ink text-paper py-3 font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {progress != null && (
                <span className="absolute inset-y-0 left-0 bg-white/20 transition-[width]" style={{ width: `${progress * 100}%` }} />
              )}
              <span className="relative">
                {duplicate
                  ? "Livre déjà existant (voir ci-dessus)"
                  : progress == null
                  ? "Ajouter à ma bibliothèque"
                  : progress < 1
                  ? `Envoi… ${Math.round(progress * 100)} %`
                  : "Finalisation…"}
              </span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}


