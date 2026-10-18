import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MAX_COVER_BYTES, saveCover } from "@/lib/covers";
import { buildBookNormalizedKey, parseTitleAndAuthorFromFilename } from "@/lib/books";
import { writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

import { getUploadsDir } from "@/lib/storage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const books = await db.listLibraryBooksForUser(session.user.id);
  return NextResponse.json(books);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Fichier PDF requis" }, { status: 400 });
  }

  const parsedFallback = parseTitleAndAuthorFromFilename(file.name);
  const title = ((form.get("title") as string) || "").trim() || parsedFallback.title || "Sans titre";
  const author = ((form.get("author") as string) || "").trim() || parsedFallback.author || "Auteur inconnu";
  const category = ((form.get("category") as string) || "").trim() || "Autre";
  const visibility = (form.get("visibility") as string) === "public" ? "public" : "private";
  const pageCountRaw = Number(form.get("pageCount"));
  const pageCount = Number.isFinite(pageCountRaw) && pageCountRaw > 0 ? Math.floor(pageCountRaw) : null;
  const cover = form.get("cover") as File | null;
  const collectionIdsRaw = form.getAll("collectionIds") as string[];

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
  const normalizedKey = buildBookNormalizedKey(title, author);

  // Check if a book with the same (Title + Author) or the exact same PDF binary already exists
  const existing = await db.findDuplicateBook({ normalizedKey, fileHash });

  if (existing) {
    const isOwner = existing.userId === session.user.id;
    const canAttach = isOwner || existing.visibility === "public";
    const reason = existing.fileHash === fileHash ? "file_hash" : "title_author";
    return NextResponse.json(
      {
        error:
          reason === "file_hash"
            ? `Ce fichier PDF est déjà enregistré sous « ${existing.title} » (${existing.author}).`
            : `Le livre « ${existing.title} » de ${existing.author} existe déjà sur l'application.`,
        duplicate: true,
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
      },
      { status: 409 }
    );
  }

  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(uploadsDir, fileName), fileBuffer);

  const book = await db.createBook({
    userId: session.user.id,
    title,
    author,
    normalizedKey,
    fileHash,
    category,
    filePath: fileName,
    visibility,
    pageCount,
    collectionIds: collectionIdsRaw,
  });
  if (cover && cover.size > 0 && cover.size <= MAX_COVER_BYTES) {
    await saveCover(book.id, new Uint8Array(await cover.arrayBuffer()));
  }
  return NextResponse.json(book);
}


