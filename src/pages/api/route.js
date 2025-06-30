// src/pages/api/route.js
import { computeRoute } from '../../utils/routeUtils.js';
import * as turf from '@turf/turf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { start, end, noFlyZones = [], corridorWidth = 0 } = req.body;
    console.log("← API /api/route body:", req.body);
    const route = computeRoute(start, end, noFlyZones, corridorWidth);
    console.log("← API computeRoute result coords:", route ? route.geometry.coordinates : null);
    if (!route) {
      return res.status(404).json({ error: 'Маршрут не найден' });
    }
    const corridor = turf.buffer(route, corridorWidth, { units: 'meters' });
    return res.status(200).json({ route, corridor });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
