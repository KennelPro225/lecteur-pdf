import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildBookNormalizedKey } from "@/lib/books";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const book = await db.findBookById(id);
  if (!book) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const isOwner = book.userId === session.user.id;
  if (!isOwner && book.visibility !== "public") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Only owner can update book fields (title, author, category, visibility)
  if (
    isOwner &&
    (body.visibility !== undefined ||
      body.category !== undefined ||
      body.title !== undefined ||
      body.author !== undefined)
  ) {
    const data: { visibility?: string; category?: string; title?: string; author?: string; normalizedKey?: string } = {};
    if (body.visibility !== undefined) {
      data.visibility = body.visibility === "public" ? "public" : "private";
    }
    if (typeof body.category === "string" && body.category.trim()) {
      data.category = body.category.trim();
    }
    const nextTitle = typeof body.title === "string" && body.title.trim() ? body.title.trim() : book.title;
    const nextAuthor = typeof body.author === "string" && body.author.trim() ? body.author.trim() : book.author;

    if (nextTitle !== book.title || nextAuthor !== book.author) {
      const nextKey = buildBookNormalizedKey(nextTitle, nextAuthor);
      const conflict = await db.findDuplicateBook({
        normalizedKey: nextKey,
        excludeId: id,
      });
      if (conflict) {
        return NextResponse.json(
          { error: `Un livre « ${conflict.title} » de ${conflict.author} existe déjà.` },
          { status: 409 }
        );
      }
      data.title = nextTitle;
      data.author = nextAuthor;
      data.normalizedKey = nextKey;
    }

    await db.updateBook(id, data);
  }

  // Any authenticated user who can read the book can organize it into their own collections
  if (Array.isArray(body.collectionIds)) {
    const validIds: string[] = (body.collectionIds as unknown[]).filter(
      (c: unknown): c is string => typeof c === "string"
    );
    await db.setBookCollectionsForUser(id, session.user.id, validIds);
  }

  const updated = await db.getBookWithUserCollections(id, session.user.id);
  return NextResponse.json(updated);
}


