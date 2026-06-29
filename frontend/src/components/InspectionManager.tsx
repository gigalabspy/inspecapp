import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { InspectionSummary, StorageUsageInfo } from '../types';
import { humanFileSize } from '../utils/indexedDb';

interface Props {
  summaries: InspectionSummary[];
  storageUsage: StorageUsageInfo;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onImport: (file: File) => void;
  onExportAll: () => void;
  onRefresh: () => void;
  syncPanel?: ReactNode;
}

export function InspectionManager({
  summaries,
  storageUsage,
  onNew,
  onOpen,
  onDelete,
  onDuplicate,
  onImport,
  onExportAll,
  onRefresh,
  syncPanel
}: Props) {
  const [query, setQuery] = useState('');
  const importInput = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return summaries;
    return summaries.filter((item) =>
      `${item.id} ${item.razonSocial} ${item.ruc} ${item.direccion} ${item.tipoInspeccion} ${item.estado}`.toLowerCase().includes(clean)
    );
  }, [summaries, query]);

  const totalNoCumple = summaries.reduce((acc, item) => acc + item.noConformidades, 0);
  const totalEvidencias = summaries.reduce((acc, item) => acc + item.evidencias, 0);

  return (
    <main>
      <header className="hero dashboard-hero">
        <div>
          <p className="eyebrow">InspecAPP · Fase 4</p>
          <h1>Backend y sincronización</h1>
          <p>Gestión offline en el dispositivo, respaldo en servidor, API central y sincronización entre campo y oficina.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={onNew}>Nueva inspección</button>
          <button type="button" className="ghost" onClick={() => importInput.current?.click()}>Importar JSON</button>
          <button type="button" className="ghost" onClick={onExportAll}>Exportar todo</button>
        </div>
      </header>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = '';
        }}
      />

      <section className="summary-grid">
        <div><strong>{summaries.length}</strong><span>inspecciones locales</span></div>
        <div><strong>{totalEvidencias}</strong><span>evidencias guardadas</span></div>
        <div className={totalNoCumple ? 'alert' : ''}><strong>{totalNoCumple}</strong><span>no conformidades</span></div>
        <div><strong>{storageUsage.percent ?? 0}%</strong><span>{humanFileSize(storageUsage.usage)} / {humanFileSize(storageUsage.quota)}</span></div>
      </section>

      {syncPanel}

      <section className="panel slim dashboard-tools">
        <label>Buscar inspección<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cliente, RUC, dirección, estado..." /></label>
        <button type="button" className="ghost" onClick={onRefresh}>Actualizar lista</button>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Inspecciones guardadas</h2>
          <span>{filtered.length} resultado(s)</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No hay inspecciones guardadas</h3>
            <p>Creá una nueva inspección para iniciar la carga en campo. La información quedará disponible aunque no haya internet.</p>
            <button type="button" onClick={onNew}>Crear primera inspección</button>
          </div>
        ) : (
          <div className="inspection-list">
            {filtered.map((inspection) => (
              <article key={inspection.id} className="inspection-row">
                <div>
                  <div className="row-title">
                    <strong>{inspection.razonSocial}</strong>
                    <span className={`status-pill ${inspection.estado.toLowerCase()}`}>{inspection.estado}</span>
                    <span className={`status-pill ${inspection.syncStatus.toLowerCase()}`}>{inspection.syncStatus}</span>
                  </div>
                  <p>{inspection.direccion || 'Sin dirección cargada'}</p>
                  <small>
                    {inspection.id} · {inspection.tipoInspeccion} · Fecha: {inspection.fechaInspeccion || 's/f'} · RUC: {inspection.ruc || 's/d'}
                  </small>
                  <small>
                    {inspection.circuitos} circuito(s) · {inspection.evidencias} evidencia(s) · {inspection.noConformidades} no conformidad(es) · Actualizado: {inspection.updatedAt ? new Date(inspection.updatedAt).toLocaleString() : 's/d'}
                  </small>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => onOpen(inspection.id)}>Abrir</button>
                  <button type="button" className="ghost" onClick={() => onDuplicate(inspection.id)}>Duplicar</button>
                  <button type="button" className="ghost danger-text" onClick={() => onDelete(inspection.id)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
