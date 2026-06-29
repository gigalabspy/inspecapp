import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../utils/env.js';
import type { AuditAction, AuditEntry, DatabaseSchema, InspectionRecord, InspectionState, SignatureRecord, UserRecord } from '../types/inspection.js';

function tokenFor(prefix: string, email: string): string {
  return `demo-token-${prefix}-${crypto.createHash('sha1').update(email).digest('hex').slice(0, 12)}`;
}

function demoUsers(): UserRecord[] {
  return [
    {
      id: 'usr-admin-demo',
      email: env.demoAdminEmail,
      name: 'Administrador InspecAPP',
      role: 'ADMIN',
      token: tokenFor('admin', env.demoAdminEmail),
      active: true,
      organization: 'InspecAPP Demo'
    },
    {
      id: 'usr-supervisor-demo',
      email: 'supervisor@inspecapp.local',
      name: 'Supervisor Técnico',
      role: 'SUPERVISOR',
      token: tokenFor('supervisor', 'supervisor@inspecapp.local'),
      active: true,
      organization: 'Organismo Inspector Demo'
    },
    {
      id: 'usr-inspector-demo',
      email: env.demoInspectorEmail,
      name: 'Inspector de Campo',
      role: 'INSPECTOR',
      token: tokenFor('inspector', env.demoInspectorEmail),
      active: true,
      organization: 'Organismo Inspector Demo'
    }
  ];
}

const initialDb = (): DatabaseSchema => ({
  users: demoUsers(),
  inspections: [],
  audit: [],
  updatedAt: new Date().toISOString()
});

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(path.dirname(env.dataFile), { recursive: true });
  try {
    await fs.access(env.dataFile);
  } catch {
    await fs.writeFile(env.dataFile, JSON.stringify(initialDb(), null, 2), 'utf8');
  }
}

function mergeDemoUsers(users: UserRecord[] = []): UserRecord[] {
  const byEmail = new Map<string, UserRecord>();
  [...users, ...demoUsers()].forEach((user) => byEmail.set(user.email.toLowerCase(), user));
  return Array.from(byEmail.values());
}

