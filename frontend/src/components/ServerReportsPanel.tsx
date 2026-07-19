import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_API_URL } from '../services/api';

type ServerSummary = {
  id: string;
  razonSocial: string;
  ruc: string;
  direccion: string;
  fechaInspeccion: string;
  tipoInspeccion: string;
  estado: string;
  updatedAt: string;
  noConformidades: number;
  evidencias: number;
  firmas: number;
};

function formatDate(value?: string): string {
  if (!value) return 's/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PY');
}

export function ServerReportsPanel() {
  const { user } = useAuth();
  const token = user?.token ?? '';
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<ServerSummary[]>([]);
  const [trash, setTrash] = useState<ServerSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = useCallback(
    (): HeadersInit => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const load = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/inspections`, { headers: authHeaders() });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      setItems(data.inspections || []);

      if (isAdmin) {
        const trashResponse = await fetch(`${DEFAULT_API_URL}/api/inspections/trash/list`, {
          headers: authHeaders()
        });
        const trashData: any = await trashResponse.json().catch(() => ({}));
        if (trashResponse.ok) setTrash(trashData.inspections || []);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo cargar el listado del servidor.');
    } finally {
      setBusy(false);
    }
  }, [authHeaders, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchReportBlob(id: string, format: 'html' | 'pdf'): Promise<Blob> {
    const response = await fetch(`${DEFAULT_API_URL}/api/reports/${id}/${format}`, {
      headers: authHeaders()
    });
    if (!response.ok) {
      const data: any = await response.json().catch(() => ({}));
      throw new Error(data.error || `Error HTTP ${response.status}`);
    }
    return response.blob();
  }

  async function openHtml(id: string) {
    setBusy(true);
    setMessage('Generando vista HTML...');
    try {
      const blob = await fetchReportBlob(id, 'html');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setMessage('Reporte abierto en una pestaña nueva.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir el reporte.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(id: string) {
    setBusy(true);
    setMessage('Generando PDF...');
    try {
      const blob = await fetchReportBlob(id, 'pdf');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `reporte-${id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('PDF descargado.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo descargar el PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function sendToTrash(id: string) {
    if (!window.confirm(`¿Enviar la inspección ${id} a la papelera? Podrás restaurarla luego.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/inspections/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      setMessage(`Inspección ${id} enviada a la papelera.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo enviar a la papelera.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/inspections/${id}/restore`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      setMessage(`Inspección ${id} restaurada.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo restaurar.');
    } finally {
      setBusy(false);
    }
  }

  const cell: CSSProperties = { padding: '6px', verticalAlign: 'top' };

  function renderTable(rows: ServerSummary[], inTrash: boolean) {
    if (!rows.length) {
      return <p>{inTrash ? 'La papelera está vacía.' : 'No hay inspecciones en el servidor. Sincronizá desde la pestaña Sync.'}</p>;
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: 'left' }}>ID</th>
              <th style={{ ...cell, textAlign: 'left' }}>Razón social</th>
              <th style={{ ...cell, textAlign: 'left' }}>Fecha</th>
              <th style={{ ...cell, textAlign: 'left' }}>Estado</th>
              <th style={{ ...cell, textAlign: 'left' }}>No conf.</th>
              <th style={{ ...cell, textAlign: 'left' }}>Actualizada</th>
              <th style={{ ...cell, textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={cell}>{item.id}</td>
                <td style={cell}>{item.razonSocial}</td>
                <td style={cell}>{item.fechaInspeccion || 's/d'}</td>
                <td style={cell}>{item.estado}</td>
                <td style={cell}>{item.noConformidades}</td>
                <td style={cell}>{formatDate(item.updatedAt)}</td>
                <td style={cell}>
                  {!inTrash && (
                    <>
                      <button type="button" className="ghost" disabled={busy} onClick={() => openHtml(item.id)}>
                        Ver HTML
                      </button>{' '}
                      <button type="button" className="ghost" disabled={busy} onClick={() => downloadPdf(item.id)}>
                        PDF
                      </button>{' '}
                      {isAdmin && (
                        <button type="button" disabled={busy} onClick={() => sendToTrash(item.id)}>
                          Enviar a papelera
                        </button>
                      )}
                    </>
                  )}
                  {inTrash && (
                    <button type="button" disabled={busy} onClick={() => restore(item.id)}>
                      Restaurar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Reportes de inspecciones en servidor</h2>
        <span>{items.length} inspección(es)</span>
      </div>

      <p>
        Listado de inspecciones sincronizadas en el servidor. Podés visualizar el reporte formal de
        cada una{isAdmin ? ' y, como administrador, enviarlas a la papelera o restaurarlas' : ''}.
      </p>

      <button type="button" className="ghost" disabled={busy} onClick={load}>
        Actualizar listado
      </button>

      {message && <p className="sync-message">{message}</p>}

      {renderTable(items, false)}

      {isAdmin && (
        <>
          <h3>Papelera ({trash.length})</h3>
          {renderTable(trash, true)}
        </>
      )}
    </section>
  );
}
