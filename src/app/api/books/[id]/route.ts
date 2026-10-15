import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const { visibility } = await req.json();
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book || book.userId !== session.user.id) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const updated = await prisma.book.update({
    where: { id },
    data: { visibility: visibility === "public" ? "public" : "private" },
  });
  return NextResponse.json(updated);
}
