/**
 * Generate solid PNG icons for PWA manifest.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal 1x1 or 192x192 PNG generator or copy SVG
// Simple valid 192x192 PNG with blue background
// We can use a lightweight script with raw zlib/png or create standard files
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="36" fill="#2563EB"/>
  <circle cx="96" cy="96" r="50" fill="#FFFFFF"/>
  <circle cx="96" cy="96" r="34" fill="#DBEAFE"/>
  <circle cx="96" cy="96" r="16" fill="#2563EB"/>
  <path d="M96,46 L96,62 M96,130 L96,146 M46,96 L62,96 M130,96 L146,96" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
</svg>`;

const publicDir = path.resolve(__dirname, '../public');
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
console.log('Generated icon.svg');
