import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

/**
 * Streams the PDF with HTTP Range support so pdf.js can display the first
 * pages before the whole file has been downloaded.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { userId: true, visibility: true, filePath: true },
  });
  if (!book) return Response.json({ error: "Introuvable" }, { status: 404 });
  if (book.visibility !== "public") {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== book.userId) {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const abs = path.join(process.cwd(), "uploads", path.basename(book.filePath));
  let info;
  try {
    info = await stat(abs);
  } catch {
    return Response.json({ error: "Fichier manquant" }, { status: 404 });
  }
  const size = info.size;
  const etag = `"${size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
    "Cache-Control": book.visibility === "public" ? "public, max-age=86400" : "private, max-age=86400",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] ? Number(m[1]) : NaN;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (Number.isNaN(start)) {
        // suffix range: last N bytes
        start = Math.max(0, size - end);
        end = size - 1;
      }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${size}` } });
      }
      const stream = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(stream, { headers: { ...baseHeaders, "Content-Length": String(size) } });
}
