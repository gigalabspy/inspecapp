import { useEffect, useState } from 'react';
import { getPlatformName, isNativeMobile } from '../utils/mobile';
import type { StorageUsageInfo } from '../types';

interface Props {
  storageUsage: StorageUsageInfo;
  apiUrl?: string;
}

function formatBytes(value?: number) {
  if (!value) return 's/d';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function MobileStatusPanel({ storageUsage, apiUrl }: Props) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Modo móvil / Android</h2>
        <span>{isNativeMobile() ? 'App nativa Capacitor' : 'PWA navegador'}</span>
      </div>

      <div className="summary-grid mobile-summary">
        <div><strong>{getPlatformName()}</strong><span>plataforma</span></div>
        <div className={online ? '' : 'alert'}><strong>{online ? 'online' : 'offline'}</strong><span>conectividad</span></div>
        <div><strong>{formatBytes(storageUsage.usage)}</strong><span>uso local</span></div>
        <div><strong>{storageUsage.percent ? `${storageUsage.percent.toFixed(1)}%` : 's/d'}</strong><span>cuota usada</span></div>
      </div>

      <div className="mobile-card">
        <h3>Configuración importante para Android</h3>
        <p>
          En celular físico, el backend no debe apuntar a <code>localhost</code>. Usá la IP de la PC o del servidor, por ejemplo
          <code> http://192.168.1.10:3001</code>, configurada en <code>frontend/.env</code> como <code>VITE_API_URL</code>.
        </p>
        <p><strong>API actual:</strong> {apiUrl || 'no configurada'}</p>
      </div>

      <div className="mobile-card">
        <h3>Permisos móviles previstos</h3>
        <ul>
          <li>Cámara para evidencias fotográficas.</li>
          <li>Ubicación para asociar coordenadas a la evidencia.</li>
          <li>Almacenamiento temporal para compartir reportes PDF.</li>
          <li>Conectividad para sincronizar inspecciones con el backend.</li>
        </ul>
      </div>
    </section>
  );
}
