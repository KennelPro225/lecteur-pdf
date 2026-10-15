"use client";
import { useDeferredValue, useMemo, useState } from "react";
import BookCard from "@/components/BookCard";
import { progressOf, type LibraryBook } from "@/lib/books";
import { IconSearch } from "@/components/icons";

type Sort = "recent" | "title" | "progress";
type Filter = "all" | "reading" | "unread" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "reading", label: "En cours" },
  { key: "unread", label: "Non lus" },
  { key: "done", label: "Terminés" },
];

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function LibraryGrid({
  books,
  owner,
  emptyMessage,
}: {
  books: LibraryBook[];
  owner: boolean;
  emptyMessage: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<Filter>("all");
  const q = useDeferredValue(query);

  const list = useMemo(() => {
    const nq = normalize(q.trim());
    const filtered = books.filter((b) => {
      if (nq && !normalize(b.title).includes(nq) && !(b.author && normalize(b.author).includes(nq))) return false;
      const pct = progressOf(b);
      if (filter === "reading") return !!b.page && (pct == null || pct < 98);
      if (filter === "unread") return !b.page;
      if (filter === "done") return pct != null && pct >= 98;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => collator.compare(a.title, b.title));
    else if (sort === "progress") sorted.sort((a, b) => (progressOf(b) ?? -1) - (progressOf(a) ?? -1));
    else sorted.sort((a, b) => Math.max(b.updatedAt ?? 0, b.createdAt) - Math.max(a.updatedAt ?? 0, a.createdAt));
    return sorted;
  }, [books, q, sort, filter]);

  if (books.length === 0) return <div className="py-16 text-center text-stone-500">{emptyMessage}</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <label className="relative flex-1 max-w-md">
          <IconSearch width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre…"
            className="w-full rounded-full border border-stone-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </label>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {owner &&
            FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${filter === f.key ? "bg-ink text-paper" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"}`}
              >
                {f.label}
              </button>
            ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Trier"
            className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 focus:outline-none"
          >
            <option value="recent">Récents</option>
            <option value="title">Titre</option>
            {owner && <option value="progress">Progression</option>}
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="py-12 text-center text-stone-500">Aucun livre ne correspond.</p>
      ) : (
        <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
          {list.map((b, i) => (
            <BookCard key={b.id} book={b} owner={owner} priority={i < 6} />
          ))}
        </ul>
      )}
    </div>
  );
}

