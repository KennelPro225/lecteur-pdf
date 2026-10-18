import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const VALID_PRISMA_PROVIDERS = new Set(["sqlite", "postgresql", "mysql", "sqlserver", "cockroachdb"]);

function detectPrismaProvider() {
  const raw = (process.env.DB_PROVIDER || process.env.DB_ADAPTER || "").toLowerCase().trim();
  if (raw === "postgres" || raw === "postgresql") return "postgresql";
  if (VALID_PRISMA_PROVIDERS.has(raw)) return raw;

  const url = (process.env.DATABASE_URL || "").toLowerCase().trim();
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgresql";
  if (url.startsWith("mysql://")) return "mysql";
  return "sqlite";
}

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const provider = detectPrismaProvider();

const content = readFileSync(schemaPath, "utf-8");
const updated = content.replace(
  /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*)(?:env\([^)]+\)|"[^"]+")/,
  `$1"${provider}"`
);

if (updated !== content) {
  writeFileSync(schemaPath, updated, "utf-8");
  console.log(`✓ prisma/schema.prisma synchronisé avec provider = "${provider}"`);
} else {
  console.log(`✓ prisma/schema.prisma utilise déjà provider = "${provider}"`);
}
