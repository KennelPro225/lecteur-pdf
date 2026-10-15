import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReaderClient from "@/components/reader/ReaderClient";

export const metadata: Metadata = { title: "Lecture — Folio" };

export default async function ReaderPage({ params }: { params: Promise<{ bookId: string }> }) {
  const [session, { bookId }] = await Promise.all([auth(), params]);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Book + reading position fetched in parallel; the position is passed to the
  // client so it doesn't need an extra round-trip before rendering.
  const [book, position] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, userId: true, visibility: true, pageCount: true },
    }),
    prisma.readingPosition.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { page: true, updatedAt: true },
    }),
  ]);
  if (!book) notFound();
  if (book.visibility !== "public" && book.userId !== userId) notFound();

  return (
    <ReaderClient
      bookId={book.id}
      title={book.title}
      fileUrl={`/api/books/${book.id}/file`}
      coverUrl={`/api/books/${book.id}/cover`}
      initialPage={position?.page ?? 1}
      serverUpdatedAt={position?.updatedAt.getTime() ?? null}
      knownPageCount={book.pageCount}
      isOwner={book.userId === userId}
    />
  );
}
