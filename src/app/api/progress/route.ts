import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function save(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Non connecté" }, { status: 401 });
  let body: { bookId?: unknown; page?: unknown; pageCount?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }
  const { bookId, page, pageCount } = body;
  if (typeof bookId !== "string" || typeof page !== "number" || !Number.isFinite(page)) {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }
  const userId = session.user.id;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, visibility: true, pageCount: true },
  });
  if (!book || (book.visibility !== "public" && book.userId !== userId)) {
    return Response.json({ error: "Introuvable" }, { status: 404 });
  }
  const safePage = Math.max(1, Math.floor(page));
  const ops = [
    prisma.readingPosition.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { page: safePage },
      create: { userId, bookId, page: safePage },
      select: { page: true },
    }),
  ] as const;
  if (typeof pageCount === "number" && pageCount > 0 && book.pageCount !== pageCount) {
    await prisma.$transaction([
      ...ops,
      prisma.book.update({ where: { id: bookId }, data: { pageCount: Math.floor(pageCount) }, select: { id: true } }),
    ]);
  } else {
    await ops[0];
  }
  return Response.json({ page: safePage });
}

export const PUT = save;
// POST is used by navigator.sendBeacon when the tab is closed / hidden.
export const POST = save;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Non connecté" }, { status: 401 });
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return Response.json({ error: "bookId requis" }, { status: 400 });
  const pos = await prisma.readingPosition.findUnique({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    select: { page: true },
  });
  return Response.json(pos ?? { page: 1 }, { headers: { "Cache-Control": "no-store" } });
}
