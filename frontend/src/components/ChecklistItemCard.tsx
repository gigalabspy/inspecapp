import type { AnswerStatus, ChecklistAnswer, ChecklistItem } from '../types';

interface Props {
  item: ChecklistItem;
  answer?: ChecklistAnswer;
  evidenceCount: number;
  onChange: (answer: ChecklistAnswer) => void;
}

const statuses: AnswerStatus[] = ['', 'CUMPLE', 'NO_CUMPLE', 'NO_APLICA', 'PENDIENTE'];

export function ChecklistItemCard({ item, answer, evidenceCount, onChange }: Props) {
  const current: ChecklistAnswer = answer || {
    itemId: item.id,
    resultado: '',
    observacion: '',
    criticidad: ''
  };

  return (
    <article className={`check-card ${current.resultado === 'NO_CUMPLE' ? 'noncompliance' : ''}`}>
      <div className="check-head">
        <div>
          <strong>{item.codigo}</strong>
          {item.esRES && <span className="badge danger">RES</span>}
          {evidenceCount > 0 && <span className="badge">{evidenceCount} evidencia(s)</span>}
        </div>
        <small>{item.referencia}</small>
      </div>

      <p>{item.requisito}</p>

      <div className="form-grid compact">
        <label>
          Resultado
          <select
            value={current.resultado}
            onChange={(event) => onChange({ ...current, resultado: event.target.value as AnswerStatus })}
          >
            {statuses.map((status) => <option key={status} value={status}>{status || 'Seleccionar'}</option>)}
          </select>
        </label>

        <label>
          Criticidad
          <select
            value={current.criticidad}
            onChange={(event) => onChange({ ...current, criticidad: event.target.value as ChecklistAnswer['criticidad'] })}
          >
            <option value="">Sin definir</option>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </label>
      </div>

      <label>
        Observación del inspector
        <textarea
          value={current.observacion}
          placeholder="Describir hallazgo, ubicación, condición observada o recomendación."
          onChange={(event) => onChange({ ...current, observacion: event.target.value })}
        />
      </label>
    </article>
  );
}
