import { useMemo, useState } from 'react';
import type { ChecklistItem, Evidence } from '../types';
import { getCurrentPositionSafe, isNativeMobile, takePhotoWithNativeCamera } from '../utils/mobile';

interface Props {
  items: ChecklistItem[];
  evidences: Evidence[];
  onChange: (evidences: Evidence[]) => void;
}

const MAX_IMAGE_SIZE = 1600;
const JPEG_QUALITY = 0.75;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen. Probá con JPG o PNG.'));
    };

    image.src = url;
  });
}

async function imageFileToCompressedDataUrl(file: File): Promise<string> {
  try {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    // Si el navegador no logra comprimir la imagen, se guarda el archivo original.
    // Esto evita perder la evidencia, aunque el archivo pueda quedar más pesado.
    return fileToDataUrl(file);
  }
}

export function EvidenceUploader({ items, evidences, onChange }: Props) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    if (!selectedItemId) {
      alert('Seleccioná primero el requisito al que corresponde la evidencia.');
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('El archivo seleccionado no es una imagen. Usá JPG, PNG o una foto tomada desde la cámara.');
      return;
    }

    setIsLoading(true);
    setStatus(`Cargando ${imageFiles.length} evidencia(s)...`);

    try {
      const position = await getCurrentPositionSafe();
      const next: Evidence[] = [];

      for (const file of imageFiles) {
        const dataUrl = await imageFileToCompressedDataUrl(file);

        next.push({
          id: crypto.randomUUID(),
          itemId: selectedItemId,
          fileName: file.name || `evidencia-${new Date().toISOString()}.jpg`,
          dataUrl,
          descripcion: selectedItem ? `${selectedItem.codigo} - ${selectedItem.grupo}` : '',
          createdAt: new Date().toISOString(),
          ...position
        });
      }

      onChange([...evidences, ...next]);
      setStatus(`Se cargaron ${next.length} evidencia(s).`);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar las evidencias.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNativeCamera() {
    if (!selectedItemId) {
      alert('Seleccioná primero el requisito al que corresponde la evidencia.');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Abriendo cámara nativa...');

      const photo = await takePhotoWithNativeCamera();
      if (!photo) {
        setStatus('La cámara nativa está disponible cuando la app se ejecuta empaquetada con Capacitor. En navegador usá el selector de archivo.');
        return;
      }

      const next: Evidence = {
        id: crypto.randomUUID(),
        itemId: selectedItemId,
        fileName: photo.fileName,
        dataUrl: photo.dataUrl,
        descripcion: selectedItem ? `${selectedItem.codigo} - ${selectedItem.grupo}` : '',
        createdAt: new Date().toISOString(),
        latitud: photo.latitud,
        longitud: photo.longitud
      };

      onChange([...evidences, next]);
      setStatus('Fotografía cargada correctamente.');
    } catch (error) {
      console.error(error);
      setStatus('No se pudo tomar la fotografía. Verificá los permisos de cámara.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Evidencias fotográficas</h2>
        <span>{evidences.length} archivo(s)</span>
      </div>

      <p className="muted">
        Primero seleccioná el requisito inspeccionado y luego adjuntá la foto. Las imágenes se comprimen automáticamente para que puedan guardarse e incluirse en el informe.
      </p>

      <div className="form-grid">
        <label>
          Asociar evidencia al requisito
          <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
            <option value="">Seleccionar requisito</option>
            {items.map((item) => (
              <option value={item.id} key={item.id}>{item.codigo} — {item.grupo}</option>
            ))}
          </select>
        </label>

        <label>
          Adjuntar fotos desde cámara o galería
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isLoading}
            onChange={async (event) => {
              await handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="mobile-actions">
        <button type="button" onClick={handleNativeCamera} disabled={isLoading}>Tomar foto con cámara nativa</button>
        <span>{isNativeMobile() ? 'Modo Android habilitado' : 'En navegador usá Adjuntar fotos desde cámara o galería'}</span>
      </div>

      {status && <p className="sync-message">{status}</p>}

      <div className="evidence-grid">
        {evidences.map((evidence) => {
          const item = items.find((entry) => entry.id === evidence.itemId);
          return (
            <figure key={evidence.id}>
              <img src={evidence.dataUrl} alt={evidence.fileName} />
              <figcaption>
                <strong>{item ? `${item.codigo} — ${item.grupo}` : evidence.itemId}</strong>
                {(evidence.latitud && evidence.longitud) && (
                  <small>{evidence.latitud.toFixed(6)}, {evidence.longitud.toFixed(6)}</small>
                )}
                <small>{evidence.fileName}</small>
                <input
                  value={evidence.descripcion}
                  placeholder="Descripción / ubicación"
                  onChange={(event) => onChange(
                    evidences.map((ev) => ev.id === evidence.id ? { ...ev, descripcion: event.target.value } : ev)
                  )}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onChange(evidences.filter((ev) => ev.id !== evidence.id))}
                >
                  Quitar
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {evidences.length > 0 && (
        <p className="muted">
          Evidencias cargadas en esta inspección: {evidences.length}. Al generar el reporte local se insertan automáticamente. Para el informe formal del servidor, primero sincronizá la inspección después de cargar las fotos.
        </p>
      )}
    </section>
  );
}
