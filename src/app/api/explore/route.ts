import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const books = await prisma.book.findMany({
    where: { visibility: "public" },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  return NextResponse.json(books);
}
