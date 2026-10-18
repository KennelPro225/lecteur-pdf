import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const book = await db.findBookById(bookId);
  if (!book || (book.visibility !== "public" && book.userId !== userId)) {
    return Response.json({ error: "Introuvable" }, { status: 404 });
  }

  const existing = await db.getReadingPosition(userId, bookId);

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
  const newPageCount =
    typeof pageCount === "number" && pageCount > 0 && book.pageCount !== pageCount
      ? Math.floor(pageCount)
      : undefined;

  const pos = await db.upsertReadingPosition({
    userId,
    bookId,
    page: safePage,
    status: nextStatus,
    notes: nextNotes,
    pageCount: newPageCount,
  });

  return Response.json({ page: pos.page, status: pos.status, notes: pos.notes });
}

export const PUT = save;
// POST is used by navigator.sendBeacon when the tab is closed / hidden.
export const POST = save;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Non connecté" }, { status: 401 });
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return Response.json({ error: "bookId requis" }, { status: 400 });
  const pos = await db.getReadingPosition(session.user.id, bookId);
  return Response.json(
    pos ? { page: pos.page, status: pos.status, notes: pos.notes } : { page: 1, status: "to_read", notes: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}


