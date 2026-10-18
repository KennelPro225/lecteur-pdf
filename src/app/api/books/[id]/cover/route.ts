import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MAX_COVER_BYTES, readCover, saveCover } from "@/lib/covers";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await db.findBookById(id);
  if (!book) return new Response(null, { status: 404 });
  if (book.visibility !== "public") {
    const session = await auth();
    if (session?.user?.id !== book.userId) return new Response(null, { status: 403 });
  }
  try {
    const { info, data } = await readCover(id);
    const etag = `"c-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": "image/webp",
      ETag: etag,
      "Cache-Control": "private, max-age=604800, stale-while-revalidate=86400",
    };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(data, { headers });
  } catch {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const book = await db.findBookById(id);
  if (!book || book.userId !== session.user.id) return Response.json({ error: "Introuvable" }, { status: 404 });
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) {
    return Response.json({ error: "Couverture invalide" }, { status: 400 });
  }
  await saveCover(id, buf);
  return Response.json({ ok: true });
}


