import type { ChecklistItem, InspectionState } from '../types/inspection.js';
import type { FindingCode } from './findingClassifications.js';
import { checklistDSE001 } from './checklistDSE001.js';

export type ReportStatusCounts = Record<'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA' | 'PENDIENTE' | 'SIN_RESPONDER', number>;

export interface ReportSummary {
  inspectionId: string;
  generatedAt: string;
  tipoInspeccion: string;
  cliente: string;
  direccion: string;
  totalRequisitos: number;
  resEvaluados: number;
  noConformidades: number;
  noConformidadesCriticas: number;
  hallazgosPorCodigo: Record<Exclude<FindingCode, ''>, number>;
  evidencias: number;
  circuitos: number;
  mediciones: number;
  counts: ReportStatusCounts;
  resultadoPreliminar: 'CONFORME' | 'OBSERVADO' | 'PENDIENTE';
}

export function getApplicableItems(type: InspectionState['meta']['tipoInspeccion']): ChecklistItem[] {
  if (type === 'INICIAL') return checklistDSE001.filter((item) => item.etapa === 'INICIAL');
  if (type === 'INTERMEDIA') return checklistDSE001.filter((item) => item.etapa === 'INTERMEDIA');
  return checklistDSE001.filter((item) => item.etapa === 'FINAL_VISUAL' || item.etapa === 'FINAL_ENSAYOS');
}

export function itemById(items: ChecklistItem[], id: string): ChecklistItem | undefined {
  return items.find((item) => item.id === id || item.codigo === id);
}

export function buildReportSummary(inspection: InspectionState): ReportSummary {
  const items = getApplicableItems(inspection.meta.tipoInspeccion);
  const counts: ReportStatusCounts = {
    CUMPLE: 0,
    NO_CUMPLE: 0,
    NO_APLICA: 0,
    PENDIENTE: 0,
    SIN_RESPONDER: 0
  };

  for (const item of items) {
    const status = inspection.answers?.[item.id]?.resultado || 'SIN_RESPONDER';
    if (status === 'CUMPLE') counts.CUMPLE += 1;
    else if (status === 'NO_CUMPLE') counts.NO_CUMPLE += 1;
    else if (status === 'NO_APLICA') counts.NO_APLICA += 1;
    else if (status === 'PENDIENTE') counts.PENDIENTE += 1;
    else counts.SIN_RESPONDER += 1;
  }

  const noConformidadesCriticas = items.filter((item) => {
    const answer = inspection.answers?.[item.id];
    return answer?.resultado === 'NO_CUMPLE' && (answer.criticidad === 'CRITICA' || answer.hallazgoCodigo === 'P1' || item.esRES);
  }).length;

  const hallazgosPorCodigo = items.reduce<Record<Exclude<FindingCode, ''>, number>>((acc, item) => {
    const code = inspection.answers?.[item.id]?.hallazgoCodigo;
    if (code) acc[code] += 1;
    return acc;
  }, { P1: 0, P2: 0, P3: 0, MI: 0 });

  const resultadoPreliminar = counts.NO_CUMPLE > 0
    ? 'OBSERVADO'
    : counts.PENDIENTE > 0 || counts.SIN_RESPONDER > 0
      ? 'PENDIENTE'
      : 'CONFORME';

  return {
    inspectionId: inspection.meta.id,
    generatedAt: new Date().toISOString(),
    tipoInspeccion: inspection.meta.tipoInspeccion,
    cliente: inspection.client.razonSocial || 'Sin razón social',
    direccion: inspection.client.direccion || 'Sin dirección',
    totalRequisitos: items.length,
    resEvaluados: items.filter((item) => item.esRES).length,
    noConformidades: counts.NO_CUMPLE,
    noConformidadesCriticas,
    hallazgosPorCodigo,
    evidencias: inspection.evidences?.length || 0,
    circuitos: inspection.circuits?.length || 0,
    mediciones: inspection.measurements?.length || 0,
    counts,
    resultadoPreliminar
  };
}
