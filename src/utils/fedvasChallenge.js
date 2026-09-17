// Resolución del challenge anti-bot "Comprobando tu navegador" de fedvasvol.com.
// El servidor responde 429 con un HTML que incluye RETO/FIRMA/SEMILLA/BITS.
// Hay que encontrar un nonce tal que sha256(SEMILLA + nonce) empiece por BITS
// bits a cero y después validarlo con una petición ?_pow_r&_pow_f&_pow_n.
import axios from 'axios';
import { requestAnimationFrame } from 'react-native';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── SHA-256 (JS puro, compatible con Hermes/React Native) ──────────────────
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

function utf8Bytes(str) {
  const res = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) {
      res.push(c);
    } else if (c < 2048) {
      res.push(192 | (c >> 6), 128 | (c & 63));
    } else {
      res.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
  }
  return res;
}

// SHA-256 de un string; devuelve Uint32Array con los 8 primeros words del hash.
function sha256State(text) {
  const bytes = utf8Bytes(text);
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(
    0, 0, 0, 0,
    (bitLen >>> 24) & 255,
    (bitLen >>> 16) & 255,
    (bitLen >>> 8) & 255,
    bitLen & 255
  );

  const h = new Uint32Array(H0);
  const w = new Uint32Array(64);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] =
        (bytes[i + j * 4] << 24) |
        (bytes[i + j * 4 + 1] << 16) |
        (bytes[i + j * 4 + 2] << 8) |
        bytes[i + j * 4 + 3];
    }

    for (let j = 16; j < 64; j++) {
      const s0 =
        ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
        ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
        (w[j - 15] >>> 3);
      const s1 =
        ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
        ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
        (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h[0], b = h[1], cc = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];

    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[j] + w[j]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & cc) ^ (b & cc);
      const t2 = (S0 + maj) | 0;

      hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
    }

    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + cc) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }

  return h;
}

function firstBitsAreZero(h, bits) {
  if (bits <= 32) return (h[0] >>> (32 - bits)) === 0;
  return h[0] === 0 && (h[1] >>> (64 - bits)) === 0;
}

// ─── Extracción del reto del HTML ────────────────────────────────────────────
export function extractChallenge(html = '') {
  const text = typeof html === 'string' ? html : String(html || '');
  const match = text.match(
    /var RETO = '([^']*)', FIRMA = '([^']*)', SEMILLA = '([^']*)', BITS = (\d+);/
  );
  if (!match) return null;
  return { reto: match[1], firma: match[2], semilla: match[3], bits: Number(match[4]) };
}

export function isChallengePage(html = '') {
  const text = typeof html === 'string' ? html : String(html || '');
  return (
    /Comprobando tu navegador/i.test(text) &&
    /_pow_r|var RETO/i.test(text)
  );
}

