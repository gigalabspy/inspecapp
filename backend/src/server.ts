import fs from 'node:fs/promises';
import express from 'express';
import cors from 'cors';
import { env } from './utils/env.js';
import { authRouter } from './routes/auth.js';
import { inspectionsRouter } from './routes/inspections.js';
import { syncRouter } from './routes/sync.js';
import { evidencesRouter } from './routes/evidences.js';
import { reportsRouter } from './routes/reports.js';
import { workflowRouter } from './routes/workflow.js';
import { readDb } from './storage/jsonDb.js';

const app = express();

await fs.mkdir(env.uploadDir, { recursive: true });
await fs.mkdir(env.reportDir, { recursive: true });
await readDb();

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(env.uploadDir));
app.use('/reports', express.static(env.reportDir));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    app: 'InspecAPP API',
    phase: 6,
    message: 'API de InspecAPP funcionando. Ver estado en /api/health',
    health: '/api/health'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'InspecAPP API',
    phase: 6,
    serverTime: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/evidences', evidencesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/workflow', workflowRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor.' });
});

app.listen(env.port, () => {
  console.log(`InspecAPP API Fase 6 escuchando en http://localhost:${env.port}`);
  console.log(`CORS habilitado para ${env.corsOrigins.join(', ')}`);
});
