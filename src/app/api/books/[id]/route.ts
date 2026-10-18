import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const isOwner = book.userId === session.user.id;
  if (!isOwner && book.visibility !== "public") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Only owner can update book fields (title, category, visibility)
  if (isOwner && (body.visibility !== undefined || body.category !== undefined || body.title !== undefined)) {
    const data: { visibility?: string; category?: string; title?: string } = {};
    if (body.visibility !== undefined) {
      data.visibility = body.visibility === "public" ? "public" : "private";
    }
    if (typeof body.category === "string" && body.category.trim()) {
      data.category = body.category.trim();
    }
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }
    await prisma.book.update({
      where: { id },
      data,
    });
  }

  // Any authenticated user who can read the book can organize it into their own collections
  if (Array.isArray(body.collectionIds)) {
    const validIds: string[] = (body.collectionIds as unknown[]).filter(
      (c: unknown): c is string => typeof c === "string"
    );
    // Ensure the collections belong to the current user
    const userCollections = await prisma.collection.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const userColIds = new Set(userCollections.map((c) => c.id));
    const filteredColIds = validIds.filter((cid: string) => userColIds.has(cid));

    await prisma.$transaction([
      prisma.collectionBook.deleteMany({
        where: {
          bookId: id,
          collection: { userId: session.user.id },
        },
      }),
      ...filteredColIds.map((collectionId: string) =>
        prisma.collectionBook.create({
          data: { collectionId, bookId: id },
        })
      ),
    ]);
  }

  const updated = await prisma.book.findUnique({
    where: { id },
    include: {
      collections: {
        where: { collection: { userId: session.user.id } },
        select: { collectionId: true },
      },
    },
  });
  return NextResponse.json(updated);
}

