/**
 * IndexedDB-based local project storage
 * Allows saving/loading multiple projects in the browser
 */

const DB_NAME = 'pixelconnect_projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export interface SavedProjectMeta {
  id: string;
  name: string;
  savedAt: string;
  sizeBytes: number;
  thumbnailDataUrl?: string;
  layerCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SavedProject extends SavedProjectMeta {
  /** The full serialized JSON string */
  projectJson: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** List all saved projects (metadata only, no full JSON payload) */
export async function listSavedProjects(): Promise<SavedProjectMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const results: SavedProjectMeta[] = (req.result as SavedProject[]).map(
        ({ id, name, savedAt, sizeBytes, thumbnailDataUrl, layerCount, canvasWidth, canvasHeight }) => ({
          id, name, savedAt, sizeBytes, thumbnailDataUrl, layerCount, canvasWidth, canvasHeight,
        })
      );
      // Sort newest first
      results.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Save a project (overwrite if same id) */
export async function saveProjectLocal(entry: SavedProject): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load a full saved project by id */
export async function loadProjectLocal(id: string): Promise<SavedProject | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as SavedProject | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a saved project */
export async function deleteProjectLocal(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Rename a saved project */
export async function renameProjectLocal(id: string, newName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const entry = req.result as SavedProject | undefined;
      if (!entry) { reject(new Error('Project not found')); return; }
      entry.name = newName;
      store.put(entry);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Generate a small thumbnail from project layers */
export function generateThumbnail(
  layers: { imageData: string; x: number; y: number; width: number; height: number; visible: boolean; opacity: number; zIndex: number }[],
  canvasWidth: number,
  canvasHeight: number,
  maxSize: number = 128,
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(maxSize / canvasWidth, maxSize / canvasHeight, 1);
    canvas.width = Math.round(canvasWidth * scale);
    canvas.height = Math.round(canvasHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    const sorted = [...layers].filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex);
    let loaded = 0;

    if (sorted.length === 0) {
      resolve(canvas.toDataURL('image/png'));
      return;
    }

    sorted.forEach((layer) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === sorted.length) {
          // Draw in order
          sorted.forEach((l) => {
            const li = new Image();
            li.src = l.imageData;
            ctx.globalAlpha = l.opacity;
            ctx.drawImage(li, l.x, l.y, l.width, l.height);
          });
          ctx.globalAlpha = 1;
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === sorted.length) resolve(canvas.toDataURL('image/png'));
      };
      img.src = layer.imageData;
    });
  });
}

/** Format byte size to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
