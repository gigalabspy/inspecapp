import { Router, Request, Response, NextFunction } from "express";

export type UserRole = "INSPECTOR" | "SUPERVISOR" | "ADMIN";

type AppUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

const users: AppUser[] = [
  {
    id: "usr-inspector",
    email: "inspector@inspecapp.local",
    password: "inspecapp123",
    name: "Inspector Demo",
    role: "INSPECTOR"
  },
  {
    id: "usr-supervisor",
    email: "supervisor@inspecapp.local",
    password: "inspecapp123",
    name: "Supervisor Demo",
    role: "SUPERVISOR"
  },
  {
    id: "usr-admin",
    email: "admin@inspecapp.local",
    password: "inspecapp123",
    name: "Administrador Demo",
    role: "ADMIN"
  }
];

function publicUser(user: AppUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

function createToken(user: AppUser) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: new Date().toISOString()
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function readToken(token: string) {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "No autenticado"
    });
  }

  const token = header.replace("Bearer ", "");
  const payload = readToken(token);

  if (!payload?.email || !payload?.role) {
    return res.status(401).json({
      ok: false,
      message: "Token inválido"
    });
  }

  (req as any).user = payload;
  next();
}

export function requireRoles(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "No autenticado"
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({
        ok: false,
        message: "No tiene permiso para esta acción"
      });
    }

    next();
  };
}

const router = Router();

router.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  const user = users.find(
    (item) =>
      item.email.toLowerCase() === String(email ?? "").toLowerCase() &&
      item.password === password
  );

  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "Usuario o contraseña incorrectos"
    });
  }

  return res.json({
    ok: true,
    token: createToken(user),
    user: publicUser(user)
  });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  return res.json({
    ok: true,
    user: (req as any).user
  });
});

router.get(
  "/users",
  authMiddleware,
  requireRoles(["ADMIN"]),
  (_req: Request, res: Response) => {
    return res.json({
      ok: true,
      users: users.map(publicUser)
    });
  }
);

export const authRouter = router;