// Busca el nonce dejando que la UI respire (troceado en bloques).
// Optimizado para Hermes: hash de bloque único con buffers preasignados
// (la semilla tiene ≤ 64-8 bytes y el nonce cabe en 7 dígitos), lo que evita
// el CreateObject/allocaciones por iteración de la versión genérica.
export async function solveNonce(semilla, bits, { chunkSize = 25000, shouldContinue = () => true } = {}) {
  // Esperar a que la transición/animación en curso respire antes de empezar
  // el trabajo pesado (varios frames), para que la navegación no se congele.
  await new Promise((resolve) => {
    let frames = 0;
    const step = () => {
      frames += 1;
      if (frames >= 3) {
        setTimeout(resolve, 0);
        return;
      }
      try {
        requestAnimationFrame(step);
      } catch {
        setTimeout(resolve, 32);
      }
    };
    step();
  });

  const objetivo = Math.pow(2, bits);
  const nonceMax = Math.ceil(objetivo * 4);

  // Casos no cubiertos por la vía rápida (bloque único ≤ 55 bytes, bits ≤ 32):
  // usar la implementación genérica.
  const semillaLen = utf8Bytes(semilla).length;
  const fastPath = semillaLen <= 55 && bits <= 32;

  // Buffers preasignados (fuera del bucle caliente)
  const W = new Uint32Array(64);
  const h = new Uint32Array(8);
  const bytes = new Uint8Array(64);
  const semillaBytes = [];
  for (let i = 0; i < semilla.length; i++) {
    const c = semilla.charCodeAt(i);
    if (c < 128) semillaBytes.push(c);
    else if (c < 2048) semillaBytes.push(192 | (c >> 6), 128 | (c & 63));
    else semillaBytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  const baseLen = semillaBytes.length;
  const nonceBuf = [];

  let nonce = 0;

  if (!fastPath) {
    for (; nonce < nonceMax; nonce++) {
      const hh = sha256State(semilla + nonce);
      if (firstBitsAreZero(hh, bits)) return nonce;
      if (nonce % chunkSize === chunkSize - 1) {
        if (!shouldContinue()) throw new Error('Búsqueda de nonce cancelada');
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    throw new Error('No se pudo resolver el reto de fedvasvol');
  }

  for (; nonce < nonceMax; nonce++) {
    // Serializar nonce en bytes ASCII (sin crear strings)
    nonceBuf.length = 0;
    let v = nonce;
    do {
      nonceBuf.push(48 + (v % 10));
      v = (v / 10) | 0;
    } while (v > 0);
    const totalLen = baseLen + nonceBuf.length;

    // Construir bloque único con padding SHA-256 (dígitos del nonce en orden)
    bytes.fill(0);
    for (let i = 0; i < baseLen; i++) bytes[i] = semillaBytes[i];
    for (let i = 0; i < nonceBuf.length; i++) bytes[baseLen + i] = nonceBuf[nonceBuf.length - 1 - i];
    bytes[totalLen] = 0x80;
    const bitLen = totalLen * 8;
    bytes[62] = (bitLen >>> 8) & 255;
    bytes[63] = bitLen & 255;

    // Compresión SHA-256 inline (un solo bloque)
    for (let j = 0; j < 16; j++) {
      const o = j * 4;
      W[j] = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    }
    for (let j = 16; j < 64; j++) {
      const x = W[j - 15];
      const y = W[j - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
    }

    let a = H0[0], b = H0[1], cc = H0[2], d = H0[3], e = H0[4], f = H0[5], g = H0[6], hh = H0[7];
    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[j] + W[j]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & cc) ^ (b & cc);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
    }

    h[0] = (H0[0] + a) | 0;
    h[1] = (H0[1] + b) | 0;
    h[2] = (H0[2] + cc) | 0;
    h[3] = (H0[3] + d) | 0;
    h[4] = (H0[4] + e) | 0;
    h[5] = (H0[5] + f) | 0;
    h[6] = (H0[6] + g) | 0;
    h[7] = (H0[7] + hh) | 0;

    // bits ≤ 32: basta con h[0]
    if ((h[0] >>> (32 - bits)) === 0) return nonce;

    if (nonce % chunkSize === chunkSize - 1) {
      if (!shouldContinue()) throw new Error('Búsqueda de nonce cancelada');
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw new Error('No se pudo resolver el reto de fedvasvol');
}

// Valida el nonce ante el servidor y devuelve las cookies de sesión resultantes.
export async function validateChallenge(url, { reto, firma, nonce }, { signal } = {}) {
  const separator = url.includes('?') ? '&' : '?';
  const powUrl =
    `${url}${separator}_pow_r=${encodeURIComponent(reto)}` +
    `&_pow_f=${encodeURIComponent(firma)}` +
    `&_pow_n=${encodeURIComponent(nonce)}`;

  const response = await axios.get(powUrl, {
    timeout: 20000,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    validateStatus: (status) => status === 204 || status === 200,
    signal,
  });

  const cookieHeader = (response.headers?.['set-cookie'] || [])
    .map((item) => String(item || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  return { validated: response.status === 204, cookieHeader };
}