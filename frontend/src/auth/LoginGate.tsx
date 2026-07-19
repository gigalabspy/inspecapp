import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";

const demoUsers = [
  {
    label: "Inspector",
    email: "inspector@inspecapp.local"
  },
  {
    label: "Gerente",
    email: "supervisor@inspecapp.local"
  },
  {
    label: "Administrador",
    email: "admin@inspecapp.local"
  }
];

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, login, logout } = useAuth();

  const [email, setEmail] = useState("inspector@inspecapp.local");
  const [password, setPassword] = useState("inspecapp123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setError("");
      setLoading(true);
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-brand">
            <h1>InspecAPP</h1>
            <p>Acceso al panel de inspección</p>
          </div>

          <label>
            Usuario
            <input
              type="email"
              value={email}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <div className="login-demo">
            <strong>Usuarios demo</strong>

            {demoUsers.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => {
                  setEmail(demo.email);
                  setPassword("inspecapp123");
                }}
              >
                {demo.label}
              </button>
            ))}
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <header className="auth-header">
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>

        <div className="auth-role">
          <span>{user.role}</span>
          <button type="button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {children}
    </>
  );
}