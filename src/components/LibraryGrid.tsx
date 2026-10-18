"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookCard from "@/components/BookCard";
import {
  COLLECTION_COLORS,
  READING_STATUSES,
  effectiveStatusOf,
  progressOf,
  type LibraryBook,
  type ReadingStatusKey,
  type UserCollection,
} from "@/lib/books";
import { IconClose, IconFolder, IconPlus, IconSearch, IconTag, IconTrash } from "@/components/icons";

type Sort = "recent" | "title" | "progress" | "category";
type StatusFilter = "all" | ReadingStatusKey;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  ...READING_STATUSES.map((s) => ({ key: s.key, label: s.label })),
];

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function LibraryGrid({
  books,
  owner,
  collections = [],
  canCategorize = true,
  emptyMessage,
}: {
  books: LibraryBook[];
  owner: boolean;
  collections?: UserCollection[];
  canCategorize?: boolean;
  emptyMessage: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [manageCollectionsOpen, setManageCollectionsOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("amber");
  const [creatingCol, setCreatingCol] = useState(false);
  const [colError, setColError] = useState("");
  const q = useDeferredValue(query);

  // Extract distinct categories present in the books list (with counts)
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) {
      const cat = b.category || "Autre";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => collator.compare(a[0], b[0]));
  }, [books]);

  const list = useMemo(() => {
    const nq = normalize(q.trim());
    const filtered = books.filter((b) => {
      if (
        nq &&
        !normalize(b.title).includes(nq) &&
        !(b.author && normalize(b.author).includes(nq)) &&
        !normalize(b.category || "").includes(nq)
      ) {
        return false;
      }
      if (categoryFilter !== "all" && (b.category || "Autre") !== categoryFilter) {
        return false;
      }
      if (collectionFilter !== "all" && !b.collectionIds?.includes(collectionFilter)) {
        return false;
      }
      if (statusFilter !== "all") {
        const eff = effectiveStatusOf(b);
        if (eff !== statusFilter) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => collator.compare(a.title, b.title));
    else if (sort === "category")
      sorted.sort((a, b) => collator.compare(a.category || "Autre", b.category || "Autre") || collator.compare(a.title, b.title));
    else if (sort === "progress") sorted.sort((a, b) => (progressOf(b) ?? -1) - (progressOf(a) ?? -1));
    else sorted.sort((a, b) => Math.max(b.updatedAt ?? 0, b.createdAt) - Math.max(a.updatedAt ?? 0, a.createdAt));
    return sorted;
  }, [books, q, sort, statusFilter, categoryFilter, collectionFilter]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || creatingCol) return;
    setCreatingCol(true);
    setColError("");
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColName.trim(), color: newColColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setColError(data.error ?? "Impossible de créer la liste");
      } else {
        setNewColName("");
        router.refresh();
      }
    } catch {
      setColError("Erreur réseau");
    } finally {
      setCreatingCol(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (collectionFilter === id) setCollectionFilter("all");
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    router.refresh();
  };

  if (books.length === 0) return <div className="py-16 text-center text-stone-500">{emptyMessage}</div>;

  return (
    <div>
      {/* Top search & status filter bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <label className="relative flex-1 max-w-md">
          <IconSearch width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre, une catégorie…"
            className="w-full rounded-full border border-stone-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </label>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {canCategorize &&
            STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-ink text-paper"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                {f.label}
              </button>
            ))}

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Trier"
            className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-600 focus:outline-none"
          >
            <option value="recent">Récents</option>
            <option value="title">Titre</option>
            <option value="category">Catégorie</option>
            {canCategorize && <option value="progress">Progression</option>}
          </select>
        </div>
      </div>

      {/* Category & User Reading Collections shelves */}
      <div className="flex flex-col gap-2.5 mb-6 rounded-2xl bg-stone-100/80 border border-stone-200/70 p-3 sm:p-4">
        {/* Book Categories row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-500 shrink-0 mr-1">
            <IconTag width={13} height={13} /> Catégories :
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              categoryFilter === "all"
                ? "bg-stone-800 text-paper"
                : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Toutes ({books.length})
          </button>
          {availableCategories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-stone-800 text-paper"
                  : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {cat} <span className="opacity-60">({count})</span>
            </button>
          ))}
        </div>

        {/* User Personal Reading Lists / Collections row */}
        {canCategorize && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/60">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-500 shrink-0 mr-1">
                <IconFolder width={13} height={13} /> Mes listes :
              </span>
              <button
                type="button"
                onClick={() => setCollectionFilter("all")}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  collectionFilter === "all"
                    ? "bg-accent text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                Toutes
              </button>
              {collections.map((col) => {
                const active = collectionFilter === col.id;
                const colorMeta = COLLECTION_COLORS.find((c) => c.key === col.color) ?? COLLECTION_COLORS[0];
                const count = books.filter((b) => b.collectionIds?.includes(col.id)).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setCollectionFilter(active ? "all" : col.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                      active
                        ? "bg-ink text-paper border-ink"
                        : `bg-white text-stone-700 border-stone-200 hover:bg-stone-50`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${active ? "bg-paper" : colorMeta.dot}`} />
                    <span>{col.name}</span>
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setManageCollectionsOpen((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <IconPlus width={13} height={13} />
              <span>Gérer mes listes</span>
            </button>
          </div>
        )}

        {/* Drawer / Panel to create or delete personal reading collections */}
        {canCategorize && manageCollectionsOpen && (
          <div className="mt-2 pt-3 border-t border-stone-200/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">
                Créer ou supprimer une liste de lecture personnalisée
              </span>
              <button
                type="button"
                onClick={() => setManageCollectionsOpen(false)}
                className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
              >
                <IconClose width={14} height={14} /> Fermer
              </button>
            </div>
            <form onSubmit={handleCreateCollection} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Nom de la liste (ex: Lectures du soir, Recherche, Favoris…)"
                maxLength={40}
                className="flex-1 min-w-[180px] rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <select
                value={newColColor}
                onChange={(e) => setNewColColor(e.target.value)}
                aria-label="Couleur de la liste"
                className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:outline-none"
              >
                {COLLECTION_COLORS.map((c) => (
                  <option key={c.key} value={c.key}>
                    Couleur : {c.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!newColName.trim() || creatingCol}
                className="inline-flex items-center gap-1 rounded-xl bg-ink text-paper px-3 py-1.5 text-xs font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
              >
                <IconPlus width={14} height={14} /> Créer la liste
              </button>
            </form>
            {colError && <p className="text-xs text-red-600">{colError}</p>}
            {collections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {collections.map((col) => {
                  const colorMeta = COLLECTION_COLORS.find((c) => c.key === col.color) ?? COLLECTION_COLORS[0];
                  return (
                    <span
                      key={col.id}
                      className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1.5 py-1 text-xs font-medium border ${colorMeta.bg}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${colorMeta.dot}`} />
                      <span>{col.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        title="Supprimer cette liste"
                        className="p-0.5 rounded-full hover:bg-black/10 text-stone-600 transition-colors"
                      >
                        <IconTrash width={12} height={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center text-stone-500">
          <p>Aucun livre ne correspond à ces filtres.</p>
          {(categoryFilter !== "all" || collectionFilter !== "all" || statusFilter !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setCollectionFilter("all");
                setStatusFilter("all");
                setQuery("");
              }}
              className="mt-3 inline-flex items-center rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
          {list.map((b, i) => (
            <BookCard
              key={b.id}
              book={b}
              owner={owner}
              collections={collections}
              canCategorize={canCategorize}
              priority={i < 6}
            />
          ))}
        </ul>
      )}
    </div>
  );
}


