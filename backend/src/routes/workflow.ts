import crypto from 'node:crypto';
import { Router } from 'express';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { addAuditEntry, getInspectionRecord, listAuditEntries, saveInspectionRecord } from '../storage/jsonDb.js';
import type { FinalDecision, InspectionState, SignatureKind, SignatureRecord } from '../types/inspection.js';

export const workflowRouter = Router();

workflowRouter.use(authRequired);

function isSignatureKind(value: unknown): value is SignatureKind {
  return value === 'PROPIETARIO' || value === 'INSPECTOR' || value === 'SUPERVISOR';
}

function isFinalDecision(value: unknown): value is FinalDecision {
  return value === 'CONFORME' || value === 'OBSERVADO' || value === 'NO_CONFORME';
}

function hasSignature(inspection: InspectionState, kind: SignatureKind): boolean {
  return Boolean(inspection.signatures?.some((signature) => signature.kind === kind && signature.dataUrl));
}

async function getRecordOr404(id: string, res: import('express').Response) {
  const record = await getInspectionRecord(id);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return null;
  }
  return record;
}

workflowRouter.get('/:id/audit', async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const audit = await listAuditEntries(inspectionId);
  res.json({ inspectionId, audit });
});

workflowRouter.post('/:id/note', async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const detail = String(req.body?.detail || '').trim();
  if (!detail) {
    res.status(400).json({ error: 'La observación es obligatoria.' });
    return;
  }
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'OBSERVACION_AGREGADA',
    detail
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ entry, inspection: refreshed?.payload });
});

workflowRouter.post('/:id/signatures', async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;

  const { kind, signerName, signerDocument, signerEmail, statement, dataUrl } = req.body || {};
  if (!isSignatureKind(kind)) {
    res.status(400).json({ error: 'Tipo de firma inválido.' });
    return;
  }
  if (!String(signerName || '').trim()) {
    res.status(400).json({ error: 'El nombre del firmante es obligatorio.' });
    return;
  }
  if (!String(dataUrl || '').startsWith('data:image/')) {
    res.status(400).json({ error: 'La firma debe enviarse como imagen data URL.' });
    return;
  }

  const now = new Date().toISOString();
  const signature: SignatureRecord = {
    id: `SIG-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    kind,
    signerName: String(signerName).trim(),
    signerDocument: String(signerDocument || '').trim(),
    signerEmail: String(signerEmail || '').trim(),
    roleLabel: kind === 'PROPIETARIO' ? 'Propietario / responsable de la instalación' : kind === 'INSPECTOR' ? 'Inspector actuante' : 'Supervisor / responsable técnico',
    statement: String(statement || 'Conforme a los datos registrados en InspecAPP.').trim(),
    dataUrl: String(dataUrl),
    signedAt: now,
    signedByUserId: req.user!.id,
    signedByUserName: req.user!.name
  };

  const payload: InspectionState = {
    ...record.payload,
    signatures: [...(record.payload.signatures || []), signature],
    meta: {
      ...record.payload.meta,
      updatedAt: now,
      syncStatus: 'SINCRONIZADA',
      version: 5
    }
  };

  const saved = await saveInspectionRecord({ ...record, payload });
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'FIRMA_REGISTRADA',
    detail: `Firma registrada: ${signature.roleLabel} - ${signature.signerName}`,
    payload: { signatureId: signature.id, kind: signature.kind, signerName: signature.signerName }
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ signature, entry, inspection: refreshed?.payload || saved.payload });
});

workflowRouter.post('/:id/submit-review', async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const now = new Date().toISOString();
  const payload: InspectionState = {
    ...record.payload,
    meta: {
      ...record.payload.meta,
      estado: 'EN_REVISION',
      updatedAt: now,
      syncStatus: 'SINCRONIZADA',
      version: 5
    }
  };
  await saveInspectionRecord({ ...record, payload });
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'ENVIADA_REVISION',
    detail: String(req.body?.detail || 'Inspección enviada a revisión técnica.'),
    payload: { estado: 'EN_REVISION' }
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ entry, inspection: refreshed?.payload });
});

workflowRouter.post('/:id/approve', requireRoles('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const now = new Date().toISOString();
  const payload: InspectionState = {
    ...record.payload,
    meta: {
      ...record.payload.meta,
      estado: 'APROBADA',
      updatedAt: now,
      syncStatus: 'SINCRONIZADA',
      version: 5
    }
  };
  await saveInspectionRecord({ ...record, payload });
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'APROBADA_SUPERVISION',
    detail: String(req.body?.detail || 'Inspección aprobada por supervisión.'),
    payload: { estado: 'APROBADA' }
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ entry, inspection: refreshed?.payload });
});

workflowRouter.post('/:id/close', requireRoles('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const finalDecision = req.body?.finalDecision;
  if (!isFinalDecision(finalDecision)) {
    res.status(400).json({ error: 'Decisión final inválida. Usá CONFORME, OBSERVADO o NO_CONFORME.' });
    return;
  }
  if (!hasSignature(record.payload, 'INSPECTOR')) {
    res.status(400).json({ error: 'No se puede cerrar sin firma del inspector.' });
    return;
  }
  if (!hasSignature(record.payload, 'PROPIETARIO')) {
    res.status(400).json({ error: 'No se puede cerrar sin firma del propietario o responsable.' });
    return;
  }

  const now = new Date().toISOString();
  const payload: InspectionState = {
    ...record.payload,
    meta: {
      ...record.payload.meta,
      estado: 'CERRADA',
      reportStatus: 'FIRMADO',
      updatedAt: now,
      syncStatus: 'SINCRONIZADA',
      version: 5
    },
    closure: {
      finalDecision,
      closureNote: String(req.body?.closureNote || '').trim(),
      closedAt: now,
      closedByUserId: req.user!.id,
      closedByUserName: req.user!.name,
      requiresCorrection: Boolean(req.body?.requiresCorrection)
    }
  };
  await saveInspectionRecord({ ...record, payload });
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'CERRADA_FORMALMENTE',
    detail: `Inspección cerrada formalmente. Decisión final: ${finalDecision}.`,
    payload: { finalDecision, requiresCorrection: Boolean(req.body?.requiresCorrection) }
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ entry, inspection: refreshed?.payload });
});

workflowRouter.post('/:id/reopen', requireRoles('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const inspectionId = req.params.id;
  const record = await getRecordOr404(inspectionId, res);
  if (!record) return;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'Para reabrir la inspección se requiere motivo.' });
    return;
  }
  const now = new Date().toISOString();
  const payload: InspectionState = {
    ...record.payload,
    meta: {
      ...record.payload.meta,
      estado: 'OBSERVADA',
      reportStatus: 'GENERADO_SERVIDOR',
      updatedAt: now,
      syncStatus: 'SINCRONIZADA',
      version: 5
    },
    closure: {
      ...(record.payload.closure || {}),
      requiresCorrection: true,
      closureNote: `Reabierta: ${reason}`
    }
  };
  await saveInspectionRecord({ ...record, payload });
  const entry = await addAuditEntry({
    inspectionId,
    user: req.user!,
    action: 'REABIERTA',
    detail: reason,
    payload: { estado: 'OBSERVADA' }
  });
  const refreshed = await getInspectionRecord(inspectionId);
  res.json({ entry, inspection: refreshed?.payload });
});
