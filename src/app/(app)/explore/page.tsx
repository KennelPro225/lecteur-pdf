import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LibraryGrid from "@/components/LibraryGrid";
import type { LibraryBook } from "@/lib/books";

export default async function Explore() {
  const [session, rows] = await Promise.all([
    auth(),
    prisma.book.findMany({
      where: { visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        visibility: true,
        pageCount: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true } },
      },
    }),
  ]);
  const userId = session?.user?.id;

  const books: LibraryBook[] = rows.map((b) => ({
    id: b.id,
    title: b.title,
    visibility: b.visibility,
    pageCount: b.pageCount,
    createdAt: b.createdAt.getTime(),
    page: null,
    updatedAt: null,
    // Only expose the part before "@" — no full emails on a public page.
    author: b.userId === userId ? "Vous" : b.user.email.split("@")[0],
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Explorer</h1>
      <p className="text-sm text-stone-500 mt-0.5 mb-6">Des livres partagés par la communauté.</p>
      <LibraryGrid books={books} owner={false} emptyMessage="Aucun livre public pour le moment." />
    </main>
  );
}
