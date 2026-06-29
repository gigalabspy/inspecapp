import type { Measurement } from '../types';

interface Props {
  measurements: Measurement[];
  onChange: (measurements: Measurement[]) => void;
}

const emptyMeasurement = (): Measurement => ({
  id: crypto.randomUUID(),
  tipo: '',
  valor: '',
  unidad: '',
  instrumento: '',
  observacion: ''
});

export function MeasurementsEditor({ measurements, onChange }: Props) {
  const update = (id: string, patch: Partial<Measurement>) => {
    onChange(measurements.map((measurement) => measurement.id === id ? { ...measurement, ...patch } : measurement));
  };

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Registro de ensayos y mediciones</h2>
        <button type="button" onClick={() => onChange([...measurements, emptyMeasurement()])}>Agregar medición</button>
      </div>

      {measurements.length === 0 && <p className="muted">Ejemplos: RPAT, resistencia de aislación, impedancia de falla, prueba de DR.</p>}

      {measurements.map((measurement) => (
        <article className="measurement-card" key={measurement.id}>
          <div className="form-grid">
            <label>Tipo de medición<input value={measurement.tipo} onChange={(e) => update(measurement.id, { tipo: e.target.value })} placeholder="RPAT / Aislación / Zfalla" /></label>
            <label>Valor<input value={measurement.valor} onChange={(e) => update(measurement.id, { valor: e.target.value })} /></label>
            <label>Unidad<input value={measurement.unidad} onChange={(e) => update(measurement.id, { unidad: e.target.value })} placeholder="Ω / MΩ / ms" /></label>
            <label>Instrumento<input value={measurement.instrumento} onChange={(e) => update(measurement.id, { instrumento: e.target.value })} placeholder="Marca, modelo, serie" /></label>
          </div>
          <label>Observación<textarea value={measurement.observacion} onChange={(e) => update(measurement.id, { observacion: e.target.value })} /></label>
          <button type="button" className="ghost" onClick={() => onChange(measurements.filter((item) => item.id !== measurement.id))}>Eliminar medición</button>
        </article>
      ))}
    </section>
  );
}
