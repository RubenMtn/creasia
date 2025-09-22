const path = require('path');
const fs = require('fs/promises');
const { parseICO } = require('icojs');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.join(projectRoot, 'src', 'assets', 'icons', 'facesico.ico');
const outputDir = path.join(projectRoot, 'src', 'assets', 'icons');
const outputPng = path.join(outputDir, 'favicd-512.png');
const outputIco = path.join(outputDir, 'favicd.ico');
const targetSize = 512;
const BACKGROUND_TOLERANCE = 12;

async function loadLargestIconImage(buffer) {
  const images = await parseICO(buffer);
  if (!images.length) {
    throw new Error('No se pudieron extraer imágenes del ICO de origen.');
  }
  return images.reduce((largest, current) => {
    return current.width * current.height > largest.width * largest.height ? current : largest;
  }, images[0]);
}

function collectBackgroundSamples(rawData, width, height) {
  const positions = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 }
  ];

  return positions
    .map(({ x, y }) => {
      const idx = (y * width + x) * 4;
      return rawData.slice(idx, idx + 4);
    })
    .filter(sample => sample.length === 4);
}

function withinTolerance(pixel, sample, tolerance) {
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(pixel[i] - sample[i]) > tolerance) {
      return false;
    }
  }
  return true;
}

function clearBackground(rawData, width, height, tolerance) {
  const samples = collectBackgroundSamples(rawData, width, height);
  if (!samples.length) {
    return rawData;
  }

  const result = Buffer.from(rawData);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const pixel = rawData.slice(idx, idx + 4);
      if (samples.some(sample => withinTolerance(pixel, sample, tolerance))) {
        result[idx] = 0;
        result[idx + 1] = 0;
        result[idx + 2] = 0;
        result[idx + 3] = 0;
      }
    }
  }
  return result;
}

async function generateFavicon() {
  await fs.mkdir(outputDir, { recursive: true });
  const icoBuffer = await fs.readFile(inputPath);
  const largestImage = await loadLargestIconImage(icoBuffer);
  const basePngBuffer = Buffer.from(largestImage.buffer);

  const { data, info } = await sharp(basePngBuffer)
    .resize({
      width: targetSize,
      height: targetSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const transparentData = clearBackground(data, info.width, info.height, BACKGROUND_TOLERANCE);

  const transparentPng = await sharp(transparentData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(outputPng, transparentPng);

  const icoOutBuffer = await pngToIco([transparentPng]);
  await fs.writeFile(outputIco, icoOutBuffer);
}

generateFavicon().catch((err) => {
  console.error(err);
  process.exit(1);
});

