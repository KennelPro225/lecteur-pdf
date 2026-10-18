import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import path from "path";

function resolveDatabaseUrl(): string {
  const envUrl = (process.env.DATABASE_URL || "").trim();
  const provider = (process.env.DB_PROVIDER || process.env.DB_ADAPTER || "").toLowerCase().trim();

  if (envUrl) {
    if (envUrl.startsWith("file:./") || envUrl.startsWith("file:../")) {
      const rel = envUrl.replace(/^file:/, "");
      return `file:${path.resolve(process.cwd(), "prisma", rel)}`;
    }
    return envUrl;
  }

  if (provider === "postgresql" || provider === "postgres") {
    return "postgresql://localhost:5432/postgres";
  }

  // Default to SQLite in prisma/dev.db
  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

const PRISMA_SCHEMA_VERSION = `v3-${process.env.DB_PROVIDER || "auto"}-${process.env.DATABASE_URL || "default"}`;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION
) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}



