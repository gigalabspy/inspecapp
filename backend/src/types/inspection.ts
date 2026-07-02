export type InspectionType = 'INICIAL' | 'INTERMEDIA' | 'FINAL' | 'EXISTENTE';
export type ChecklistStage = 'INICIAL' | 'INTERMEDIA' | 'FINAL_VISUAL' | 'FINAL_ENSAYOS';
export type AnswerStatus = '' | 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA' | 'PENDIENTE';
export type FindingCode = '' | 'P1' | 'P2' | 'P3' | 'MI';
export type SyncStatus = 'LOCAL' | 'PENDIENTE_SYNC' | 'SINCRONIZADA' | 'ERROR_SYNC';
export type UserRole = 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR';
export type SignatureKind = 'PROPIETARIO' | 'INSPECTOR' | 'SUPERVISOR';
export type FinalDecision = 'CONFORME' | 'OBSERVADO' | 'NO_CONFORME';
export type AuditAction =
  | 'CREADA_LOCAL'
  | 'SINCRONIZADA'
  | 'FIRMA_REGISTRADA'
  | 'ENVIADA_REVISION'
  | 'APROBADA_SUPERVISION'
  | 'CERRADA_FORMALMENTE'
  | 'REABIERTA'
  | 'REPORTE_GENERADO'
  | 'OBSERVACION_AGREGADA';

export interface ClientData {
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  nis: string;
  limiteCarga: string;
}

export interface InspectorData {
  organismoInspector: string;
  inspector: string;
  nroHabilitacionOrganismo: string;
  nroHabilitacionInspector: string;
}

export interface SignatureRecord {
  id: string;
  kind: SignatureKind;
  signerName: string;
  signerDocument: string;
  signerEmail?: string;
  roleLabel: string;
  statement: string;
  dataUrl: string;
  signedAt: string;
  signedByUserId?: string;
  signedByUserName?: string;
}

export interface AuditEntry {
  id: string;
  inspectionId: string;
  action: AuditAction;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
  detail: string;
  payload?: Record<string, unknown>;
}

export interface ClosureData {
  finalDecision?: FinalDecision;
  closureNote?: string;
  closedAt?: string;
  closedByUserId?: string;
  closedByUserName?: string;
  requiresCorrection?: boolean;
}

export interface InspectionMeta {
  id: string;
  fechaInspeccion: string;
  tipoInspeccion: InspectionType;
  estado: 'BORRADOR' | 'EN_CAMPO' | 'OBSERVADA' | 'PRELIMINAR_GENERADO' | 'EN_REVISION' | 'APROBADA' | 'CERRADA';
  observacionGeneral: string;
  ubicacion?: string;
  createdAt?: string;
  updatedAt?: string;
  syncStatus?: SyncStatus;
  version?: number;
  reportStatus?: 'NO_GENERADO' | 'BORRADOR_LOCAL' | 'GENERADO_SERVIDOR' | 'FIRMADO';
  lastReportAt?: string;
}

export interface Circuit {
  id: string;
  tablero: string;
  nombre: string;
  uso: string;
  tension: string;
  fases: string;
  conductorFase: string;
  conductorNeutro: string;
  conductorPE: string;
  proteccion: string;
  dr: string;
  observaciones: string;
}

export interface ChecklistItem {
  id: string;
  codigo: string;
  etapa: ChecklistStage;
  grupo: string;
  requisito: string;
  referencia: string;
  esRES?: boolean;
}

export interface ChecklistAnswer {
  itemId: string;
  resultado: AnswerStatus;
  observacion: string;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' | '';
  hallazgoCodigo?: FindingCode;
  accionCorrectiva?: string;
  plazoCorreccion?: string;
  responsableCorreccion?: string;
}

export interface Evidence {
  id: string;
  itemId: string;
  fileName: string;
  dataUrl: string;
  descripcion: string;
  createdAt: string;
  latitud?: number;
  longitud?: number;
  serverFileUrl?: string;
}

export interface Measurement {
  id: string;
  tipo: string;
  valor: string;
  unidad: string;
  instrumento: string;
  observacion: string;
}

export interface InspectionState {
  meta: InspectionMeta;
  client: ClientData;
  inspector: InspectorData;
  circuits: Circuit[];
  answers: Record<string, ChecklistAnswer>;
  evidences: Evidence[];
  measurements: Measurement[];
  signatures?: SignatureRecord[];
  auditTrail?: AuditEntry[];
  closure?: ClosureData;
}

export interface InspectionSummary {
  id: string;
  razonSocial: string;
  ruc: string;
  direccion: string;
  fechaInspeccion: string;
  tipoInspeccion: InspectionType;
  estado: InspectionState['meta']['estado'];
  updatedAt: string;
  syncStatus: SyncStatus;
  noConformidades: number;
  evidencias: number;
  circuitos: number;
}

export interface StorageUsageInfo {
  quota?: number;
  usage?: number;
  percent?: number;
}

export interface InspectionRecord {
  id: string;
  payload: InspectionState;
  ownerUserId: string;
  serverUpdatedAt: string;
  deleted?: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
  active?: boolean;
  organization?: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  inspections: InspectionRecord[];
  audit: AuditEntry[];
  updatedAt: string;
}
