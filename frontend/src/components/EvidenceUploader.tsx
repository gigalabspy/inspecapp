import type { ChecklistItem, Evidence } from '../types';
import { getCurrentPositionSafe, isNativeMobile, takePhotoWithNativeCamera } from '../utils/mobile';

interface Props {
  items: ChecklistItem[];
  evidences: Evidence[];
  onChange: (evidences: Evidence[]) => void;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function selectedEvidenceItemId(): string {
  const select = document.getElementById('evidence-item') as HTMLSelectElement | null;
  return select?.value || '';
}

export function EvidenceUploader({ items, evidences, onChange }: Props) {
  async function handleFiles(itemId: string, files: FileList | null) {
    if (!files) return;

    const position = await getCurrentPositionSafe();
    const next: Evidence[] = [];

    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);

      next.push({
        id: crypto.randomUUID(),
        itemId,
        fileName: file.name,
        dataUrl,
        descripcion: '',
        createdAt: new Date().toISOString(),
        ...position
      });
    }

    onChange([...evidences, ...next]);
  }

  async function handleNativeCamera() {
    const itemId = selectedEvidenceItemId();
    if (!itemId) {
      alert('Seleccioná primero el requisito al que corresponde la evidencia.');
      return;
    }

    try {
      const photo = await takePhotoWithNativeCamera();
      if (!photo) {
        alert('La cámara nativa está disponible cuando la app se ejecuta empaquetada con Capacitor. En navegador usá el selector de archivo.');
        return;
      }

      const next: Evidence = {
        id: crypto.randomUUID(),
        itemId,
        fileName: photo.fileName,
        dataUrl: photo.dataUrl,
        descripcion: '',
        createdAt: new Date().toISOString(),
        latitud: photo.latitud,
        longitud: photo.longitud
      };
      onChange([...evidences, next]);
    } catch (error) {
      console.error(error);
      alert('No se pudo tomar la fotografía. Verificá los permisos de cámara.');
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Evidencias fotográficas</h2>
        <span>{evidences.length} archivo(s)</span>
      </div>

      <div className="form-grid">
        <label>
          Asociar evidencia al requisito
          <select id="evidence-item">
            <option value="">Seleccionar requisito</option>
            {items.map((item) => <option value={item.id} key={item.id}>{item.codigo} — {item.grupo}</option>)}
          </select>
        </label>

        <label>
          Adjuntar fotos desde cámara o galería
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(event) => {
              const itemId = selectedEvidenceItemId();
              if (!itemId) {
                alert('Seleccioná primero el requisito al que corresponde la evidencia.');
                event.target.value = '';
                return;
              }
              handleFiles(itemId, event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="mobile-actions">
        <button type="button" onClick={handleNativeCamera}>Tomar foto con cámara nativa</button>
        <span>{isNativeMobile() ? 'Modo Android habilitado' : 'En navegador funciona como PWA con input de cámara'}</span>
      </div>

      <div className="evidence-grid">
        {evidences.map((evidence) => (
          <figure key={evidence.id}>
            <img src={evidence.dataUrl} alt={evidence.fileName} />
            <figcaption>
              <strong>{evidence.itemId}</strong>
              {(evidence.latitud && evidence.longitud) && (
                <small>{evidence.latitud.toFixed(6)}, {evidence.longitud.toFixed(6)}</small>
              )}
              <input
                value={evidence.descripcion}
                placeholder="Descripción / ubicación"
                onChange={(event) => onChange(evidences.map((ev) => ev.id === evidence.id ? { ...ev, descripcion: event.target.value } : ev))}
              />
              <button type="button" className="ghost" onClick={() => onChange(evidences.filter((ev) => ev.id !== evidence.id))}>Quitar</button>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
