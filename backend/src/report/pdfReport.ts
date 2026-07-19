import PDFDocument from 'pdfkit';
import type { ChecklistItem, Evidence, InspectionState } from '../types/inspection.js';
import { buildReportSummary, getApplicableItems, itemById } from './reportData.js';
import { findingCodeLabel } from './findingClassifications.js';
import { COMPANY, getLogoBuffer } from './branding.js';

function text(value: unknown): string {
  return String(value ?? '').trim() || 's/d';
}

function formatDate(value?: string): string {
  if (!value) return 's/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PY');
}

function statusLabel(value: string): string {
  if (value === 'NO_CUMPLE') return 'NO CUMPLE';
  if (value === 'NO_APLICA') return 'NO APLICA';
  if (value === 'SIN_RESPONDER') return 'SIN RESPONDER';
  return value || 'PENDIENTE';
}

function dataUrlToBuffer(dataUrl?: string): Buffer | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;
  const base64 = dataUrl.slice(commaIndex + 1);
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, height = 80): void {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 55);
  doc.x = doc.page.margins.left;
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor('#0f172a').font('Helvetica-Bold').text(title);
  doc.moveTo(doc.page.margins.left, doc.y + 4).lineTo(doc.page.width - doc.page.margins.right, doc.y + 4).strokeColor('#94a3b8').stroke();
  doc.moveDown(0.8).fillColor('#111827').font('Helvetica');
}

function keyValue(doc: PDFKit.PDFDocument, key: string, value: unknown): void {
  ensureSpace(doc, 22);
  doc.x = doc.page.margins.left;
  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155').text(`${key}:`, { continued: true });
  doc.font('Helvetica').fillColor('#111827').text(` ${text(value)}`);
  if (doc.y === startY) doc.moveDown(0.2);
}

function tableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[]): void {
  ensureSpace(doc, 35);
  const x = doc.page.margins.left;
  let cursorX = x;
  const y = doc.y;
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), 18).fill('#e2e8f0');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
  headers.forEach((header, index) => {
    doc.text(header, cursorX + 3, y + 5, { width: widths[index] - 6, lineBreak: false });
    cursorX += widths[index];
  });
  doc.y = y + 21;
  doc.font('Helvetica').fillColor('#111827');
}

function tableRow(doc: PDFKit.PDFDocument, values: string[], widths: number[], minHeight = 26): void {
  ensureSpace(doc, minHeight + 10);
  const x = doc.page.margins.left;
  const y = doc.y;
  let maxHeight = minHeight;
  values.forEach((value, index) => {
    const h = doc.heightOfString(value, { width: widths[index] - 6 });
    maxHeight = Math.max(maxHeight, h + 9);
  });
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), maxHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
  let cursorX = x;
  doc.fontSize(7.2).font('Helvetica').fillColor('#111827');
  values.forEach((value, index) => {
    doc.text(value, cursorX + 3, y + 4, { width: widths[index] - 6, height: maxHeight - 8 });
    cursorX += widths[index];
    doc.moveTo(cursorX, y).lineTo(cursorX, y + maxHeight).strokeColor('#cbd5e1').stroke();
  });
  doc.y = y + maxHeight;
}

function renderEvidence(doc: PDFKit.PDFDocument, evidence: Evidence, items: ChecklistItem[]): void {
  ensureSpace(doc, 190);
  const x = doc.page.margins.left;
  const y = doc.y;
  const imageBuffer = dataUrlToBuffer(evidence.dataUrl);
  const item = itemById(items, evidence.itemId);

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, x, y, { fit: [190, 130] });
    } catch {
      doc.rect(x, y, 190, 110).strokeColor('#cbd5e1').stroke();
      doc.fontSize(8).fillColor('#64748b').text('Imagen no soportada por el generador PDF', x + 8, y + 45, { width: 174, align: 'center' });
    }
  } else {
    doc.rect(x, y, 190, 110).strokeColor('#cbd5e1').stroke();
    doc.fontSize(8).fillColor('#64748b').text('Evidencia sin imagen embebida', x + 8, y + 45, { width: 174, align: 'center' });
  }

  doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(evidence.itemId, x + 210, y, { width: 310 });
  doc.font('Helvetica').fontSize(8).text(text(item?.requisito), x + 210, doc.y + 2, { width: 310 });
  doc.fillColor('#475569').text(text(evidence.descripcion || evidence.fileName), x + 210, doc.y + 4, { width: 310 });
  doc.text(formatDate(evidence.createdAt), x + 210, doc.y + 4, { width: 310 });
  doc.y = Math.max(doc.y, y + 142);
}

