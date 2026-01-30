const DB_NAME = 'recipesnap-images'
const STORE_NAME = 'images'
const DB_VERSION = 1
const MAX_ENTRIES = 50

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

export function useImageCache() {
  async function getCachedImage(recipeName: string): Promise<string | null> {
    if (!import.meta.client) return null
    try {
      const db = await openDB()
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(recipeName)
        request.onsuccess = () => resolve(request.result?.dataUrl || null)
        request.onerror = () => resolve(null)
      })
    } catch {
      return null
    }
  }

  async function setCachedImage(recipeName: string, dataUrl: string): Promise<void> {
    if (!import.meta.client) return
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ key: recipeName, dataUrl, timestamp: Date.now() })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject()
      })
      cleanup()
    } catch {
      // Silently fail -- cache is best-effort
    }
  }

  async function cleanup(): Promise<void> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const countReq = store.count()
      countReq.onsuccess = () => {
        if (countReq.result <= MAX_ENTRIES) return
        const idx = store.index('timestamp')
        const toDelete = countReq.result - MAX_ENTRIES
        let deleted = 0
        const cursor = idx.openCursor()
        cursor.onsuccess = (e: any) => {
          const c = e.target.result
          if (c && deleted < toDelete) {
            store.delete(c.primaryKey)
            deleted++
            c.continue()
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  return {
    getCachedImage,
    setCachedImage,
    cleanup
  }
}
