import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { ChecklistSection } from './components/ChecklistSection';
import { CircuitsEditor } from './components/CircuitsEditor';
import { EvidenceUploader } from './components/EvidenceUploader';
import { InspectionManager } from './components/InspectionManager';
import { MeasurementsEditor } from './components/MeasurementsEditor';
import { SyncPanel } from './components/SyncPanel';
import { AuthProvider, useAuth, type UserRole } from './auth/AuthContext';
import { LoginGate } from './auth/LoginGate';
import { FormalReportPanel } from './components/FormalReportPanel';
import { ClosurePanel } from './components/ClosurePanel';
import { MobileStatusPanel } from './components/MobileStatusPanel';
import { checklistDSE001 } from './data/checklistDSE001';
import type { ChecklistAnswer, ChecklistItem, InspectionState, InspectionSummary, InspectionType, StorageUsageInfo } from './types';
import { downloadJson } from './utils/storage';
import {
  deleteInspectionOffline,
  downloadBlob,
  duplicateInspectionOffline,
  getAllInspectionsOffline,
  getStorageUsage,
  importInspectionOffline,
  listInspectionsOffline,
  loadInspectionOffline,
  migrateLegacyLocalStorage,
  saveInspectionOffline
} from './utils/indexedDb';
import { DEFAULT_API_URL, SESSION_KEY } from './services/api';

const today = new Date().toISOString().slice(0, 10);

type TabKey =
  | 'datos'
  | 'circuitos'
  | 'checklist'
  | 'evidencias'
  | 'sync'
  | 'reporte'
  | 'cierre'
  | 'movil';

type AppTab = {
  key: TabKey;
  label: string;
  roles: UserRole[];
};

