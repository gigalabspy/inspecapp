import type { ChecklistAnswer, FindingCode } from '../types';

type FindingClassification = {
  code: Exclude<FindingCode, ''>;
  label: string;
  title: string;
  description: string;
  action: string;
  defaultDeadline: string;
  defaultCriticidad: ChecklistAnswer['criticidad'];
};

export const findingClassifications: Record<Exclude<FindingCode, ''>, FindingClassification> = {
  P1: {
    code: 'P1',
    label: 'P1 - Peligro presente',
    title: 'Peligro presente',
    description: 'Riesgo de lesiones. Requiere acción correctiva inmediata.',
    action: 'Corregir inmediatamente el incumplimiento por una persona competente con Matrícula de Electricista INTN o seccionar la fuente de riesgo del resto de la instalación.',
    defaultDeadline: 'Inmediato. Comunicar la corrección al Organismo de Inspección dentro de las 24 horas posteriores a la corrección.',
    defaultCriticidad: 'CRITICA'
  },
  P2: {
    code: 'P2',
    label: 'P2 - Potencialmente peligroso',
    title: 'Potencialmente peligroso',
    description: 'La seguridad de las personas puede estar en riesgo. Requiere medidas correctivas urgentes.',
    action: 'Implementar medidas correctivas urgentes y presentar informe con evidencia documental de las correcciones.',
    defaultDeadline: 'Urgente, conforme al plazo especificado por el Organismo de Inspección.',
    defaultCriticidad: 'ALTA'
  },
  P3: {
    code: 'P3',
    label: 'P3 - Mejora recomendada',
    title: 'Mejora recomendada',
    description: 'La seguridad de las personas no se encuentra en riesgo, pero se recomienda ejecutar mejoras.',
    action: 'Ejecutar mejoras recomendadas y adjuntar documentación de respaldo si el solicitante decide implementarlas.',
    defaultDeadline: 'Plazo adecuado definido por el solicitante u Organismo de Inspección.',
    defaultCriticidad: 'BAJA'
  },
  MI: {
    code: 'MI',
    label: 'MI - Requiere investigación adicional',
    title: 'Requiere investigación adicional',
    description: 'Existe una aparente deficiencia que no pudo ser completamente identificada por la extensión o limitaciones de la inspección.',
    action: 'Designar profesional competente con Matrícula de Electricista INTN para realizar investigación adicional y remitir informe con conclusiones y medidas propuestas.',
    defaultDeadline: 'Sin demora. Si la investigación confirma P1 o P2, aplicar los plazos de la clasificación correspondiente.',
    defaultCriticidad: 'MEDIA'
  }
};

export const findingOptions = Object.values(findingClassifications);

export function getFindingClassification(code?: FindingCode) {
  if (!code) return undefined;
  return findingClassifications[code];
}

export function shouldShowFindingFields(resultado: ChecklistAnswer['resultado']) {
  return resultado === 'NO_CUMPLE' || resultado === 'PENDIENTE';
}

export function findingCodeLabel(code?: FindingCode) {
  return getFindingClassification(code)?.label || 'Sin clasificar';
}
