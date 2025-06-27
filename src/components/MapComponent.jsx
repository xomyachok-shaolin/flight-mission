// src/components/MapComponent.jsx
import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

import { Card, Button, Space, InputNumber } from "antd";
import * as turf from "@turf/turf";

// ====================== CrosshairManager ======================
class CrosshairManager {
  constructor(map) {
    this.map = map;
    this.svgCanvas = null;
    this.xLine = null;
    this.yLine = null;
    this.width = 0;
    this.height = 0;
  }
  create() {
    if (!this.map) return;
    this.width = this.map.getCanvas().clientWidth;
    this.height = this.map.getCanvas().clientHeight;
    this.map.on("resize", this.onResize);
    this._draw();
  }
  destroy() {
    this.map.off("resize", this.onResize);
    this.svgCanvas?.remove();
    this.svgCanvas = null;
  }
  onResize = () => {
    if (!this.map) return;
    this.width = this.map.getCanvas().clientWidth;
    this.height = this.map.getCanvas().clientHeight;
    this.svgCanvas.setAttribute("width", this.width);
    this.svgCanvas.setAttribute("height", this.height);
    const cx = this.width / 2,
      cy = this.height / 2;
    this.xLine.setAttribute("x2", this.width);
    this.xLine.setAttribute("y1", cy);
    this.xLine.setAttribute("y2", cy);
    this.yLine.setAttribute("x1", cx);
    this.yLine.setAttribute("y2", this.height);
  };
  _draw() {
    const container = this.map.getCanvasContainer();
    this.svgCanvas = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    Object.assign(this.svgCanvas.style, {
      position: "absolute",
      top: 0,
      left: 0,
    });
    this.svgCanvas.setAttribute("width", this.width);
    this.svgCanvas.setAttribute("height", this.height);

    const cx = this.width / 2,
      cy = this.height / 2;
    this.yLine = this._makeLine(cx, 0, cx, this.height);
    this.xLine = this._makeLine(0, cy, this.width, cy);

    this.svgCanvas.append(this.yLine, this.xLine);
    container.appendChild(this.svgCanvas);
  }
  _makeLine(x1, y1, x2, y2) {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", x1);
    l.setAttribute("y1", y1);
    l.setAttribute("x2", x2);
    l.setAttribute("y2", y2);
    l.setAttribute("stroke", "#111");
    l.setAttribute("stroke-dasharray", "4,4");
    l.setAttribute("stroke-width", "2");
    return l;
  }
}

// ====================== RouteControl ======================
class RouteControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this._button = document.createElement("button");
    Object.assign(this._button.style, {
      width: 20,
      height: 20,
      background:
        'url(\'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M487.663,282.767c-32.447-32.447-85.054-32.447-117.501,0c-26.833,26.833-32.076,68.438-12.738,101.089l53.549,90.417H105.657c-26.329,0-47.749-21.421-47.749-47.75c0-26.329,21.42-47.749,47.749-47.749h143.589c42.871,0,77.749-34.878,77.749-77.749c0-42.871-34.878-77.749-77.749-77.749H101.027l53.549-90.416c19.338-32.651,14.095-74.256-12.738-101.089c-32.447-32.447-85.054-32.447-117.501,0C-2.496,58.603-7.739,100.208,11.599,132.859l71.489,120.708l0.172-0.291h165.986c26.329,0,47.749,21.42,47.749,47.749c0,26.329-21.42,47.749-47.749,47.749H105.657c-42.871,0-77.749,34.878-77.749,77.749c0,42.871,34.878,77.75,77.749,77.75H428.74l0.172,0.291l71.489-120.707C519.739,351.205,514.496,309.6,487.663,282.767z"/></svg>\') no-repeat center /90%',
      border: "none",
      cursor: "pointer",
      borderRadius: 4,
      margin: 5,
    });
    this._button.title = "Управление маршрутом";
    this._container.appendChild(this._button);
    return this._container;
  }
  onRemove() {
    this._container.remove();
    this._map = undefined;
  }
  getDefaultPosition() {
    return "top-right";
  }
  getButtonElement() {
    return this._button;
  }
}

