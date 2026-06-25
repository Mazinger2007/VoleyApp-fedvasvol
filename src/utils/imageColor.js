import jpeg from 'jpeg-js';
import UPNG from 'upng-js';

const colorCache = new Map();

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(value / 16) * 16));
}

// Returns true if the color is too light/white to be useful as an accent
function isTooLight(r, g, b) {
  // Perceived luminance (ITU-R BT.709)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 210;
}

function rgbToHex(red, green, blue) {
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function buildBorderHistogram(rgba, width, height) {
  const histogram = new Map();
  const borderThickness = Math.max(1, Math.round(Math.min(width, height) * 0.12));

  const pushPixel = (x, y) => {
    const index = (y * width + x) * 4;
    const red = rgba[index];
    const green = rgba[index + 1];
    const blue = rgba[index + 2];
    const alpha = rgba[index + 3];
    if (alpha < 120) return;
    // Skip white/near-white pixels so they don't dominate the histogram
    if (isTooLight(red, green, blue)) return;

    const key = `${quantize(red)}-${quantize(green)}-${quantize(blue)}`;
    histogram.set(key, (histogram.get(key) || 0) + 1);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isTop = y < borderThickness;
      const isBottom = y >= height - borderThickness;
      const isLeft = x < borderThickness;
      const isRight = x >= width - borderThickness;
      if (isTop || isBottom || isLeft || isRight) pushPixel(x, y);
    }
  }

  return histogram;
}

function pickDominantFromHistogram(histogram) {
  let winningKey = null;
  let winningCount = -1;

  for (const [key, count] of histogram.entries()) {
    if (count > winningCount) {
      winningCount = count;
      winningKey = key;
    }
  }

  if (!winningKey) return null;

  const [red, green, blue] = winningKey.split('-').map(Number);
  const hex = rgbToHex(red, green, blue);
  // Final safety check: don't return very light colors
  if (isTooLight(red, green, blue)) return null;
  return hex;
}

function isPng(buffer) {
  if (!buffer || buffer.length < 8) return false;
  return buffer[0] === 137
    && buffer[1] === 80
    && buffer[2] === 78
    && buffer[3] === 71;
}

function decodeToRgba(uint8) {
  if (isPng(uint8)) {
    const png = UPNG.decode(uint8.buffer);
    const frames = UPNG.toRGBA8(png);
    const frame = frames?.[0] || null;
    if (!frame) return null;
    return {
      rgba: new Uint8Array(frame),
      width: png.width,
      height: png.height,
    };
  }

  const jpegDecoded = jpeg.decode(uint8, { useTArray: true, formatAsRGBA: true });
  if (!jpegDecoded?.data || !jpegDecoded?.width || !jpegDecoded?.height) return null;
  return {
    rgba: jpegDecoded.data,
    width: jpegDecoded.width,
    height: jpegDecoded.height,
  };
}

export async function getDominantBorderColor(imageUrl) {
  if (!imageUrl) return null;
  if (colorCache.has(imageUrl)) return colorCache.get(imageUrl);
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const decoded = decodeToRgba(uint8);
    if (!decoded) {
      colorCache.set(imageUrl, null);
      return null;
    }

    const histogram = buildBorderHistogram(decoded.rgba, decoded.width, decoded.height);
    const color = pickDominantFromHistogram(histogram);
    colorCache.set(imageUrl, color);
    return color;
  } catch (_) {
    colorCache.set(imageUrl, null);
    return null;
  }
}
