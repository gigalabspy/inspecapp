import type { InspectionState } from '../types';

const STORAGE_KEY = 'inspecapp:fase1:inspection';

export function saveInspection(state: InspectionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadInspection(): InspectionState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InspectionState;
  } catch {
    return null;
  }
}

export function clearInspection(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function downloadJson(state: InspectionState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `inspecapp-${state.meta.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
