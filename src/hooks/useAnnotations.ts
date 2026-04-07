import { useState, useEffect, useCallback } from 'react'
import { getStore, type ReadLoopDB } from '../db/store'
import type { Annotation } from '../types'

export function useAnnotations(bookId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [db, setDb] = useState<ReadLoopDB | null>(null)

  useEffect(() => {
    getStore().then(store => {
      setDb(store)
      store.getAnnotationsByBook(bookId).then(setAnnotations)
    })
  }, [bookId])

  const addAnnotation = useCallback(async (annotation: Annotation) => {
    if (!db) return
    await db.addAnnotation(annotation)
    setAnnotations(prev => [...prev, annotation])
  }, [db])

  const updateAnnotation = useCallback(async (annotation: Annotation) => {
    if (!db) return
    await db.updateAnnotation(annotation)
    setAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a))
  }, [db])

  const deleteAnnotation = useCallback(async (id: string) => {
    if (!db) return
    await db.deleteAnnotation(id)
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [db])

  return { annotations, addAnnotation, updateAnnotation, deleteAnnotation }
}
