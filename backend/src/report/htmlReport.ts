import type { ChecklistItem, Evidence, InspectionState } from '../types/inspection.js';
import { buildReportSummary, getApplicableItems, itemById } from './reportData.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value?: string): string {
  if (!value) return 's/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PY');
}

function statusClass(status: string): string {
  if (status === 'CUMPLE') return 'ok';
  if (status === 'NO_CUMPLE') return 'bad';
  if (status === 'NO_APLICA') return 'na';
  return 'pending';
}

function evidenceHtml(evidence: Evidence, items: ChecklistItem[]): string {
  const item = itemById(items, evidence.itemId);
  const src = evidence.dataUrl || evidence.serverFileUrl || '';
  return `
    <figure class="evidence">
      ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(evidence.fileName)}" />` : '<div class="no-image">Sin imagen embebida</div>'}
      <figcaption>
        <strong>${escapeHtml(evidence.itemId)}</strong> ${escapeHtml(item?.requisito || '')}<br />
        ${escapeHtml(evidence.descripcion || evidence.fileName)}<br />
        <span>${formatDate(evidence.createdAt)}</span>
      </figcaption>
    </figure>`;
}

export function buildFormalReportHtml(inspection: InspectionState): string {
  const items = getApplicableItems(inspection.meta.tipoInspeccion);
  const summary = buildReportSummary(inspection);

  const checklistRows = items.map((item) => {
    const answer = inspection.answers?.[item.id];
    const status = answer?.resultado || 'SIN_RESPONDER';
    const evCount = inspection.evidences?.filter((ev) => ev.itemId === item.id || ev.itemId === item.codigo).length || 0;
    return `
      <tr>
        <td>${escapeHtml(item.codigo)}</td>
        <td>${item.esRES ? '<strong>RES</strong>' : ''}</td>
        <td>${escapeHtml(item.grupo)}</td>
        <td>${escapeHtml(item.requisito)}</td>
        <td>${escapeHtml(item.referencia)}</td>
        <td class="${statusClass(status)}">${escapeHtml(status)}</td>
        <td>${escapeHtml(answer?.criticidad || '')}</td>
        <td>${escapeHtml(answer?.observacion || '')}</td>
        <td>${evCount}</td>
      </tr>`;
  }).join('');

  const nonConformities = items
    .filter((item) => inspection.answers?.[item.id]?.resultado === 'NO_CUMPLE')
    .map((item) => {
      const answer = inspection.answers[item.id]!;
      const criticidad = answer.criticidad || (item.esRES ? 'CRITICA' : 'MEDIA');
      return `
        <tr>
          <td>${escapeHtml(item.codigo)}</td>
          <td>${item.esRES ? 'Sí' : 'No'}</td>
          <td>${escapeHtml(criticidad)}</td>
          <td>${escapeHtml(item.requisito)}</td>
          <td>${escapeHtml(answer.observacion || 'Sin observación.')}</td>
          <td>${escapeHtml(item.referencia)}</td>
        </tr>`;
    })
    .join('');

  const circuits = inspection.circuits.map((circuit, index) => `
    <tr>
      <td>${index + 1}</td>
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
      <td>${escapeHtml(circuit.observaciones)}</td>
    </tr>`).join('');

  const measurements = inspection.measurements.map((measurement, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(measurement.tipo)}</td>
      <td>${escapeHtml(measurement.valor)}</td>
      <td>${escapeHtml(measurement.unidad)}</td>
      <td>${escapeHtml(measurement.instrumento)}</td>
      <td>${escapeHtml(measurement.observacion)}</td>
    </tr>`).join('');

  const evidences = inspection.evidences.map((evidence) => evidenceHtml(evidence, items)).join('');

  const signatures = inspection.signatures || [];
  const signatureHtml = (kind: string, title: string) => {
    const signature = signatures.find((item) => item.kind === kind);
    if (!signature) return `<div class="signature"><strong>${escapeHtml(title)}</strong><br/><span>Firma no registrada</span></div>`;
    return `<div class="signature"><img src="${escapeHtml(signature.dataUrl)}" alt="Firma ${escapeHtml(signature.signerName)}" /><strong>${escapeHtml(title)}</strong><span>${escapeHtml(signature.signerName)}</span><small>${formatDate(signature.signedAt)}</small></div>`;
  };

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe de inspección ${escapeHtml(inspection.meta.id)}</title>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; line-height: 1.35; }
    .cover { border-top: 18px solid #0f766e; padding-top: 20px; }
    .brand { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 12px; }
    .brand h1 { margin: 0; font-size: 26px; letter-spacing: -.02em; }
    .brand p { margin: 3px 0; color: #475569; }
    .doc-code { text-align:right; font-size: 12px; color: #334155; }
    h2 { margin: 24px 0 8px; font-size: 17px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    h3 { margin: 18px 0 8px; font-size: 14px; }
    .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 10px 0 18px; font-size: 12px; }
    .grid div { border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
    .summary { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 16px 0; }
    .summary div { border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #f8fafc; }
    .summary strong { display:block; font-size: 20px; }
    .result { display:inline-block; padding: 7px 12px; border-radius: 999px; font-weight: 700; background:#ecfeff; color:#155e75; border:1px solid #67e8f9; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; font-size: 10.5px; page-break-inside: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; }
    th { background: #e2e8f0; color: #0f172a; }
    tr { page-break-inside: avoid; }
    .ok { color:#166534; font-weight:700; }
    .bad { color:#991b1b; font-weight:700; }
    .na { color:#475569; font-weight:700; }
    .pending { color:#92400e; font-weight:700; }
    .notice { padding: 10px; border-left: 4px solid #0f766e; background: #f0fdfa; font-size: 12px; }
    .evidence { display:inline-block; width: 31%; margin: 0 1% 14px 0; vertical-align: top; page-break-inside: avoid; }
    .evidence img, .no-image { width: 100%; max-height: 160px; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 6px; }
    .no-image { min-height: 100px; display:grid; place-items:center; color:#64748b; background:#f8fafc; }
    figcaption { font-size: 10px; color: #334155; margin-top: 4px; }
    .signature-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 32px; }
    .signature { border: 1px solid #cbd5e1; border-radius: 8px; text-align:center; padding: 10px; font-size: 11px; min-height: 120px; }
    .signature img { max-width: 100%; height: 60px; object-fit: contain; display:block; margin: 0 auto 8px; }
    .signature strong, .signature span { display:block; }
    .signature small { color:#64748b; }
    .footer-note { margin-top: 20px; color:#64748b; font-size: 10.5px; }
    @media print { body { font-size: 11px; } .page-break { page-break-before: always; } }
  </style>
</head>
<body>
  <section class="cover">
    <div class="brand">
      <div>
        <h1>InspecAPP</h1>
        <p>Informe preliminar de inspección de instalación eléctrica en baja tensión</p>
        <p>DSE-GUI-001 · NP 2 028 96</p>
      </div>
      <div class="doc-code">
        <strong>Código:</strong> REP-${escapeHtml(inspection.meta.id)}<br />
        <strong>Generado:</strong> ${formatDate(summary.generatedAt)}<br />
        <strong>Estado:</strong> ${escapeHtml(inspection.meta.estado)}<br />
        <strong>Resultado:</strong> <span class="result">${escapeHtml(summary.resultadoPreliminar)}</span>
      </div>
    </div>

    <h2>1. Identificación de la inspección</h2>
    <div class="grid">
      <div><strong>Fecha de inspección:</strong> ${escapeHtml(inspection.meta.fechaInspeccion)}</div>
      <div><strong>Tipo de inspección:</strong> ${escapeHtml(inspection.meta.tipoInspeccion)}</div>
      <div><strong>Propietario / Razón social:</strong> ${escapeHtml(inspection.client.razonSocial)}</div>
      <div><strong>RUC:</strong> ${escapeHtml(inspection.client.ruc)}</div>
      <div><strong>Dirección de instalación:</strong> ${escapeHtml(inspection.client.direccion)}</div>
      <div><strong>Ubicación / referencia:</strong> ${escapeHtml(inspection.meta.ubicacion || '')}</div>
      <div><strong>NIS:</strong> ${escapeHtml(inspection.client.nis)}</div>
      <div><strong>Límite de carga:</strong> ${escapeHtml(inspection.client.limiteCarga)}</div>
      <div><strong>Organismo inspector:</strong> ${escapeHtml(inspection.inspector.organismoInspector)}</div>
      <div><strong>Nro. hab. organismo:</strong> ${escapeHtml(inspection.inspector.nroHabilitacionOrganismo)}</div>
      <div><strong>Inspector:</strong> ${escapeHtml(inspection.inspector.inspector)}</div>
      <div><strong>Nro. hab. inspector:</strong> ${escapeHtml(inspection.inspector.nroHabilitacionInspector)}</div>
    </div>

    <div class="summary">
      <div><strong>${summary.totalRequisitos}</strong><span>requisitos aplicables</span></div>
      <div><strong>${summary.counts.CUMPLE}</strong><span>cumplen</span></div>
      <div><strong>${summary.noConformidades}</strong><span>no conformidades</span></div>
      <div><strong>${summary.evidencias}</strong><span>evidencias</span></div>
    </div>

    <p class="notice">Este documento es un reporte preliminar generado por el sistema. La emisión formal debe ser revisada y validada por el organismo inspector responsable.</p>
  </section>

  <h2>2. Circuitos definidos</h2>
  <table>
    <thead><tr><th>#</th><th>Tablero</th><th>Circuito</th><th>Uso</th><th>Tensión</th><th>Fases</th><th>Fase</th><th>Neutro</th><th>PE</th><th>Protección</th><th>DR</th><th>Observaciones</th></tr></thead>
    <tbody>${circuits || '<tr><td colspan="12">Sin circuitos cargados.</td></tr>'}</tbody>
  </table>

  <h2>3. Ensayos y mediciones registradas</h2>
  <table>
    <thead><tr><th>#</th><th>Tipo</th><th>Valor</th><th>Unidad</th><th>Instrumento</th><th>Observación</th></tr></thead>
    <tbody>${measurements || '<tr><td colspan="6">Sin mediciones cargadas.</td></tr>'}</tbody>
  </table>

  <h2>4. No conformidades detectadas</h2>
  <table>
    <thead><tr><th>Código</th><th>RES</th><th>Criticidad</th><th>Requisito</th><th>Observación</th><th>Referencia</th></tr></thead>
    <tbody>${nonConformities || '<tr><td colspan="6">No se registraron no conformidades en esta versión.</td></tr>'}</tbody>
  </table>

  <div class="page-break"></div>
  <h2>5. Lista de verificación completa</h2>
  <table>
    <thead><tr><th>Código</th><th>RES</th><th>Grupo</th><th>Requisito</th><th>Referencia</th><th>Resultado</th><th>Criticidad</th><th>Observación</th><th>Evid.</th></tr></thead>
    <tbody>${checklistRows}</tbody>
  </table>

  <h2>6. Evidencias fotográficas</h2>
  <div>${evidences || '<p>Sin evidencias fotográficas adjuntas.</p>'}</div>

  <h2>7. Observación general</h2>
  <p>${escapeHtml(inspection.meta.observacionGeneral || 'Sin observación general.')}</p>

  <h2>8. Firmas y cierre documental</h2>
  <div class="grid">
    <div><strong>Decisión final:</strong> ${escapeHtml(inspection.closure?.finalDecision || 'Pendiente')}</div>
    <div><strong>Fecha de cierre:</strong> ${formatDate(inspection.closure?.closedAt)}</div>
    <div><strong>Cerrado por:</strong> ${escapeHtml(inspection.closure?.closedByUserName || '')}</div>
    <div><strong>Requiere corrección:</strong> ${inspection.closure?.requiresCorrection ? 'Sí' : 'No'}</div>
  </div>
  <p>${escapeHtml(inspection.closure?.closureNote || 'Sin nota de cierre.')}</p>
  <div class="signature-grid">
    ${signatureHtml('PROPIETARIO', 'Propietario / responsable')}
    ${signatureHtml('INSPECTOR', 'Inspector actuante')}
    ${signatureHtml('SUPERVISOR', 'Gerente técnico')}
  </div>

  <h2>9. Trazabilidad resumida</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Detalle</th></tr></thead>
    <tbody>${(inspection.auditTrail || []).map((entry) => `<tr><td>${formatDate(entry.createdAt)}</td><td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.actorName)} (${escapeHtml(entry.actorRole)})</td><td>${escapeHtml(entry.detail)}</td></tr>`).join('') || '<tr><td colspan="4">Sin eventos de trazabilidad registrados.</td></tr>'}</tbody>
  </table>

  <p class="footer-note">Trazabilidad: ${escapeHtml(inspection.meta.id)} · Reporte generado desde servidor InspecAPP Fase 6 · ${formatDate(summary.generatedAt)}</p>
</body>
</html>`;
}
