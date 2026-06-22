import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// SVG design for the AVATAR icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="#030a14"/>
  <!-- Decorative water flow ring -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="url(#waterGrad)" stroke-width="3" opacity="0.3"/>
  <!-- Defs -->
  <defs>
    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="50%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <!-- AVATAR "A" letterform -->
  <path d="M256 100 L370 380 L320 380 L290 300 L222 300 L192 380 L142 380 Z M256 180 L240 260 L272 260 Z" fill="url(#iconGrad)"/>
  <!-- Circuit dots -->
  <circle cx="180" cy="200" r="6" fill="#10b981" opacity="0.6"/>
  <circle cx="332" cy="200" r="6" fill="#0ea5e9" opacity="0.6"/>
  <circle cx="150" cy="320" r="4" fill="#10b981" opacity="0.4"/>
  <circle cx="362" cy="320" r="4" fill="#0ea5e9" opacity="0.4"/>
  <!-- Connection lines -->
  <line x1="186" y1="200" x2="230" y2="250" stroke="#10b981" stroke-width="1.5" opacity="0.3"/>
  <line x1="326" y1="200" x2="282" y2="250" stroke="#0ea5e9" stroke-width="1.5" opacity="0.3"/>
</svg>`;

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating PWA icons...');

  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);

    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Generated icon-${size}.png (${size}x${size})`);
  }

  // Also generate a favicon.ico (32x32) for convenience
  const faviconPath = path.join(OUTPUT_DIR, '..', 'favicon.ico');
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'));

  console.log('  ✓ Generated favicon.png (32x32)');
  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
