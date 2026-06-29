import { Router } from 'express';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { listUsers, loginDemoUser } from '../storage/jsonDb.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    return;
  }

  const user = await loginDemoUser(String(email), String(password));
  if (!user) {
    res.status(401).json({ error: 'Credenciales inválidas.' });
    return;
  }

  res.json({
    token: user.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization || ''
    }
  });
});

authRouter.get('/me', authRequired, async (req, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization || ''
  });
});

authRouter.get('/users', authRequired, requireRoles('ADMIN', 'SUPERVISOR'), async (_req, res) => {
  const users = await listUsers();
  res.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active !== false,
      organization: user.organization || ''
    }))
  });
});
