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
   * Saves or updates an imported vector artwork in IndexedDB.
   * @param {Object} artworkData - Full ArtworkData object matching Rust models.
   * @param {Blob} thumbnailBlob - Pre-rendered PNG thumbnail Blob.
   * @param {string} [customTitle] - Optional title.
   * @returns {Promise<string>} The saved artwork ID.
   */
  async saveArtwork(artworkData, thumbnailBlob, customTitle = '') {
    const db = await this.getDB();
    const id = artworkData.id || `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    artworkData.id = id;

    const pieces = (artworkData.regions && artworkData.regions.length) || 0;
    const colors = (artworkData.palette && artworkData.palette.length) || 0;
    const filledCount = (artworkData.regions && artworkData.regions.filter(r => r.is_filled).length) || 0;

    const record = {
      id,
      title: customTitle || artworkData.title || 'Custom Imported Artwork',
      artist: artworkData.artist || 'My Photo Studio',
      category: 'imported',
      createdAt: Date.now(),
      thumbnailBlob,
      artworkData,
      pieces,
      colors,
      filledCount,
      completed: pieces > 0 && filledCount >= pieces,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error || new Error(`Failed to save artwork ${id}`));
    });
  }

  /**
   * Retrieves all imported artworks sorted by createdAt (newest first).
   * @returns {Promise<Array<Object>>}
   */
  async getAllArtworks() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Newest first

      const items = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error || new Error('Failed to load gallery artworks'));
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
   */
  async updateArtworkProgress(id, filledCount, completed, updatedArtworkData = null) {
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
        if (updatedArtworkData) {
          record.artworkData = updatedArtworkData;
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
