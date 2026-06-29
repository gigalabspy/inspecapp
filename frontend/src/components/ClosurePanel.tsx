import { useMemo, useState } from 'react';
import type { AuditEntry, FinalDecision, InspectionState, SignatureKind } from '../types';
import {
  addWorkflowNote,
  approveInspection,
  closeInspection,
  DEFAULT_API_URL,
  getAuditTrail,
  reopenInspection,
  SESSION_KEY,
  signInspection,
  submitInspectionForReview
} from '../services/api';
import { saveInspectionSyncedOffline } from '../utils/indexedDb';
import { SignaturePad } from './SignaturePad';

type ClosurePanelProps = {
  state: InspectionState;
  onInspectionChange: (inspection: InspectionState) => void;
  onRefresh?: () => Promise<void> | void;
};

type StoredSession = {
  apiUrl: string;
  token: string;
  userName: string;
  userEmail: string;
  userRole?: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR';
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

function formatDate(value?: string) {
  if (!value) return 's/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusLabel(action: string) {
  return action.replace(/_/g, ' ').toLowerCase();
}

function defaultStatement(kind: SignatureKind) {
  if (kind === 'PROPIETARIO') return 'Declaro haber tomado conocimiento del resultado preliminar de la inspección y de las observaciones registradas.';
  if (kind === 'SUPERVISOR') return 'Valido la revisión técnica y autorizo el cierre documental de la inspección conforme a los registros disponibles.';
  return 'Declaro que la inspección fue realizada conforme a los datos, evidencias y requisitos cargados en InspecAPP.';
}

export function ClosurePanel({ state, onInspectionChange, onRefresh }: ClosurePanelProps) {
  const [session] = useState<StoredSession>(() => loadSession());
  const [kind, setKind] = useState<SignatureKind>('INSPECTOR');
  const [signerName, setSignerName] = useState(state.inspector.inspector || session.userName || '');
  const [signerDocument, setSignerDocument] = useState('');
  const [signerEmail, setSignerEmail] = useState(session.userEmail || '');
  const [statement, setStatement] = useState(defaultStatement('INSPECTOR'));
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [note, setNote] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [finalDecision, setFinalDecision] = useState<FinalDecision>('CONFORME');
  const [requiresCorrection, setRequiresCorrection] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>(state.auditTrail || []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const signatures = state.signatures || [];
  const hasInspectorSignature = signatures.some((signature) => signature.kind === 'INSPECTOR');
  const hasOwnerSignature = signatures.some((signature) => signature.kind === 'PROPIETARIO');
  const canSupervise = session.userRole === 'ADMIN' || session.userRole === 'SUPERVISOR';

  const counts = useMemo(() => {
    const answers = Object.values(state.answers || {});
    return {
      noCumple: answers.filter((a) => a.resultado === 'NO_CUMPLE').length,
      criticas: answers.filter((a) => a.resultado === 'NO_CUMPLE' && a.criticidad === 'CRITICA').length,
      pendientes: answers.filter((a) => !a.resultado || a.resultado === 'PENDIENTE').length
    };
  }, [state.answers]);

  async function saveServerInspection(next: InspectionState) {
    const saved = await saveInspectionSyncedOffline(next);
    onInspectionChange(saved);
    await onRefresh?.();
  }

  async function perform(action: () => Promise<{ inspection: InspectionState; entry?: AuditEntry }>, fallbackMessage: string) {
    if (!session.token) {
      setMessage('Primero iniciá sesión en el módulo Sync.');
      return;
    }
    setBusy(true);
    try {
      const result = await action();
      await saveServerInspection(result.inspection);
      if (result.inspection.auditTrail) setAudit(result.inspection.auditTrail);
      setMessage(fallbackMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo ejecutar la acción.');
    } finally {
      setBusy(false);
    }
  }

  function handleKindChange(nextKind: SignatureKind) {
    setKind(nextKind);
    setStatement(defaultStatement(nextKind));
    if (nextKind === 'INSPECTOR') setSignerName(state.inspector.inspector || session.userName || '');
    if (nextKind === 'PROPIETARIO') setSignerName(state.client.razonSocial || '');
    if (nextKind === 'SUPERVISOR') setSignerName(session.userName || '');
  }

  async function handleSign() {
    await perform(() => signInspection(session.apiUrl, session.token, state.meta.id, {
      kind,
      signerName,
      signerDocument,
      signerEmail,
      statement,
      dataUrl: signatureDataUrl
    }), 'Firma registrada y trazabilidad actualizada.');
    setSignatureDataUrl('');
  }

  async function refreshAudit() {
    if (!session.token) {
      setMessage('Primero iniciá sesión en el módulo Sync.');
      return;
    }
    setBusy(true);
    try {
      const result = await getAuditTrail(session.apiUrl, session.token, state.meta.id);
      setAudit(result.audit);
      setMessage('Trazabilidad actualizada desde servidor.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo consultar la trazabilidad.');
    } finally {
      setBusy(false);
    }
  }

  async function handleNote() {
    await perform(() => addWorkflowNote(session.apiUrl, session.token, state.meta.id, note), 'Observación agregada a la trazabilidad.');
    setNote('');
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Cierre formal, firmas y trazabilidad</h2>
        <span>{session.token ? `${session.userName} · ${session.userRole || 'ROL'}` : 'Sin sesión'}</span>
      </div>

      <div className="summary-grid sync-summary">
        <div><strong>{state.meta.estado}</strong><span>estado documental</span></div>
        <div className={hasInspectorSignature ? '' : 'alert'}><strong>{hasInspectorSignature ? 'Sí' : 'No'}</strong><span>firma inspector</span></div>
        <div className={hasOwnerSignature ? '' : 'alert'}><strong>{hasOwnerSignature ? 'Sí' : 'No'}</strong><span>firma responsable</span></div>
        <div className={counts.noCumple ? 'alert' : ''}><strong>{counts.noCumple}</strong><span>no conformidades</span></div>
      </div>

      <div className="form-grid">
        <label>Tipo de firma
          <select value={kind} onChange={(e) => handleKindChange(e.target.value as SignatureKind)}>
            <option value="INSPECTOR">Inspector actuante</option>
            <option value="PROPIETARIO">Propietario / responsable</option>
            <option value="SUPERVISOR">Supervisor técnico</option>
          </select>
        </label>
        <label>Nombre del firmante<input value={signerName} onChange={(e) => setSignerName(e.target.value)} /></label>
        <label>Documento / RUC<input value={signerDocument} onChange={(e) => setSignerDocument(e.target.value)} /></label>
        <label>Email<input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} /></label>
      </div>
      <label>Declaración de firma<textarea value={statement} onChange={(e) => setStatement(e.target.value)} /></label>
      <SignaturePad onSave={setSignatureDataUrl} />
      {signatureDataUrl && <div className="signature-preview"><img src={signatureDataUrl} alt="Firma preparada" /><span>Firma lista para registrar</span></div>}
      <div className="report-actions">
        <button type="button" disabled={busy || !signatureDataUrl} onClick={handleSign}>Registrar firma</button>
      </div>

      <h3>Firmas registradas</h3>
      <div className="signature-list">
        {signatures.length ? signatures.map((signature) => (
          <article key={signature.id} className="signature-card">
            <img src={signature.dataUrl} alt={`Firma ${signature.signerName}`} />
            <div>
              <strong>{signature.signerName}</strong>
              <span>{signature.roleLabel}</span>
              <small>{formatDate(signature.signedAt)} · registrado por {signature.signedByUserName || 's/d'}</small>
              <p>{signature.statement}</p>
            </div>
          </article>
        )) : <p className="muted">Todavía no hay firmas registradas.</p>}
      </div>

      <h3>Flujo de revisión</h3>
      <div className="report-actions">
        <button type="button" className="ghost" disabled={busy} onClick={() => perform(() => submitInspectionForReview(session.apiUrl, session.token, state.meta.id, 'Inspección enviada para revisión.'), 'Inspección enviada a revisión.')}>Enviar a revisión</button>
        <button type="button" disabled={busy || !canSupervise} onClick={() => perform(() => approveInspection(session.apiUrl, session.token, state.meta.id, 'Revisión técnica aprobada.'), 'Inspección aprobada por supervisión.')}>Aprobar supervisión</button>
      </div>

      <div className="form-grid">
        <label>Decisión final
          <select value={finalDecision} onChange={(e) => setFinalDecision(e.target.value as FinalDecision)}>
            <option value="CONFORME">Conforme</option>
            <option value="OBSERVADO">Observado</option>
            <option value="NO_CONFORME">No conforme</option>
          </select>
        </label>
        <label>Requiere corrección
          <select value={requiresCorrection ? 'SI' : 'NO'} onChange={(e) => setRequiresCorrection(e.target.value === 'SI')}>
            <option value="NO">No</option>
            <option value="SI">Sí</option>
          </select>
        </label>
      </div>
      <label>Nota de cierre<textarea value={closureNote} onChange={(e) => setClosureNote(e.target.value)} placeholder="Conclusión, condición de cierre o instrucción al cliente." /></label>
      <div className="report-actions">
        <button type="button" disabled={busy || !canSupervise} onClick={() => perform(() => closeInspection(session.apiUrl, session.token, state.meta.id, { finalDecision, closureNote, requiresCorrection }), 'Inspección cerrada formalmente.')}>Cerrar formalmente</button>
      </div>
      {state.closure?.closedAt && <p className="sync-message">Cerrada el {formatDate(state.closure.closedAt)} por {state.closure.closedByUserName}. Decisión: {state.closure.finalDecision}</p>}

      <details className="sync-details">
        <summary>Reabrir inspección observada</summary>
        <label>Motivo de reapertura<textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} /></label>
        <button type="button" disabled={busy || !canSupervise || !reopenReason.trim()} onClick={() => perform(() => reopenInspection(session.apiUrl, session.token, state.meta.id, reopenReason), 'Inspección reabierta para corrección.')}>Reabrir inspección</button>
      </details>

      <h3>Trazabilidad</h3>
      <label>Agregar observación de auditoría<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="report-actions">
        <button type="button" className="ghost" disabled={busy} onClick={refreshAudit}>Actualizar trazabilidad</button>
        <button type="button" disabled={busy || !note.trim()} onClick={handleNote}>Agregar observación</button>
      </div>
      {message && <p className="sync-message">{message}</p>}
      <ol className="timeline">
        {(audit.length ? audit : state.auditTrail || []).slice().reverse().map((entry) => (
          <li key={entry.id}>
            <strong>{statusLabel(entry.action)}</strong>
            <span>{formatDate(entry.createdAt)} · {entry.actorName} ({entry.actorRole})</span>
            <p>{entry.detail}</p>
          </li>
        ))}
      </ol>

      <p className="muted">Control rápido: pendientes {counts.pendientes}, críticas {counts.criticas}. Para cierre formal se exige firma del inspector y del propietario/responsable.</p>
    </section>
  );
}
