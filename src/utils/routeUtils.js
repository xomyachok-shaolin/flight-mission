// src/utils/routeUtils.js

import Heap from "heap";
import * as turf from "@turf/turf";
import { getElevation } from "./terrain.js";

/**
 * Рекурсивно “деденсифицирует” отрезок [a → b],
 * дробя его только там, где уклон превышает thresholdSlope.
 *
 * @param {[number,number]} a               — координаты начала отрезка
 * @param {[number,number]} b               — координаты конца отрезка
 * @param {number} thresholdSlope           — допустимый уклон (вертикальный перепад / горизонталь)
 * @param {number} depth                    — текущая глубина рекурсии
 * @param {number} maxDepth                 — максимальная глубина рекурсии
 * @param {Array<[number,number]>} out      — выходной массив точек (добавляем a)
 */
async function subdivideIfSteep(a, b, thresholdSlope, depth, maxDepth, out) {
  // если достигли максимальной глубины — просто добавляем a
  if (depth >= maxDepth) {
    out.push(a);
    return;
  }

  const [ax, ay] = a;
  const [bx, by] = b;
  // середина отрезка
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;

  // параллельно запускаем загрузку высот
  const [ha, hb, hm] = await Promise.all([
    getElevation(ax, ay),
    getElevation(bx, by),
    getElevation(mx, my),
  ]);

  // если не удалось получить высоту — добавляем a и не дробим
  if (ha == null || hb == null || hm == null) {
    out.push(a);
    return;
  }

  // расстояние по горизонтали между a и b (в метрах)
  const horDist = turf.distance(turf.point(a), turf.point(b), { units: "meters" });
  // вертикальная разница
  const verDiff = Math.abs(ha - hb);
  // уклон
  const slope = verDiff / horDist;

  if (slope > thresholdSlope) {
    // слишком круто — дробим пополам и проверяем каждую часть
    await subdivideIfSteep(a, [mx, my], thresholdSlope, depth + 1, maxDepth, out);
    await subdivideIfSteep([mx, my], b, thresholdSlope, depth + 1, maxDepth, out);
  } else {
    // участок спокойный — оставляем точку a
    out.push(a);
  }
}

/**
 * Адаптивная дробление прямой линии: возвращает LineString,
 * в котором точки вставлены только там, где круто.
 *
 * @param {Feature<LineString>} straight        — исходная прямая линия (два узла)
 * @param {number} thresholdSlope               — максимальный уклон в отрезке
 * @param {number} maxDepth                     — максимальная глубина рекурсии дробления
 * @returns {Promise<Feature<LineString>>}
 */
export async function densifyAdaptive(straight, thresholdSlope = 0.1, maxDepth = 5) {
  const coords = straight.geometry.coordinates;
  const out = [];
  // Для каждого парного отрезка coords[i] → coords[i+1]
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    await subdivideIfSteep(a, b, thresholdSlope, 0, maxDepth, out);
  }
  // Добавляем последний узел
  out.push(coords[coords.length - 1]);
  return turf.lineString(out);
}

/**
 * Основная функция: прокладывает маршрут A* по сетке с учётом рельефа,
 * но **сначала** делает адаптивную проверку прямой (и адаптивно дробит её).
 *
 * @param {[number,number]} start               — [lon, lat] начала
 * @param {[number,number]} end                 — [lon, lat] конца
 * @param {Feature<Polygon>[]} noFlyZones       — зоны запрета полётов
 * @param {Object} options                      — параметры:
 *    baseStep: number                        — минимальный шаг сетки в м (default 50)
 *    maxAltMargin: number                    — запас по высоте в м (default 200)
 *    straightSlopeThreshold: number          — порог уклона для дробления прямой (default 0.1)
 *    straightMaxDepth: number                — max глубина дробления прямой (default 5)
 *    doAdaptiveDensify: boolean              — включить адаптивную дробь прямой (default true)
 *    maxAltitude: number                     — абсолютный потолок БПЛА (override)
 * @returns {Promise<Feature<LineString> | null>}
 */
export async function computeRoute(
  start,
  end,
  noFlyZones = [],
  options = {}
) {
  const {
    baseStep = 50,
    maxAltMargin = 200,
    straightSlopeThreshold = 0.1,
    straightMaxDepth = 5,
    doAdaptiveDensify = true,
    maxAltitude = Infinity,
    // далее параметры для A* — оставляем ваши старые
  } = options;

  // 1) Исходная прямая и её длина
  const straight = turf.lineString([start, end]);
  const straightDist = turf.length(straight, { units: "meters" });

  // 2) Вычисляем фактический шаг сетки (метр → градус) + потолок
  const gridStep = Math.min(200, Math.max(baseStep, straightDist / 100));
  const [sx, sy] = start;
  const [ex, ey] = end;
  // высоты концов
  const [startZ, endZ] = await Promise.all([
    getElevation(sx, sy),
    getElevation(ex, ey),
  ]);
  if (startZ == null || endZ == null) {
    console.warn("Не удалось получить высоты концов — возврат null");
    return null;
  }
  const peakAlt = Math.max(startZ, endZ) + maxAltMargin;
  const ceilingAlt = Math.min(maxAltitude, peakAlt);

  // 3) Быстрая проверка прямой: noFly + потолок
  let straightOK = turf.booleanDisjoint(straight, turf.featureCollection(noFlyZones));
  if (straightOK) {
    // проверяем несколько точек вдоль прямой по высоте
    const samples = 10;
    for (let i = 0; i <= samples; i++) {
      const coord = turf.along(straight, (straightDist * i) / samples, { units: "meters" })
        .geometry.coordinates;
      const h = await getElevation(coord[0], coord[1]);
      if (h == null || h > ceilingAlt) {
        straightOK = false;
        break;
      }
    }
  }

  if (straightOK) {
    // прямая безопасна
    if (doAdaptiveDensify) {
      // возвращаем адаптивно дробленную линию
      return await densifyAdaptive(straight, straightSlopeThreshold, straightMaxDepth);
    } else {
      return straight;
    }
  }

  // 4) Если прямая не проходит — запускаем ваш A* (вставьте здесь вашу реализацию).
  // Пример заглушки:
  // const path = await yourAstargorithm(start, end, noFlyZones, ceilingAlt, gridStep);
  // if (path) return turf.lineString(path);
  // else return null;

  console.warn("Прямая не прошла проверку, но A* ещё не реализован.");
  return null;
}
