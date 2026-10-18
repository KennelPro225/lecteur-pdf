import { auth } from "@/auth";
import { db } from "@/lib/db";
import LibraryGrid from "@/components/LibraryGrid";
import type { LibraryBook, ReadingStatusKey, UserCollection } from "@/lib/books";

export default async function Explore() {
  const session = await auth();
  const userId = session?.user?.id;

  const [rows, collectionRows] = await Promise.all([
    db.listPublicBooks(userId, 200),
    userId ? db.listUserCollections(userId) : Promise.resolve([]),
  ]);

  const collections: UserCollection[] = collectionRows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    bookCount: c.bookCount ?? 0,
  }));

  const books: LibraryBook[] = rows.map((b) => {
    const pos = b.positions[0];
    return {
      id: b.id,
      title: b.title,
      author: b.author || "Auteur inconnu",
      // Only expose the part before "@" — no full emails on a public page.
      sharedBy: b.userId === userId ? "Vous" : b.user?.email.split("@")[0],
      category: b.category || "Autre",
      visibility: b.visibility,
      pageCount: b.pageCount,
      createdAt: b.createdAt.getTime(),
      page: pos?.page ?? null,
      status: (pos?.status as ReadingStatusKey | undefined) ?? null,
      notes: pos?.notes ?? null,
      updatedAt: pos?.updatedAt.getTime() ?? null,
      collectionIds: b.collections.map((c) => c.collectionId),
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

