"use client";
import Link from "next/link";
import BookCover from "@/components/BookCover";
import VisibilityToggle from "@/components/VisibilityToggle";
import { prefetchPdfJs } from "@/lib/pdf";

import { progressOf, type LibraryBook } from "@/lib/books";
export { progressOf, type LibraryBook };

export default function BookCard({
  book,
  owner,
  priority,
}: {
  book: LibraryBook;
  owner: boolean;
  priority?: boolean;
}) {
  const pct = progressOf(book);
  const isNew = owner && !book.page;
  return (
    <li className="group flex flex-col">
      <Link
        href={`/reader/${book.id}`}
        onPointerEnter={prefetchPdfJs}
        onTouchStart={prefetchPdfJs}
        className="block rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink transition-transform duration-200 group-hover:-translate-y-1"
      >
        <BookCover id={book.id} title={book.title} canGenerate={owner} priority={priority} />
      </Link>
      <div className="mt-2.5 min-w-0">
        {pct != null ? (
          <div className="flex items-center gap-2" aria-label={`${pct} % lu`}>
            <div className="h-1 flex-1 rounded-full bg-stone-200 overflow-hidden">
              <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-stone-500">{pct}%</span>
          </div>
        ) : isNew ? (
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-accent">Nouveau</span>
        ) : book.page ? (
          <span className="text-[11px] text-stone-500">Page {book.page}</span>
        ) : null}
        <Link href={`/reader/${book.id}`} className="mt-1 block text-sm font-medium leading-snug line-clamp-2 hover:underline underline-offset-2">
          {book.title}
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          {book.author && <span className="text-xs text-stone-500 truncate">{book.author}</span>}
          {owner && <VisibilityToggle id={book.id} visibility={book.visibility} />}
        </div>
      </div>
    </li>
  );
}

