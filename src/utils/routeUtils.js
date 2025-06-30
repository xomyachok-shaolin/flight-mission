// src/utils/routeUtils.js
const turf = require("@turf/turf");

// ──────────────────────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ
// ──────────────────────────────────────────────────────────────────────────────
const clampLat = lat => Math.max(-89.9, Math.min(89.9, lat));
const normLng  = lon => ((lon + 180) % 360) - 180;

/** возвращает true, если сегмент пересекает хотя‑бы одну из зон */
function isBlocked(seg, zones, bboxes) {
  const sb = turf.bbox(seg);
  for (let i = 0; i < zones.length; i++) {
    const zb = bboxes[i];
    if (zb[0] > sb[2] || zb[2] < sb[0] || zb[1] > sb[3] || zb[3] < sb[1]) continue;
    if (turf.booleanIntersects(seg, zones[i])) return true;
  }
  return false;
}

/** сглаживание маршрута: отбрасываем лишние вершины, если прямой отрезок свободен */
function smoothPath(coords, zones, bboxes) {
  const out = [coords[0]];
  let i = 0;
  while (i < coords.length - 1) {
    let j = coords.length - 1;
    for (; j > i + 1; j--) {
      const seg = turf.lineString([coords[i], coords[j]]);
      if (!isBlocked(seg, zones, bboxes)) break;
    }
    out.push(coords[j]);
    i = j;
  }
  return out;
}

/** добавляет узлы‑смещения вдоль нормали */
function addOffsetNodes(nodes, poly, idx, corridorW) {
  const eps = corridorW * 1.1;          // немного больше, чтобы не задевать буфер
  turf.flatten(poly).features.forEach((f, fi) => {
    const ring = turf.getCoords(f)[0];  // внешнее кольцо
    for (let vi = 0; vi < ring.length - 1; vi++) {
      const p  = turf.point(ring[vi]);
      const p2 = turf.point(ring[vi + 1]);
      const seg = turf.lineString([p.geometry.coordinates, p2.geometry.coordinates]);
      const n   = turf.lineOffset(seg, eps, { units: "meters" }).geometry.coordinates[0];
      const n2  = turf.lineOffset(seg, -eps, { units: "meters" }).geometry.coordinates[0];
      nodes.push({ id: `z${idx}_${fi}_${vi}_+`, coord: n });
      nodes.push({ id: `z${idx}_${fi}_${vi}_-`, coord: n2 });
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
function computeRoute(start, end, noFlyZones = [], corridorWidth = 0) {
  // 0) нормализация входных координат
  start = [normLng(start[0]), clampLat(start[1])];
  end   = [normLng(end[0]),   clampLat(end[1])];

  // 1) буферим зоны
  const buffered = noFlyZones.map(z => turf.buffer(z, corridorWidth, { units: "meters" }));
  const bboxes   = buffered.map(turf.bbox);

  // 2) пробуем прямую
  const direct = turf.lineString([start, end]);
  if (!isBlocked(direct, buffered, bboxes)) return direct;

  // 3) строим граф видимости
  const nodes = [
    { id: "S", coord: start },
    { id: "E", coord: end   },
  ];
  buffered.forEach((poly, idx) => addOffsetNodes(nodes, poly, idx, corridorWidth));

  const graph = Object.fromEntries(nodes.map(n => [n.id, []]));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const seg = turf.lineString([nodes[i].coord, nodes[j].coord]);
      if (!isBlocked(seg, buffered, bboxes)) {
        const d = turf.length(seg, { units: "meters" });
        graph[nodes[i].id].push({ to: nodes[j].id, cost: d });
        graph[nodes[j].id].push({ to: nodes[i].id, cost: d });
      }
    }
  }

  const heuristic = id => turf.distance(
      turf.point(nodes.find(n => n.id === id).coord),
      turf.point(end),
      { units: "meters" }
    );

  const Astar = () => {
    const open  = new Set(["S"]);
    const g     = { S: 0 };
    const f     = { S: heuristic("S") };
    const came  = {};
    while (open.size) {
      let cur = [...open].reduce((a,b)=> f[a] < f[b] ? a : b);
      if (cur === "E") {
        const path = [];
        for (let u = "E"; u; u=came[u]) path.unshift(u);
        return path.map(id => nodes.find(n => n.id === id).coord);
      }
      open.delete(cur);
      for (const {to, cost} of graph[cur]) {
        const gNew = g[cur] + cost;
        if (gNew < (g[to] ?? Infinity)) {
          came[to]=cur; g[to]=gNew; f[to]=gNew+heuristic(to); open.add(to);
        }
      }
    }
    return null;
  };

  let coords = Astar();
  if (coords) coords = smoothPath(coords, buffered, bboxes);

  // 4) fallback: A* по grid, если граф не дал результата
  if (!coords) {
    const padding = corridorWidth * 2 / 1000;  // ≈ км → °
    const [minX, minY, maxX, maxY] = turf.bbox(turf.featureCollection([
      turf.point(start), turf.point(end), ...buffered
    ]));
    const step = corridorWidth / 1000 / 111;   // широта ≈111 км на 1°
    const cols = Math.ceil((maxX - minX + 2*padding) / step);
    const rows = Math.ceil((maxY - minY + 2*padding) / step);

    // helper to map (c,r) → lon/lat
    const toLL = (c,r)=>[
      normLng(minX - padding + c*step),
      clampLat(minY - padding + r*step)
    ];

    // find indices for start/end
    const sx = Math.floor((start[0]-minX+padding)/step);
    const sy = Math.floor((start[1]-minY+padding)/step);
    const ex = Math.floor((end[0]  -minX+padding)/step);
    const ey = Math.floor((end[1]  -minY+padding)/step);

    const idx = (c,r)=>r*cols+c;
    const neigh = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    const g = {}; const f = {};
    const open = new Set([idx(sx,sy)]);
    g[idx(sx,sy)] = 0; f[idx(sx,sy)] = turf.distance(turf.point(start), turf.point(end));
    const came = {};

    while(open.size){
      let cur=[...open].reduce((a,b)=>f[a]<f[b]?a:b);
      const cx=cur%cols, cy=Math.floor(cur/cols);
      if (cx===ex && cy===ey) {
        const path=[];
        for(let u=cur;u!==undefined;u=came[u]){
          const x=u%cols,y=Math.floor(u/cols); path.unshift(toLL(x,y));
        }
        coords = smoothPath(path, buffered, bboxes);
        break;
      }
      open.delete(cur);
      for(const [dx,dy] of neigh){
        const nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>=cols||ny>=rows) continue;
        const nid=idx(nx,ny);
        const seg=turf.lineString([toLL(cx,cy),toLL(nx,ny)]);
        if(isBlocked(seg, buffered, bboxes)) continue;
        const tentative = g[cur]+turf.length(seg,{units:"meters"});
        if(tentative < (g[nid]??Infinity)){
          came[nid]=cur; g[nid]=tentative;
          f[nid]=tentative+turf.distance(turf.point(toLL(nx,ny)), turf.point(end),{units:"meters"});
          open.add(nid);
        }
      }
    }
  }

  // 5) если ничего не нашли — вернём прямую «как есть»
  return coords ? turf.lineString(coords) : direct;
}

module.exports = { computeRoute };
