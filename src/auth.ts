import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
