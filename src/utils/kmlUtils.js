// src/utils/kmlUtils.js
import * as turf from "@turf/turf";

const TILE_SIZE = 256;
const ZOOM = 12;
const API_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Браузерная выборка одной высоты AMSL из terrain-rgb тайла MapTiler
 * @param {number} lon 
 * @param {number} lat 
 * @returns {Promise<number>} высота в метрах
 */
async function sampleElevationBrowser(lon, lat) {
  const n = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * n;
  const y =
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
        1 / Math.cos((lat * Math.PI) / 180)
      ) /
      Math.PI) /
      2) *
    n;
  const tileX = Math.floor(x), tileY = Math.floor(y);
  const px = Math.floor((x - tileX) * TILE_SIZE),
    py = Math.floor((y - tileY) * TILE_SIZE);

  const url = `https://api.maptiler.com/tiles/terrain-rgb-v2/${ZOOM}/${tileX}/${tileY}.webp?key=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`DEM fetch failed: ${resp.status}`);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(px, py, 1, 1);
  const [R, G, B] = data;
  // спецификация terrain-rgb → высота
  return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
}

function isLatLonArray([a,b]) {
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 && Math.abs(b) > 90;
}

/**
 * @param {Feature<LineString>} route
 * @param {object} options
 * @param {number} options.relAlt       — относительная высота (м)
 * @param {boolean} options.swapLatLon  — выдавать в KML {lat,lon,alt} вместо {lon,lat,alt}
 */
export async function routeToKml(
  route,
  { relAlt = 50, swapLatLon = false } = {}
) {
  let coords = route?.geometry?.coordinates;
  if (!coords?.length) throw new Error('Маршрут пуст');

  // coords = coords.map(([maybeLon, maybeLat]) => [ maybeLat, maybeLon ]);

  // Высота для первой точки
  const baseAmsl = Math.round(
    await sampleElevationBrowser(coords[0][0], coords[0][1])
  );

  // Тэги точек
  const waypoints = coords.map((c, i) => {
    const amsl = i === 0 ? baseAmsl : baseAmsl + relAlt;
    const descr = [
      `Index: ${i}`,
      'Waypoint',
      `Alt AMSL: ${amsl.toFixed(2)} m`,
      `Alt Rel: ${(i === 0 ? 0 : relAlt).toFixed(2)} m`,
      `Lat: ${c[1].toFixed(7)}`,
      `Lon: ${c[0].toFixed(7)}`
    ].join('\n');

    // Действительная координата в KML
    const [k0, k1] = swapLatLon ? [c[1], c[0]] : [c[0], c[1]];
    return /* xml */`
   <Placemark>
    <name>${i} </name>
    <styleUrl>#BalloonStyle</styleUrl>
    <description><![CDATA[${descr}]]></description>
    <Point>
     <altitudeMode>absolute</altitudeMode>
     <coordinates>${k0.toFixed(7)},${k1.toFixed(7)},${amsl.toFixed(2)}</coordinates>
     <extrude>1</extrude>
    </Point>
   </Placemark>`;
  }).join('\n');

  // Координаты линии
  const lineCoords = coords
    .map((c, i) => {
      const amsl = i === 0 ? baseAmsl : baseAmsl + relAlt;
      const [k0,k1] = swapLatLon ? [c[1], c[0]] : [c[0], c[1]];
      return `${k0.toFixed(7)},${k1.toFixed(7)},${amsl.toFixed(2)}`;
    })
    .join('\n');

  // Центроид для LookAt
  const center = turf.center(route).geometry.coordinates; // [lon,lat]
  const [clon, clat] = center;

  return /* xml */`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
 <Document>
  <name>QGroundControl Plan KML</name>
  <open>1</open>
  <Style id="BalloonStyle"><BalloonStyle><text>$[description]</text></BalloonStyle></Style>
  <Style id="MissionLineStyle"><LineStyle><color>ff1c78be</color><width>4</width></LineStyle></Style>
  <LookAt>
    <latitude>${clat.toFixed(7)}</latitude>
    <longitude>${clon.toFixed(7)}</longitude>
    <altitude>0</altitude>
    <heading>0</heading>
    <tilt>0</tilt>
    <range>10000</range>
  </LookAt>
  <Folder>
   <name>Items</name>
${waypoints}
  </Folder>
  <Placemark>
   <styleUrl>#MissionLineStyle</styleUrl>
   <name>Flight Path</name>
   <visibility>1</visibility>
   <LineString>
    <extrude>1</extrude>
    <tessellate>1</tessellate>
    <altitudeMode>absolute</altitudeMode>
    <coordinates>
${lineCoords}
    </coordinates>
   </LineString>
  </Placemark>
 </Document>
</kml>`;
}

/** Скачивание */
export async function downloadKml(route, opts) {
  const kml = await routeToKml(route, opts);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'testMission.kml';
  a.click();
  URL.revokeObjectURL(url);
}
