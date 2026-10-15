import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import path from "path";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    if (envUrl.startsWith("file:./") || envUrl.startsWith("file:../")) {
      const rel = envUrl.replace(/^file:/, "");
      return `file:${path.resolve(process.cwd(), "prisma", rel)}`;
    }
    return envUrl;
  }
  // Fallback to SQLite in prisma/dev.db if DATABASE_URL is not set in production
  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
