import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const collections = await prisma.collection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { books: true } },
    },
  });
  return NextResponse.json(
    collections.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      bookCount: c._count.books,
    }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  let body: { name?: unknown; color?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : "stone";
  if (!name || name.length > 40) {
    return NextResponse.json({ error: "Nom de catégorie/collection invalide (1 à 40 caractères)" }, { status: 400 });
  }
  try {
    const col = await prisma.collection.create({
      data: {
        userId: session.user.id,
        name,
        color,
      },
    });
    return NextResponse.json({ id: col.id, name: col.name, color: col.color, bookCount: 0 });
  } catch {
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });
  }
}
