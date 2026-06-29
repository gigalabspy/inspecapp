import { Router } from 'express';
import { markInspectionDeleted, readDb, summarizeInspection, upsertInspection } from '../storage/jsonDb.js';
import { authRequired } from '../middleware/auth.js';
import type { InspectionState } from '../types/inspection.js';

export const inspectionsRouter = Router();

inspectionsRouter.use(authRequired);

inspectionsRouter.get('/', async (_req, res) => {
  const db = await readDb();
  res.json({ inspections: db.inspections.filter((record) => !record.deleted).map(summarizeInspection) });
});

inspectionsRouter.get('/:id', async (req, res) => {
  const db = await readDb();
  const record = db.inspections.find((item) => item.id === req.params.id && !item.deleted);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return;
  }
  res.json(record.payload);
});

inspectionsRouter.put('/:id', async (req, res) => {
  const payload = req.body as InspectionState;
  if (!payload?.meta?.id || payload.meta.id !== req.params.id) {
    res.status(400).json({ error: 'El id de la inspección no coincide.' });
    return;
  }
  const record = await upsertInspection(req.user!.id, payload);
  res.json({ accepted: true, inspection: record.payload, serverUpdatedAt: record.serverUpdatedAt });
});

inspectionsRouter.delete('/:id', async (req, res) => {
  const deleted = await markInspectionDeleted(req.params.id);
  res.status(deleted ? 200 : 404).json({ deleted });
});
