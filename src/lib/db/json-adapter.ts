import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  CreateBookInput,
  DatabaseAdapter,
  DbBook,
  DbBookWithDetails,
  DbCollection,
  DbReadingPosition,
  DbUser,
  UpdateBookInput,
  UpsertPositionInput,
} from "./types";

interface JsonStoreData {
  users: DbUser[];
  books: Array<Omit<DbBook, "createdAt"> & { createdAt: string }>;
  positions: Array<Omit<DbReadingPosition, "updatedAt"> & { updatedAt: string }>;
  collections: Array<Omit<DbCollection, "createdAt"> & { createdAt: string }>;
  collectionBooks: Array<{ collectionId: string; bookId: string; addedAt: string }>;
}

/**
 * JsonFileDatabaseAdapter
 * Concrete adapter storing data in a local JSON file (zero external DB engine required).
 */
export class JsonFileDatabaseAdapter implements DatabaseAdapter {
  readonly providerName = "json" as const;
  private readonly filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(process.cwd(), "prisma", "local-store.json");
  }

  private readStore(): JsonStoreData {
    if (!existsSync(this.filePath)) {
      return { users: [], books: [], positions: [], collections: [], collectionBooks: [] };
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as Partial<JsonStoreData>;
      return {
        users: raw.users ?? [],
        books: raw.books ?? [],
        positions: raw.positions ?? [],
        collections: raw.collections ?? [],
        collectionBooks: raw.collectionBooks ?? [],
      };
    } catch {
      return { users: [], books: [], positions: [], collections: [], collectionBooks: [] };
    }
  }

  private writeStore(store: JsonStoreData): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(store, null, 2), "utf-8");
  }

  async findUserByEmail(email: string): Promise<DbUser | null> {
    const store = this.readStore();
    return store.users.find((u) => u.email === email) ?? null;
  }

  async createUser(data: { email: string; password: string }): Promise<DbUser> {
    const store = this.readStore();
    if (store.users.some((u) => u.email === data.email)) {
      throw new Error("Email déjà utilisé");
    }
    const user: DbUser = { id: randomUUID(), email: data.email, password: data.password };
    store.users.push(user);
    this.writeStore(store);
    return user;
  }

  async findBookById(id: string): Promise<DbBook | null> {
    const store = this.readStore();
    const b = store.books.find((x) => x.id === id);
    return b ? { ...b, createdAt: new Date(b.createdAt) } : null;
  }

  async findDuplicateBook(params: {
    normalizedKey?: string;
    fileHash?: string;
    excludeId?: string;
  }): Promise<DbBook | null> {
    const store = this.readStore();
    const found = store.books.find((b) => {
      if (params.excludeId && b.id === params.excludeId) return false;
      if (params.normalizedKey && b.normalizedKey === params.normalizedKey) return true;
      if (params.fileHash && b.fileHash && b.fileHash === params.fileHash) return true;
      return false;
    });
    return found ? { ...found, createdAt: new Date(found.createdAt) } : null;
  }

  private hydrateBook(store: JsonStoreData, b: JsonStoreData["books"][number], viewerUserId?: string): DbBookWithDetails {
    const owner = store.users.find((u) => u.id === b.userId);
    const userColIds = new Set(
      store.collections.filter((c) => !viewerUserId || c.userId === viewerUserId).map((c) => c.id)
    );
    return {
      ...b,
      createdAt: new Date(b.createdAt),
      user: owner ? { email: owner.email } : undefined,
      positions: viewerUserId
        ? store.positions
            .filter((p) => p.bookId === b.id && p.userId === viewerUserId)
            .slice(0, 1)
            .map((p) => ({
              page: p.page,
              status: p.status,
              notes: p.notes,
              updatedAt: new Date(p.updatedAt),
            }))
        : [],
      collections: viewerUserId
        ? store.collectionBooks
            .filter((cb) => cb.bookId === b.id && userColIds.has(cb.collectionId))
            .map((cb) => ({ collectionId: cb.collectionId }))
        : [],
    };
  }

  async listLibraryBooksForUser(userId: string): Promise<DbBookWithDetails[]> {
    const store = this.readStore();
    const userColIds = new Set(store.collections.filter((c) => c.userId === userId).map((c) => c.id));
    const filtered = store.books.filter(
      (b) =>
        b.userId === userId ||
        store.positions.some((p) => p.bookId === b.id && p.userId === userId) ||
        store.collectionBooks.some((cb) => cb.bookId === b.id && userColIds.has(cb.collectionId))
    );
    return filtered
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((b) => this.hydrateBook(store, b, userId));
  }

  async listPublicBooks(viewerUserId?: string, limit = 200): Promise<DbBookWithDetails[]> {
    const store = this.readStore();
    return store.books
      .filter((b) => b.visibility === "public")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((b) => this.hydrateBook(store, b, viewerUserId));
  }

  async createBook(data: CreateBookInput): Promise<DbBook> {
    const store = this.readStore();
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = {
      id,
      userId: data.userId,
      title: data.title,
      author: data.author,
      normalizedKey: data.normalizedKey,
      fileHash: data.fileHash,
      category: data.category,
      filePath: data.filePath,
      visibility: data.visibility,
      pageCount: data.pageCount,
      createdAt: now,
    };
    store.books.push(row);
    if (data.collectionIds) {
      for (const collectionId of data.collectionIds) {
        store.collectionBooks.push({ collectionId, bookId: id, addedAt: now });
      }
    }
    this.writeStore(store);
    return { ...row, createdAt: new Date(now) };
  }

  async updateBook(id: string, data: UpdateBookInput): Promise<DbBook> {
    const store = this.readStore();
    const idx = store.books.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error("Livre introuvable");
    store.books[idx] = { ...store.books[idx], ...data };
    this.writeStore(store);
    return { ...store.books[idx], createdAt: new Date(store.books[idx].createdAt) };
  }

  async setBookCollectionsForUser(bookId: string, userId: string, collectionIds: string[]): Promise<void> {
    const store = this.readStore();
    const userColIds = new Set(store.collections.filter((c) => c.userId === userId).map((c) => c.id));
    store.collectionBooks = store.collectionBooks.filter(
      (cb) => !(cb.bookId === bookId && userColIds.has(cb.collectionId))
    );
    const now = new Date().toISOString();
    for (const cid of collectionIds.filter((id) => userColIds.has(id))) {
      store.collectionBooks.push({ collectionId: cid, bookId, addedAt: now });
    }
    this.writeStore(store);
  }

  async getBookWithUserCollections(bookId: string, userId: string): Promise<DbBookWithDetails | null> {
    const store = this.readStore();
    const b = store.books.find((x) => x.id === bookId);
    return b ? this.hydrateBook(store, b, userId) : null;
  }

  async getReadingPosition(userId: string, bookId: string): Promise<DbReadingPosition | null> {
    const store = this.readStore();
    const p = store.positions.find((x) => x.userId === userId && x.bookId === bookId);
    return p ? { ...p, updatedAt: new Date(p.updatedAt) } : null;
  }

  async upsertReadingPosition(data: UpsertPositionInput): Promise<DbReadingPosition> {
    const store = this.readStore();
    const now = new Date().toISOString();
    const idx = store.positions.findIndex((x) => x.userId === data.userId && x.bookId === data.bookId);
    const row = {
      userId: data.userId,
      bookId: data.bookId,
      page: data.page,
      status: data.status,
      notes: data.notes,
      updatedAt: now,
    };
    if (idx === -1) store.positions.push(row);
    else store.positions[idx] = row;

    if (typeof data.pageCount === "number" && data.pageCount > 0) {
      const bIdx = store.books.findIndex((b) => b.id === data.bookId);
      if (bIdx !== -1) store.books[bIdx].pageCount = Math.floor(data.pageCount);
    }
    this.writeStore(store);
    return { ...row, updatedAt: new Date(now) };
  }

  async listUserCollections(userId: string): Promise<DbCollection[]> {
    const store = this.readStore();
    return store.collections
      .filter((c) => c.userId === userId)
      .map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        bookCount: store.collectionBooks.filter((cb) => cb.collectionId === c.id).length,
      }));
  }

  async findCollectionById(id: string): Promise<DbCollection | null> {
    const store = this.readStore();
    const c = store.collections.find((x) => x.id === id);
    return c ? { ...c, createdAt: new Date(c.createdAt) } : null;
  }

  async createCollection(data: { userId: string; name: string; color: string }): Promise<DbCollection> {
    const store = this.readStore();
    if (store.collections.some((c) => c.userId === data.userId && c.name === data.name)) {
      throw new Error("Cette catégorie existe déjà");
    }
    const now = new Date().toISOString();
    const row = { id: randomUUID(), userId: data.userId, name: data.name, color: data.color, createdAt: now };
    store.collections.push(row);
    this.writeStore(store);
    return { ...row, createdAt: new Date(now), bookCount: 0 };
  }

  async updateCollection(id: string, data: { name?: string; color?: string }): Promise<DbCollection> {
    const store = this.readStore();
    const idx = store.collections.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Introuvable");
    store.collections[idx] = { ...store.collections[idx], ...data };
    this.writeStore(store);
    return { ...store.collections[idx], createdAt: new Date(store.collections[idx].createdAt) };
  }

  async deleteCollection(id: string): Promise<void> {
    const store = this.readStore();
    store.collections = store.collections.filter((c) => c.id !== id);
    store.collectionBooks = store.collectionBooks.filter((cb) => cb.collectionId !== id);
    this.writeStore(store);
  }
}
