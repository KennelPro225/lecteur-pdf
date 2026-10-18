export const BOOK_CATEGORIES = [
  "Roman & Fiction",
  "Philosophie",
  "Développement personnel",
  "Sciences & Tech",
  "Histoire & Biographie",
  "Business & Économie",
  "Art & Culture",
  "Éducation & Cours",
  "BD & Manga",
  "Autre",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number] | string;

export const READING_STATUSES = [
  { key: "to_read", label: "À lire", badgeClass: "bg-sky-100 text-sky-800 border-sky-200" },
  { key: "reading", label: "En cours", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "completed", label: "Terminé", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "favorite", label: "Coup de cœur", badgeClass: "bg-rose-100 text-rose-800 border-rose-200" },
  { key: "paused", label: "En pause", badgeClass: "bg-stone-200 text-stone-700 border-stone-300" },
] as const;

export type ReadingStatusKey = (typeof READING_STATUSES)[number]["key"];

export const COLLECTION_COLORS = [
  { key: "stone", label: "Pierre", dot: "bg-stone-500", bg: "bg-stone-100 text-stone-800 border-stone-200" },
  { key: "amber", label: "Ambre", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-900 border-amber-200" },
  { key: "emerald", label: "Émeraude", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  { key: "sky", label: "Azur", dot: "bg-sky-500", bg: "bg-sky-50 text-sky-900 border-sky-200" },
  { key: "rose", label: "Rose", dot: "bg-rose-500", bg: "bg-rose-50 text-rose-900 border-rose-200" },
  { key: "violet", label: "Violet", dot: "bg-violet-500", bg: "bg-violet-50 text-violet-900 border-violet-200" },
] as const;

export type UserCollection = {
  id: string;
  name: string;
  color: string;
  bookCount?: number;
};

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  sharedBy?: string;
  category: string;
  visibility: string;
  pageCount: number | null;
  page: number | null;
  status: ReadingStatusKey | null;
  notes?: string | null;
  updatedAt: number | null;
  createdAt: number;
  collectionIds: string[];
};

/**
 * Normalizes a book title or author for deduplication:
 * removes file extensions, z-lib suffixes, trailing numeric IDs, accents, punctuation, and extra spaces.
 */
export function normalizeBookText(input: string): string {
  return input
    .replace(/\.pdf$/i, "")
    .replace(/\s*-\s*z-lib\.org.*$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\b\d{4,}\b$/g, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Builds the canonical uniqueness key for a (title, author) pair.
 */
export function buildBookNormalizedKey(title: string, author: string): string {
  const normTitle = normalizeBookText(title) || "sans titre";
  const normAuthor = normalizeBookText(author || "auteur inconnu") || "auteur inconnu";
  return `${normTitle}::${normAuthor}`;
}

/**
 * Extracts clean title and author from a PDF filename when PDF metadata is absent.
 */
export function parseTitleAndAuthorFromFilename(rawName: string): { title: string; author: string } {
  const cleaned = rawName
    .replace(/\.pdf$/i, "")
    .replace(/\s*-?\s*z-lib\.org.*$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+\d{4,}$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Check for "Title - Author" pattern
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        title: parts.slice(0, -1).join(" - "),
        author: parts[parts.length - 1],
      };
    }
  }

  // Known pattern like "Atteindre-lexcellence-Greene-Robert"
  if (/greene[-\s]+robert/i.test(cleaned)) {
    const titlePart = cleaned.replace(/[-\s]*greene[-\s]+robert.*/i, "").replace(/-/g, " ").trim();
    return {
      title: titlePart || cleaned,
      author: "Robert Greene",
    };
  }

  return {
    title: cleaned || "Sans titre",
    author: "",
  };
}

/**
 * Calculates reading progress percentage (0 - 100).
 * Safe to call from both Server Components and Client Components.
 */
export function progressOf(b: Pick<LibraryBook, "page" | "pageCount">): number | null {
  if (!b.page || !b.pageCount) return null;
  return Math.min(100, Math.round((b.page / b.pageCount) * 100));
}

export function effectiveStatusOf(b: Pick<LibraryBook, "status" | "page" | "pageCount">): ReadingStatusKey {
  if (b.status) return b.status;
  const pct = progressOf(b);
  if (pct != null && pct >= 98) return "completed";
  if (b.page && b.page > 1) return "reading";
  return "to_read";
}

export function getStatusMeta(status: ReadingStatusKey) {
  return READING_STATUSES.find((s) => s.key === status) ?? READING_STATUSES[0];
}



