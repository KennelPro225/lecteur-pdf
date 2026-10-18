"use client";
import { useState } from "react";
import Link from "next/link";
import BookCover from "@/components/BookCover";
import VisibilityToggle from "@/components/VisibilityToggle";
import BookCategoryModal from "@/components/BookCategoryModal";
import { prefetchPdfJs } from "@/lib/pdf";
import { IconTag } from "@/components/icons";

import {
  COLLECTION_COLORS,
  effectiveStatusOf,
  getStatusMeta,
  progressOf,
  type LibraryBook,
  type UserCollection,
} from "@/lib/books";
export { progressOf, type LibraryBook };

export default function BookCard({
  book,
  owner,
  collections = [],
  canCategorize = true,
  priority,
}: {
  book: LibraryBook;
  owner: boolean;
  collections?: UserCollection[];
  canCategorize?: boolean;
  priority?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const pct = progressOf(book);
  const effStatus = effectiveStatusOf(book);
  const statusMeta = getStatusMeta(effStatus);
  const bookCollections = collections.filter((c) => book.collectionIds?.includes(c.id));

  return (
    <li className="group flex flex-col">
      <div className="relative">
        <Link
          href={`/reader/${book.id}`}
          onPointerEnter={prefetchPdfJs}
          onTouchStart={prefetchPdfJs}
          className="block rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink transition-transform duration-200 group-hover:-translate-y-1"
        >
          <BookCover id={book.id} title={book.title} canGenerate={owner} priority={priority} />
        </Link>
        {canCategorize && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title="Catégoriser ce livre et ma lecture"
            aria-label="Catégoriser ce livre"
            className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm border border-stone-200/80 px-2 py-1 text-[11px] font-medium text-stone-700 shadow-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-white transition-all"
          >
            <IconTag width={12} height={12} />
            <span className="hidden min-[480px]:inline">Classer</span>
          </button>
        )}
      </div>

      <div className="mt-2.5 min-w-0 flex-1 flex flex-col">
        {pct != null ? (
          <div className="flex items-center gap-2" aria-label={`${pct} % lu`}>
            <div className="h-1 flex-1 rounded-full bg-stone-200 overflow-hidden">
              <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-stone-500">{pct}%</span>
          </div>
        ) : book.page ? (
          <span className="text-[11px] text-stone-500">Page {book.page}</span>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {book.category && (
            <button
              type="button"
              onClick={() => canCategorize && setModalOpen(true)}
              className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200/75 text-stone-700 hover:bg-stone-300/70 transition-colors truncate max-w-full"
            >
              {book.category}
            </button>
          )}
          {(owner || book.status || book.page) && (
            <button
              type="button"
              onClick={() => canCategorize && setModalOpen(true)}
              className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80 ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </button>
          )}
        </div>

        <Link
          href={`/reader/${book.id}`}
          className="mt-1 block text-sm font-medium leading-snug line-clamp-2 hover:underline underline-offset-2"
        >
          {book.title}
        </Link>
        {book.author && (
          <p className="mt-0.5 text-xs text-stone-500 truncate">{book.author}</p>
        )}

        {bookCollections.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {bookCollections.map((col) => {
              const colorMeta = COLLECTION_COLORS.find((c) => c.key === col.color) ?? COLLECTION_COLORS[0];
              return (
                <span
                  key={col.id}
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${colorMeta.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colorMeta.dot}`} />
                  <span className="truncate max-w-[100px]">{col.name}</span>
                </span>
              );
            })}
          </div>
        )}

        {book.notes && (
          <p className="mt-1 text-[11px] text-stone-500 italic line-clamp-1" title={book.notes}>
            « {book.notes} »
          </p>
        )}

        <div className="mt-auto pt-1.5 flex items-center justify-between gap-2">
          {book.sharedBy ? (
            <span className="text-[11px] text-stone-400 truncate">Partagé par {book.sharedBy}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            {owner && <VisibilityToggle id={book.id} visibility={book.visibility} />}
          </div>
        </div>
      </div>

      {canCategorize && modalOpen && (
        <BookCategoryModal
          book={book}
          owner={owner}
          collections={collections}
          onClose={() => setModalOpen(false)}
        />
      )}
    </li>
  );
}


