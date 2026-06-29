import type { AuditEntry, FinalDecision, InspectionState, SignatureKind, SignatureRecord, UserRole } from '../types';

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organization?: string;
  };
}

export interface PushResult {
  serverTime: string;
  accepted: Array<{ id: string; serverUpdatedAt: string; inspection: InspectionState }>;
  conflicts: Array<{ id: string; reason: string; serverInspection: InspectionState; serverUpdatedAt: string }>;
}

export interface PullResult {
  serverTime: string;
  inspections: InspectionState[];
  summaries: unknown[];
}

export const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const SESSION_KEY = 'inspecapp:fase6:sync-session';

function headers(token?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }
  return data as T;
}

export async function checkHealth(apiUrl: string) {
  const response = await fetch(`${apiUrl}/api/health`);
  return parseResponse<{ ok: boolean; app: string; phase: number; serverTime: string }>(response);
}

export async function login(apiUrl: string, email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password })
  });
  return parseResponse<LoginResponse>(response);
}

export async function pushInspections(apiUrl: string, token: string, inspections: InspectionState[]): Promise<PushResult> {
  const response = await fetch(`${apiUrl}/api/sync/push`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ inspections })
  });
  return parseResponse<PushResult>(response);
}

export async function pullInspections(apiUrl: string, token: string, since = ''): Promise<PullResult> {
  const url = new URL(`${apiUrl}/api/sync/pull`);
  if (since) url.searchParams.set('since', since);
  const response = await fetch(url.toString(), { headers: headers(token) });
  return parseResponse<PullResult>(response);
}

export async function uploadEvidenceFile(apiUrl: string, token: string, params: {
  inspectionId: string;
  checklistItemId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('inspectionId', params.inspectionId);
  formData.append('checklistItemId', params.checklistItemId);
  formData.append('file', params.file);

  const response = await fetch(`${apiUrl}/api/evidences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  return parseResponse<{
    inspectionId: string;
    checklistItemId: string;
    fileName: string;
    storedName: string;
    fileUrl: string;
    size: number;
    uploadedAt: string;
  }>(response);
}

export interface ReportSummary {
  inspectionId: string;
  generatedAt: string;
  tipoInspeccion: string;
  cliente: string;
  direccion: string;
  totalRequisitos: number;
  resEvaluados: number;
  noConformidades: number;
  noConformidadesCriticas: number;
  evidencias: number;
  circuitos: number;
  mediciones: number;
  counts: Record<string, number>;
  resultadoPreliminar: 'CONFORME' | 'OBSERVADO' | 'PENDIENTE';
}

export interface GenerateReportResponse {
  generatedAt: string;
  inspection: InspectionState;
  summary: ReportSummary;
  files: { html: string; pdf: string };
}

export async function getReportSummary(apiUrl: string, token: string, inspectionId: string): Promise<ReportSummary> {
  const response = await fetch(`${apiUrl}/api/reports/${encodeURIComponent(inspectionId)}/summary`, { headers: headers(token) });
  return parseResponse<ReportSummary>(response);
}

export async function generateFormalReport(apiUrl: string, token: string, inspectionId: string): Promise<GenerateReportResponse> {
  const response = await fetch(`${apiUrl}/api/reports/${encodeURIComponent(inspectionId)}/generate`, {
    method: 'POST',
    headers: headers(token)
  });
  return parseResponse<GenerateReportResponse>(response);
}

export async function fetchFormalReportBlob(apiUrl: string, token: string, inspectionId: string, format: 'html' | 'pdf'): Promise<Blob> {
  const response = await fetch(`${apiUrl}/api/reports/${encodeURIComponent(inspectionId)}/${format}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }
  return response.blob();
}

export async function getAuditTrail(apiUrl: string, token: string, inspectionId: string): Promise<{ inspectionId: string; audit: AuditEntry[] }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/audit`, { headers: headers(token) });
  return parseResponse<{ inspectionId: string; audit: AuditEntry[] }>(response);
}

export async function addWorkflowNote(apiUrl: string, token: string, inspectionId: string, detail: string): Promise<{ entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/note`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ detail })
  });
  return parseResponse<{ entry: AuditEntry; inspection: InspectionState }>(response);
}

export async function signInspection(apiUrl: string, token: string, inspectionId: string, data: {
  kind: SignatureKind;
  signerName: string;
  signerDocument: string;
  signerEmail?: string;
  statement?: string;
  dataUrl: string;
}): Promise<{ signature: SignatureRecord; entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/signatures`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data)
  });
  return parseResponse<{ signature: SignatureRecord; entry: AuditEntry; inspection: InspectionState }>(response);
}

export async function submitInspectionForReview(apiUrl: string, token: string, inspectionId: string, detail: string): Promise<{ entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/submit-review`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ detail })
  });
  return parseResponse<{ entry: AuditEntry; inspection: InspectionState }>(response);
}

export async function approveInspection(apiUrl: string, token: string, inspectionId: string, detail: string): Promise<{ entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/approve`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ detail })
  });
  return parseResponse<{ entry: AuditEntry; inspection: InspectionState }>(response);
}

export async function closeInspection(apiUrl: string, token: string, inspectionId: string, data: {
  finalDecision: FinalDecision;
  closureNote: string;
  requiresCorrection: boolean;
}): Promise<{ entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/close`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data)
  });
  return parseResponse<{ entry: AuditEntry; inspection: InspectionState }>(response);
}

export async function reopenInspection(apiUrl: string, token: string, inspectionId: string, reason: string): Promise<{ entry: AuditEntry; inspection: InspectionState }> {
  const response = await fetch(`${apiUrl}/api/workflow/${encodeURIComponent(inspectionId)}/reopen`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ reason })
  });
  return parseResponse<{ entry: AuditEntry; inspection: InspectionState }>(response);
}
