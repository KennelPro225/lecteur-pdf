import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const col = await prisma.collection.findUnique({ where: { id } });
  if (!col || col.userId !== session.user.id) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const body = await req.json();
  const data: { name?: string; color?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.color === "string" && body.color.trim()) {
    data.color = body.color.trim();
  }
  try {
    const updated = await prisma.collection.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Impossible de modifier cette catégorie" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const col = await prisma.collection.findUnique({ where: { id } });
  if (!col || col.userId !== session.user.id) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
