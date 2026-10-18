export type DbProviderType = "sqlite" | "postgresql" | "json";

export interface DbUser {
  id: string;
  email: string;
  password: string;
}

export interface DbBook {
  id: string;
  userId: string;
  title: string;
  author: string;
  normalizedKey: string;
  fileHash: string | null;
  category: string;
  filePath: string;
  visibility: string;
  pageCount: number | null;
  createdAt: Date;
}

export interface DbReadingPosition {
  userId: string;
  bookId: string;
  page: number;
  status: string;
  notes: string | null;
  updatedAt: Date;
}

export interface DbCollection {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  bookCount?: number;
}

export interface DbBookWithDetails extends DbBook {
  user?: { email: string };
  positions: Array<{
    page: number;
    status: string;
    notes: string | null;
    updatedAt: Date;
  }>;
  collections: Array<{
    collectionId: string;
  }>;
}

export interface CreateBookInput {
  userId: string;
  title: string;
  author: string;
  normalizedKey: string;
  fileHash: string | null;
  category: string;
  filePath: string;
  visibility: string;
  pageCount: number | null;
  collectionIds?: string[];
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  normalizedKey?: string;
  category?: string;
  visibility?: string;
  pageCount?: number;
}

export interface UpsertPositionInput {
  userId: string;
  bookId: string;
  page: number;
  status: string;
  notes: string | null;
  pageCount?: number;
}

/**
 * DatabaseAdapter interface (Adapter Pattern)
 * Decouples the application from the underlying database technology
 * (SQLite, PostgreSQL, JSON File DB, etc.).
 */
export interface DatabaseAdapter {
  readonly providerName: DbProviderType;

  // Users
  findUserByEmail(email: string): Promise<DbUser | null>;
  createUser(data: { email: string; password: string }): Promise<DbUser>;

  // Books
  findBookById(id: string): Promise<DbBook | null>;
  findDuplicateBook(params: {
    normalizedKey?: string;
    fileHash?: string;
    excludeId?: string;
  }): Promise<DbBook | null>;
  listLibraryBooksForUser(userId: string): Promise<DbBookWithDetails[]>;
  listPublicBooks(viewerUserId?: string, limit?: number): Promise<DbBookWithDetails[]>;
  createBook(data: CreateBookInput): Promise<DbBook>;
  updateBook(id: string, data: UpdateBookInput): Promise<DbBook>;
  setBookCollectionsForUser(bookId: string, userId: string, collectionIds: string[]): Promise<void>;
  getBookWithUserCollections(bookId: string, userId: string): Promise<DbBookWithDetails | null>;

  // Reading Positions
  getReadingPosition(userId: string, bookId: string): Promise<DbReadingPosition | null>;
  upsertReadingPosition(data: UpsertPositionInput): Promise<DbReadingPosition>;

  // Collections / Categories
  listUserCollections(userId: string): Promise<DbCollection[]>;
  findCollectionById(id: string): Promise<DbCollection | null>;
  createCollection(data: { userId: string; name: string; color: string }): Promise<DbCollection>;
  updateCollection(id: string, data: { name?: string; color?: string }): Promise<DbCollection>;
  deleteCollection(id: string): Promise<void>;
}
