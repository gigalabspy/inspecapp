import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { readDb, summarizeInspection, upsertInspection } from '../storage/jsonDb.js';
import type { InspectionState } from '../types/inspection.js';

export const syncRouter = Router();

syncRouter.use(authRequired);

syncRouter.get('/pull', async (req, res) => {
  const since = String(req.query.since || '');
  const db = await readDb();
  const inspections = db.inspections.filter((record) => {
    if (!since) return true;
    return record.serverUpdatedAt > since;
  });

  res.json({
    serverTime: new Date().toISOString(),
    inspections: inspections.map((record) => record.payload),
    summaries: inspections.map(summarizeInspection)
  });
});

syncRouter.post('/push', async (req, res) => {
  const incoming = (req.body?.inspections || []) as InspectionState[];
 const conflicts: Array<{
  id: string;
  reason: string;
  serverInspection: InspectionState;
  serverUpdatedAt: string;
}> = [];

const accepted: Array<{
  id: string;
  serverUpdatedAt: string;
  inspection: InspectionState;
}> = [];

  for (const inspection of incoming) {
    if (!inspection?.meta?.id) continue;

    const dbBefore = await readDb();
    const existing = dbBefore.inspections.find((record) => record.id === inspection.meta.id && !record.deleted);
    const incomingUpdatedAt = inspection.meta.updatedAt || inspection.meta.createdAt || '';
    const existingUpdatedAt = existing?.payload.meta.updatedAt || existing?.payload.meta.createdAt || '';

    if (existing && existingUpdatedAt > incomingUpdatedAt && inspection.meta.syncStatus !== 'PENDIENTE_SYNC') {
      conflicts.push({
        id: inspection.meta.id,
        reason: 'El servidor tiene una versión más reciente.',
        serverInspection: existing.payload,
        serverUpdatedAt: existing.serverUpdatedAt
      });
      continue;
    }

    const record = await upsertInspection(req.user!.id, inspection);
    accepted.push({
      id: inspection.meta.id,
      serverUpdatedAt: record.serverUpdatedAt,
      inspection: record.payload
    });
  }

  res.json({
    serverTime: new Date().toISOString(),
    accepted,
    conflicts
  });
});
