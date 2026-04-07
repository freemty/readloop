import { openDB, type IDBPDatabase } from 'idb'
import type { Book, Annotation, GuideCache } from '../types'

interface FileData {
  bookId: string
  data: ArrayBuffer
}

interface CoverData {
  bookId: string
  data: ArrayBuffer
}

interface ReadLoopSchema {
  books: { key: string; value: Book }
  annotations: { key: string; value: Annotation; indexes: { byBook: string } }
  guideCache: { key: string; value: GuideCache; indexes: { byBook: string } }
  fileData: { key: string; value: FileData }
  coverImages: { key: string; value: CoverData }
}

export interface ReadLoopDB {
  addBook(book: Book): Promise<void>
  getBook(id: string): Promise<Book | undefined>
  getAllBooks(): Promise<Book[]>
  updateBook(book: Book): Promise<void>
  deleteBook(id: string): Promise<void>

  addAnnotation(annotation: Annotation): Promise<void>
  getAnnotationsByBook(bookId: string): Promise<Annotation[]>
  updateAnnotation(annotation: Annotation): Promise<void>
  deleteAnnotation(id: string): Promise<void>

  addGuideCache(entry: GuideCache): Promise<void>
  getGuideCacheByBook(bookId: string): Promise<GuideCache[]>

  saveFileData(bookId: string, data: ArrayBuffer): Promise<void>
  getFileData(bookId: string): Promise<ArrayBuffer | undefined>
  deleteFileData(bookId: string): Promise<void>

  saveCoverImage(bookId: string, data: ArrayBuffer): Promise<void>
  getCoverImage(bookId: string): Promise<ArrayBuffer | undefined>

  exportAll(): Promise<{ books: Book[]; annotations: Annotation[]; guideCache: GuideCache[] }>
}

let _singleton: Promise<ReadLoopDB> | null = null

export function getStore(name = 'readloop'): Promise<ReadLoopDB> {
  if (!_singleton) _singleton = createStore(name)
  return _singleton
}

export async function createStore(name = 'readloop'): Promise<ReadLoopDB> {
  const db: IDBPDatabase<ReadLoopSchema> = await openDB<ReadLoopSchema>(name, 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('books', { keyPath: 'id' })
        const annStore = database.createObjectStore('annotations', { keyPath: 'id' })
        annStore.createIndex('byBook', 'bookId')
        const guideStore = database.createObjectStore('guideCache', { keyPath: 'id' })
        guideStore.createIndex('byBook', 'bookId')
      }
      if (oldVersion < 2) {
        database.createObjectStore('fileData', { keyPath: 'bookId' })
      }
      if (oldVersion < 3) {
        database.createObjectStore('coverImages', { keyPath: 'bookId' })
      }
    },
  })

  return {
    async addBook(book) {
      await db.put('books', book)
    },
    async getBook(id) {
      return db.get('books', id)
    },
    async getAllBooks() {
      return db.getAll('books')
    },
    async updateBook(book) {
      await db.put('books', book)
    },
    async deleteBook(id) {
      await db.delete('books', id)
    },

    async addAnnotation(annotation) {
      await db.put('annotations', annotation)
    },
    async getAnnotationsByBook(bookId) {
      return db.getAllFromIndex('annotations', 'byBook', bookId)
    },
    async updateAnnotation(annotation) {
      await db.put('annotations', annotation)
    },
    async deleteAnnotation(id) {
      await db.delete('annotations', id)
    },

    async addGuideCache(entry) {
      await db.put('guideCache', entry)
    },
    async getGuideCacheByBook(bookId) {
      return db.getAllFromIndex('guideCache', 'byBook', bookId)
    },

    async saveFileData(bookId, data) {
      await db.put('fileData', { bookId, data })
    },
    async getFileData(bookId) {
      const entry = await db.get('fileData', bookId)
      return entry?.data
    },
    async deleteFileData(bookId) {
      await db.delete('fileData', bookId)
    },

    async saveCoverImage(bookId, data) {
      await db.put('coverImages', { bookId, data })
    },
    async getCoverImage(bookId) {
      const entry = await db.get('coverImages', bookId)
      return entry?.data
    },

    async exportAll() {
      const [books, annotations, guideCache] = await Promise.all([
        db.getAll('books'),
        db.getAll('annotations'),
        db.getAll('guideCache'),
      ])
      return { books, annotations, guideCache }
    },
  }
}