function mergeAuditEntries(a: AuditEntry[] = [], b: AuditEntry[] = []): AuditEntry[] {
  const byId = new Map<string, AuditEntry>();
  [...a, ...b].forEach((entry) => byId.set(entry.id, entry));
  return Array.from(byId.values()).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

function normalizedInspectionPayload(incoming: InspectionState, previous?: InspectionState): InspectionState {
  const mergedAudit = mergeAuditEntries(previous?.auditTrail || [], incoming.auditTrail || []);
  const previousSignatures = previous?.signatures || [];
  const incomingSignatures = incoming.signatures || [];
  const signaturesById = new Map<string, SignatureRecord>();
  [...previousSignatures, ...incomingSignatures].forEach((signature) => signaturesById.set(signature.id, signature));

  return {
    ...incoming,
    meta: {
      ...incoming.meta,
      syncStatus: 'SINCRONIZADA',
      version: 5
    },
    signatures: Array.from(signaturesById.values()).sort((a, b) => a.signedAt.localeCompare(b.signedAt)),
    auditTrail: mergedAudit,
    closure: incoming.closure || previous?.closure || {}
  };
}

export async function readDb(): Promise<DatabaseSchema> {
  await ensureDbFile();
  const raw = await fs.readFile(env.dataFile, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
  return {
    users: mergeDemoUsers(parsed.users || []),
    inspections: parsed.inspections || [],
    audit: parsed.audit || [],
    updatedAt: parsed.updatedAt || new Date().toISOString()
  };
}

export async function writeDb(db: DatabaseSchema): Promise<DatabaseSchema> {
  const next = { ...db, updatedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(env.dataFile), { recursive: true });
  await fs.writeFile(env.dataFile, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function findUserByToken(token?: string): Promise<UserRecord | null> {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const db = await readDb();
  return db.users.find((user) => user.token === cleanToken && user.active !== false) || null;
}

export async function loginDemoUser(email: string, password: string): Promise<UserRecord | null> {
  if (password !== env.demoPassword) return null;
  const db = await readDb();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase() && user.active !== false) || null;
}

export async function listUsers(): Promise<UserRecord[]> {
  const db = await readDb();
  return db.users;
}

export function summarizeInspection(record: InspectionRecord) {
  const inspection = record.payload;
  return {
    id: record.id,
    razonSocial: inspection.client?.razonSocial || 'Sin razón social',
    ruc: inspection.client?.ruc || '',
    direccion: inspection.client?.direccion || '',
    fechaInspeccion: inspection.meta?.fechaInspeccion || '',
    tipoInspeccion: inspection.meta?.tipoInspeccion || 'FINAL',
    estado: inspection.meta?.estado || 'BORRADOR',
    updatedAt: inspection.meta?.updatedAt || record.serverUpdatedAt,
    serverUpdatedAt: record.serverUpdatedAt,
    syncStatus: 'SINCRONIZADA',
    noConformidades: Object.values(inspection.answers || {}).filter((answer) => answer.resultado === 'NO_CUMPLE').length,
    evidencias: inspection.evidences?.length || 0,
    circuitos: inspection.circuits?.length || 0,
    firmas: inspection.signatures?.length || 0,
    ownerUserId: record.ownerUserId,
    deleted: Boolean(record.deleted)
  };
}

export async function getInspectionRecord(id: string): Promise<InspectionRecord | null> {
  const db = await readDb();
  return db.inspections.find((record) => record.id === id && !record.deleted) || null;
}

export async function saveInspectionRecord(record: InspectionRecord): Promise<InspectionRecord> {
  const db = await readDb();
  const index = db.inspections.findIndex((item) => item.id === record.id);
  const nextRecord = { ...record, serverUpdatedAt: new Date().toISOString() };
  if (index >= 0) db.inspections[index] = nextRecord;
  else db.inspections.push(nextRecord);
  await writeDb(db);
  return nextRecord;
}

export async function upsertInspection(userId: string, incoming: InspectionState): Promise<InspectionRecord> {
  const db = await readDb();
  const now = new Date().toISOString();
  const id = incoming.meta.id;
  const existingIndex = db.inspections.findIndex((record) => record.id === id);
  const previousPayload = existingIndex >= 0 ? db.inspections[existingIndex].payload : undefined;
  const syncedPayload = normalizedInspectionPayload(incoming, previousPayload);
  const record: InspectionRecord = {
    id,
    payload: syncedPayload,
    ownerUserId: existingIndex >= 0 ? db.inspections[existingIndex].ownerUserId : userId,
    serverUpdatedAt: now,
    deleted: false
  };

  if (existingIndex >= 0) db.inspections[existingIndex] = record;
  else db.inspections.push(record);

  await writeDb(db);
  return record;
}

export async function addAuditEntry(params: {
  inspectionId: string;
  user: UserRecord;
  action: AuditAction;
  detail: string;
  payload?: Record<string, unknown>;
}): Promise<AuditEntry> {
  const db = await readDb();
  const index = db.inspections.findIndex((record) => record.id === params.inspectionId && !record.deleted);
  if (index < 0) throw new Error('Inspección no encontrada.');

  const entry: AuditEntry = {
    id: `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    inspectionId: params.inspectionId,
    action: params.action,
    actorUserId: params.user.id,
    actorName: params.user.name,
    actorRole: params.user.role,
    createdAt: new Date().toISOString(),
    detail: params.detail,
    payload: params.payload
  };

  db.audit.push(entry);
  const payload = db.inspections[index].payload;
  db.inspections[index] = {
    ...db.inspections[index],
    serverUpdatedAt: entry.createdAt,
    payload: {
      ...payload,
      auditTrail: mergeAuditEntries(payload.auditTrail || [], [entry]),
      meta: {
        ...payload.meta,
        updatedAt: entry.createdAt,
        syncStatus: 'SINCRONIZADA',
        version: 5
      }
    }
  };

  await writeDb(db);
  return entry;
}

export async function listAuditEntries(inspectionId: string): Promise<AuditEntry[]> {
  const db = await readDb();
  const record = db.inspections.find((item) => item.id === inspectionId && !item.deleted);
  return mergeAuditEntries(record?.payload.auditTrail || [], db.audit.filter((entry) => entry.inspectionId === inspectionId));
}

export async function markInspectionDeleted(id: string): Promise<boolean> {
  const db = await readDb();
  const index = db.inspections.findIndex((record) => record.id === id);
  if (index < 0) return false;
  db.inspections[index] = {
    ...db.inspections[index],
    deleted: true,
    serverUpdatedAt: new Date().toISOString()
  };
  await writeDb(db);
  return true;
}