// ====================== MapComponent ======================
export default function MapComponent() {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);

  const geomanRef = useRef(null);
  const routeGmIdRef = useRef(null);

  // temp/frozen coords
  const [tempStart, setTempStart] = useState(null);
  const [frozenStart, setFrozenStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);
  const [frozenEnd, setFrozenEnd] = useState(null);

  // markers
  const startMark = useRef(null);
  const tempEndMark = useRef(null);
  const endMark = useRef(null);

  // route + corridor + settings
  const [routeFeature, setRouteFeature] = useState(null);
  const [corridorFeature, setCorridorFeature] = useState(null);
  const [corridorWidth, setCorridorWidth] = useState(50);
  const [noFlyZones, setNoFlyZones] = useState([]);

  // panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelStep, setPanelStep] = useState(null);
  const panelRef = useRef(null);

  const routeBtnRef = useRef(null);
  const isDragging = useRef(false);
  const crosshairRef = useRef(null);

  // Внутри MapComponent, после всех рефов:
const startGeomanEdit = () => {
  const gm = geomanRef.current;
  if (!gm || !routeFeature) return;
  // Очистим старую
  if (routeGmIdRef.current) {
    gm.features.delete(routeGmIdRef.current);
    routeGmIdRef.current = null;
    gm.disableGlobalEditMode();
  }
  // Импортируем новую
  const fd = gm.features.importGeoJsonFeature({
    ...routeFeature,
    properties: { ...(routeFeature.properties||{}), shape: "line" },
  });
  routeGmIdRef.current = fd.id;
  gm.enableGlobalEditMode();
};

