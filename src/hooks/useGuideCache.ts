import { useState, useEffect, useCallback } from 'react'
import { getStore, type ReadLoopDB } from '../db/store'
import type { GuideCache } from '../types'

export function useGuideCache(bookId: string) {
  const [cache, setCache] = useState<GuideCache[]>([])
  const [db, setDb] = useState<ReadLoopDB | null>(null)

  useEffect(() => {
    getStore().then(store => {
      setDb(store)
      store.getGuideCacheByBook(bookId).then(setCache)
    })
  }, [bookId])

  const getCachedGuide = useCallback((chapter: string, paragraph: number): GuideCache | undefined => {
    return cache.find(g => g.anchor.chapter === chapter && g.anchor.paragraph === paragraph)
  }, [cache])

  const addGuide = useCallback(async (entry: GuideCache) => {
    if (!db) return
    await db.addGuideCache(entry)
    setCache(prev => [...prev, entry])
  }, [db])

  return { cache, getCachedGuide, addGuide }
}
