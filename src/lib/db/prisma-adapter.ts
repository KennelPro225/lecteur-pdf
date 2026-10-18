import { prisma } from "@/lib/prisma";
import type {
  CreateBookInput,
  DatabaseAdapter,
  DbBook,
  DbBookWithDetails,
  DbCollection,
  DbProviderType,
  DbReadingPosition,
  DbUser,
  UpdateBookInput,
  UpsertPositionInput,
} from "./types";

export class PrismaDatabaseAdapter implements DatabaseAdapter {
  readonly providerName: DbProviderType;

  constructor(providerName: DbProviderType = "sqlite") {
    this.providerName = providerName;
  }

  // Users
  async findUserByEmail(email: string): Promise<DbUser | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: { email: string; password: string }): Promise<DbUser> {
    return prisma.user.create({ data });
  }

  // Books
  async findBookById(id: string): Promise<DbBook | null> {
    return prisma.book.findUnique({ where: { id } });
  }

  async findDuplicateBook(params: {
    normalizedKey?: string;
    fileHash?: string;
    excludeId?: string;
  }): Promise<DbBook | null> {
    const conditions: Array<{ normalizedKey?: string; fileHash?: string }> = [];
    if (params.normalizedKey) conditions.push({ normalizedKey: params.normalizedKey });
    if (params.fileHash) conditions.push({ fileHash: params.fileHash });
    if (conditions.length === 0) return null;

    return prisma.book.findFirst({
      where: {
        OR: conditions,
        ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
      },
    });
  }

  async listLibraryBooksForUser(userId: string): Promise<DbBookWithDetails[]> {
    const rows = await prisma.book.findMany({
      where: {
        OR: [
          { userId },
          { positions: { some: { userId } } },
          { collections: { some: { collection: { userId } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true } },
        positions: {
          where: { userId },
          select: { page: true, status: true, notes: true, updatedAt: true },
          take: 1,
        },
        collections: {
          where: { collection: { userId } },
          select: { collectionId: true },
        },
      },
    });
    return rows;
  }

  async listPublicBooks(viewerUserId?: string, limit = 200): Promise<DbBookWithDetails[]> {
    const rows = await prisma.book.findMany({
      where: { visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { email: true } },
        ...(viewerUserId
          ? {
              positions: {
                where: { userId: viewerUserId },
                select: { page: true, status: true, notes: true, updatedAt: true },
                take: 1,
              },
              collections: {
                where: { collection: { userId: viewerUserId } },
                select: { collectionId: true },
              },
            }
          : {}),
      },
    });
    return rows.map((r) => ({
      ...r,
      positions: "positions" in r && Array.isArray(r.positions) ? r.positions : [],
      collections: "collections" in r && Array.isArray(r.collections) ? r.collections : [],
    }));
  }

  async createBook(data: CreateBookInput): Promise<DbBook> {
    const { collectionIds, ...bookData } = data;
    return prisma.book.create({
      data: {
        ...bookData,
        ...(collectionIds && collectionIds.length > 0
          ? {
              collections: {
                create: collectionIds.map((collectionId) => ({ collectionId })),
              },
            }
          : {}),
      },
    });
  }

  async updateBook(id: string, data: UpdateBookInput): Promise<DbBook> {
    return prisma.book.update({
      where: { id },
      data,
    });
  }

  async setBookCollectionsForUser(bookId: string, userId: string, collectionIds: string[]): Promise<void> {
    const userCollections = await prisma.collection.findMany({
      where: { userId },
      select: { id: true },
    });
    const userColIds = new Set(userCollections.map((c) => c.id));
    const filteredColIds = collectionIds.filter((cid) => userColIds.has(cid));

    await prisma.$transaction([
      prisma.collectionBook.deleteMany({
        where: {
          bookId,
          collection: { userId },
        },
      }),
      ...filteredColIds.map((collectionId) =>
        prisma.collectionBook.create({
          data: { collectionId, bookId },
        })
      ),
    ]);
  }

  async getBookWithUserCollections(bookId: string, userId: string): Promise<DbBookWithDetails | null> {
    const row = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        user: { select: { email: true } },
        positions: {
          where: { userId },
          select: { page: true, status: true, notes: true, updatedAt: true },
          take: 1,
        },
        collections: {
          where: { collection: { userId } },
          select: { collectionId: true },
        },
      },
    });
    return row;
  }

  // Reading Positions
  async getReadingPosition(userId: string, bookId: string): Promise<DbReadingPosition | null> {
    return prisma.readingPosition.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async upsertReadingPosition(data: UpsertPositionInput): Promise<DbReadingPosition> {
    const { userId, bookId, page, status, notes, pageCount } = data;
    const upsertOp = prisma.readingPosition.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { page, status, notes },
      create: { userId, bookId, page, status, notes },
    });

    if (typeof pageCount === "number" && pageCount > 0) {
      const [pos] = await prisma.$transaction([
        upsertOp,
        prisma.book.update({
          where: { id: bookId },
          data: { pageCount: Math.floor(pageCount) },
        }),
      ]);
      return pos;
    }

    return upsertOp;
  }

  // Collections
  async listUserCollections(userId: string): Promise<DbCollection[]> {
    const rows = await prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { books: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      color: c.color,
      createdAt: c.createdAt,
      bookCount: c._count.books,
    }));
  }

  async findCollectionById(id: string): Promise<DbCollection | null> {
    return prisma.collection.findUnique({ where: { id } });
  }

  async createCollection(data: { userId: string; name: string; color: string }): Promise<DbCollection> {
    const col = await prisma.collection.create({ data });
    return { ...col, bookCount: 0 };
  }

  async updateCollection(id: string, data: { name?: string; color?: string }): Promise<DbCollection> {
    return prisma.collection.update({ where: { id }, data });
  }

  async deleteCollection(id: string): Promise<void> {
    await prisma.collection.delete({ where: { id } });
  }
}
