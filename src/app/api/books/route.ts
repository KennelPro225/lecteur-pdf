import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_COVER_BYTES, saveCover } from "@/lib/covers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(books);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = ((form.get("title") as string) || "").trim() || file?.name.replace(/\.pdf$/i, "") || "Sans titre";
  const visibility = (form.get("visibility") as string) === "public" ? "public" : "private";
  const pageCountRaw = Number(form.get("pageCount"));
  const pageCount = Number.isFinite(pageCountRaw) && pageCountRaw > 0 ? Math.floor(pageCountRaw) : null;
  const cover = form.get("cover") as File | null;
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Fichier PDF requis" }, { status: 400 });
  }
  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(uploadsDir, fileName), Buffer.from(await file.arrayBuffer()));
  const book = await prisma.book.create({
    data: { userId: session.user.id, title, filePath: fileName, visibility, pageCount },
  });
  if (cover && cover.size > 0 && cover.size <= MAX_COVER_BYTES) {
    await saveCover(book.id, new Uint8Array(await cover.arrayBuffer()));
  }
  return NextResponse.json(book);
}
