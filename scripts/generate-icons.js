import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');

async function ensureDir() {
  await fs.promises.mkdir(iconsDir, { recursive: true });
}

async function renderSvgToPng(src, width, height, output) {
  await sharp(path.join(iconsDir, src))
    .resize(width, height)
    .png()
    .toFile(path.join(iconsDir, output));
}

(async () => {
  try {
    await ensureDir();
    await renderSvgToPng('icon-dark.svg', 192, 192, 'icon-192.png');
    await renderSvgToPng('icon-dark.svg', 512, 512, 'icon-512.png');
    await renderSvgToPng('icon-maskable.svg', 512, 512, 'icon-maskable-512.png');
    await renderSvgToPng('icon-dark.svg', 180, 180, 'apple-touch-icon.png');
    console.log('Generated icon PNGs in public/icons');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
