import type { ChecklistItem, InspectionState } from '../types';
import { findingCodeLabel } from '../data/findingClassifications';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeValue(value: unknown): string {
  return escapeHtml(String(value ?? ''));
}

export function buildPreliminaryReportHtml(state: InspectionState, items: ChecklistItem[]): string {
  const rows = items.map((item) => {
    const answer = state.answers[item.id];
    const status = answer?.resultado || 'PENDIENTE';
    const obs = answer?.observacion || '';
    return `
      <tr>
        <td>${escapeHtml(item.codigo)}</td>
        <td>${item.esRES ? 'Sí' : 'No'}</td>
        <td>${escapeHtml(item.grupo)}</td>
        <td>${escapeHtml(item.requisito)}</td>
        <td>${escapeHtml(item.referencia)}</td>
        <td>${escapeHtml(status)}</td>
        <td>${escapeValue(findingCodeLabel(answer?.hallazgoCodigo))}</td>
        <td>${escapeValue(answer?.accionCorrectiva)}</td>
        <td>${escapeValue(answer?.plazoCorreccion)}</td>
        <td>${escapeHtml(obs)}</td>
      </tr>`;
  }).join('');

  const nonConformities = items
    .filter((item) => state.answers[item.id]?.resultado === 'NO_CUMPLE')
    .map((item) => {
      const answer = state.answers[item.id];
      return `<li>
        <strong>${escapeHtml(item.codigo)}</strong> ${escapeHtml(item.requisito)}<br />
        <strong>Clasificación:</strong> ${escapeValue(findingCodeLabel(answer?.hallazgoCodigo))}<br />
        <strong>Observación:</strong> ${escapeValue(answer?.observacion || 'Sin observación.')}<br />
        <strong>Acción:</strong> ${escapeValue(answer?.accionCorrectiva || 'Sin acción definida.')}<br />
        <strong>Plazo:</strong> ${escapeValue(answer?.plazoCorreccion || 'Sin plazo definido.')}
      </li>`;
    })
    .join('');

  const findingCounts = items.reduce<Record<'P1' | 'P2' | 'P3' | 'MI', number>>((acc, item) => {
    const code = state.answers[item.id]?.hallazgoCodigo;
    if (code) acc[code] += 1;
    return acc;
  }, { P1: 0, P2: 0, P3: 0, MI: 0 });

  const circuits = state.circuits.map((circuit) => `
    <tr>
      <td>${escapeHtml(circuit.tablero)}</td>
      <td>${escapeHtml(circuit.nombre)}</td>
      <td>${escapeHtml(circuit.uso)}</td>
      <td>${escapeHtml(circuit.tension)}</td>
      <td>${escapeHtml(circuit.fases)}</td>
      <td>${escapeHtml(circuit.conductorFase)}</td>
      <td>${escapeHtml(circuit.conductorNeutro)}</td>
      <td>${escapeHtml(circuit.conductorPE)}</td>
      <td>${escapeHtml(circuit.proteccion)}</td>
      <td>${escapeHtml(circuit.dr)}</td>
    </tr>`).join('');

  const evidences = state.evidences.map((ev) => `
    <figure>
      <img src="${ev.dataUrl}" alt="${escapeHtml(ev.fileName)}" />
      <figcaption>${escapeHtml(ev.itemId)} — ${escapeHtml(ev.descripcion || ev.fileName)}</figcaption>
    </figure>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte preliminar InspecAPP ${escapeHtml(state.meta.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    h1, h2 { margin-bottom: 6px; }
    .muted { color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; }
    .finding-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 24px; }
    .finding-summary div { border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #f8fafc; }
    .finding-summary strong { display: block; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
    th { background: #f1f5f9; }
    li { margin-bottom: 10px; }
    figure { display: inline-block; width: 220px; margin: 8px; vertical-align: top; }
    img { max-width: 220px; max-height: 180px; object-fit: cover; border: 1px solid #cbd5e1; }
    figcaption { font-size: 11px; color: #475569; }
    .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 64px; }
    .line { border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
    @media print { body { margin: 16mm; } }
  </style>
</head>
<body>
  <h1>InspecAPP — Reporte preliminar de inspección</h1>
  <p class="muted">Documento preliminar generado desde la aplicación. Debe ser revisado y validado por el organismo inspector antes de emisión formal.</p>

  <h2>1. Identificación</h2>
  <div class="grid">
    <div><strong>Fecha:</strong> ${escapeHtml(state.meta.fechaInspeccion)}</div>
    <div><strong>Tipo:</strong> ${escapeHtml(state.meta.tipoInspeccion)}</div>
    <div><strong>Propietario/Razón social:</strong> ${escapeHtml(state.client.razonSocial)}</div>
    <div><strong>RUC:</strong> ${escapeHtml(state.client.ruc)}</div>
    <div><strong>Dirección:</strong> ${escapeHtml(state.client.direccion)}</div>
    <div><strong>NIS:</strong> ${escapeHtml(state.client.nis)}</div>
    <div><strong>Límite de carga:</strong> ${escapeHtml(state.client.limiteCarga)}</div>
    <div><strong>Organismo inspector:</strong> ${escapeHtml(state.inspector.organismoInspector)}</div>
    <div><strong>Inspector:</strong> ${escapeHtml(state.inspector.inspector)}</div>
    <div><strong>Nro. habilitación inspector:</strong> ${escapeHtml(state.inspector.nroHabilitacionInspector)}</div>
  </div>

  <h2>2. Circuitos definidos</h2>
  <table>
    <thead><tr><th>Tablero</th><th>Circuito</th><th>Uso</th><th>Tensión</th><th>Fases</th><th>Fase</th><th>Neutro</th><th>PE</th><th>Protección</th><th>DR</th></tr></thead>
    <tbody>${circuits || '<tr><td colspan="10">Sin circuitos cargados.</td></tr>'}</tbody>
  </table>

  <h2>3. Clasificación de hallazgos</h2>
  <div class="finding-summary">
    <div><strong>${findingCounts.P1}</strong><span>P1 - Peligro presente</span></div>
    <div><strong>${findingCounts.P2}</strong><span>P2 - Potencialmente peligroso</span></div>
    <div><strong>${findingCounts.P3}</strong><span>P3 - Mejora recomendada</span></div>
    <div><strong>${findingCounts.MI}</strong><span>MI - Investigación adicional</span></div>
  </div>

  <h2>4. No conformidades detectadas</h2>
  <ul>${nonConformities || '<li>No se registraron no conformidades en el borrador actual.</li>'}</ul>

  <h2>5. Lista de verificación</h2>
  <table>
    <thead><tr><th>Código</th><th>RES</th><th>Grupo</th><th>Requisito</th><th>Referencia</th><th>Resultado</th><th>Clasificación</th><th>Acción</th><th>Plazo</th><th>Observación</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2>6. Evidencias fotográficas</h2>
  <div>${evidences || '<p>Sin evidencias fotográficas adjuntas.</p>'}</div>

  <h2>7. Observación general</h2>
  <p>${escapeHtml(state.meta.observacionGeneral || 'Sin observación general.')}</p>

  <div class="signature">
    <div class="line">Firma del propietario</div>
    <div class="line">Firma del inspector</div>
  </div>
</body>
</html>`;
}

export function downloadHtmlReport(state: InspectionState, items: ChecklistItem[]): void {
  const html = buildPreliminaryReportHtml(state, items);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `reporte-preliminar-${state.meta.id}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printReport(state: InspectionState, items: ChecklistItem[]): void {
  const html = buildPreliminaryReportHtml(state, items);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
