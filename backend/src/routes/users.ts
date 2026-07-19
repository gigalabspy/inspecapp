import { Router } from 'express';
import crypto from 'node:crypto';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { readDb, writeDb } from '../storage/jsonDb.js';
import type { UserRecord, UserRole } from '../types/inspection.js';

const VALID_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'INSPECTOR'];

function publicUser(user: UserRecord) {
  const { token, ...safe } = user;
  return safe;
}

export const usersRouter = Router();

usersRouter.use(authRequired, requireRoles('ADMIN'));

usersRouter.get('/', async (_req, res) => {
  const db = await readDb();
  res.json({ ok: true, users: db.users.map(publicUser) });
});

usersRouter.post('/', async (req, res) => {
  const { name, email, role, organization } = req.body ?? {};

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Faltan campos: name, email y role son obligatorios.' });
    return;
  }
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Rol inv\u00e1lido. Valores permitidos: ${VALID_ROLES.join(', ')}.` });
    return;
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    res.status(400).json({ error: 'El email no tiene un formato v\u00e1lido.' });
    return;
  }
  if (db.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    return;
  }

  const user: UserRecord = {
    id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    email: normalizedEmail,
    name: String(name).trim(),
    role,
    token: `usr-token-${crypto.randomBytes(16).toString('hex')}`,
    active: true,
    organization: organization ? String(organization).trim() : undefined
  };

  db.users.push(user);
  await writeDb(db);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

usersRouter.patch('/:id', async (req, res) => {
  const { role, active, name, organization } = req.body ?? {};

  const db = await readDb();
  const index = db.users.findIndex((user) => user.id === req.params.id);
  if (index < 0) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }

  const target = { ...db.users[index] };
  const self = req.user!;

  if (target.id === self.id && active === false) {
    res.status(400).json({ error: 'No pod\u00e9s desactivar tu propio usuario.' });
    return;
  }
  if (target.id === self.id && role !== undefined && role !== 'ADMIN') {
    res.status(400).json({ error: 'No pod\u00e9s quitarte a vos mismo el rol de administrador.' });
    return;
  }

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `Rol inv\u00e1lido. Valores permitidos: ${VALID_ROLES.join(', ')}.` });
      return;
    }
    target.role = role;
  }
  if (typeof active === 'boolean') target.active = active;
  if (name) target.name = String(name).trim();
  if (organization !== undefined) target.organization = String(organization).trim() || undefined;

  db.users[index] = target;
  await writeDb(db);
  res.json({ ok: true, user: publicUser(target) });
});