const stopGeomanEdit = () => {
  const gm = geomanRef.current;
  if (!gm || !routeGmIdRef.current) return;
  gm.features.delete(routeGmIdRef.current);
  routeGmIdRef.current = null;
  gm.disableGlobalEditMode();
};


  // ─── INIT MAP & GEOMAN ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=UuT3bgRT2n76FjxDNq6B",
            ],
            tileSize: 512,
          },
        },
        layers: [{ id: "sat", type: "raster", source: "satellite" }],
      },
      center: [71.7143, 39.7641],
      zoom: 13.3,
      pitch: 45,
      bearing: 20,
      projection: "mercator",
      maxPitch: 60,
    });
    mapRef.current = map;

    const geoman = new Geoman(map, {
      settings: { controlsPosition: "top-right" },
      layerStyles: {
        polygon: {
          gm_main: [{ type: "fill", paint: { "fill-color": "#f00", "fill-opacity": 0.3, "fill-outline-color": "#f00" } }],
        },
        line: {
          gm_main: [{ type: "line", paint: { "line-color": "#00f", "line-width": 4 } }],
        },
        circle: {
          gm_main: [{ type: "fill", paint: { "fill-color": "#f00", "fill-opacity": 0.3, "fill-outline-color": "#f00" } }],
        },
        rectangle: {
          gm_main: [{ type: "fill", paint: { "fill-color": "#f00", "fill-opacity": 0.3, "fill-outline-color": "#f00" } }],
        },
      },
    });
    geomanRef.current = geoman;

    map.on("pm:create", (e) => {
      if (e.geometry?.type === "Polygon") {
        setNoFlyZones((zs) => [...zs, { type: "Feature", geometry: e.geometry, properties: {} }]);
      }
    });

    map.on("load", () => {
      // route source/layer
      map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: null } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-width": 4, "line-color": "#00f" } });

      // corridor
      map.addSource("corridor", { type: "geojson", data: { type: "Feature", geometry: null } });
      map.addLayer({ id: "corridor-fill", type: "fill", source: "corridor", paint: { "fill-color": "#0ff", "fill-opacity": 0.3 } });
      map.addLayer({ id: "corridor-outline", type: "line", source: "corridor", paint: { "line-color": "#0cc", "line-width": 2 } });

      // no-fly
      map.addSource("no-fly", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "nf-fill", type: "fill", source: "no-fly", paint: { "fill-color": "#f00", "fill-opacity": 0.3 } });
      map.addLayer({ id: "nf-outline", type: "line", source: "no-fly", paint: { "line-color": "#f00", "line-width": 2 } });

      // terrain
      map.addSource("dem", {
        type: "raster-dem",
        tiles: ["https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=UuT3bgRT2n76FjxDNq6B"],
        tileSize: 512,
        maxzoom: 12,
      });
      map.setTerrain({ source: "dem", exaggeration: 1.0 });
      map.addControl(new maplibregl.NavigationControl(), "top-left");
      map.addControl(new maplibregl.TerrainControl({ source: "dem" }), "top-left");

      // custom button
      const rc = new RouteControl();
      map.addControl(rc, "top-right");
      routeBtnRef.current = rc.getButtonElement();
      routeBtnRef.current.onclick = (ev) => {
        ev.stopPropagation();
        setIsPanelOpen(true);
        setPanelStep(!frozenStart ? "startSelect" : "endSelect");
      };
    });

    map.on("dragstart", () => (isDragging.current = true));
    map.on("dragend", () => (isDragging.current = false));

    crosshairRef.current = new CrosshairManager(map);
    return () => map.remove();
  }, []);

  // обновление no-fly
  useEffect(() => {
    mapRef.current?.getSource("no-fly")?.setData({ type: "FeatureCollection", features: noFlyZones });
  }, [noFlyZones]);

  // крестик при выборе
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onMove = () => {
      const c = map.getCenter();
      if (!c) return;
      if (panelStep === "startSelect") setTempStart([c.lng, c.lat]);
      if (panelStep === "endSelect") setTempEnd([c.lng, c.lat]);
    };
    if (isPanelOpen && (panelStep === "startSelect" || panelStep === "endSelect")) {
      crosshairRef.current.create();
      map.on("move", onMove);
      onMove();
    }
    return () => {
      crosshairRef.current.destroy();
      map.off("move", onMove);
    };
  }, [isPanelOpen, panelStep]);

  // обновление маркеров
  useEffect(() => {
    function upd(ref, coord, color) {
      if (coord?.length === 2) {
        if (!ref.current) {
          ref.current = new maplibregl.Marker({ color, offset: [0, -15] })
            .setLngLat(coord)
            .addTo(mapRef.current);
        } else {
          ref.current.setLngLat(coord);
        }
      } else {
        ref.current?.remove();
        ref.current = null;
      }
    }
    upd(startMark, panelStep === "startSelect" ? tempStart : frozenStart, "#0a0");
    upd(tempEndMark, panelStep === "endSelect" ? tempEnd : null, "#00f");
    upd(endMark, frozenEnd, "#a00");
  }, [panelStep, tempStart, frozenStart, tempEnd, frozenEnd]);

  // синхронизация route/corridor в карту
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getSource("route")?.setData(routeFeature || { type: "Feature", geometry: null });
    m.getSource("corridor")?.setData(corridorFeature || { type: "Feature", geometry: null });
  }, [routeFeature, corridorFeature]);

  // клики вне панели
  useEffect(() => {
    const handler = (e) => {
      if (!isPanelOpen || isDragging.current) return;
      if (panelRef.current?.contains(e.target)) return;
      if (routeBtnRef.current?.contains(e.target)) return;
      setIsPanelOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isPanelOpen]);

   function clearGeoman() {
    const gm = geomanRef.current;
    if (!gm || !routeGmIdRef.current) return;
    // 1) выключаем edit mode
    gm.disableGlobalEditMode();
    // 2) удаляем feature по id
    gm.features.delete(routeGmIdRef.current);
    // 3) сбрасываем ref
    routeGmIdRef.current = null;
  }
  
  useEffect(() => {
    const gm = geomanRef.current;
    if (!gm) return;
  
    // clear old
    if (routeGmIdRef.current) {
      gm.disableGlobalEditMode();
      gm.features.delete(routeGmIdRef.current);
      routeGmIdRef.current = null;
    }
  
    if (routeFeature) {
      // import and turn on edit mode
      const fd = gm.features.importGeoJsonFeature({
        ...routeFeature,
        properties: { ...(routeFeature.properties||{}), shape: 'line' }
      });
      routeGmIdRef.current = fd.id;
      gm.enableGlobalEditMode();
    }
  }, [routeFeature]);  

  // обработка правки из Geoman
  useEffect(() => {
    const map = mapRef.current;
    const onEditEnd = (evt) => {
      if (evt.feature?.id !== routeGmIdRef.current) return;
      const updated = evt.feature.getGeoJson();            // <— use getGeoJson()
      setRouteFeature(updated);
      setCorridorFeature(turf.buffer(updated, corridorWidth, { units: 'meters' }));
    };
    map.on('gm:editend', onEditEnd);
    return () => { map.off('gm:editend', onEditEnd); };
  }, [corridorWidth]);

  // пересчёт коридора при изменении ширины
  useEffect(() => {
    if (!routeFeature) return;
    setCorridorFeature(turf.buffer(routeFeature, corridorWidth, { units: "meters" }));
  }, [corridorWidth, routeFeature]);

  // панель: отмена старта
  function handleCancelStart(e) {
    e.stopPropagation();
    clearGeoman();
    setTempStart(null);
    setFrozenStart(null);
    setTempEnd(null);
    setFrozenEnd(null);
    setRouteFeature(null);
    setCorridorFeature(null);
    setIsPanelOpen(false);
    setPanelStep(null);
  }
  function handleNextFromStart(e) {
    e.stopPropagation();
    if (!tempStart) return alert("Укажите начало");
    setFrozenStart(tempStart);
    setPanelStep("endSelect");
    setTempStart(null);
  }
  // панель: отмена конца
  function handleCancelEnd(e) {
    e.stopPropagation();
    clearGeoman();
    setTempEnd(null);
    setFrozenEnd(null);
    setRouteFeature(null);
    setCorridorFeature(null);
    setTempStart(frozenStart);
    setFrozenStart(null);
    setPanelStep("startSelect");
  }

  const [isCalculating, setIsCalculating] = useState(false);
  // расчёт маршрута
  async function handleCalculateRoute(e) {
    e.stopPropagation();
    if (!frozenStart || !tempEnd) return alert("Укажите обе точки");

    stopGeomanEdit();

    setIsCalculating(true);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: frozenStart,
          end: tempEnd,
          noFlyZones,
          corridorWidth,
          maxAltitude: 300,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || "Ошибка расчёта");
      }
      const { route, corridor } = await res.json();
      
      setRouteFeature(route);
      setCorridorFeature(corridor);
      setFrozenEnd(tempEnd);
    } catch (err) {
      console.error(err);
      alert("Сетевая ошибка");
    } finally {
      setIsCalculating(false);
    }
  }

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 150px)" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {isPanelOpen && (
        <Card ref={panelRef} style={{ position: "absolute", top: 10, right: 10, width: 300, zIndex: 9999 }}>
          {panelStep === "startSelect" ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <b>Начало (Lon,Lat):</b>
              <Space>
                <InputNumber placeholder="Lon" value={tempStart?.[0]} onChange={(v) => setTempStart(([_, lat]) => [v || 0, lat])} />
                <InputNumber placeholder="Lat" value={tempStart?.[1]} onChange={(v) => setTempStart(([lon, _]) => [lon, v || 0])} />
              </Space>
              <Space>
                <Button danger onClick={handleCancelStart}>Отменить</Button>
                <Button type="primary" onClick={handleNextFromStart}>Далее</Button>
              </Space>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              <b>Конец (Lon,Lat):</b>
              <Space>
                <InputNumber placeholder="Lon" value={tempEnd?.[0]} onChange={(v) => setTempEnd(([_, lat]) => [v || 0, lat])} />
                <InputNumber placeholder="Lat" value={tempEnd?.[1]} onChange={(v) => setTempEnd(([lon, _]) => [lon, v || 0])} />
              </Space>
              <div>
                <b>Ширина коридора:</b>
                <InputNumber min={0} step={10} value={corridorWidth} onChange={setCorridorWidth} />
              </div>
              <Space>
                <Button danger onClick={handleCancelEnd}>Отменить</Button>
                <Button type="primary" loading={isCalculating} onClick={handleCalculateRoute}>Рассчитать</Button>
              </Space>
            </Space>
          )}
        </Card>
      )}
    </div>
  );
}
