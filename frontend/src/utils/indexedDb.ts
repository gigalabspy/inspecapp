import type { InspectionState, InspectionSummary, StorageUsageInfo } from '../types';

const DB_NAME = 'inspecapp-offline-db';
const DB_VERSION = 2;
const INSPECTION_STORE = 'inspections';
const LEGACY_STORAGE_KEY = 'inspecapp:fase1:inspection';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function openInspecDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INSPECTION_STORE)) {
        const store = db.createObjectStore(INSPECTION_STORE, { keyPath: 'meta.id' });
        store.createIndex('updatedAt', 'meta.updatedAt', { unique: false });
        store.createIndex('fechaInspeccion', 'meta.fechaInspeccion', { unique: false });
        store.createIndex('estado', 'meta.estado', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeInspection(state: InspectionState, markDirty = true): InspectionState {
  const now = new Date().toISOString();
  const shouldBumpUpdatedAt = markDirty && state.meta.syncStatus !== 'SINCRONIZADA';
  return {
    ...state,
    meta: {
      ...state.meta,
      createdAt: state.meta.createdAt || now,
      updatedAt: shouldBumpUpdatedAt ? now : (state.meta.updatedAt || now),
      syncStatus: state.meta.syncStatus || 'LOCAL',
      version: 4
    }
  };
}

export async function saveInspectionOffline(state: InspectionState): Promise<InspectionState> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readwrite');
  const store = tx.objectStore(INSPECTION_STORE);
  const normalized = normalizeInspection(state, true);
  store.put(normalized);
  await transactionDone(tx);
  db.close();
  return normalized;
}

export async function saveInspectionSyncedOffline(state: InspectionState): Promise<InspectionState> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readwrite');
  const store = tx.objectStore(INSPECTION_STORE);
  const normalized = normalizeInspection({
    ...state,
    meta: {
      ...state.meta,
      syncStatus: 'SINCRONIZADA',
      version: 4
    }
  }, false);
  store.put(normalized);
  await transactionDone(tx);
  db.close();
  return normalized;
}

export async function loadInspectionOffline(id: string): Promise<InspectionState | null> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readonly');
  const result = await requestToPromise<InspectionState | undefined>(tx.objectStore(INSPECTION_STORE).get(id));
  db.close();
  return result || null;
}

export async function listInspectionsOffline(): Promise<InspectionSummary[]> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readonly');
  const all = await requestToPromise<InspectionState[]>(tx.objectStore(INSPECTION_STORE).getAll());
  db.close();

  return all
    .map((inspection) => ({
      id: inspection.meta.id,
      razonSocial: inspection.client.razonSocial || 'Sin razón social',
      ruc: inspection.client.ruc || '',
      direccion: inspection.client.direccion || '',
      fechaInspeccion: inspection.meta.fechaInspeccion,
      tipoInspeccion: inspection.meta.tipoInspeccion,
      estado: inspection.meta.estado,
      updatedAt: inspection.meta.updatedAt || inspection.meta.createdAt || '',
      syncStatus: inspection.meta.syncStatus || 'LOCAL',
      noConformidades: Object.values(inspection.answers).filter((answer) => answer.resultado === 'NO_CUMPLE').length,
      evidencias: inspection.evidences.length,
      circuitos: inspection.circuits.length
    }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function deleteInspectionOffline(id: string): Promise<void> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readwrite');
  tx.objectStore(INSPECTION_STORE).delete(id);
  await transactionDone(tx);
  db.close();
}

export async function getAllInspectionsOffline(): Promise<InspectionState[]> {
  const db = await openInspecDb();
  const tx = db.transaction(INSPECTION_STORE, 'readonly');
  const all = await requestToPromise<InspectionState[]>(tx.objectStore(INSPECTION_STORE).getAll());
  db.close();
  return all.sort((a, b) => (b.meta.updatedAt || '').localeCompare(a.meta.updatedAt || ''));
}

export async function duplicateInspectionOffline(id: string): Promise<InspectionState | null> {
  const original = await loadInspectionOffline(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy: InspectionState = {
    ...original,
    meta: {
      ...original.meta,
      id: `INSP-${Date.now()}`,
      estado: 'BORRADOR',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'LOCAL',
      observacionGeneral: original.meta.observacionGeneral
        ? `${original.meta.observacionGeneral}\n\nDuplicado de ${original.meta.id}`
        : `Duplicado de ${original.meta.id}`
    },
    evidences: original.evidences.map((evidence) => ({
      ...evidence,
      id: crypto.randomUUID(),
      createdAt: now
    }))
  };
  return saveInspectionOffline(copy);
}

export async function importInspectionOffline(state: InspectionState): Promise<InspectionState> {
  const now = new Date().toISOString();
  const incoming: InspectionState = {
    ...state,
    meta: {
      ...state.meta,
      id: state.meta?.id || `INSP-${Date.now()}`,
      createdAt: state.meta?.createdAt || now,
      updatedAt: now,
      syncStatus: 'LOCAL',
      version: 4
    },
    circuits: state.circuits || [],
    answers: state.answers || {},
    evidences: state.evidences || [],
    measurements: state.measurements || []
  };
  return saveInspectionOffline(incoming);
}

export async function migrateLegacyLocalStorage(): Promise<InspectionState | null> {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InspectionState;
    const saved = await importInspectionOffline(parsed);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return saved;
  } catch {
    return null;
  }
}

export async function getStorageUsage(): Promise<StorageUsageInfo> {
  if (!navigator.storage?.estimate) return {};
  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota || 0;
  const usage = estimate.usage || 0;
  return {
    quota,
    usage,
    percent: quota ? Math.round((usage / quota) * 10000) / 100 : 0
  };
}

export function downloadBlob(content: string, fileName: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function humanFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
