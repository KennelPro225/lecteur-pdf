import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildBookNormalizedKey } from "@/lib/books";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").trim();
  const author = (searchParams.get("author") || "").trim();
  const fileHash = (searchParams.get("hash") || "").trim();
  const excludeId = (searchParams.get("excludeId") || "").trim();

  const normalizedKey = title ? buildBookNormalizedKey(title, author) : undefined;
  if (!normalizedKey && !fileHash) {
    return NextResponse.json({ exists: false });
  }

  const existing = await db.findDuplicateBook({
    normalizedKey,
    fileHash: fileHash || undefined,
    excludeId: excludeId || undefined,
  });

  if (!existing) {
    return NextResponse.json({ exists: false });
  }

  const isOwner = existing.userId === session.user.id;
  const canAttach = isOwner || existing.visibility === "public";
  const reason = fileHash && existing.fileHash === fileHash ? "file_hash" : "title_author";

  return NextResponse.json({
    exists: true,
    reason,
    book: {
      id: existing.id,
      title: existing.title,
      author: existing.author,
      category: existing.category,
      visibility: existing.visibility,
      pageCount: existing.pageCount,
      isOwner,
      canAttach,
    },
  });
}

/**
 * Attaches an existing book on the platform to the current user's library
 * (creates/ensures a ReadingPosition and optionally links to selected collections).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const userId = session.user.id;

  let body: { bookId?: unknown; collectionIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const bookId = typeof body.bookId === "string" ? body.bookId : "";
  if (!bookId) return NextResponse.json({ error: "bookId requis" }, { status: 400 });

  const book = await db.findBookById(bookId);
  if (!book || (book.userId !== userId && book.visibility !== "public")) {
    return NextResponse.json({ error: "Ce livre n'est pas accessible" }, { status: 404 });
  }

  const existingPos = await db.getReadingPosition(userId, bookId);
  if (!existingPos) {
    await db.upsertReadingPosition({
      userId,
      bookId,
      page: 1,
      status: "to_read",
      notes: null,
    });
  }

  if (Array.isArray(body.collectionIds) && body.collectionIds.length > 0) {
    const validIds: string[] = (body.collectionIds as unknown[]).filter(
      (c: unknown): c is string => typeof c === "string"
    );
    await db.setBookCollectionsForUser(bookId, userId, validIds);
  }

  return NextResponse.json({ ok: true, bookId: book.id });
}

