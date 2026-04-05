import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, type ReadLoopDB } from '../src/db/store'
import type { Book, Annotation } from '../src/types'

describe('ReadLoopDB', () => {
  let db: ReadLoopDB

  beforeEach(async () => {
    db = await createStore('test-' + Date.now())
  })

  describe('books', () => {
    it('adds and retrieves a book', async () => {
      const book: Book = {
        id: 'book-1',
        title: 'The Wealth of Nations',
        author: 'Adam Smith',
        format: 'pdf',
        fileHash: 'abc123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.addBook(book)
      const retrieved = await db.getBook('book-1')
      expect(retrieved).toEqual(book)
    })

    it('lists all books', async () => {
      const book1: Book = {
        id: 'b1', title: 'Book 1', author: 'A1', format: 'pdf',
        fileHash: 'h1', createdAt: 1, updatedAt: 1,
      }
      const book2: Book = {
        id: 'b2', title: 'Book 2', author: 'A2', format: 'pdf',
        fileHash: 'h2', createdAt: 2, updatedAt: 2,
      }
      await db.addBook(book1)
      await db.addBook(book2)
      const books = await db.getAllBooks()
      expect(books).toHaveLength(2)
    })

    it('deletes a book', async () => {
      const book: Book = {
        id: 'b-del', title: 'T', author: 'A', format: 'pdf',
        fileHash: 'h', createdAt: 1, updatedAt: 1,
      }
      await db.addBook(book)
      await db.deleteBook('b-del')
      const result = await db.getBook('b-del')
      expect(result).toBeUndefined()
    })
  })

  describe('annotations', () => {
    it('adds and retrieves annotations by bookId', async () => {
      const annotation: Annotation = {
        id: 'ann-1',
        bookId: 'book-1',
        anchor: {
          chapter: 'Ch.1',
          paragraph: 3,
          textPrefix: 'prefix text here',
          selectedText: 'the selected text',
          textSuffix: 'suffix text here',
          pageHint: 5,
        },
        type: 'highlight',
        color: '#ffeb3b',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.addAnnotation(annotation)
      const results = await db.getAnnotationsByBook('book-1')
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(annotation)
    })

    it('updates an annotation', async () => {
      const annotation: Annotation = {
        id: 'ann-u', bookId: 'b1',
        anchor: { chapter: 'Ch.1', paragraph: 1, textPrefix: '', selectedText: 'x', textSuffix: '' },
        type: 'note', noteText: 'original', createdAt: 1, updatedAt: 1,
      }
      await db.addAnnotation(annotation)
      const updated = { ...annotation, noteText: 'revised', updatedAt: 2 }
      await db.updateAnnotation(updated)
      const results = await db.getAnnotationsByBook('b1')
      expect(results[0].noteText).toBe('revised')
    })

    it('deletes an annotation', async () => {
      const annotation: Annotation = {
        id: 'ann-d', bookId: 'b1',
        anchor: { chapter: 'Ch.1', paragraph: 1, textPrefix: '', selectedText: 'x', textSuffix: '' },
        type: 'highlight', createdAt: 1, updatedAt: 1,
      }
      await db.addAnnotation(annotation)
      await db.deleteAnnotation('ann-d')
      const results = await db.getAnnotationsByBook('b1')
      expect(results).toHaveLength(0)
    })
  })

  describe('export', () => {
    it('exports all data as JSON', async () => {
      const book: Book = {
        id: 'b1', title: 'T', author: 'A', format: 'pdf',
        fileHash: 'h', createdAt: 1, updatedAt: 1,
      }
      await db.addBook(book)
      const exported = await db.exportAll()
      expect(exported.books).toHaveLength(1)
      expect(exported.annotations).toHaveLength(0)
      expect(exported.guideCache).toHaveLength(0)
    })
  })
})
