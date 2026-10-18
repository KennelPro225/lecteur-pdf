import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const backupFile = path.join(process.cwd(), "prisma", "sqlite-backup.json");

if (!existsSync(backupFile)) {
  console.error("Aucun fichier de sauvegarde trouvé dans prisma/sqlite-backup.json");
  process.exit(1);
}

const data = JSON.parse(readFileSync(backupFile, "utf-8"));
const prisma = new PrismaClient();

function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("pensees") || t.includes("marc aurele")) return "Philosophie";
  if (t.includes("excellence") || t.includes("greene")) return "Développement personnel";
  return "Autre";
}

async function main() {
  console.log("Restauration des données dans SQLite en cours...");

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

  let bookCount = 0;
  for (const b of data.books) {
    const category = b.category || inferCategory(b.title);
    await prisma.book.upsert({
      where: { id: b.id },
      update: {
        title: b.title,
        category,
        filePath: b.filePath,
        visibility: b.visibility,
        pageCount: b.pageCount,
        createdAt: new Date(b.createdAt),
      },
      create: {
        id: b.id,
        userId: b.userId,
        title: b.title,
        category,
        filePath: b.filePath,
        visibility: b.visibility,
        pageCount: b.pageCount,
        createdAt: new Date(b.createdAt),
      },
    });
    bookCount++;
  }
  console.log(`✓ ${bookCount} livres synchronisés`);

  let posCount = 0;
  for (const p of data.positions) {
    await prisma.readingPosition.upsert({
      where: { userId_bookId: { userId: p.userId, bookId: p.bookId } },
      update: { page: p.page, status: p.status || "reading", updatedAt: new Date(p.updatedAt) },
      create: {
        userId: p.userId,
        bookId: p.bookId,
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


