export type LibraryBook = {
  id: string;
  title: string;
  visibility: string;
  pageCount: number | null;
  page: number | null;
  updatedAt: number | null;
  createdAt: number;
  author?: string;
};

/**
 * Calculates reading progress percentage (0 - 100).
 * Safe to call from both Server Components and Client Components.
 */
export function progressOf(b: Pick<LibraryBook, "page" | "pageCount">): number | null {
  if (!b.page || !b.pageCount) return null;
  return Math.min(100, Math.round((b.page / b.pageCount) * 100));
}

