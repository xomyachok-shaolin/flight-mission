// src/components/MapComponent.jsx
import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

import { Card, Button, Space, InputNumber } from "antd";
import * as turf from "@turf/turf";

// import "./map.css";

// ====================== CrosshairManager ======================
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

// ====================== RouteControl ======================
class RouteControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement("div");
        this._container.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

        this._button = document.createElement("button");
        Object.assign(this._button.style, {
            width: "20px",
            height: "20px",
            backgroundImage:
                "url('data:image/svg+xml;charset=UTF-8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M487.663,282.767c-32.447-32.447-85.054-32.447-117.501,0c-26.833,26.833-32.076,68.438-12.738,101.089l53.549,90.417H105.657c-26.329,0-47.749-21.421-47.749-47.75c0-26.329,21.42-47.749,47.749-47.749h143.589c42.871,0,77.749-34.878,77.749-77.749c0-42.871-34.878-77.749-77.749-77.749H101.027l53.549-90.416c19.338-32.651,14.095-74.256-12.738-101.089c-32.447-32.447-85.054-32.447-117.501,0C-2.496,58.603-7.739,100.208,11.599,132.859l71.489,120.708l0.172-0.291h165.986c26.329,0,47.749,21.42,47.749,47.749c0,26.329-21.42,47.749-47.749,47.749H105.657c-42.871,0-77.749,34.878-77.749,77.749c0,42.871,34.878,77.75,77.749,77.75H428.74l0.172,0.291l71.489-120.707C519.739,351.205,514.496,309.6,487.663,282.767z\"/></svg>')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "90%",
            cursor: "pointer",
            border: "none",
            outline: "none",
            borderRadius: "4px",
            margin: "5px",
            backgroundColor: "#fff",
        });
        this._button.title = "Управление маршрутом";

        this._container.appendChild(this._button);
        return this._container;
    }
    onRemove() {
        this._container.parentNode?.removeChild(this._container);
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
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    const geomanRef = useRef(null);
    const routeGmIdRef = useRef(null);
      const routeGmDataRef = useRef(null);

    const [panelStep, setPanelStep] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const [tempStartCoord, setTempStartCoord] = useState(null);
    const [frozenStartCoord, setFrozenStartCoord] = useState(null);

    const [tempEndCoord, setTempEndCoord] = useState(null);
    const [frozenEndCoord, setFrozenEndCoord] = useState(null);

    const startMarkerRef = useRef(null);
    const endMarkerRef = useRef(null);
    const tempEndMarkerRef = useRef(null);

    const [corridorWidth, setCorridorWidth] = useState(50);
    const [routeFeature, setRouteFeature] = useState(null);
    const [corridorFeature, setCorridorFeature] = useState(null);
    const [noFlyZones, setNoFlyZones] = useState([]);

    const panelRef = useRef(null);
    const isDraggingRef = useRef(false);
    const routeButtonRef = useRef(null);
    const crosshairRef = useRef(null);

    useEffect(() => {
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
            projection: "mercator",
            maxPitch: 60,
        });
        mapRef.current = map;

        // === Geoman ===
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
                line: {    // <-- возвращаем ключ "line", чтобы delete работал корректно
                    gm_main: [
                        {
                            type: "line",
                            paint: {
                                "line-color": "#0000ff",
                                "line-width": 4,
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
        geomanRef.current = geoman;

        map.on("pm:create", (e) => {
            if (e.geometry?.type === "Polygon") {
                setNoFlyZones((prev) => [
                    ...prev,
                    { type: "Feature", geometry: e.geometry, properties: {} },
                ]);
            }
        });

        map.on("load", () => {
            // 1) Источник + слой "route"
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

            // 3) No-fly зоны
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

            // 4) Terrain
            map.addSource("dem", {
                type: "raster-dem",
                tiles: [
                    "https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=UuT3bgRT2n76FjxDNq6B",
                ],
                tileSize: 512,
                maxzoom: 12,
            });
            map.setTerrain({ source: "dem", exaggeration: 1.0 });

            map.addControl(new maplibregl.NavigationControl(), "top-left");
            map.addControl(new maplibregl.TerrainControl({ source: "dem" }), "top-left");

            // 5) RouteControl
            const routeCtrl = new RouteControl();
            map.addControl(routeCtrl, "top-right");
            routeButtonRef.current = routeCtrl.getButtonElement();
            routeButtonRef.current.onclick = (e) => {
                e.stopPropagation();
                if (!isPanelOpen) {
                    setIsPanelOpen(true);
                    setPanelStep(!frozenStartCoord ? "startSelect" : "endSelect");
                }
            };
        });

        map.on("dragstart", () => {
            isDraggingRef.current = true;
        });
        map.on("dragend", () => {
            isDraggingRef.current = false;
        });

        crosshairRef.current = new CrosshairManager(map);

        return () => {
            map.remove();
        };
    }, []);

    // обновляем no-fly
    useEffect(() => {
        mapRef.current
            ?.getSource("no-fly-zones")
            ?.setData({ type: "FeatureCollection", features: noFlyZones });
    }, [noFlyZones]);

    // перекрестие
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const onMove = () => {
            const c = map.getCenter();
            if (!c) return;
            if (panelStep === "startSelect") setTempStartCoord([c.lng, c.lat]);
            else if (panelStep === "endSelect") setTempEndCoord([c.lng, c.lat]);
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

    // маркеры
    useEffect(() => {
        function updateMarker(ref, coord, color) {
            if (coord?.length === 2) {
                if (!ref.current) {
                    ref.current = new maplibregl.Marker({ color, offset: [0, -15] })
                        .setLngLat(coord)
                        .addTo(mapRef.current);
                } else {
                    ref.current.setLngLat(coord);
                }
            } else {
                if (ref.current) {
                    ref.current.remove();
                    ref.current = null;
                }
            }
        }
        updateMarker(startMarkerRef, panelStep === "startSelect" ? tempStartCoord : frozenStartCoord, "#0a0");
        updateMarker(endMarkerRef, frozenEndCoord, "#a00");
        updateMarker(tempEndMarkerRef, panelStep === "endSelect" ? tempEndCoord : null, "#00f");
    }, [panelStep, tempStartCoord, frozenStartCoord, tempEndCoord, frozenEndCoord]);

    // обновляем линии
    useEffect(() => {
        mapRef.current?.getSource("route")?.setData(routeFeature ?? { type: "Feature", geometry: null });
        mapRef.current?.getSource("corridor")?.setData(corridorFeature ?? { type: "Feature", geometry: null });
    }, [routeFeature, corridorFeature]);

    // клики вне панели
    useEffect(() => {
        const handler = e => {
            if (!isPanelOpen) return;
            if (isDraggingRef.current) return;
            if (panelRef.current?.contains(e.target)) return;
            if (routeButtonRef.current?.contains(e.target)) return;
            setIsPanelOpen(false);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [isPanelOpen]);

    const clearGeomanShape = () => {
        const geoman = geomanRef.current;
        const featureData = routeGmDataRef.current;
        if (geoman && featureData) {
          geoman.disableGlobalEditMode();
          geoman.features.delete(featureData);
          routeGmDataRef.current = null;
          routeGmIdRef.current = null;
        }
      };

    // === кнопки панели ===
    const handleCancelStart = e => {
        e.stopPropagation();
        clearGeomanShape();
        setTempStartCoord(null);
        setFrozenStartCoord(null);
        setTempEndCoord(null);
        setFrozenEndCoord(null);
        setRouteFeature(null);
        setCorridorFeature(null);
        setIsPanelOpen(false);
        setPanelStep(null);
    };
    const handleNextFromStart = e => {
        e.stopPropagation();
        if (!tempStartCoord) {
            alert("Сначала укажите начало маршрута!");
            return;
        }
        setFrozenStartCoord(tempStartCoord);
        setPanelStep("endSelect");
        setTempStartCoord(null);
    };
    const handleCancelEnd = e => {
        e.stopPropagation();
        clearGeomanShape();
        setTempEndCoord(null);
        setFrozenEndCoord(null);
        setRouteFeature(null);
        setCorridorFeature(null);
        setTempStartCoord(frozenStartCoord);
        setFrozenStartCoord(null);
        setPanelStep("startSelect");
    };

    const [isCalculating, setIsCalculating] = useState(false);

    const handleCalculateRoute = async (e) => {
        e.stopPropagation();
        setIsCalculating(true);
    try {

        if (!frozenStartCoord || !tempEndCoord) {
          alert('Укажите и начало, и конец маршрута');
          return;
        }
      
        // вызываем сервер
        const resp = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: frozenStartCoord,
            end: tempEndCoord,
            noFlyZones,
            corridorWidth
          }),
        });
      
        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          alert(err?.error || 'Ошибка при расчёте маршрута');
          return;
        }
      
        const { route, corridor } = await resp.json();
      
        // сбрасываем старые (если нужно)
        if (geomanRef.current && routeGmDataRef.current) {
          geomanRef.current.disableGlobalEditMode();
          geomanRef.current.features.delete(routeGmDataRef.current);
          routeGmDataRef.current = null;
        }
      
        // импортируем новый маршрут
        const fd = geomanRef.current.features.importGeoJsonFeature({
          ...route,
          properties: { ...(route.properties||{}), shape: 'line' },
        });
        routeGmDataRef.current = fd.id;
        geomanRef.current.enableGlobalEditMode();
      
        // обновляем React-стейт
        setRouteFeature(route);
        setCorridorFeature(corridor);
        setFrozenEndCoord(tempEndCoord);
    } finally {
            setIsCalculating(false);
            }
      };
      
        

// обработка редактирования в Geoman
useEffect(() => {
    const map = mapRef.current;
    const gm = geomanRef.current;
    if (!map || !gm) return;
    const onEditEnd = ev => {
        if (ev?.feature?.id !== routeGmIdRef.current) return;
        const geo = ev.feature.getGeoJson();
        setRouteFeature(geo);
        try {
            setCorridorFeature(turf.buffer(geo, corridorWidth, { units: "meters" }));
        } catch {
            setCorridorFeature(null);
        }
    };
    map.on("gm:editend", onEditEnd);
    return () => map.off("gm:editend", onEditEnd);
}, [corridorWidth]);

const onChangeStartLon = v => setTempStartCoord(([_, lat] = [0, 0]) => [v ?? 0, lat]);
const onChangeStartLat = v => setTempStartCoord(([lon, _] = [0, 0]) => [lon, v ?? 0]);
const onChangeEndLon = v => setTempEndCoord(([_, lat] = [0, 0]) => [v ?? 0, lat]);
const onChangeEndLat = v => setTempEndCoord(([lon, _] = [0, 0]) => [lon, v ?? 0]);

return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 150px)" }}>
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
                    boxShadow: "0 3px 8px rgba(0,0,0,0.3)"
                }}
                title={panelStep === "startSelect" ? "Выбор начала маршрута" : "Выбор конца маршрута"}
            >
                {panelStep === "startSelect" && (
                    <Space direction="vertical" style={{ width: "100%" }}>
                        <div>
                            <b>Начало (Lon, Lat):</b>
                            <Space style={{ marginTop: 8 }}>
                                <InputNumber
                                    style={{ width: 100 }}
                                    placeholder="Lon"
                                    value={tempStartCoord?.[0] || ""}
                                    onChange={onChangeStartLon}
                                />
                                <InputNumber
                                    style={{ width: 100 }}
                                    placeholder="Lat"
                                    value={tempStartCoord?.[1] || ""}
                                    onChange={onChangeStartLat}
                                />
                            </Space>
                        </div>
                        <Space>
                            <Button danger onClick={handleCancelStart}>Отменить</Button>
                            <Button type="primary" onClick={handleNextFromStart}>Далее</Button>
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
                                    value={tempEndCoord?.[0] || ""}
                                    onChange={onChangeEndLon}
                                />
                                <InputNumber
                                    style={{ width: 100 }}
                                    placeholder="Lat"
                                    value={tempEndCoord?.[1] || ""}
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
                                onChange={v => setCorridorWidth(v || 0)}
                            />
                        </div>
                        <Space wrap>
                            <Button danger onClick={handleCancelEnd}>Отменить</Button>
                            <Button type="primary" onClick={handleCalculateRoute} loading={isCalculating}>Рассчитать</Button>
                        </Space>
                        <p style={{ fontSize: 12, color: "#666" }}>
                            После расчёта конец (красный маркер) переместится на новую точку, а маршрут будет построен.
                        </p>
                    </Space>
                )}
            </Card>
        )}
    </div>
);
}
