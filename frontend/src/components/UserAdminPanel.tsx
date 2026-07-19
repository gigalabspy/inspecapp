import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_API_URL } from '../services/api';

type ManagedRole = 'ADMIN' | 'SUPERVISOR' | 'INSPECTOR';

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: ManagedRole;
  active?: boolean;
  organization?: string;
};

const ROLE_LABELS: Record<ManagedRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Gerente',
  INSPECTOR: 'Inspector'
};

export function UserAdminPanel() {
  const { user } = useAuth();
  const token = user?.token ?? '';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'INSPECTOR' as ManagedRole,
    organization: ''
  });

  const authHeaders = useCallback(
    (): HeadersInit => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/users`, { headers: authHeaders() });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function createUser() {
    setError('');
    setNotice('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Completá nombre y email para crear el usuario.');
      return;
    }
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          organization: form.organization.trim() || undefined
        })
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      setNotice(
        `Usuario ${data.user?.email} creado con rol ${ROLE_LABELS[form.role]}. Ingresa con su email y la contraseña demo del sistema.`
      );
      setForm({ name: '', email: '', role: 'INSPECTOR', organization: '' });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    }
  }

  return (
    <section className="panel">
      <h2>Gestión de usuarios y roles</h2>
      <p>
        Creá perfiles con rol Inspector, Gerente o Administrador, y dales o quitales visibilidad
        (acceso). Un usuario sin visibilidad no puede iniciar sesión. Los usuarios nuevos ingresan
        con su email y la contraseña demo del sistema.
      </p>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {notice && <p style={{ color: '#16a34a' }}>{notice}</p>}

      <h3>Crear usuario</h3>
      <div className="form-grid">
        <label>
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre y apellido"
          />
        </label>
        <label>
          Email
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@empresa.com"
          />
        </label>
        <label>
          Rol
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as ManagedRole })}
          >
            <option value="INSPECTOR">Inspector</option>
            <option value="SUPERVISOR">Gerente</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <label>
          Organización (opcional)
          <input
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            placeholder="Organismo / empresa"
          />
        </label>
      </div>
      <button type="button" onClick={createUser} disabled={loading}>
        Crear usuario
      </button>

      <h3>Usuarios existentes</h3>
      {loading && <p>Cargando usuarios...</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px' }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: '6px' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '6px' }}>Rol</th>
              <th style={{ textAlign: 'left', padding: '6px' }}>Visibilidad</th>
              <th style={{ textAlign: 'left', padding: '6px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const isSelf = item.id === user?.id;
              const isActive = item.active !== false;
              return (
                <tr
                  key={item.id}
                  style={{ borderTop: '1px solid #e2e8f0', opacity: isActive ? 1 : 0.55 }}
                >
                  <td style={{ padding: '6px' }}>
                    {item.name}
                    {isSelf ? ' (vos)' : ''}
                  </td>
                  <td style={{ padding: '6px' }}>{item.email}</td>
                  <td style={{ padding: '6px' }}>
                    <select
                      value={item.role}
                      disabled={isSelf}
                      onChange={(e) => patchUser(item.id, { role: e.target.value })}
                    >
                      <option value="INSPECTOR">Inspector</option>
                      <option value="SUPERVISOR">Gerente</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </td>
                  <td style={{ padding: '6px' }}>{isActive ? 'Visible / activo' : 'Sin visibilidad'}</td>
                  <td style={{ padding: '6px' }}>
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => patchUser(item.id, { active: !isActive })}
                    >
                      {isActive ? 'Quitar visibilidad' : 'Dar visibilidad'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
