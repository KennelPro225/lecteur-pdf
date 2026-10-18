import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const backupFile = path.join(process.cwd(), "prisma", "sqlite-backup.json");

if (!existsSync(backupFile)) {
  console.error("Aucun fichier de sauvegarde trouvé dans prisma/sqlite-backup.json");
  process.exit(1);
}

const data = JSON.parse(readFileSync(backupFile, "utf-8"));
const prisma = new PrismaClient();

function normalizeBookText(input) {
  return String(input || "")
    .replace(/\.pdf$/i, "")
    .replace(/\s*-?\s*z-lib\.org.*$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\b\d{4,}\b$/g, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseTitleAndAuthor(rawTitle) {
  const cleaned = String(rawTitle || "")
    .replace(/\.pdf$/i, "")
    .replace(/\s*-?\s*z-lib\.org.*$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+\d{4,}$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        title: parts.slice(0, -1).join(" - "),
        author: parts[parts.length - 1],
      };
    }
  }

  if (/greene[-\s]+robert/i.test(cleaned)) {
    const titlePart = cleaned.replace(/[-\s]*greene[-\s]+robert.*/i, "").replace(/-/g, " ").trim();
    return {
      title: titlePart || cleaned,
      author: "Robert Greene",
    };
  }

  return { title: cleaned || "Sans titre", author: "Auteur inconnu" };
}

function buildNormalizedKey(title, author) {
  const normTitle = normalizeBookText(title) || "sans titre";
  const normAuthor = normalizeBookText(author || "auteur inconnu") || "auteur inconnu";
  return `${normTitle}::${normAuthor}`;
}

function inferCategory(title, author) {
  const t = `${title} ${author}`.toLowerCase();
  if (t.includes("pensees") || t.includes("marc aurele")) return "Philosophie";
  if (t.includes("excellence") || t.includes("greene")) return "Développement personnel";
  return "Autre";
}

function computeFileHash(filePath) {
  const fullPath = path.join(process.cwd(), "uploads", path.basename(filePath));
  if (!existsSync(fullPath)) return null;
  try {
    const buf = readFileSync(fullPath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

async function main() {
  console.log("Restauration et dédoublonnage des données dans SQLite en cours...");

  let userCount = 0;
  for (const u of data.users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, password: u.password },
      create: { id: u.id, email: u.email, password: u.password },
    });
    userCount++;
  }
  console.log(`✓ ${userCount} utilisateurs synchronisés`);

  // Clear existing books to cleanly deduplicate
  await prisma.book.deleteMany({});

  // Sort books so the one with pageCount is preferred when deduplicating
  const sortedBooks = [...data.books].sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
  const idRemap = new Map();
  const seenKeys = new Map();
  const seenHashes = new Map();

  let bookCount = 0;
  let deduplicatedCount = 0;

  for (const b of sortedBooks) {
    const parsed = parseTitleAndAuthor(b.title);
    const title = parsed.title;
    const author = b.author || parsed.author || "Auteur inconnu";
    const normalizedKey = buildNormalizedKey(title, author);
    const fileHash = computeFileHash(b.filePath);
    const category = b.category || inferCategory(title, author);

    const existingId = seenKeys.get(normalizedKey) || (fileHash && seenHashes.get(fileHash));
    if (existingId) {
      idRemap.set(b.id, existingId);
      deduplicatedCount++;
      console.log(`  ↺ Doublon fusionné : "${b.title}" -> conservé sous "${title}" (${author})`);
      continue;
    }

    await prisma.book.create({
      data: {
        id: b.id,
        userId: b.userId,
        title,
        author,
        normalizedKey,
        fileHash,
        category,
        filePath: b.filePath,
        visibility: b.visibility,
        pageCount: b.pageCount,
        createdAt: new Date(b.createdAt),
      },
    });

    seenKeys.set(normalizedKey, b.id);
    if (fileHash) seenHashes.set(fileHash, b.id);
    idRemap.set(b.id, b.id);
    bookCount++;
  }
  console.log(`✓ ${bookCount} livres uniques synchronisés (${deduplicatedCount} doublon(s) éliminé(s))`);

  let posCount = 0;
  for (const p of data.positions) {
    const targetBookId = idRemap.get(p.bookId) || p.bookId;
    await prisma.readingPosition.upsert({
      where: { userId_bookId: { userId: p.userId, bookId: targetBookId } },
      update: { page: p.page, status: p.status || "reading", updatedAt: new Date(p.updatedAt) },
      create: {
        userId: p.userId,
        bookId: targetBookId,
        page: p.page,
        status: p.status || "reading",
        updatedAt: new Date(p.updatedAt),
      },
    });
    posCount++;
  }
  console.log(`✓ ${posCount} positions de lecture synchronisées`);
  console.log("Restauration des données SQLite terminée avec succès !");
}

main()
  .catch((e) => {
    console.error("Erreur lors de la restauration des données :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



