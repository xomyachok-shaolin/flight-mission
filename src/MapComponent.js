import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

import { Card, Button, Space, InputNumber } from "antd";
import * as turf from "@turf/turf";

import "./map.css";

// ====================== CrosshairManager (без изменений) ======================
class CrosshairManager {
  constructor(map) {
    this.map = map;
    this.width = 0;
    this.height = 0;
    this.svgCanvas = null;
    this.xLine = null;
    this.yLine = null;
  }
  create() {
    if (!this.map) return;
    this.updateValues();
    this.map.on("resize", this.onResize);
    this.createCanvas(this.map.getCanvasContainer());
  }
  destroy() {
    if (this.svgCanvas) {
      this.svgCanvas.remove();
      this.svgCanvas = null;
    }
    if (this.map) {
      this.map.off("resize", this.onResize);
    }
  }
  onResize = () => {
    this.updateValues();
    this.updateCanvas();
  };
  updateValues() {
    this.width = this.map.getCanvas().clientWidth;
    this.height = this.map.getCanvas().clientHeight;
  }
  createCanvas(container) {
    this.svgCanvas = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.svgCanvas.style.position = "absolute";
    this.svgCanvas.style.top = "0";
    this.svgCanvas.style.left = "0";
    this.svgCanvas.setAttribute("width", `${this.width}px`);
    this.svgCanvas.setAttribute("height", `${this.height}px`);

    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    this.yLine = this.createLine(halfWidth, 0, halfWidth, this.height);
    this.xLine = this.createLine(0, halfHeight, this.width, halfHeight);

    this.svgCanvas.appendChild(this.yLine);
    this.svgCanvas.appendChild(this.xLine);
    container.appendChild(this.svgCanvas);
  }
  updateCanvas() {
    if (!this.svgCanvas || !this.xLine || !this.yLine) return;
    this.svgCanvas.setAttribute("width", `${this.width}px`);
    this.svgCanvas.setAttribute("height", `${this.height}px`);

    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    this.yLine.setAttribute("x1", halfWidth);
    this.yLine.setAttribute("y1", 0);
    this.yLine.setAttribute("x2", halfWidth);
    this.yLine.setAttribute("y2", this.height);
    this.xLine.setAttribute("x1", 0);
    this.xLine.setAttribute("y1", halfHeight);
    this.xLine.setAttribute("x2", this.width);
    this.xLine.setAttribute("y2", halfHeight);
  }
  createLine(x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke-dasharray", "4,4");
    line.setAttribute("stroke", "#111");
    line.setAttribute("stroke-width", "2");
    return line;
  }
}

class RouteControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

    this._button = document.createElement("button");
    this._button.style.width = "20px";
    this._button.style.height = "20px";
    this._button.style.backgroundImage =
      'url(\'data:image/svg+xml;charset=UTF-8,<svg id="Capa_1" enable-background="new 0 0 512 512" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg"><g><path d="M487.663,282.767c-32.447-32.447-85.054-32.447-117.501,0c-26.833,26.833-32.076,68.438-12.738,101.089l53.549,90.417 H105.657c-26.329,0-47.749-21.421-47.749-47.75c0-26.329,21.42-47.749,47.749-47.749h143.589 c42.871,0,77.749-34.878,77.749-77.749c0-42.871-34.878-77.749-77.749-77.749H101.027l53.549-90.416 c19.338-32.651,14.095-74.256-12.738-101.089c-32.447-32.447-85.054-32.447-117.501,0C-2.496,58.603-7.739,100.208,11.599,132.859 l71.489,120.708l0.172-0.291h165.986c26.329,0,47.749,21.42,47.749,47.749c0,26.329-21.42,47.749-47.749,47.749H105.657 c-42.871,0-77.749,34.878-77.749,77.749c0,42.871,34.878,77.75,77.749,77.75H428.74l0.172,0.291l71.489-120.707 C519.739,351.205,514.496,309.6,487.663,282.767z M83.087,116.713c-14.442,0-26.191-11.749-26.191-26.191 c0-14.442,11.749-26.191,26.191-26.191c14.442,0,26.191,11.749,26.191,26.191C109.278,104.964,97.529,116.713,83.087,116.713z M427.79,367.71c-14.442,0-26.191-11.749-26.191-26.191c0-14.442,11.749-26.191,26.191-26.191 c14.442,0,26.191,11.749,26.191,26.191S442.232,367.71,427.79,367.71z"/></g></svg>\')';
    this._button.style.backgroundRepeat = "no-repeat";
    this._button.style.backgroundPosition = "center";
    this._button.style.backgroundSize = "90%";
    this._button.style.cursor = "pointer";
    this._button.style.border = "none";
    this._button.style.outline = "none";
    this._button.style.borderRadius = "4px";
    this._button.style.margin = "5px";
    this._button.style.backgroundColor = "#fff";
    this._button.title = "Управление маршрутом";

    this._container.appendChild(this._button);
    return this._container;
  }
  onRemove() {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._map = undefined;
  }
  getDefaultPosition() {
    return "top-right";
  }
  getButtonElement() {
    return this._button;
  }
}

