import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const COMPANY = {
  name: 'GigaLabs',
  email: 'info@gigalabs.com.py',
  address: 'Asunci\u00f3n, Paraguay',
  phone: '021-223344',
  website: 'www.gigalabs.com.py'
};

const LOGO_CANDIDATES = [
  { file: path.resolve(currentDir, '../../assets/logo-gigalabs.png'), mime: 'image/png' },
  { file: path.resolve(currentDir, '../../assets/logo-gigalabs.jpg'), mime: 'image/jpeg' },
  { file: path.resolve(currentDir, '../../assets/logo-gigalabs.jpeg'), mime: 'image/jpeg' }
];

export function getLogoBuffer(): Buffer | null {
  for (const candidate of LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(candidate.file)) return fs.readFileSync(candidate.file);
    } catch {
      // sin logo: el reporte sale igual
    }
  }
  return null;
}

export function getLogoDataUrl(): string | null {
  for (const candidate of LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(candidate.file)) {
        const base64 = fs.readFileSync(candidate.file).toString('base64');
        return `data:${candidate.mime};base64,${base64}`;
      }
    } catch {
      // sin logo: el reporte sale igual
    }
  }
  return null;
}
