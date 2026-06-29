import type { Circuit } from '../types';

interface Props {
  circuits: Circuit[];
  onChange: (circuits: Circuit[]) => void;
}

const emptyCircuit = (): Circuit => ({
  id: crypto.randomUUID(),
  tablero: '',
  nombre: '',
  uso: '',
  tension: '',
  fases: '',
  conductorFase: '',
  conductorNeutro: '',
  conductorPE: '',
  proteccion: '',
  dr: '',
  observaciones: ''
});

export function CircuitsEditor({ circuits, onChange }: Props) {
  const update = (id: string, patch: Partial<Circuit>) => {
    onChange(circuits.map((circuit) => circuit.id === id ? { ...circuit, ...patch } : circuit));
  };

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Definición de circuitos</h2>
        <button type="button" onClick={() => onChange([...circuits, emptyCircuit()])}>Agregar circuito</button>
      </div>

      {circuits.length === 0 && <p className="muted">Todavía no se cargaron circuitos.</p>}

      {circuits.map((circuit, index) => (
        <article className="circuit-card" key={circuit.id}>
          <div className="section-title small">
            <h3>Circuito {index + 1}</h3>
            <button type="button" className="ghost" onClick={() => onChange(circuits.filter((c) => c.id !== circuit.id))}>Eliminar</button>
          </div>

          <div className="form-grid">
            <label>Tablero<input value={circuit.tablero} onChange={(e) => update(circuit.id, { tablero: e.target.value })} placeholder="TG, TS-01..." /></label>
            <label>Nombre circuito<input value={circuit.nombre} onChange={(e) => update(circuit.id, { nombre: e.target.value })} placeholder="C-01 iluminación" /></label>
            <label>Uso<input value={circuit.uso} onChange={(e) => update(circuit.id, { uso: e.target.value })} placeholder="Iluminación, toma, AA..." /></label>
            <label>Tensión<input value={circuit.tension} onChange={(e) => update(circuit.id, { tension: e.target.value })} placeholder="220 V / 380 V" /></label>
            <label>Fases<input value={circuit.fases} onChange={(e) => update(circuit.id, { fases: e.target.value })} placeholder="1F+N+PE / 3F+N+PE" /></label>
            <label>Conductor fase<input value={circuit.conductorFase} onChange={(e) => update(circuit.id, { conductorFase: e.target.value })} placeholder="2,5 mm² Cu" /></label>
            <label>Conductor neutro<input value={circuit.conductorNeutro} onChange={(e) => update(circuit.id, { conductorNeutro: e.target.value })} /></label>
            <label>Conductor PE<input value={circuit.conductorPE} onChange={(e) => update(circuit.id, { conductorPE: e.target.value })} /></label>
            <label>Protección<input value={circuit.proteccion} onChange={(e) => update(circuit.id, { proteccion: e.target.value })} placeholder="TM 2x16 A curva C" /></label>
            <label>DR<input value={circuit.dr} onChange={(e) => update(circuit.id, { dr: e.target.value })} placeholder="30 mA / No aplica" /></label>
          </div>

          <label>Observaciones<textarea value={circuit.observaciones} onChange={(e) => update(circuit.id, { observaciones: e.target.value })} /></label>
        </article>
      ))}
    </section>
  );
}
