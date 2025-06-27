// src/utils/terrain.js
import fetch from 'node-fetch';
import { LRUCache } from 'lru-cache';
import sharp from 'sharp';
import PQueue from 'p-queue';

const TILE_URL =
  'https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key={key}';
const CACHE = new LRUCache({ max: 500, ttl: 1000*60*60 });
const queue = new PQueue({ concurrency: 10 });

async function fetchTileData(z, x, y) {
  const apiKey = process.env.MAPTILER_KEY;
  if (!apiKey) throw new Error('MAPTILER_KEY не задан');

  const url = TILE_URL
    .replace('{z}', z)
    .replace('{x}', x)
    .replace('{y}', y)
    .replace('{key}', apiKey);

  // 3 попытки с backoff
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { timeout: 5000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const webpBuf = Buffer.from(await res.arrayBuffer());
      // получаем сразу raw-буфер RGBA 256×256
      const { data, info } = await sharp(webpBuf)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 100 * 2 ** i));
    }
  }
  throw lastErr;
}

async function fetchTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (CACHE.has(key)) return CACHE.get(key);
  try {
    const tile = await queue.add(() => fetchTileData(z, x, y));
    CACHE.set(key, tile);
    return tile;
  } catch (err) {
    console.warn(`fetchTile ${z}/${x}/${y} failed: ${err.message}`);
    return null;
  }
}

/**
 * Возвращает elevation (м) или null.
 */
export async function getElevation(lon, lat, zoom = 12) {
  const xt = ((lon + 180) / 360) * 2 ** zoom;
  const yt =
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    2 ** zoom;

  const tx = Math.floor(xt),
    ty = Math.floor(yt);
  const px = Math.floor((xt - tx) * 256),
    py = Math.floor((yt - ty) * 256);

  const tile = await fetchTile(zoom, tx, ty);
  if (!tile) return null;

  // в raw-буфере RGBA: 4 байта на пиксель
  const idx = (py * tile.width + px) * 4;
  const R = tile.data[idx], G = tile.data[idx + 1], B = tile.data[idx + 2];

  return -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
}
