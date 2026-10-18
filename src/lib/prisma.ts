import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import path from "path";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith("file:")) {
    if (envUrl.startsWith("file:./") || envUrl.startsWith("file:../")) {
      const rel = envUrl.replace(/^file:/, "");
      return `file:${path.resolve(process.cwd(), "prisma", rel)}`;
    }
    return envUrl;
  }
  // Default to SQLite in prisma/dev.db
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
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

