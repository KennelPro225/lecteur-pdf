import { JsonFileDatabaseAdapter } from "./json-adapter";
import { PrismaDatabaseAdapter } from "./prisma-adapter";
import type { DatabaseAdapter, DbProviderType } from "./types";

export * from "./types";

function detectProvider(): DbProviderType {
  const explicit = (process.env.DB_PROVIDER || process.env.DB_ADAPTER || "").toLowerCase().trim();
  if (explicit === "json") return "json";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  if (explicit === "sqlite") return "sqlite";

  const dbUrl = (process.env.DATABASE_URL || "").toLowerCase().trim();
  if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

function createDatabaseAdapter(): DatabaseAdapter {
  const provider = detectProvider();
  if (provider === "json") {
    return new JsonFileDatabaseAdapter(process.env.JSON_DB_PATH);
  }
  return new PrismaDatabaseAdapter(provider);
}

const globalForDb = globalThis as unknown as {
  dbAdapter?: DatabaseAdapter;
  dbProvider?: DbProviderType;
};

const currentProvider = detectProvider();

export const db: DatabaseAdapter =
  globalForDb.dbAdapter && globalForDb.dbProvider === currentProvider
    ? globalForDb.dbAdapter
    : createDatabaseAdapter();

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbAdapter = db;
  globalForDb.dbProvider = currentProvider;
}
