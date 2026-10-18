import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "Email et mot de passe (6+ caractères) requis" }, { status: 400 });
  }
  const exists = await db.findUserByEmail(email);
  if (exists) return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  const user = await db.createUser({
    email,
    password: await bcrypt.hash(password, 10),
  });
  return NextResponse.json({ id: user.id });
}

