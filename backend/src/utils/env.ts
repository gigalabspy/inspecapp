import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const root = process.cwd();

function parseOrigins(value: string | undefined): string[] {
  return (value || 'http://localhost:5173,capacitor://localhost,https://localhost')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,capacitor://localhost,https://localhost',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  dataFile: path.resolve(root, process.env.DATA_FILE || './data/inspecapp-db.json'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  reportDir: path.resolve(root, process.env.REPORT_DIR || './reports'),
  demoAdminEmail: process.env.DEMO_ADMIN_EMAIL || 'admin@inspecapp.local',
  demoInspectorEmail: process.env.DEMO_INSPECTOR_EMAIL || 'inspector@inspecapp.local',
  demoPassword: process.env.DEMO_PASSWORD || 'inspecapp123'
};