// ====================== Основной компонент ======================
export default function MapComponent() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [panelStep, setPanelStep] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [tempStartCoord, setTempStartCoord] = useState(null);
  const [frozenStartCoord, setFrozenStartCoord] = useState(null);

  const [tempEndCoord, setTempEndCoord] = useState(null);
  const [frozenEndCoord, setFrozenEndCoord] = useState(null);

  // Маркеры (рефы)
  const startMarkerRef = useRef(null); // зелёный (начало)
  const endMarkerRef = useRef(null); // красный (конец)
  const tempEndMarkerRef = useRef(null); // синий (временный конец)

  // Ширина коридора
  const [corridorWidth, setCorridorWidth] = useState(50);

  // Маршрут + коридор (GeoJSON)
  const [routeFeature, setRouteFeature] = useState(null);
  const [corridorFeature, setCorridorFeature] = useState(null);

  // No-fly зоны (GeoJSON-массив)
  const [noFlyZones, setNoFlyZones] = useState([]);

  // Ссылки для «наружных» кликов
  const panelRef = useRef(null);
  const isDraggingRef = useRef(false);
  const routeButtonRef = useRef(null);

  // Кроссхейр
  const crosshairRef = useRef(null);

  // ====================== 1) Инициализация карты ======================
  useEffect(() => {
    // Проверяем, доступна ли GlobeControl
    let supportsGlobe = false;
    try {
      // Если есть maplibregl.GlobeControl — значит поддерживается
      if (maplibregl.GlobeControl) {
        supportsGlobe = true;
      }
    } catch (err) {
      supportsGlobe = false;
    }

    const initialProjection = supportsGlobe ? "mercator" : "mercator";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          "satellite-tiles": {
            type: "raster",
            tiles: [
              "https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=UuT3bgRT2n76FjxDNq6B",
            ],
            tileSize: 512,
          },
        },
        layers: [
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite-tiles",
          },
        ],
      },
      center: [71.7143, 39.7641],
      zoom: 13.3,
      pitch: 45,
      bearing: 20,
      renderWorldCopies: false,
      projection: initialProjection,
      maxPitch: 60,
    });
    mapRef.current = map;

    // Geoman
    const geoman = new Geoman(map, {
      settings: { controlsPosition: "top-right" },
      layerStyles: {
        polygon: {
          gm_main: [
            {
              type: "fill",
              paint: {
                "fill-color": "#ff0000",
                "fill-opacity": 0.3,
                "fill-outline-color": "#ff0000",
              },
            },
          ],
        },
        line: {
          gm_main: [
            {
              type: "line",
              paint: {
                "line-color": "#ff0000",
                "line-width": 3,
              },
            },
          ],
        },
        circle: {
          gm_main: [
            {
              type: "fill",
              paint: {
                "fill-color": "#ff0000",
                "fill-opacity": 0.3,
                "fill-outline-color": "#ff0000",
              },
            },
          ],
        },
        rectangle: {
          gm_main: [
            {
              type: "fill",
              paint: {
                "fill-color": "#ff0000",
                "fill-opacity": 0.3,
                "fill-outline-color": "#ff0000",
              },
            },
          ],
        },
      },
    });

    map.on("pm:create", (e) => {
      if (e.geometry?.type === "Polygon") {
        const feat = {
          type: "Feature",
          geometry: e.geometry,
          properties: {},
        };
        setNoFlyZones((prev) => [...prev, feat]);
      }
      if (e.layerIds && e.layerIds["fill-extrusion"]) {
        map.removeLayer(e.layerIds["fill-extrusion"]);
      }
    });

    map.on("load", () => {
      if (map.getProjection())
        if (map.getProjection()?.type === "globe") {
          map.setPitch(0);
          map.setMaxPitch(0);
          map.dragRotate.disable();
          map.touchZoomRotate.disableRotation();
        }

      // 1) Источник+слой "route"
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: null },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-width": 4,
          "line-color": "#0000ff",
        },
      });

      // 2) Коридор
      map.addSource("corridor", {
        type: "geojson",
        data: { type: "Feature", geometry: null },
      });
      map.addLayer({
        id: "corridor-fill",
        type: "fill",
        source: "corridor",
        paint: {
          "fill-color": "#00ffff",
          "fill-opacity": 0.3,
        },
      });
      map.addLayer({
        id: "corridor-outline",
        type: "line",
        source: "corridor",
        paint: {
          "line-color": "#00cccc",
          "line-width": 2,
        },
      });

      // 3) No-fly
      map.addSource("no-fly-zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "no-fly-fill",
        type: "fill",
        source: "no-fly-zones",
        paint: {
          "fill-color": "#ff0000",
          "fill-opacity": 0.3,
        },
      });
      map.addLayer({
        id: "no-fly-outline",
        type: "line",
        source: "no-fly-zones",
        paint: {
          "line-color": "#ff0000",
          "line-width": 2,
        },
      });

      // Terrain
      map.addSource("dem", {
        type: "raster-dem",
        tiles: [
          "https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=UuT3bgRT2n76FjxDNq6B",
        ],
        tileSize: 512,
        maxzoom: 12,
      });
      map.setTerrain({ source: "dem", exaggeration: 1.0 });

      // Стандартные контролы
      map.addControl(new maplibregl.NavigationControl(), "top-left");
      if (supportsGlobe) {
        const globeControl = new maplibregl.GlobeControl();
        map.addControl(globeControl, "top-left");

        // Ловим клик по кнопке GlobeControl
        const globeButton = globeControl._globeButton; // ВНИМАНИЕ: это приватное API
        globeButton.addEventListener("click", () => {
          // Переключение проекции в MapLibre происходит с задержкой (async),
          // поэтому небольшой setTimeout (или requestAnimationFrame),
          // чтобы дождаться фактического переключения:
          setTimeout(() => {
            const currentProj = map.getProjection()?.type; // "globe" или "mercator"
            if (currentProj === "globe") {
              // Блокируем наклон
              map.setPitch(0);
              map.setBearing(0);
              map.setMaxPitch(0);
              map.dragRotate.disable();
              map.touchZoomRotate.disableRotation();
            } else {
              // Возвращаем возможность наклона
              map.setMaxPitch(60);
              map.dragRotate.enable();
              map.touchZoomRotate.enableRotation();
            }
          }, 100);
        });
      }

      map.addControl(
        new maplibregl.TerrainControl({ source: "dem" }),
        "top-left"
      );

      // 4) Ваш контрол "RouteControl"
      const routeCtrl = new RouteControl();
      map.addControl(routeCtrl, "top-right");
      const routeBtn = routeCtrl.getButtonElement();
      routeButtonRef.current = routeBtn;

      routeBtn.onclick = (e) => {
        e.stopPropagation();
        if (!isPanelOpen) {
          // Открываем панель
          setIsPanelOpen(true);
          // Если шаг ещё не выбран, определяем
          if (!panelStep) {
            if (!frozenStartCoord) {
              setPanelStep("startSelect");
            } else if (!frozenEndCoord) {
              setPanelStep("endSelect");
            } else {
              setPanelStep("endSelect");
            }
          }
        } else {
          // Если хотим сворачивать панель «повторным нажатием» - раскомментируйте
          // setIsPanelOpen(false);
        }
      };
    });

    map.on("dragstart", () => {
      isDraggingRef.current = true;
    });
    map.on("dragend", () => {
      isDraggingRef.current = false;
    });

    // Кроссхейр
    crosshairRef.current = new CrosshairManager(map);

    return () => {
      map.remove();
    };
  }, []);

  // обновляем no-fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("no-fly-zones");
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: noFlyZones,
      });
    }
  }, [noFlyZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !crosshairRef.current) return;

    // Один раз объявляем «реальный» обработчик (будет фиксированная ссылка)
    const handleMapMove = () => {
      const center = map.getCenter();
      if (!center) return;
      if (panelStep === "startSelect") {
        setTempStartCoord([center.lng, center.lat]);
      } else if (panelStep === "endSelect") {
        setTempEndCoord([center.lng, center.lat]);
      }
    };

    if (panelStep === "startSelect" || panelStep === "endSelect") {
      // Включаем перекрестие + подписываемся
      crosshairRef.current.create();
      map.on("move", handleMapMove);
      // Сразу один раз вызовем, чтобы не ждать первого сдвига
      handleMapMove();
    }

    // Именно return-колбэк освободит нас от дублированных подписок
    return () => {
      // При любом изменении panelStep (или размонтировании компонента) —
      // убираем всё, что навешивали.
      crosshairRef.current.destroy();
      map.off("move", handleMapMove);
    };
  }, [panelStep]);

  useEffect(() => {
    if (frozenStartCoord) {
      updateMarker(startMarkerRef, frozenStartCoord, "#0a0");
    } else if (panelStep === "startSelect" && tempStartCoord) {
      updateMarker(startMarkerRef, tempStartCoord, "#0a0");
    } else {
      removeMarker(startMarkerRef);
    }

    if (frozenEndCoord) {
      updateMarker(endMarkerRef, frozenEndCoord, "#a00");
    } else {
      removeMarker(endMarkerRef);
    }

    if (panelStep === "endSelect" && tempEndCoord) {
      updateMarker(tempEndMarkerRef, tempEndCoord, "#00f");
    } else {
      removeMarker(tempEndMarkerRef);
    }
  }, [panelStep, tempStartCoord, frozenStartCoord, tempEndCoord, frozenEndCoord]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeSrc = map.getSource("route");
    if (routeSrc) {
      routeSrc.setData(routeFeature || { type: "Feature", geometry: null });
    }

    const corrSrc = map.getSource("corridor");
    if (corrSrc) {
      corrSrc.setData(corridorFeature || { type: "Feature", geometry: null });
    }
  }, [routeFeature, corridorFeature]);

  useEffect(() => {
    function onDocClick(e) {
      // Если панель и так закрыта — выходим
      if (!isPanelOpen) return;
      // Если двигаем карту — выходим
      if (isDraggingRef.current) return;
      // Если клик внутри панели — выходим
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      // Если клик по кнопке RouteControl — выходим
      if (routeButtonRef.current && routeButtonRef.current.contains(e.target))
        return;

      // Во всех прочих случаях — просто скрываем панель
      // (НО не сбрасываем panelStep!)
      setIsPanelOpen(false);
    }

    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, [isPanelOpen]);

  /** ====================== Хелперы для маркеров ====================== */
  function updateMarker(markerRef, coord, color) {
    const map = mapRef.current;
    if (!map) return;
    if (!coord || coord.length !== 2) {
      removeMarker(markerRef);
      return;
    }
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ color, offset: [0, -15] });
      marker.getElement().style.zIndex = "9999";
      markerRef.current = marker.setLngLat(coord).addTo(map);
    } else {
      markerRef.current.setLngLat(coord);
    }
  }
  function removeMarker(markerRef) {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }

  function handleCancelStart(e) {
    e.stopPropagation();
    setTempStartCoord(null);
    setFrozenStartCoord(null);
    setTempEndCoord(null);
    setRouteFeature(null);
    setCorridorFeature(null);
    // При желании можно и панель закрыть:
    setIsPanelOpen(false);
    // Либо сбрасываем шаг:
    setPanelStep(null);
  }

  function handleNextFromStart(e) {
    e.stopPropagation();
    if (!tempStartCoord) {
      alert("Сначала укажите начало маршрута!");
      return;
    }
    console.log("Fixing startCoord:", tempStartCoord);

    setFrozenStartCoord(tempStartCoord);
    setPanelStep("endSelect");

    // А обнулим tempStartCoord чуть позже,
    // чтобы при текущем рендере условие успело переключиться на frozenStartCoord.
    setTimeout(() => {
      setTempStartCoord(null);
    }, 100);
  }

  function handleCancelEnd(e) {
    e.stopPropagation();
    // Сбрасываем только временный конец и маршрут
    setTempEndCoord(null);
    setRouteFeature(null);
    setCorridorFeature(null);
    setFrozenEndCoord(null);
    // Возвращаемся к выбору начала
    setPanelStep("startSelect");
  }

  function handleCalculateRoute(e) {
    e.stopPropagation();

    if (!frozenStartCoord) {
      alert("Сначала укажите начало маршрута!");
      return;
    }
    if (!tempEndCoord) {
      alert("Укажите конец маршрута!");
      return;
    }

    const route = computeRoute(frozenStartCoord, tempEndCoord, noFlyZones);
    setRouteFeature(route);

    if (route) {
      try {
        const buf = turf.buffer(route, corridorWidth, { units: "meters" });
        setCorridorFeature(buf);
      } catch (err) {
        console.error("Buffer error:", err);
        setCorridorFeature(null);
      }
      setFrozenEndCoord(tempEndCoord);
    } else {
      setRouteFeature(null);
      setCorridorFeature(null);
      alert("Маршрут не найден!");
    }
  }

  function onChangeStartLon(val) {
    setTempStartCoord((prev) => [val ?? 0, prev?.[1] ?? 0]);
  }

  function onChangeStartLat(val) {
    setTempStartCoord((prev) => [prev?.[0] ?? 0, val ?? 0]);
  }

  function onChangeEndLon(val) {
    setTempEndCoord((prev) => [val ?? 0, prev?.[1] ?? 0]);
  }

  function onChangeEndLat(val) {
    setTempEndCoord((prev) => [prev?.[0] ?? 0, val ?? 0]);
  }

  // ====================== Рендер ======================
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 150px)",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {isPanelOpen && (
        <Card
          ref={panelRef}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 300,
            zIndex: 9999,
            boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
          }}
          title={
            panelStep === "startSelect"
              ? "Выбор начала маршрута"
              : "Выбор конца маршрута"
          }
        >
          {panelStep === "startSelect" && (
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <b>Начало (Lon, Lat):</b>
                <Space style={{ marginTop: 8 }}>
                  <InputNumber
                    style={{ width: 100 }}
                    placeholder="Lon"
                    value={tempStartCoord ? tempStartCoord[0] : ""}
                    onChange={onChangeStartLon}
                  />
                  <InputNumber
                    style={{ width: 100 }}
                    placeholder="Lat"
                    value={tempStartCoord ? tempStartCoord[1] : ""}
                    onChange={onChangeStartLat}
                  />
                </Space>
              </div>

              <Space>
                <Button onClick={handleCancelStart} danger>
                  Отменить
                </Button>
                <Button type="primary" onClick={handleNextFromStart}>
                  Далее
                </Button>
              </Space>
            </Space>
          )}

          {panelStep === "endSelect" && (
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <b>Конец (Lon, Lat):</b>
                <Space style={{ marginTop: 8 }}>
                  <InputNumber
                    style={{ width: 100 }}
                    placeholder="Lon"
                    value={tempEndCoord ? tempEndCoord[0] : ""}
                    onChange={onChangeEndLon}
                  />
                  <InputNumber
                    style={{ width: 100 }}
                    placeholder="Lat"
                    value={tempEndCoord ? tempEndCoord[1] : ""}
                    onChange={onChangeEndLat}
                  />
                </Space>
              </div>

              <div>
                <b>Ширина коридора (м):</b>
                <InputNumber
                  style={{ marginLeft: 8, width: 80 }}
                  min={0}
                  step={10}
                  value={corridorWidth}
                  onChange={(val) => setCorridorWidth(val || 0)}
                />
              </div>

              <Space wrap>
                <Button onClick={handleCancelEnd} danger>
                  Отменить
                </Button>
                <Button type="primary" onClick={handleCalculateRoute}>
                  Рассчитать
                </Button>
              </Space>
              <p style={{ fontSize: 12, color: "#666" }}>
                После расчёта конец (красный маркер) переместится на новую
                точку, а маршрут будет построен.
              </p>
            </Space>
          )}
        </Card>
      )}
    </div>
  );
}

