import type { NextFunction, Request, Response } from 'express';
import { findUserByToken } from '../storage/jsonDb.js';
import type { UserRecord, UserRole } from '../types/inspection.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const user = await findUserByToken(req.header('authorization'));
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Iniciá sesión para continuar.' });
    return;
  }
  req.user = user;
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `No tenés permiso para esta acción. Rol requerido: ${roles.join(', ')}.` });
      return;
    }
    next();
  };
}
