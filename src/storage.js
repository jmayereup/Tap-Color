/**
 * Tap Color - Native IndexedDB Storage Engine
 * Provides persistent on-device storage for imported vector artworks and thumbnails.
 * Splits lightweight metadata/thumbnails from heavy polygon payloads (DB v2).
 */

const DB_NAME = 'TapColorDB';
const DB_VERSION = 2;
const STORE_META = 'user_artworks';
const STORE_DATA = 'artwork_data';

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
        this.dbPromise = null;
        reject(new Error('IndexedDB is not supported in this browser environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;

        let metaStore;
        if (!db.objectStoreNames.contains(STORE_META)) {
          metaStore = db.createObjectStore(STORE_META, { keyPath: 'id' });
          metaStore.createIndex('createdAt', 'createdAt', { unique: false });
          metaStore.createIndex('category', 'category', { unique: false });
          metaStore.createIndex('completed', 'completed', { unique: false });
        } else {
          metaStore = tx.objectStore(STORE_META);
        }

        let dataStore;
        if (!db.objectStoreNames.contains(STORE_DATA)) {
          dataStore = db.createObjectStore(STORE_DATA, { keyPath: 'id' });
        } else {
          dataStore = tx.objectStore(STORE_DATA);
        }

        // Migrate v1 records: move heavy artworkData out of user_artworks into artwork_data
        if (event.oldVersion > 0 && event.oldVersion < 2) {
          const cursorReq = metaStore.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            const rec = cursor.value;
            if (rec && rec.artworkData) {
              dataStore.put({ id: rec.id, artworkData: rec.artworkData });
              delete rec.artworkData;
              cursor.update(rec);
            }
            cursor.continue();
          };
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
        this.dbPromise = null;
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
    const artworkData = record.artworkData || null;
    const metaRecord = { ...record, id };
    delete metaRecord.artworkData;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const dataStore = tx.objectStore(STORE_DATA);

      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error || new Error(`Failed to save artwork ${id}`));
      tx.onabort = () => reject(tx.error || new Error(`Transaction aborted saving artwork ${id}`));

      const getReq = metaStore.get(id);
      const writeRecords = (existing) => {
        if (existing) {
          metaRecord.createdAt = existing.createdAt || metaRecord.createdAt || Date.now();
          if (!metaRecord.thumbnailBlob && existing.thumbnailBlob) {
            metaRecord.thumbnailBlob = existing.thumbnailBlob;
          }
        } else {
          metaRecord.createdAt = metaRecord.createdAt || Date.now();
        }
        metaRecord.lastModified = Date.now();

        metaStore.put(metaRecord);
        if (artworkData) {
          dataStore.put({ id, artworkData });
        }
      };

      getReq.onsuccess = () => writeRecords(getReq.result);
      getReq.onerror = () => writeRecords(null);
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
   * Retrieves all saved artwork metadata sorted by lastModified / createdAt (newest first).
   * @returns {Promise<Array<Object>>}
   */
  async getAllArtworks() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_META], 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
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
   * Fetches an artwork record (including heavy artworkData) by its unique ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getArtworkById(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_DATA], 'readonly');
      const metaStore = tx.objectStore(STORE_META);
      const dataStore = tx.objectStore(STORE_DATA);

      let meta = null;
      let dataWrap = null;

      const metaReq = metaStore.get(id);
      metaReq.onsuccess = () => { meta = metaReq.result || null; };

      const dataReq = dataStore.get(id);
      dataReq.onsuccess = () => { dataWrap = dataReq.result || null; };

      tx.oncomplete = () => {
        if (!meta) {
          resolve(null);
          return;
        }
        if (dataWrap && dataWrap.artworkData) {
          meta.artworkData = dataWrap.artworkData;
        }
        resolve(meta);
      };
      tx.onerror = () => reject(tx.error || new Error(`Failed to get artwork ${id}`));
      tx.onabort = () => reject(tx.error || new Error(`Aborted reading artwork ${id}`));
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
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const dataStore = tx.objectStore(STORE_DATA);
      let found = false;

      tx.oncomplete = () => resolve(found);
      tx.onerror = () => reject(tx.error || new Error(`Failed to update progress for ${id}`));
      tx.onabort = () => reject(tx.error || new Error(`Aborted updating progress for ${id}`));

      const getReq = metaStore.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) return;
        found = true;

        record.filledCount = filledCount;
        record.completed = completed;
        record.lastModified = Date.now();
        if (thumbnailBlob) {
          record.thumbnailBlob = thumbnailBlob;
        }
        delete record.artworkData;
        metaStore.put(record);

        if (updatedArtworkData) {
          dataStore.put({ id, artworkData: updatedArtworkData });
        }
      };
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
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const dataStore = tx.objectStore(STORE_DATA);
      let found = false;

      tx.oncomplete = () => resolve(found);
      tx.onerror = () => reject(tx.error || new Error(`Failed to reset progress for ${id}`));
      tx.onabort = () => reject(tx.error || new Error(`Aborted resetting progress for ${id}`));

      const metaReq = metaStore.get(id);
      const dataReq = dataStore.get(id);
      let meta = null;
      let dataWrap = null;
      let pending = 2;

      const tryApply = () => {
        if (--pending > 0) return;
        if (!meta) return;
        found = true;

        meta.filledCount = 0;
        meta.completed = false;
        meta.lastModified = Date.now();

        const art = (dataWrap && dataWrap.artworkData) || meta.artworkData;
        if (art) {
          if (Array.isArray(art.regions)) {
            art.regions.forEach(r => {
              r.is_filled = false;
              r.fill_anim = 0.0;
            });
          }
          if (Array.isArray(art.palette)) {
            art.palette.forEach(p => {
              p.filled_count = 0;
              p.is_completed = false;
            });
          }
          dataStore.put({ id, artworkData: art });
        }
        delete meta.artworkData;
        metaStore.put(meta);
      };

      metaReq.onsuccess = () => { meta = metaReq.result || null; tryApply(); };
      dataReq.onsuccess = () => { dataWrap = dataReq.result || null; tryApply(); };
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
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error(`Failed to delete artwork ${id}`));
      tx.onabort = () => reject(tx.error || new Error(`Aborted deleting artwork ${id}`));

      tx.objectStore(STORE_META).delete(id);
      tx.objectStore(STORE_DATA).delete(id);
    });
  }
}

export const storage = new TapColorStorage();
