import { useEffect, useState } from 'react';
import type { ChecklistItem, InspectionState } from '../types';
import { downloadHtmlReport, printReport } from '../utils/report';
import { saveInspectionSyncedOffline } from '../utils/indexedDb';
import { isNativeMobile, saveBlobForShare, shareFileUri } from '../utils/mobile';
import {
  DEFAULT_API_URL,
  SESSION_KEY,
  fetchFormalReportBlob,
  generateFormalReport,
  getReportSummary,
  type ReportSummary
} from '../services/api';

type StoredSession = {
  apiUrl: string;
  token: string;
  userName: string;
  userEmail: string;
  userRole?: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR';
  lastPullAt?: string;
};

type FormalReportPanelProps = {
  state: InspectionState;
  applicableItems: ChecklistItem[];
  noCumple: number;
  onInspectionChange: (inspection: InspectionState) => void;
  onRefresh?: () => Promise<void> | void;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}

export function FormalReportPanel({ state, applicableItems, noCumple, onInspectionChange, onRefresh }: FormalReportPanelProps) {
  const [session, setSession] = useState<StoredSession>(() => loadSession());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSession(loadSession()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSummary() {
    if (!session.token) {
      setMessage('Primero iniciá sesión en el módulo Sync.');
      return;
    }
    setBusy(true);
    setMessage('Consultando resumen formal en servidor...');
    try {
      const next = await getReportSummary(session.apiUrl, session.token, state.meta.id);
      setSummary(next);
      setMessage('Resumen formal actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo consultar el resumen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!session.token) {
      setMessage('Primero iniciá sesión en el módulo Sync.');
      return;
    }
    if (state.meta.syncStatus !== 'SINCRONIZADA') {
      setMessage('Antes de generar el informe formal, subí/sincronizá la inspección en el módulo Sync.');
      return;
    }
    setBusy(true);
    setMessage('Generando HTML y PDF formal en servidor...');
    try {
      const result = await generateFormalReport(session.apiUrl, session.token, state.meta.id);
      const saved = await saveInspectionSyncedOffline(result.inspection);
      onInspectionChange(saved);
      await onRefresh?.();
      setSummary(result.summary);
      setMessage(`Reporte generado: ${new Date(result.generatedAt).toLocaleString()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar el reporte.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(format: 'html' | 'pdf', open = false, share = false) {
    if (!session.token) {
      setMessage('Primero iniciá sesión en el módulo Sync.');
      return;
    }
    setBusy(true);
    setMessage(`Preparando reporte ${format.toUpperCase()}...`);
    try {
      const blob = await fetchFormalReportBlob(session.apiUrl, session.token, state.meta.id, format);
      if (share && format === 'pdf' && isNativeMobile()) {
        const fileUri = await saveBlobForShare(blob, `reporte-${state.meta.id}.pdf`);
        if (fileUri) await shareFileUri(fileUri, 'Reporte InspecAPP');
        else downloadBlob(blob, `reporte-${state.meta.id}.${format}`);
      } else if (open) openBlob(blob);
      else downloadBlob(blob, `reporte-${state.meta.id}.${format}`);
      setMessage(`Reporte ${format.toUpperCase()} listo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo descargar el reporte.');
    } finally {
      setBusy(false);
    }
  }

  const localNonConformities = applicableItems.filter((item) => state.answers[item.id]?.resultado === 'NO_CUMPLE');

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Reporte preliminar y PDF formal</h2>
        <span>{noCumple} no conformidad(es)</span>
      </div>

      <p>
        En Fase 6 el reporte puede generarse desde el servidor como HTML formal y PDF. El reporte local sigue disponible para revisión rápida en campo.
      </p>

      <div className="summary-grid report-summary">
        <div><strong>{applicableItems.length}</strong><span>requisitos</span></div>
        <div><strong>{state.evidences.length}</strong><span>evidencias</span></div>
        <div><strong>{state.measurements.length}</strong><span>mediciones</span></div>
        <div className={noCumple ? 'alert' : ''}><strong>{noCumple}</strong><span>no conformidades</span></div>
      </div>

      <h3>Acciones locales</h3>
      <div className="report-actions">
        <button type="button" onClick={() => downloadHtmlReport({ ...state, meta: { ...state.meta, estado: 'PRELIMINAR_GENERADO' } }, applicableItems)}>Descargar HTML local</button>
        <button type="button" className="ghost" onClick={() => printReport(state, applicableItems)}>Imprimir / guardar PDF local</button>
      </div>

      <h3>Acciones desde servidor</h3>
      <p className="muted">
        API actual: <strong>{session.apiUrl}</strong> · Sesión: <strong>{session.token ? session.userName : 'sin sesión'}</strong> · Sync: <strong>{state.meta.syncStatus || 'LOCAL'}</strong>
      </p>
      <div className="report-actions">
        <button type="button" className="ghost" disabled={busy} onClick={handleSummary}>Ver resumen servidor</button>
        <button type="button" disabled={busy} onClick={handleGenerate}>Generar informe formal</button>
        <button type="button" disabled={busy} onClick={() => handleDownload('pdf')}>Descargar PDF formal</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => handleDownload('pdf', false, true)}>Compartir PDF en Android</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => handleDownload('html', true)}>Abrir HTML formal</button>
      </div>

      {message && <p className="sync-message">{message}</p>}

      {summary && (
        <div className="server-summary">
          <h3>Resumen servidor</h3>
          <div className="summary-grid">
            <div><strong>{summary.resultadoPreliminar}</strong><span>resultado preliminar</span></div>
            <div><strong>{summary.totalRequisitos}</strong><span>requisitos</span></div>
            <div><strong>{summary.noConformidades}</strong><span>no conformidades</span></div>
            <div><strong>{summary.noConformidadesCriticas}</strong><span>críticas / RES</span></div>
          </div>
        </div>
      )}

      <h3>No conformidades</h3>
      {localNonConformities.length === 0 ? (
        <p className="muted">No se registraron no conformidades en el borrador actual.</p>
      ) : (
        <ul className="non-list">
          {localNonConformities.map((item) => (
            <li key={item.id}>
              <strong>{item.codigo}</strong> {item.esRES ? <span className="badge-res">RES</span> : null} {item.requisito}<br />
              <span>{state.answers[item.id]?.observacion || 'Sin observación.'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
