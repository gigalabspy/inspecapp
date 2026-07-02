import type { AnswerStatus, ChecklistAnswer, ChecklistItem, FindingCode } from '../types';
import { findingOptions, getFindingClassification, shouldShowFindingFields } from '../data/findingClassifications';

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
    criticidad: '',
    hallazgoCodigo: '',
    accionCorrectiva: '',
    plazoCorreccion: '',
    responsableCorreccion: ''
  };

  const selectedFinding = getFindingClassification(current.hallazgoCodigo);
  const showFindingFields = shouldShowFindingFields(current.resultado);

  function updateResultado(resultado: AnswerStatus) {
    const nextShowsFindingFields = shouldShowFindingFields(resultado);

    if (!nextShowsFindingFields) {
      onChange({
        ...current,
        resultado,
        hallazgoCodigo: '',
        accionCorrectiva: '',
        plazoCorreccion: '',
        responsableCorreccion: ''
      });
      return;
    }

    onChange({ ...current, resultado });
  }

  function updateFindingCode(hallazgoCodigo: FindingCode) {
    const classification = getFindingClassification(hallazgoCodigo);
    onChange({
      ...current,
      hallazgoCodigo,
      criticidad: classification?.defaultCriticidad ?? current.criticidad,
      accionCorrectiva: classification?.action ?? current.accionCorrectiva ?? '',
      plazoCorreccion: classification?.defaultDeadline ?? current.plazoCorreccion ?? ''
    });
  }

  return (
    <article className={`check-card ${current.resultado === 'NO_CUMPLE' ? 'noncompliance' : ''}`}>
      <div className="check-head">
        <div>
          <strong>{item.codigo}</strong>
          {item.esRES && <span className="badge danger">RES</span>}
          {current.hallazgoCodigo && <span className={`badge finding-${current.hallazgoCodigo.toLowerCase()}`}>{current.hallazgoCodigo}</span>}
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
            onChange={(event) => updateResultado(event.target.value as AnswerStatus)}
          >
            {statuses.map((status) => <option key={status} value={status}>{status || 'Seleccionar'}</option>)}
          </select>
        </label>

        <label>
          Criticidad interna
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

      {showFindingFields && (
        <div className="finding-box">
          <div className="section-title small">
            <h3>Clasificación del hallazgo</h3>
            <span>Anexo II · Resolución INTN N° 802/2024</span>
          </div>

          <div className="form-grid compact">
            <label>
              Código de hallazgo
              <select
                value={current.hallazgoCodigo || ''}
                onChange={(event) => updateFindingCode(event.target.value as FindingCode)}
              >
                <option value="">Sin clasificar</option>
                {findingOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              Responsable / encargado
              <input
                value={current.responsableCorreccion || ''}
                placeholder="Ej.: propietario, contratista, electricista matriculado"
                onChange={(event) => onChange({ ...current, responsableCorreccion: event.target.value })}
              />
            </label>
          </div>

          {selectedFinding && (
            <p className="finding-help">
              <strong>{selectedFinding.label}:</strong> {selectedFinding.description}
            </p>
          )}

          <label>
            Acción correctiva / recomendación
            <textarea
              value={current.accionCorrectiva || ''}
              placeholder="Indicar acción correctiva, mejora recomendada o investigación adicional requerida."
              onChange={(event) => onChange({ ...current, accionCorrectiva: event.target.value })}
            />
          </label>

          <label>
            Plazo / condición de comunicación
            <textarea
              value={current.plazoCorreccion || ''}
              placeholder="Ej.: inmediato, 24 horas posteriores a la corrección, 7 días hábiles, etc."
              onChange={(event) => onChange({ ...current, plazoCorreccion: event.target.value })}
            />
          </label>
        </div>
      )}

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
