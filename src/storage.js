/**
 * Tap Color - Native IndexedDB Storage Engine
 * Provides persistent on-device storage for imported vector artworks and thumbnails.
 * Zero external dependencies.
 */

const DB_NAME = 'TapColorDB';
const DB_VERSION = 1;
const STORE_NAME = 'user_artworks';

class TapColorStorage {
  constructor() {
    this.dbPromise = null;
  }

  /**
   * Initializes and opens the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  async getDB() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this browser environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('completed', 'completed', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = (event) => {
        reject(event.target.error || new Error('Failed to open IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Saves or updates an artwork record in IndexedDB.
   * Preserves original createdAt if already present.
   * @param {Object} record
   * @returns {Promise<string>} The saved artwork ID.
   */
  async saveArtworkRecord(record) {
    const db = await this.getDB();
    const id = record.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    record.id = id;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          record.createdAt = existing.createdAt || record.createdAt || Date.now();
          if (!record.thumbnailBlob && existing.thumbnailBlob) {
            record.thumbnailBlob = existing.thumbnailBlob;
          }
        } else {
          record.createdAt = record.createdAt || Date.now();
        }
        record.lastModified = Date.now();

        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(id);
        putReq.onerror = () => reject(putReq.error || new Error(`Failed to put artwork ${id}`));
      };

      getReq.onerror = () => {
        record.createdAt = record.createdAt || Date.now();
        record.lastModified = Date.now();
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(id);
        putReq.onerror = () => reject(putReq.error || new Error(`Failed to put artwork ${id}`));
      };
    });
  }

  /**
   * Saves or updates an imported or preset artwork in IndexedDB.
   * @param {Object} artworkData - Full ArtworkData object matching Rust models.
   * @param {Blob|null} thumbnailBlob - Pre-rendered PNG/JPEG thumbnail Blob.
   * @param {string} [customTitle] - Optional title.
   * @param {Object} [extraMeta] - Additional metadata (category, artist, isAutosave, etc.)
   * @returns {Promise<string>} The saved artwork ID.
   */
  async saveArtwork(artworkData, thumbnailBlob = null, customTitle = '', extraMeta = {}) {
    const id = extraMeta.id || artworkData.id || `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    artworkData.id = id;

    const pieces = (artworkData.regions && artworkData.regions.length) || 0;
    const colors = (artworkData.palette && artworkData.palette.length) || 0;
    const filledCount = (artworkData.regions && artworkData.regions.filter(r => r.is_filled).length) || 0;

    const record = {
      id,
      title: customTitle || artworkData.title || extraMeta.title || 'Custom Artwork',
      artist: extraMeta.artist || artworkData.artist || 'Tap Color Studio',
      category: extraMeta.category || artworkData.category || 'imported',
      parentArtworkId: extraMeta.parentArtworkId || null,
      variantId: extraMeta.variantId || null,
      createdAt: Date.now(),
      lastModified: Date.now(),
      thumbnailBlob,
      artworkData,
      pieces,
      colors,
      filledCount,
      completed: pieces > 0 && filledCount >= pieces,
      isAutosave: !!extraMeta.isAutosave,
    };

    return this.saveArtworkRecord(record);
  }

  /**
   * Retrieves all saved artworks sorted by lastModified / createdAt (newest first).
   * @returns {Promise<Array<Object>>}
   */
  async getAllArtworks() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
        // Sort by lastModified desc (fallback to createdAt desc)
        items.sort((a, b) => {
          const timeA = a.lastModified || a.createdAt || 0;
          const timeB = b.lastModified || b.createdAt || 0;
          return timeB - timeA;
        });
        resolve(items);
      };

      req.onerror = () => reject(req.error || new Error('Failed to load gallery artworks'));
    });
  }

  /**
   * Fetches an artwork record by its unique ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getArtworkById(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error(`Failed to get artwork ${id}`));
    });
  }

  /**
   * Updates coloring progress for an artwork.
   * @param {string} id
   * @param {number} filledCount
   * @param {boolean} completed
   * @param {Object} [updatedArtworkData] Optional full state update
   * @param {Blob} [thumbnailBlob] Optional updated thumbnail
   */
  async updateArtworkProgress(id, filledCount, completed, updatedArtworkData = null, thumbnailBlob = null) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          resolve(false);
          return;
        }

        record.filledCount = filledCount;
        record.completed = completed;
        record.lastModified = Date.now();
        if (updatedArtworkData) {
          record.artworkData = updatedArtworkData;
        }
        if (thumbnailBlob) {
          record.thumbnailBlob = thumbnailBlob;
        }

        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Resets progress on an artwork back to 0%.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async resetArtworkProgress(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          resolve(false);
          return;
        }

        record.filledCount = 0;
        record.completed = false;
        record.lastModified = Date.now();

        if (record.artworkData) {
          if (Array.isArray(record.artworkData.regions)) {
            record.artworkData.regions.forEach(r => {
              r.is_filled = false;
              r.fill_anim = 0.0;
            });
          }
          if (Array.isArray(record.artworkData.palette)) {
            record.artworkData.palette.forEach(p => {
              p.filled_count = 0;
              p.is_completed = false;
            });
          }
        }

        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Deletes an artwork by ID from IndexedDB.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteArtwork(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error(`Failed to delete artwork ${id}`));
    });
  }
}

export const storage = new TapColorStorage();