const appTabs: AppTab[] = [
  { key: 'datos', label: '1. Datos', roles: ['INSPECTOR', 'ADMIN'] },
  { key: 'circuitos', label: '2. Circuitos', roles: ['INSPECTOR', 'ADMIN'] },
  { key: 'checklist', label: '3. Checklist', roles: ['INSPECTOR', 'ADMIN'] },
  { key: 'evidencias', label: '4. Evidencias', roles: ['INSPECTOR', 'ADMIN'] },
  { key: 'sync', label: '5. Sync', roles: ['ADMIN'] },
  { key: 'reporte', label: '6. Reporte', roles: ['INSPECTOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'cierre', label: '7. Cierre', roles: ['SUPERVISOR', 'ADMIN'] },
  { key: 'movil', label: '8. Móvil', roles: ['ADMIN'] }
];

function canUseTab(role: UserRole | undefined, tab: TabKey): boolean {
  if (!role) return false;
  return appTabs.find((item) => item.key === tab)?.roles.includes(role) ?? false;
}

function firstTabForRole(role: UserRole | undefined): TabKey {
  return appTabs.find((item) => role && item.roles.includes(role))?.key ?? 'datos';
}


const initialState = (): InspectionState => {
  const now = new Date().toISOString();
  return {
    meta: {
      id: `INSP-${Date.now()}`,
      fechaInspeccion: today,
      tipoInspeccion: 'FINAL',
      estado: 'BORRADOR',
      observacionGeneral: '',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'LOCAL',
      version: 5,
      reportStatus: 'NO_GENERADO'
    },
    client: {
      razonSocial: '',
      ruc: '',
      direccion: '',
      telefono: '',
      email: '',
      nis: '',
      limiteCarga: ''
    },
    inspector: {
      organismoInspector: '',
      inspector: '',
      nroHabilitacionOrganismo: '',
      nroHabilitacionInspector: ''
    },
    circuits: [],
    answers: {},
    evidences: [],
    measurements: [],
    signatures: [],
    auditTrail: [],
    closure: {}
  };
};

function filterItemsByInspectionType(type: InspectionType): ChecklistItem[] {
  if (type === 'INICIAL') return checklistDSE001.filter((item) => item.etapa === 'INICIAL');
  if (type === 'INTERMEDIA') return checklistDSE001.filter((item) => item.etapa === 'INTERMEDIA');
  return checklistDSE001.filter((item) => item.etapa === 'FINAL_VISUAL' || item.etapa === 'FINAL_ENSAYOS');
}

function countStatus(items: ChecklistItem[], state: InspectionState, status: string): number {
  return items.filter((item) => state.answers[item.id]?.resultado === status).length;
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}
function AppContent() {
  const { user } = useAuth();
  const userRole = user?.role;
  const isAdmin = userRole === 'ADMIN';

  const [state, setState] = useState<InspectionState | null>(null);
  const [summaries, setSummaries] = useState<InspectionSummary[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsageInfo>({});
  const [tab, setTab] = useState<TabKey>('datos');
  const [query, setQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function refreshDashboard() {
    const [items, usage] = await Promise.all([listInspectionsOffline(), getStorageUsage()]);
    setSummaries(items);
    setStorageUsage(usage);
  }

  useEffect(() => {
    async function boot() {
      await migrateLegacyLocalStorage();
      await refreshDashboard();
    }
    boot();
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  const visibleTabs = useMemo(() => {
    if (!userRole) return [];
    return appTabs.filter((item) => item.roles.includes(userRole));
  }, [userRole]);

  useEffect(() => {
    if (!userRole) return;
    if (!canUseTab(userRole, tab)) {
      setTab(firstTabForRole(userRole));
    }
  }, [tab, userRole]);


  useEffect(() => {
    if (!state) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(async () => {
      try {
        await saveInspectionOffline(state);
        await refreshDashboard();
        setSaveStatus('saved');
      } catch (error) {
        console.error(error);
        setSaveStatus('error');
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [state]);

  const applicableItems = useMemo(() => state ? filterItemsByInspectionType(state.meta.tipoInspeccion) : [], [state?.meta.tipoInspeccion]);
  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return applicableItems;
    return applicableItems.filter((item) =>
      `${item.codigo} ${item.grupo} ${item.requisito} ${item.referencia}`.toLowerCase().includes(clean)
    );
  }, [applicableItems, query]);

  if (!state) {
    return (
      <InspectionManager
        summaries={summaries}
        storageUsage={storageUsage}
        onRefresh={refreshDashboard}
        onNew={async () => {
          const next = initialState();
          const saved = await saveInspectionOffline(next);
          setState(saved);
          setTab('datos');
          await refreshDashboard();
        }}
        onOpen={async (id) => {
          const inspection = await loadInspectionOffline(id);
          if (inspection) {
            setState(inspection);
            setTab('datos');
          }
        }}
        onDelete={async (id) => {
          if (!confirm('¿Eliminar esta inspección local? Esta acción no se puede deshacer.')) return;
          await deleteInspectionOffline(id);
          await refreshDashboard();
        }}
        onDuplicate={async (id) => {
          const duplicate = await duplicateInspectionOffline(id);
          if (duplicate) {
            await refreshDashboard();
            setState(duplicate);
            setTab('datos');
          }
        }}
        onImport={async (file) => {
          if (!isAdmin) {
            alert('Solo el Administrador puede importar archivos JSON.');
            return;
          }

          try {
            const json = await readJsonFile(file);
            if (Array.isArray(json)) {
              for (const item of json) await importInspectionOffline(item as InspectionState);
            } else if (json && typeof json === 'object' && 'inspections' in json && Array.isArray((json as { inspections: unknown[] }).inspections)) {
              for (const item of (json as { inspections: unknown[] }).inspections) await importInspectionOffline(item as InspectionState);
            } else {
              await importInspectionOffline(json as InspectionState);
            }
            await refreshDashboard();
            alert('Importación finalizada.');
          } catch {
            alert('No se pudo importar el archivo. Verificá que sea un JSON válido de InspecAPP.');
          }
        }}
        onExportAll={async () => {
          if (!isAdmin) {
            alert('Solo el Administrador puede exportar todo el respaldo.');
            return;
          }

          const inspections = await getAllInspectionsOffline();
          downloadBlob(JSON.stringify({ exportedAt: new Date().toISOString(), inspections }, null, 2), 'inspecapp-respaldo-offline.json');
        }}
        syncPanel={isAdmin ? <SyncPanel onRefresh={refreshDashboard} /> : <></>}
      />
    );
  }

  const visualItems = filteredItems.filter((item) => item.etapa !== 'FINAL_ENSAYOS');
  const ensayoItems = filteredItems.filter((item) => item.etapa === 'FINAL_ENSAYOS');

  const answered = applicableItems.filter((item) => state.answers[item.id]?.resultado).length;
  const noCumple = countStatus(applicableItems, state, 'NO_CUMPLE');
  const cumple = countStatus(applicableItems, state, 'CUMPLE');

  const updateAnswer = (answer: ChecklistAnswer) => {
    setState((prev) => prev ? ({
      ...prev,
      answers: {
        ...prev.answers,
        [answer.itemId]: answer
      },
      meta: { ...prev.meta, syncStatus: 'PENDIENTE_SYNC' }
    }) : prev);
  };

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">DSE-GUI-001 · NP 2 028 96</p>
          <h1>InspecAPP</h1>
          <p>Fase 6 — PWA empaquetable como app Android con Capacitor, cámara nativa, ubicación, sincronización y cierre formal.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="ghost" onClick={() => setState(null)}>Volver a lista</button>
          <button type="button" onClick={() => downloadJson(state)}>Exportar inspección</button>
          <button type="button" className="ghost" onClick={async () => {
            const next = initialState();
            const saved = await saveInspectionOffline(next);
            setState(saved);
            setTab('datos');
            await refreshDashboard();
          }}>Nueva inspección</button>
        </div>
      </header>

      <section className="summary-grid">
        <div><strong>{applicableItems.length}</strong><span>requisitos aplicables</span></div>
        <div><strong>{answered}</strong><span>respondidos</span></div>
        <div><strong>{cumple}</strong><span>cumplen</span></div>
        <div className={noCumple ? 'alert' : ''}><strong>{noCumple}</strong><span>no conformidades</span></div>
      </section>

      <section className="panel slim save-strip">
        <span><strong>{state.meta.id}</strong></span>
        <span>Guardado local: {saveStatus === 'saving' ? 'guardando...' : saveStatus === 'saved' ? 'actualizado' : saveStatus === 'error' ? 'error al guardar' : 'sin cambios'}</span>
        <span>Sincronización: {state.meta.syncStatus || 'LOCAL'}</span>
        <span>Última edición: {state.meta.updatedAt ? new Date(state.meta.updatedAt).toLocaleString() : 's/d'}</span>
      </section>

<nav className="tabs">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? 'active' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'datos' && canUseTab(userRole, 'datos') && (
        <section className="panel">
          <div className="section-title">
            <h2>Datos de inspección</h2>
            <span>{state.meta.id}</span>
          </div>

          <div className="form-grid">
            <label>Fecha de inspección<input type="date" value={state.meta.fechaInspeccion} onChange={(e) => setState({ ...state, meta: { ...state.meta, fechaInspeccion: e.target.value, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Tipo de inspección<select value={state.meta.tipoInspeccion} onChange={(e) => setState({ ...state, meta: { ...state.meta, tipoInspeccion: e.target.value as InspectionType, syncStatus: 'PENDIENTE_SYNC' } })}>
              <option value="INICIAL">Inicial</option>
              <option value="INTERMEDIA">Intermedia</option>
              <option value="FINAL">Final</option>
              <option value="EXISTENTE">Existente</option>
            </select></label>
            <label>Estado<select value={state.meta.estado} onChange={(e) => setState({ ...state, meta: { ...state.meta, estado: e.target.value as InspectionState['meta']['estado'], syncStatus: 'PENDIENTE_SYNC' } })}>
              <option value="BORRADOR">Borrador</option>
              <option value="EN_CAMPO">En campo</option>
              <option value="OBSERVADA">Observada</option>
              <option value="PRELIMINAR_GENERADO">Preliminar generado</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="APROBADA">Aprobada</option>
              <option value="CERRADA">Cerrada</option>
            </select></label>
            <label>Ubicación / referencia<input value={state.meta.ubicacion || ''} onChange={(e) => setState({ ...state, meta: { ...state.meta, ubicacion: e.target.value, syncStatus: 'PENDIENTE_SYNC' } })} placeholder="Ciudad, barrio, coordenada o referencia" /></label>
          </div>

          <h3>Cliente / instalación</h3>
          <div className="form-grid">
            <label>Propietario / Razón social<input value={state.client.razonSocial} onChange={(e) => setState({ ...state, client: { ...state.client, razonSocial: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>RUC<input value={state.client.ruc} onChange={(e) => setState({ ...state, client: { ...state.client, ruc: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Dirección de instalación<input value={state.client.direccion} onChange={(e) => setState({ ...state, client: { ...state.client, direccion: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Teléfono<input value={state.client.telefono} onChange={(e) => setState({ ...state, client: { ...state.client, telefono: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Email<input value={state.client.email} onChange={(e) => setState({ ...state, client: { ...state.client, email: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>NIS<input value={state.client.nis} onChange={(e) => setState({ ...state, client: { ...state.client, nis: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Límite de carga<input value={state.client.limiteCarga} onChange={(e) => setState({ ...state, client: { ...state.client, limiteCarga: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
          </div>

          <h3>Organismo inspector</h3>
          <div className="form-grid">
            <label>Organismo inspector<input value={state.inspector.organismoInspector} onChange={(e) => setState({ ...state, inspector: { ...state.inspector, organismoInspector: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Nro. hab. organismo<input value={state.inspector.nroHabilitacionOrganismo} onChange={(e) => setState({ ...state, inspector: { ...state.inspector, nroHabilitacionOrganismo: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Inspector<input value={state.inspector.inspector} onChange={(e) => setState({ ...state, inspector: { ...state.inspector, inspector: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
            <label>Nro. hab. inspector<input value={state.inspector.nroHabilitacionInspector} onChange={(e) => setState({ ...state, inspector: { ...state.inspector, nroHabilitacionInspector: e.target.value }, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
          </div>

          <label>Observación general<textarea value={state.meta.observacionGeneral} onChange={(e) => setState({ ...state, meta: { ...state.meta, observacionGeneral: e.target.value, syncStatus: 'PENDIENTE_SYNC' } })} /></label>
        </section>
      )}

      {tab === 'circuitos' && canUseTab(userRole, 'circuitos') && <CircuitsEditor circuits={state.circuits} onChange={(circuits) => setState({ ...state, circuits, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} />}

      {tab === 'checklist' && canUseTab(userRole, 'checklist') && (
        <>
          <section className="panel slim">
            <label>Buscar en checklist<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej.: DR, conductor neutro, RPAT, electroductos..." /></label>
          </section>
          {visualItems.length > 0 && <ChecklistSection title="Lista de verificación" items={visualItems} answers={state.answers} evidences={state.evidences} onAnswerChange={updateAnswer} />}
          {ensayoItems.length > 0 && (
            <>
              <ChecklistSection title="Ensayos y medición" items={ensayoItems} answers={state.answers} evidences={state.evidences} onAnswerChange={updateAnswer} />
              <MeasurementsEditor measurements={state.measurements} onChange={(measurements) => setState({ ...state, measurements, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} />
            </>
          )}
        </>
      )}

      {tab === 'evidencias' && canUseTab(userRole, 'evidencias') && <EvidenceUploader items={applicableItems} evidences={state.evidences} onChange={(evidences) => setState({ ...state, evidences, meta: { ...state.meta, syncStatus: 'PENDIENTE_SYNC' } })} />}

      {tab === 'sync' && canUseTab(userRole, 'sync') && <SyncPanel currentInspection={state} onCurrentInspectionChange={setState} onRefresh={refreshDashboard} />}

      {tab === 'reporte' && canUseTab(userRole, 'reporte') && (
        <FormalReportPanel
          state={state}
          applicableItems={applicableItems}
          noCumple={noCumple}
          onInspectionChange={setState}
          onRefresh={refreshDashboard}
        />
      )}

      {tab === 'cierre' && canUseTab(userRole, 'cierre') && (
        <ClosurePanel
          state={state}
          onInspectionChange={setState}
          onRefresh={refreshDashboard}
        />
      )}

      {tab === 'movil' && canUseTab(userRole, 'movil') && (
        <MobileStatusPanel
          storageUsage={storageUsage}
          apiUrl={(() => {
            try {
              const raw = localStorage.getItem(SESSION_KEY);
              return raw ? JSON.parse(raw).apiUrl : DEFAULT_API_URL;
            } catch {
              return DEFAULT_API_URL;
            }
          })()}
        />
      )}
    </main>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <AppContent />
      </LoginGate>
    </AuthProvider>
  );
}