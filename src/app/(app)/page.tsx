import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import UploadForm from "@/components/UploadForm";
import LibraryGrid from "@/components/LibraryGrid";
import BookCover from "@/components/BookCover";
import { progressOf, type LibraryBook } from "@/lib/books";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const rows = await prisma.book.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      visibility: true,
      pageCount: true,
      createdAt: true,
      positions: { where: { userId }, select: { page: true, updatedAt: true }, take: 1 },
    },
  });

  const books: LibraryBook[] = rows.map((b) => ({
    id: b.id,
    title: b.title,
    visibility: b.visibility,
    pageCount: b.pageCount,
    createdAt: b.createdAt.getTime(),
    page: b.positions[0]?.page ?? null,
    updatedAt: b.positions[0]?.updatedAt.getTime() ?? null,
  }));

  // Kindle-like "continue reading": most recently opened book not yet finished.
  const current = books
    .filter((b) => b.updatedAt && (progressOf(b) ?? 0) < 98)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  const currentPct = current ? progressOf(current) : null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {current && (
        <section className="mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Reprendre la lecture</p>
          <Link
            href={`/reader/${current.id}`}
            className="group flex items-center gap-5 sm:gap-7 rounded-3xl bg-gradient-to-br from-white to-stone-100 border border-stone-200/80 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <BookCover id={current.id} title={current.title} canGenerate priority className="w-24 sm:w-32 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl sm:text-2xl leading-tight line-clamp-2">{current.title}</h2>
              <p className="mt-1 text-sm text-stone-500">
                Page {current.page}
                {current.pageCount ? ` sur ${current.pageCount}` : ""}
              </p>
              {currentPct != null && (
                <div className="mt-4 flex items-center gap-3 max-w-sm">
                  <div className="h-1.5 flex-1 rounded-full bg-stone-200 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${currentPct}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-stone-500">{currentPct} %</span>
                </div>
              )}
              <span className="mt-5 inline-flex items-center gap-1 rounded-full bg-ink text-paper px-4 py-2 text-sm font-medium group-hover:bg-stone-700 transition-colors">
                Continuer →
              </span>
            </div>
          </Link>
        </section>
      )}

      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bibliothèque</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {books.length} livre{books.length > 1 ? "s" : ""} · synchronisés sur tous vos appareils
          </p>
        </div>
        {books.length > 0 && <UploadForm />}
      </div>

      <LibraryGrid
        books={books}
        owner
        emptyMessage={
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl">📚</div>
            <p className="max-w-xs">Votre bibliothèque est vide. Ajoutez un PDF pour commencer à lire.</p>
            <UploadForm variant="hero" />
          </div>
        }
      />
    </main>
  );
}
