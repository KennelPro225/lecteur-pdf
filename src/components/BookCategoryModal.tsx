"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BOOK_CATEGORIES,
  COLLECTION_COLORS,
  READING_STATUSES,
  effectiveStatusOf,
  type LibraryBook,
  type ReadingStatusKey,
  type UserCollection,
} from "@/lib/books";
import { IconCheck, IconClose, IconPlus, IconTag } from "@/components/icons";

export default function BookCategoryModal({
  book,
  owner,
  collections,
  onClose,
}: {
  book: LibraryBook;
  owner: boolean;
  collections: UserCollection[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState(book.category || "Autre");
  const [status, setStatus] = useState<ReadingStatusKey>(effectiveStatusOf(book));
  const [notes, setNotes] = useState(book.notes ?? "");
  const [selectedCollections, setSelectedCollections] = useState<string[]>(book.collectionIds ?? []);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("amber");
  const [creatingCol, setCreatingCol] = useState(false);
  const [addedCollections, setAddedCollections] = useState<UserCollection[]>([]);
  const [error, setError] = useState("");

  const localCollections = [
    ...collections,
    ...addedCollections.filter((ac) => !collections.some((c) => c.id === ac.id)),
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isPending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);


  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || creatingCol) return;
    setCreatingCol(true);
    setError("");
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColName.trim(), color: newColColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer la liste");
      } else {
        setAddedCollections((prev) => [...prev, data]);
        setSelectedCollections((prev) => [...prev, data.id]);
        setNewColName("");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setCreatingCol(false);
    }
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      try {
        const requests: Promise<Response>[] = [
          fetch(`/api/books/${book.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(owner ? { category } : {}),
              collectionIds: selectedCollections,
            }),
          }),
          fetch("/api/progress", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: book.id,
              status,
              notes: notes.trim() || null,
            }),
          }),
        ];
        await Promise.all(requests);
        router.refresh();
        onClose();
      } catch {
        setError("Erreur lors de l'enregistrement");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !isPending && onClose()} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] flex flex-col gap-5 animate-[slideUp_.2s_ease-out] max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <IconTag width={13} height={13} /> Catégoriser & Classer
            </span>
            <h2 className="text-lg font-semibold leading-snug line-clamp-1 mt-0.5">{book.title}</h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => !isPending && onClose()}
            className="p-2 -mr-2 rounded-full hover:bg-stone-100 shrink-0"
          >
            <IconClose width={20} height={20} />
          </button>
        </div>

        {/* Reading Status categorization */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Statut de ma lecture
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {READING_STATUSES.map((s) => {
              const active = status === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={`flex items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                    active
                      ? "bg-ink text-paper border-ink shadow-sm"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  <span>{s.label}</span>
                  {active && <IconCheck width={14} height={14} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Book Genre / Category (editable by owner) */}
        {owner && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Catégorie / Genre du livre
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            >
              {BOOK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Personal Collections / Shelves */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Mes listes & collections de lecture
          </label>
          {localCollections.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              Aucune liste personnalisée. Créez-en une ci-dessous (ex: « À lire cet été », « Cours », « Favoris »).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {localCollections.map((col) => {
                const active = selectedCollections.includes(col.id);
                const colorMeta = COLLECTION_COLORS.find((c) => c.key === col.color) ?? COLLECTION_COLORS[0];
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCollection(col.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      active
                        ? "bg-ink text-paper border-ink shadow-sm"
                        : `${colorMeta.bg} hover:opacity-85`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${active ? "bg-paper" : colorMeta.dot}`} />
                    <span>{col.name}</span>
                    {active && <IconCheck width={12} height={12} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick create collection inline */}
          <form onSubmit={handleCreateCollection} className="mt-1 flex items-center gap-2">
            <input
              type="text"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="Nouvelle liste (ex: Philosophie, Études…)"
              maxLength={40}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
            <select
              value={newColColor}
              onChange={(e) => setNewColColor(e.target.value)}
              aria-label="Couleur"
              className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600 focus:outline-none"
            >
              {COLLECTION_COLORS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newColName.trim() || creatingCol}
              className="inline-flex items-center gap-1 rounded-xl bg-stone-200 text-stone-800 px-3 py-2 text-xs font-medium hover:bg-stone-300 disabled:opacity-40 transition-colors shrink-0"
            >
              <IconPlus width={14} height={14} /> Créer
            </button>
          </form>
        </div>

        {/* Personal reading note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Note personnelle sur cette lecture
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Objectif de lecture, résumé, citation marquante…"
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-xl bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
