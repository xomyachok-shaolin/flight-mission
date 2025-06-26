// utils/routeUtils.js
import fetch from 'node-fetch';
import { createCanvas, loadImage, Image } from 'canvas';
import {LRUCache} from 'lru-cache';
import pLimit from 'p-limit';
import * as turf from '@turf/turf';
import Heap from 'heap';

const TILE_SIZE = 256;
const ZOOM = 12;
const DEM_CONCURRENCY = 8;
const MAPTILER_KEY = 'UuT3bgRT2n76FjxDNq6B';

// 1) Кеш DEM-тайлов
const demCache = new LRUCache({
  max: 200,            // до 200 последних тайлов
  ttl: 1000 * 60 * 60  // чистим раз в час
});

// 2) Помощник загрузки одного DEM-тайла
async function fetchDEM(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (demCache.has(key)) return demCache.get(key);

  const url = `https://api.maptiler.com/tiles/terrain-rgb-v2/${z}/${x}/${y}.png?key=${MAPTILER_KEY}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const img = await loadImage(Buffer.from(buf));
    demCache.set(key, img);
    return img;
  } catch (err) {
    console.warn(`⚠️ DEM tile ${key} failed: ${err.message}, using flat fallback`);
    // fallback: белый тайл
    const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    const img = new Image();
    img.src = canvas.toBuffer();
    demCache.set(key, img);
    return img;
  }
}

// 3) Ограничитель одновременных fetch
const limitDEM = pLimit(DEM_CONCURRENCY);

/**
 * preloadDEM — подгружает все нужные тайлы DEM перед расчётом,
 * чтобы избежать долгих “движений” внутри цикла.
 * @param {Array<{z:number,x:number,y:number}>} tiles 
 * @returns {Promise<Image>[]} 
 */
export function preloadDEM(tiles) {
  // сразу запускаем все запросы, но с лимитом
  return tiles.map(({z,x,y}) =>
    limitDEM(() => fetchDEM(z, x, y))
  );
}

// --- методы для работы с высотой ---
function rgbToElevation(r, g, b) {
  // по спецификации MapTiler terrain-rgb
  const R = r / 255, G = g / 255, B = b / 255;
  return -10000 + (R * 256 ** 2 + G * 256 + B) * 0.1;
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const yf =
    ((1 -
      Math.log(Math.tan(lat * Math.PI/180) +
        1/Math.cos(lat * Math.PI/180)) / Math.PI) /
      2) *
    n;
  return [Math.floor(xf), Math.floor(yf), xf, yf];
}

export async function sampleElevation(lon, lat) {
  const [xTile, yTile, xFrac, yFrac] = lonLatToTile(lon, lat, ZOOM);
  const img = await limitDEM(() => fetchDEM(ZOOM, xTile, yTile));
  // внутри тайла
  const px = Math.floor((xFrac - xTile) * TILE_SIZE);
  const py = Math.floor((yFrac - yTile) * TILE_SIZE);

  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
  const { data } = ctx.getImageData(px, py, 1, 1);
  return rgbToElevation(data[0], data[1], data[2]);
}

export async function edgeCost(p1, p2, samples = 8) {
  const line = turf.lineString([p1, p2]);
  const length = turf.length(line, { units: 'meters' });
  let cost = 0;
  let prevH = await sampleElevation(p1[0], p1[1]);
  for (let i = 1; i <= samples; i++) {
    const coord = turf.along(line, (length * i)/samples, { units: 'meters' }).geometry.coordinates;
    const h = await sampleElevation(coord[0], coord[1]);
    const dh = h - prevH;
    // положительный подъём дороже, спуск чуть дешевле
    const factor = dh > 0 ? 1 + dh/10 : 1 + Math.abs(dh)/20;
    cost += (length/samples) * factor;
    prevH = h;
  }
  return cost;
}

async function dijkstra(nodes, adj, startIdx, endIdx) {
  const dist = Array(nodes.length).fill(Infinity);
  const prev = Array(nodes.length).fill(null);
  dist[startIdx] = 0;
  const heap = new Heap((a,b) => a.dist - b.dist);
  heap.push({ idx: startIdx, dist: 0 });

  while (!heap.empty()) {
    const { idx, dist: d } = heap.pop();
    if (d > dist[idx]) continue;
    if (idx === endIdx) break;
    for (const { to, weight } of adj[idx]) {
      const nd = d + weight;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = idx;
        heap.push({ idx: to, dist: nd });
      }
    }
  }

  if (!isFinite(dist[endIdx])) return null;
  // восстановить путь
  const path = [];
  for (let u = endIdx; u != null; u = prev[u]) {
    path.push(nodes[u]);
  }
  return path.reverse();
}

/**
 * computeRoute — строит оптимальный маршрут среди узлов, обходя зоны noFlyZones
 * @param {[number,number]} start 
 * @param {[number,number]} end 
 * @param {Array<Feature<Polygon>>} noFlyZones 
 * @param {number} corridorWidth 
 */
export async function computeRoute(start, end, noFlyZones = [], corridorWidth = 0) {
  // 1) Собираем узлы графа
  const nodes = [start, end];
  noFlyZones.forEach(zone =>
    zone.geometry.coordinates[0].forEach(coord => nodes.push(coord))
  );

  // 2) Предварительно подгрузим нужные тайлы DEM для всех узлов
  // (чтобы sampleElevation в edgeCost не тормозил каждый раз новый fetch)
  const needed = new Map();
  nodes.forEach(([lon, lat]) => {
    const [x, y] = lonLatToTile(lon, lat, ZOOM);
    needed.set(`${x}/${y}`, { z: ZOOM, x, y });
  });
  await Promise.all(preloadDEM(Array.from(needed.values())));

  // 3) Строим список смежности
  const adj = Array(nodes.length).fill(0).map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const line = turf.lineString([nodes[i], nodes[j]]);
      if (!noFlyZones.some(z => turf.booleanCrosses(z, line))) {
        const w = await edgeCost(nodes[i], nodes[j]);
        adj[i].push({ to: j, weight: w });
        adj[j].push({ to: i, weight: w });
      }
    }
  }

  // 4) Поиск кратчайшего пути
  const path = await dijkstra(nodes, adj, 0, 1);
  if (!path) return null;

  // 5) Возвращаем GeoJSON и длину
  const route = turf.lineString(path, { corridorWidth });
  route.properties.length_m = turf.length(route, { units: 'meters' });
  return route;
}
