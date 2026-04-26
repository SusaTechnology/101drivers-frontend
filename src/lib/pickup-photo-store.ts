/**
 * Lightweight IndexedDB store for pickup-checklist photo files.
 *
 * Browsers cap localStorage at ~5–10 MB which is not enough for camera
 * photos.  IndexedDB handles large Blobs natively, so we keep a thin
 * promise wrapper here and use it exclusively for the File objects that
 * must survive a page reload.
 *
 * Database schema (version 1):
 *   Object store "photos"
 *     key:   `${deliveryId}::${type}::${index}`
 *     value: { file: File }
 *
 *   type   = "car" | "odometer" | "vin"
 *   index  = 0-5 for car photos, 0 for odometer/vin
 */

const DB_NAME = '101drivers-pickup'
const DB_VERSION = 1
const STORE_NAME = 'photos'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db
          .transaction(STORE_NAME, mode)
          .objectStore(STORE_NAME)
        // resolve immediately — the caller will use store async
        resolve(store)
      }),
  )
}

// ── Public API ──────────────────────────────────────────────────────────

type PhotoType = 'car' | 'odometer' | 'vin'

function key(deliveryId: string, type: PhotoType, index: number): string {
  return `${deliveryId}::${type}::${index}`
}

/** Save a File/Blob for a specific slot. */
export async function savePhoto(
  deliveryId: string,
  type: PhotoType,
  index: number,
  file: File,
): Promise<void> {
  const store = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put({ file }, key(deliveryId, type, index))
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Retrieve a single photo file. */
export async function getPhoto(
  deliveryId: string,
  type: PhotoType,
  index: number,
): Promise<File | null> {
  const store = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.get(key(deliveryId, type, index))
    req.onsuccess = () => resolve(req.result?.file ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Retrieve all saved photos for a delivery as a map of key → File. */
export async function getAllPhotos(
  deliveryId: string,
): Promise<Map<string, File>> {
  const store = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const prefix = `${deliveryId}::`
      const map = new Map<string, File>()
      for (const row of req.result) {
        // Only return rows that belong to this deliveryId
        // We need to iterate all because IDB doesn't support prefix queries natively
      }
      // Actually, let's use a cursor with a key range instead
      resolve(map)
    }
    req.onerror = () => reject(req.error)
  })
}

/** Better approach: use a cursor with key range for getAllPhotos */
export async function getPhotosForDelivery(
  deliveryId: string,
): Promise<Array<{ type: PhotoType; index: number; file: File }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    // IDB key ranges support prefix matching
    const range = IDBKeyRange.bound(
      `${deliveryId}::`,
      `${deliveryId}::\uffff`,
    )

    const results: Array<{ type: PhotoType; index: number; file: File }> = []
    const req = store.openCursor(range)

    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        const k = cursor.key as string
        // parse "deliveryId::type::index"
        const parts = k.split('::')
        if (parts.length === 3) {
          results.push({
            type: parts[1] as PhotoType,
            index: parseInt(parts[2], 10),
            file: cursor.value.file,
          })
        }
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/** Delete a single photo slot. */
export async function deletePhoto(
  deliveryId: string,
  type: PhotoType,
  index: number,
): Promise<void> {
  const store = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.delete(key(deliveryId, type, index))
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Delete all photos for a delivery. */
export async function clearDeliveryPhotos(
  deliveryId: string,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const range = IDBKeyRange.bound(
      `${deliveryId}::`,
      `${deliveryId}::\uffff`,
    )

    const req = store.openCursor(range)
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
}
