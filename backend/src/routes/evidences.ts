import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { env } from '../utils/env.js';

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(env.uploadDir, { recursive: true });
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Solo se permiten imágenes.'));
      return;
    }
    cb(null, true);
  }
});

export const evidencesRouter = Router();

evidencesRouter.use(authRequired);

evidencesRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió archivo.' });
    return;
  }

  res.json({
    inspectionId: req.body.inspectionId,
    checklistItemId: req.body.checklistItemId,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    fileUrl: `/uploads/${req.file.filename}`,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  });
});