// ====================== Пример реализации BFS + вспомогательные функции ======================
function computeRoute(start, end, noFlyZones) {
  if (!start || !end) return null;
  const [sx, sy] = start;
  const [ex, ey] = end;

  // Небольшой «запас»
  const minX = Math.min(sx, ex) - 0.01;
  const maxX = Math.max(sx, ex) + 0.01;
  const minY = Math.min(sy, ey) - 0.01;
  const maxY = Math.max(sy, ey) + 0.01;

  // шаг ~50 м
  const step = 0.0005;
  const nodes = buildGrid(minX, maxX, minY, maxY, step);
  const passNodes = filterGridByNoFly(nodes, noFlyZones);

  const startNode = findClosestNode([sx, sy], passNodes);
  const endNode = findClosestNode([ex, ey], passNodes);
  if (!startNode || !endNode) return null;

  const path = bfsFindPath(startNode, endNode, passNodes, step);
  if (!path || path.length < 2) return null;

  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: path.map((n) => [n.x, n.y]) },
    properties: {},
  };
}

function buildGrid(minX, maxX, minY, maxY, step) {
  const out = [];
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      out.push({ x, y });
    }
  }
  return out;
}

function filterGridByNoFly(nodes, noFlyZones) {
  if (!noFlyZones || !noFlyZones.length) return nodes;
  return nodes.filter((n) => {
    const pt = turf.point([n.x, n.y]);
    for (const zone of noFlyZones) {
      if (!zone || !zone.geometry) continue;
      // Если точка НЕ disjoint => она пересекается => исключаем
      if (!turf.booleanDisjoint(pt, zone)) {
        return false;
      }
    }
    return true;
  });
}

