import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { buildFormalReportHtml } from '../report/htmlReport.js';
import { buildFormalReportPdf } from '../report/pdfReport.js';
import { buildReportSummary } from '../report/reportData.js';
import { addAuditEntry, readDb, writeDb } from '../storage/jsonDb.js';
import { env } from '../utils/env.js';

export const reportsRouter = Router();

reportsRouter.use(authRequired);

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function getInspectionOr404(id: string) {
  const db = await readDb();
  const index = db.inspections.findIndex((item) => item.id === id && !item.deleted);
  return { db, index, record: index >= 0 ? db.inspections[index] : null };
}

reportsRouter.get('/:id/summary', async (req, res) => {
  const { record } = await getInspectionOr404(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return;
  }
  res.json(buildReportSummary(record.payload));
});

reportsRouter.get('/:id/html', async (req, res) => {
  const { record } = await getInspectionOr404(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return;
  }
  const html = buildFormalReportHtml(record.payload);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="reporte-${safeFileName(record.id)}.html"`);
  res.send(html);
});

reportsRouter.get('/:id/pdf', async (req, res) => {
  const { record } = await getInspectionOr404(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return;
  }
  const buffer = await buildFormalReportPdf(record.payload);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${safeFileName(record.id)}.pdf"`);
  res.send(buffer);
});

reportsRouter.post('/:id/generate', async (req, res) => {
  const { db, index, record } = await getInspectionOr404(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Inspección no encontrada.' });
    return;
  }

  const generatedAt = new Date().toISOString();
  const folder = path.join(env.reportDir, safeFileName(record.id));
  await fs.mkdir(folder, { recursive: true });

  const html = buildFormalReportHtml(record.payload);
  const pdf = await buildFormalReportPdf(record.payload);
  const htmlFile = `reporte-${safeFileName(record.id)}.html`;
  const pdfFile = `reporte-${safeFileName(record.id)}.pdf`;

  await fs.writeFile(path.join(folder, htmlFile), html, 'utf8');
  await fs.writeFile(path.join(folder, pdfFile), pdf);

  const updatedPayload = {
    ...record.payload,
    meta: {
      ...record.payload.meta,
      estado: record.payload.meta.estado === 'CERRADA' ? 'CERRADA' as const : 'PRELIMINAR_GENERADO' as const,
      reportStatus: 'GENERADO_SERVIDOR' as const,
      lastReportAt: generatedAt,
      updatedAt: generatedAt,
      syncStatus: 'SINCRONIZADA' as const,
      version: 5
    }
  };

  db.inspections[index] = {
    ...record,
    payload: updatedPayload,
    serverUpdatedAt: generatedAt
  };
  await writeDb(db);

  await addAuditEntry({
    inspectionId: record.id,
    user: req.user!,
    action: 'REPORTE_GENERADO',
    detail: 'Reporte formal generado desde servidor.',
    payload: { htmlFile, pdfFile }
  });

  res.json({
    generatedAt,
    inspection: updatedPayload,
    summary: buildReportSummary(updatedPayload),
    files: {
      html: `/reports/${safeFileName(record.id)}/${htmlFile}`,
      pdf: `/reports/${safeFileName(record.id)}/${pdfFile}`
    }
  });
});
