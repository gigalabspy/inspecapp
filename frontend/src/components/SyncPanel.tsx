import { useEffect, useMemo, useState } from 'react';
import type { InspectionState } from '../types';
import {
  checkHealth,
  DEFAULT_API_URL,
  SESSION_KEY,
  login,
  pullInspections,
  pushInspections
} from '../services/api';
import {
  getAllInspectionsOffline,
  saveInspectionSyncedOffline
} from '../utils/indexedDb';

type SyncPanelProps = {
  currentInspection?: InspectionState | null;
  onCurrentInspectionChange?: (inspection: InspectionState) => void;
  onRefresh?: () => Promise<void> | void;
};

type StoredSession = {
  apiUrl: string;
  token: string;
  userName: string;
  userEmail: string;
  userRole?: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR';
  lastPullAt?: string;
};

function loadSession(): StoredSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as StoredSession;
  } catch {
    // ignore
  }
  return { apiUrl: DEFAULT_API_URL, token: '', userName: '', userEmail: '' };
}

function saveSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function SyncPanel({ currentInspection, onCurrentInspectionChange, onRefresh }: SyncPanelProps) {
  const [session, setSession] = useState<StoredSession>(() => loadSession());
  const [email, setEmail] = useState(session.userEmail || 'inspector@inspecapp.local');
  const [password, setPassword] = useState('inspecapp123');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [offlineInspections, setOfflineInspections] = useState<InspectionState[]>([]);

  async function refreshLocalList() {
    const items = await getAllInspectionsOffline();
    setOfflineInspections(items);
  }

  useEffect(() => {
    refreshLocalList();
  }, [currentInspection?.meta.id, currentInspection?.meta.syncStatus]);

  const pending = useMemo(() => {
    return offlineInspections.filter((inspection) => inspection.meta.syncStatus !== 'SINCRONIZADA');
  }, [offlineInspections]);

  function updateSession(next: StoredSession) {
    setSession(next);
    saveSession(next);
  }

  async function handleHealthCheck() {
    setBusy(true);
    setMessage('Probando conexión con el servidor...');
    try {
      const result = await checkHealth(session.apiUrl);
      setMessage(`Servidor disponible: ${result.app}, fase ${result.phase}. Hora servidor: ${new Date(result.serverTime).toLocaleString()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    setBusy(true);
    setMessage('Iniciando sesión...');
    try {
      const result = await login(session.apiUrl, email, password);
      updateSession({
        ...session,
        token: result.token,
        userName: result.user.name,
        userEmail: result.user.email,
        userRole: result.user.role
      });
      setMessage(`Sesión iniciada como ${result.user.name} (${result.user.role}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePush() {
    if (!session.token) {
      setMessage('Primero iniciá sesión.');
      return;
    }
    setBusy(true);
    setMessage(`Subiendo ${pending.length} inspección(es) pendiente(s)...`);
    try {
      const result = await pushInspections(session.apiUrl, session.token, pending);
      for (const accepted of result.accepted) {
        const saved = await saveInspectionSyncedOffline(accepted.inspection);
        if (currentInspection?.meta.id === saved.meta.id) onCurrentInspectionChange?.(saved);
      }
      await refreshLocalList();
      await onRefresh?.();
      setMessage(`Sincronización de subida finalizada. Aceptadas: ${result.accepted.length}. Conflictos: ${result.conflicts.length}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo subir la información.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePull() {
    if (!session.token) {
      setMessage('Primero iniciá sesión.');
      return;
    }
    setBusy(true);
    setMessage('Descargando cambios del servidor...');
    try {
      const result = await pullInspections(session.apiUrl, session.token, session.lastPullAt || '');
      for (const inspection of result.inspections) {
        const saved = await saveInspectionSyncedOffline(inspection);
        if (currentInspection?.meta.id === saved.meta.id) onCurrentInspectionChange?.(saved);
      }
      updateSession({ ...session, lastPullAt: result.serverTime });
      await refreshLocalList();
      await onRefresh?.();
      setMessage(`Descarga finalizada. Registros recibidos: ${result.inspections.length}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo descargar la información.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFullSync() {
    await handlePush();
    await handlePull();
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Sincronización con servidor</h2>
        <span>{session.token ? `Sesión: ${session.userName} · ${session.userRole || 'ROL'}` : 'Sin sesión'}</span>
      </div>

      <p className="muted">
        Esta fase mantiene el trabajo offline en IndexedDB y agrega API central, sincronización, roles, cierre formal, firmas y trazabilidad.
      </p>

      <div className="form-grid">
        <label>URL de API
          <input
            value={session.apiUrl}
            onChange={(e) => updateSession({ ...session, apiUrl: e.target.value })}
            placeholder="http://localhost:3001"
          />
        </label>
        <label>Última descarga
          <input value={session.lastPullAt ? new Date(session.lastPullAt).toLocaleString() : 'Nunca'} readOnly />
        </label>
        <label>Email demo
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Contraseña demo
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>

      <div className="summary-grid sync-summary">
        <div><strong>{offlineInspections.length}</strong><span>inspecciones locales</span></div>
        <div><strong>{pending.length}</strong><span>pendientes de subir</span></div>
        <div><strong>{offlineInspections.filter((i) => i.meta.syncStatus === 'SINCRONIZADA').length}</strong><span>sincronizadas</span></div>
        <div><strong>{offlineInspections.filter((i) => i.meta.syncStatus === 'ERROR_SYNC').length}</strong><span>con error</span></div>
      </div>

      <div className="report-actions">
        <button type="button" className="ghost" disabled={busy} onClick={handleHealthCheck}>Probar servidor</button>
        <button type="button" disabled={busy} onClick={handleLogin}>Iniciar sesión</button>
        <button type="button" disabled={busy || !pending.length} onClick={handlePush}>Subir pendientes</button>
        <button type="button" className="ghost" disabled={busy} onClick={handlePull}>Descargar cambios</button>
        <button type="button" disabled={busy} onClick={handleFullSync}>Sincronización completa</button>
      </div>

      {message && <p className="sync-message">{message}</p>}

      <details className="sync-details">
        <summary>Credenciales demo incluidas</summary>
        <p><strong>Inspector:</strong> inspector@inspecapp.local / inspecapp123</p>
        <p><strong>Gerente:</strong> supervisor@inspecapp.local / inspecapp123</p>
        <p><strong>Administrador:</strong> admin@inspecapp.local / inspecapp123</p>
      </details>
    </section>
  );
}
