import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LibraryGrid from "@/components/LibraryGrid";
import type { LibraryBook, ReadingStatusKey, UserCollection } from "@/lib/books";

export default async function Explore() {
  const session = await auth();
  const userId = session?.user?.id;

  const [rows, collectionRows] = await Promise.all([
    prisma.book.findMany({
      where: { visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        category: true,
        visibility: true,
        pageCount: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true } },
        ...(userId
          ? {
              positions: {
                where: { userId },
                select: { page: true, status: true, notes: true, updatedAt: true },
                take: 1,
              },
              collections: {
                where: { collection: { userId } },
                select: { collectionId: true },
              },
            }
          : {}),
      },
    }),
    userId
      ? prisma.collection.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { books: true } } },
        })
      : Promise.resolve([]),
  ]);

  const collections: UserCollection[] = collectionRows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    bookCount: c._count.books,
  }));

  const books: LibraryBook[] = rows.map((b) => {
    const pos = "positions" in b && Array.isArray(b.positions) ? b.positions[0] : undefined;
    const cols = "collections" in b && Array.isArray(b.collections) ? b.collections : [];
    return {
      id: b.id,
      title: b.title,
      category: b.category || "Autre",
      visibility: b.visibility,
      pageCount: b.pageCount,
      createdAt: b.createdAt.getTime(),
      page: pos?.page ?? null,
      status: (pos?.status as ReadingStatusKey | undefined) ?? null,
      notes: pos?.notes ?? null,
      updatedAt: pos?.updatedAt.getTime() ?? null,
      // Only expose the part before "@" — no full emails on a public page.
      author: b.userId === userId ? "Vous" : b.user.email.split("@")[0],
      collectionIds: cols.map((c: { collectionId: string }) => c.collectionId),
    };
  });

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Explorer</h1>
      <p className="text-sm text-stone-500 mt-0.5 mb-6">
        Des livres partagés par la communauté · filtrez par catégorie ou classez-les dans vos listes de lecture.
      </p>
      <LibraryGrid
        books={books}
        owner={false}
        collections={collections}
        canCategorize={Boolean(userId)}
        emptyMessage="Aucun livre public pour le moment."
      />
    </main>
  );
}

