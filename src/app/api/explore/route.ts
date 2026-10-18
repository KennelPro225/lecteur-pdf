import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const books = await db.listPublicBooks();
  return NextResponse.json(books);
}

