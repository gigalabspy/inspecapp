import { Router, Request, Response } from 'express';
import { loginDemoUser } from '../storage/jsonDb.js';

export type UserRole = 'INSPECTOR' | 'SUPERVISOR' | 'ADMIN';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  const user = await loginDemoUser(String(email ?? ''), String(password ?? ''));

  if (!user) {
    return res.status(401).json({
      ok: false,
      message: 'Usuario o contrase\u00f1a incorrectos, o usuario desactivado.'
    });
  }

  return res.json({
    ok: true,
    token: user.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization
    }
  });
});

export const authRouter = router;
