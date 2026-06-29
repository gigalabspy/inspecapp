import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatformName(): string {
  return Capacitor.getPlatform();
}

export async function getCurrentPositionSafe(): Promise<{ latitud?: number; longitud?: number }> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000
    });
    return {
      latitud: position.coords.latitude,
      longitud: position.coords.longitude
    };
  } catch {
    return {};
  }
}

export async function takePhotoWithNativeCamera(): Promise<{ dataUrl: string; fileName: string; latitud?: number; longitud?: number } | null> {
  if (!isNativeMobile()) return null;

  const [photo, position] = await Promise.all([
    Camera.getPhoto({
      quality: 78,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true,
      promptLabelHeader: 'Evidencia InspecAPP',
      promptLabelPhoto: 'Tomar foto',
      promptLabelPicture: 'Galería'
    }),
    getCurrentPositionSafe()
  ]);

  if (!photo.dataUrl) return null;

  const safeTime = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = photo.format || 'jpeg';

  return {
    dataUrl: photo.dataUrl,
    fileName: `evidencia-${safeTime}.${ext}`,
    ...position
  };
}

export async function saveBlobForShare(blob: Blob, fileName: string): Promise<string | null> {
  if (!isNativeMobile()) return null;

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const saved = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache
  });

  return saved.uri;
}

export async function shareFileUri(fileUri: string, title = 'InspecAPP'): Promise<void> {
  if (!isNativeMobile()) return;
  await Share.share({
    title,
    text: 'Reporte generado desde InspecAPP',
    url: fileUri,
    dialogTitle: 'Compartir reporte'
  });
}