function findClosestNode(coord, nodes) {
  let minD = Infinity;
  let best = null;
  for (const n of nodes) {
    const dx = n.x - coord[0];
    const dy = n.y - coord[1];
    const dd = dx * dx + dy * dy;
    if (dd < minD) {
      minD = dd;
      best = n;
    }
  }
  return best;
}

function bfsFindPath(startNode, endNode, passNodes, step) {
  const passSet = new Set(
    passNodes.map((n) => `${n.x.toFixed(5)}|${n.y.toFixed(5)}`)
  );

  function getNeighbors(n) {
    const arr = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = +(n.x + dx * step).toFixed(5);
        const ny = +(n.y + dy * step).toFixed(5);
        if (passSet.has(`${nx}|${ny}`)) {
          arr.push({ x: nx, y: ny });
        }
      }
    }
    return arr;
  }

  const queue = [];
  const visited = new Set();
  const parent = new Map();

  const startKey = `${startNode.x.toFixed(5)}|${startNode.y.toFixed(5)}`;
  const endKey = `${endNode.x.toFixed(5)}|${endNode.y.toFixed(5)}`;

  queue.push(startNode);
  visited.add(startKey);

  while (queue.length) {
    const curr = queue.shift();
    const currKey = `${curr.x.toFixed(5)}|${curr.y.toFixed(5)}`;
    if (currKey === endKey) {
      const path = [];
      let node = curr;
      while (node) {
        path.push(node);
        const k = `${node.x.toFixed(5)}|${node.y.toFixed(5)}`;
        node = parent.get(k) || null;
      }
      return path.reverse();
    }
    const neighbors = getNeighbors(curr);
    for (const nb of neighbors) {
      const nbKey = `${nb.x.toFixed(5)}|${nb.y.toFixed(5)}`;
      if (!visited.has(nbKey)) {
        visited.add(nbKey);
        parent.set(nbKey, curr);
        queue.push(nb);
      }
    }
  }
  return null; // нет пути
}
