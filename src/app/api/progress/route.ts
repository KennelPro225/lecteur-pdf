import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = new Set(["to_read", "reading", "completed", "favorite", "paused"]);

async function save(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Non connecté" }, { status: 401 });
  let body: { bookId?: unknown; page?: unknown; pageCount?: unknown; status?: unknown; notes?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }
  const { bookId, page, pageCount, status, notes } = body;
  if (typeof bookId !== "string") {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }
  const hasPage = typeof page === "number" && Number.isFinite(page);
  const hasStatus = typeof status === "string" && VALID_STATUSES.has(status);
  const hasNotes = typeof notes === "string" || notes === null;

  if (!hasPage && !hasStatus && !hasNotes) {
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

  const existing = await prisma.readingPosition.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });

  const safePage = hasPage ? Math.max(1, Math.floor(page as number)) : existing?.page ?? 1;
  const effPageCount =
    typeof pageCount === "number" && pageCount > 0 ? Math.floor(pageCount) : book.pageCount;

  let nextStatus = hasStatus ? (status as string) : existing?.status ?? "reading";
  if (!hasStatus && hasPage && effPageCount) {
    const pct = Math.round((safePage / effPageCount) * 100);
    if (pct >= 98 && nextStatus !== "favorite") {
      nextStatus = "completed";
    } else if (safePage > 1 && nextStatus === "to_read") {
      nextStatus = "reading";
    }
  }

  const nextNotes = hasNotes ? (notes as string | null) : existing?.notes ?? null;

  const ops = [
    prisma.readingPosition.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: {
        ...(hasPage ? { page: safePage } : {}),
        status: nextStatus,
        ...(hasNotes ? { notes: nextNotes } : {}),
      },
      create: {
        userId,
        bookId,
        page: safePage,
        status: nextStatus,
        notes: nextNotes,
      },
      select: { page: true, status: true, notes: true },
    }),
  ] as const;

  if (typeof pageCount === "number" && pageCount > 0 && book.pageCount !== pageCount) {
    const [pos] = await prisma.$transaction([
      ...ops,
      prisma.book.update({ where: { id: bookId }, data: { pageCount: Math.floor(pageCount) }, select: { id: true } }),
    ]);
    return Response.json(pos);
  } else {
    const pos = await ops[0];
    return Response.json(pos);
  }
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
    select: { page: true, status: true, notes: true },
  });
  return Response.json(pos ?? { page: 1, status: "to_read", notes: null }, { headers: { "Cache-Control": "no-store" } });
}