function addFooter(doc: PDFKit.PDFDocument, inspection: InspectionState, generatedAt: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#64748b').font('Helvetica');
    doc.text(
      `InspecAPP · ${inspection.meta.id} · Generado ${formatDate(generatedAt)} · Página ${i + 1} de ${range.count}`,
      doc.page.margins.left,
      doc.page.height - 36,
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' }
    );
  }
}

export async function buildFormalReportPdf(inspection: InspectionState): Promise<Buffer> {
  const items = getApplicableItems(inspection.meta.tipoInspeccion);
  const summary = buildReportSummary(inspection);
  const generatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 96, bottom: 54, left: 42, right: 42 },
      bufferPages: true,
      info: {
        Title: `Informe de inspección ${inspection.meta.id}`,
        Author: COMPANY.name,
        Subject: 'Inspección de instalaciones eléctricas en baja tensión',
        Keywords: 'DSE-GUI-001, NP 2 028 96, baja tensión, inspección'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const logoBuffer = getLogoBuffer();

    function drawPageHeader(firstPage: boolean): void {
      doc.rect(0, 0, doc.page.width, 24).fill('#0f766e');
      const headerX = logoBuffer ? 150 : 42;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 42, firstPage ? 38 : 32, { fit: firstPage ? [96, 60] : [78, 42] });
        } catch {
          // logo inválido: continuar sin imagen
        }
      }
      const titleWidth = 372 - headerX;
      if (firstPage) {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text(COMPANY.name, headerX, 40, { lineBreak: false });
        doc.fontSize(11.5).text('Informe preliminar de inspección eléctrica en baja tensión', headerX, 64, { width: titleWidth });
        doc.font('Helvetica').fontSize(9).fillColor('#475569').text('DSE-GUI-001 · NP 2 028 96 · Generado desde servidor', headerX, 96, { lineBreak: false });
        doc.fontSize(8.5).text(`${COMPANY.address} · Tel: ${COMPANY.phone}`, headerX, 109, { lineBreak: false });
        doc.text(`${COMPANY.email} · ${COMPANY.website}`, headerX, 121, { lineBreak: false });
      } else {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(COMPANY.name, headerX, 34, { lineBreak: false });
        doc.font('Helvetica').fontSize(7.8).fillColor('#475569').text('Informe preliminar de inspección eléctrica en baja tensión · DSE-GUI-001 · NP 2 028 96', headerX, 52, { width: titleWidth + 60, lineBreak: false });
        doc.fontSize(7.5).text(`${COMPANY.address} · Tel: ${COMPANY.phone} · ${COMPANY.email} · ${COMPANY.website}`, headerX, 64, { width: titleWidth + 60, lineBreak: false });
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`REP-${inspection.meta.id}`, 380, firstPage ? 44 : 36, { width: 170, align: 'right' });
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(`Generado: ${formatDate(generatedAt)}`, 380, firstPage ? 62 : 52, { width: 170, align: 'right' });
      if (firstPage) {
        doc.text(`Resultado: ${summary.resultadoPreliminar}`, 380, 76, { width: 170, align: 'right' });
      }
      doc.font('Helvetica').fillColor('#111827');
      doc.x = doc.page.margins.left;
      doc.y = firstPage ? 142 : doc.page.margins.top;
    }

    drawPageHeader(true);
    doc.on('pageAdded', () => drawPageHeader(false));

    sectionTitle(doc, '1. Identificación de la inspección');
    keyValue(doc, 'Fecha de inspección', inspection.meta.fechaInspeccion);
    keyValue(doc, 'Tipo de inspección', inspection.meta.tipoInspeccion);
    keyValue(doc, 'Propietario / Razón social', inspection.client.razonSocial);
    keyValue(doc, 'RUC', inspection.client.ruc);
    keyValue(doc, 'Dirección de instalación', inspection.client.direccion);
    keyValue(doc, 'NIS', inspection.client.nis);
    keyValue(doc, 'Límite de carga', inspection.client.limiteCarga);
    keyValue(doc, 'Organismo inspector', inspection.inspector.organismoInspector);
    keyValue(doc, 'Inspector', inspection.inspector.inspector);
    keyValue(doc, 'Nro. habilitación inspector', inspection.inspector.nroHabilitacionInspector);

    sectionTitle(doc, '2. Resumen preliminar');
    const summaryWidths = [112, 112, 112, 112];
    tableHeader(doc, ['Requisitos', 'Cumplen', 'No conformidades', 'Evidencias'], summaryWidths);
    tableRow(doc, [String(summary.totalRequisitos), String(summary.counts.CUMPLE), String(summary.noConformidades), String(summary.evidencias)], summaryWidths, 22);
    keyValue(doc, 'Resultado preliminar', summary.resultadoPreliminar);
    keyValue(doc, 'No conformidades críticas, P1 o RES', summary.noConformidadesCriticas);

    sectionTitle(doc, '3. Clasificación de hallazgos');
    tableHeader(doc, ['P1 peligro presente', 'P2 potencialmente peligroso', 'P3 mejora recomendada', 'MI investigación adicional'], summaryWidths);
    tableRow(doc, [String(summary.hallazgosPorCodigo.P1), String(summary.hallazgosPorCodigo.P2), String(summary.hallazgosPorCodigo.P3), String(summary.hallazgosPorCodigo.MI)], summaryWidths, 22);

    sectionTitle(doc, '4. Circuitos definidos');
    tableHeader(doc, ['#', 'Tablero', 'Circuito', 'Uso', 'Tensión', 'Protección', 'DR'], [22, 70, 78, 96, 50, 76, 56]);
    if (inspection.circuits.length) {
      inspection.circuits.forEach((circuit, index) => tableRow(doc, [String(index + 1), text(circuit.tablero), text(circuit.nombre), text(circuit.uso), text(circuit.tension), text(circuit.proteccion), text(circuit.dr)], [22, 70, 78, 96, 50, 76, 56]));
    } else {
      tableRow(doc, ['-', 'Sin circuitos cargados', '', '', '', '', ''], [22, 70, 78, 96, 50, 76, 56], 22);
    }

    sectionTitle(doc, '5. Ensayos y mediciones registradas');
    tableHeader(doc, ['#', 'Tipo', 'Valor', 'Unidad', 'Instrumento', 'Observación'], [22, 110, 54, 42, 92, 128]);
    if (inspection.measurements.length) {
      inspection.measurements.forEach((m, index) => tableRow(doc, [String(index + 1), text(m.tipo), text(m.valor), text(m.unidad), text(m.instrumento), text(m.observacion)], [22, 110, 54, 42, 92, 128]));
    } else {
      tableRow(doc, ['-', 'Sin mediciones cargadas', '', '', '', ''], [22, 110, 54, 42, 92, 128], 22);
    }

    sectionTitle(doc, '6. No conformidades detectadas');
    const nonConformityWidths = [46, 24, 72, 126, 96, 84];
    tableHeader(doc, ['Código', 'RES', 'Clasificación', 'Requisito', 'Acción / plazo', 'Observación'], nonConformityWidths);
    const nonConformities = items.filter((item) => inspection.answers?.[item.id]?.resultado === 'NO_CUMPLE');
    if (nonConformities.length) {
      nonConformities.forEach((item) => {
        const answer = inspection.answers[item.id]!;
        tableRow(
          doc,
          [
            item.codigo,
            item.esRES ? 'Sí' : 'No',
            text(findingCodeLabel(answer.hallazgoCodigo)),
            item.requisito,
            `${text(answer.accionCorrectiva)} / ${text(answer.plazoCorreccion)}`,
            text(answer.observacion)
          ],
          nonConformityWidths,
          46
        );
      });
    } else {
      tableRow(doc, ['-', '-', '-', 'No se registraron no conformidades', '', ''], nonConformityWidths, 24);
    }

    doc.addPage();
    sectionTitle(doc, '7. Lista de verificación completa');
    const checklistWidths = [44, 22, 78, 135, 56, 55, 58];
    tableHeader(doc, ['Código', 'RES', 'Grupo', 'Requisito', 'Resultado', 'Hallazgo', 'Observación'], checklistWidths);
    items.forEach((item) => {
      const answer = inspection.answers?.[item.id];
      tableRow(doc, [item.codigo, item.esRES ? 'Sí' : 'No', item.grupo, item.requisito, statusLabel(answer?.resultado || 'SIN_RESPONDER'), findingCodeLabel(answer?.hallazgoCodigo), text(answer?.observacion || '')], checklistWidths, 34);
    });

    if (inspection.evidences.length) {
      doc.addPage();
      sectionTitle(doc, '8. Evidencias fotográficas');
      inspection.evidences.forEach((evidence) => renderEvidence(doc, evidence, items));
    }

    sectionTitle(doc, '9. Observación general');
    doc.fontSize(9).fillColor('#111827').font('Helvetica').text(text(inspection.meta.observacionGeneral), { width: 500 });

    sectionTitle(doc, '10. Firmas y cierre documental');
    keyValue(doc, 'Decisión final', inspection.closure?.finalDecision || 'Pendiente');
    keyValue(doc, 'Fecha de cierre', formatDate(inspection.closure?.closedAt));
    keyValue(doc, 'Cerrado por', inspection.closure?.closedByUserName || 's/d');
    keyValue(doc, 'Nota de cierre', inspection.closure?.closureNote || 'Sin nota de cierre.');

    ensureSpace(doc, 150);
    const signatureKinds: Array<{ kind: string; label: string; x: number }> = [
      { kind: 'PROPIETARIO', label: 'Propietario / responsable', x: 42 },
      { kind: 'INSPECTOR', label: 'Inspector actuante', x: 205 },
      { kind: 'SUPERVISOR', label: 'Gerente técnico', x: 368 }
    ];
    const signatureY = doc.y + 10;
    signatureKinds.forEach((slot) => {
      const signature = (inspection.signatures || []).find((item) => item.kind === slot.kind);
      doc.rect(slot.x, signatureY, 145, 118).strokeColor('#cbd5e1').stroke();
      const buffer = dataUrlToBuffer(signature?.dataUrl);
      if (buffer) {
        try { doc.image(buffer, slot.x + 12, signatureY + 8, { fit: [121, 48] }); } catch { /* ignore invalid signature image */ }
      }
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111827').text(slot.label, slot.x + 6, signatureY + 64, { width: 133, align: 'center' });
      doc.font('Helvetica').fontSize(7).fillColor('#334155').text(signature?.signerName || 'Firma no registrada', slot.x + 6, signatureY + 79, { width: 133, align: 'center' });
      doc.fillColor('#64748b').text(signature ? formatDate(signature.signedAt) : '', slot.x + 6, signatureY + 93, { width: 133, align: 'center' });
    });
    doc.y = signatureY + 134;

    if ((inspection.auditTrail || []).length) {
      sectionTitle(doc, '11. Trazabilidad resumida');
      tableHeader(doc, ['Fecha', 'Acción', 'Usuario', 'Detalle'], [80, 98, 110, 160]);
      (inspection.auditTrail || []).slice(-12).forEach((entry) => {
        tableRow(doc, [formatDate(entry.createdAt), entry.action, `${entry.actorName} (${entry.actorRole})`, entry.detail], [80, 98, 110, 160], 28);
      });
    }

    addFooter(doc, inspection, generatedAt);
    doc.end();
  });
}
