// src/components/MapComponent.jsx
import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

import { Card, Button, Space, InputNumber } from "antd";
import * as turf from "@turf/turf";

import { MapboxOverlay } from "@deck.gl/mapbox";
import { Deck } from "@deck.gl/core";
import {
  offsetDatetimeRange,
  RasterLayer,
  ParticleLayer,
  LegendControl,
  TimelineControl,
  TooltipControl,
  DirectionFormat,
} from "weatherlayers-gl";
import { Client as WeatherClient } from "weatherlayers-gl/client";
import { useRoute } from "../context/RouteContext";

import CrosshairManager from './CrosshairManager';
import RouteControl from './RouteControl';

const INITIAL_DATETIME_ISO = new Date().toISOString();
const WEATHER_LAYERS_TOKEN = "3a6kPAwznqa8AQDWhBBd";
const WIND_DATASET_ID = "gfs/wind_10m_above_ground";
const weatherClient = new WeatherClient({ accessToken: WEATHER_LAYERS_TOKEN });


class WeatherWindControl {
  constructor(datasetMeta, rasterData, onToggle) {
    this.meta = datasetMeta;
    this.raster = rasterData;
    this.onToggle = onToggle;
    this.map = null;
    this.btn = null;
    this.ctrl = null;
    this.added = false;
  }

  onAdd(map) {
    this.map = map;
    this.ctrl = document.createElement("div");
    this.ctrl.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this.btn = document.createElement("button");
    this.btn.className = "maplibregl-ctrl-icon maplibregl-ctrl-button";
    this.btn.title = "Ветер (weatherlayers-gl)";
    this.btn.style.width = this.btn.style.height = "27px";
    this.btn.innerHTML = `    <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="28" height="28" viewBox="0 0 2048 2048" style="shape-rendering:geometricPrecision;text-rendering:geometricPrecision;image-rendering:optimizeQuality;fill-rule:evenodd;clip-rule:evenodd">
      <rect width="2048" height="2048" rx="256.001" ry="256.001" style="fill:#fff"/>
      <path d="M266.09 1055.67c1.667 0 3.302.133 4.9.386l1342.49-.16c52.217.134 98.496 27.395 132.121 67.487 34.871 41.58 56.492 97.744 56.492 151.112 0 45.93-14.972 88.61-39.674 123.993-20.298 29.077-47.14 53.119-77.571 69.848-30.911 16.993-65.602 26.64-101.087 26.64-38.33 0-77.508-11.234-113.798-36.566l.05-.071c-8.717-5.763-14.486-15.777-14.486-27.167 0-17.864 14.189-32.345 31.69-32.345 8.455 0 16.136 3.38 21.818 8.886 23.897 15.977 49.572 23.092 74.726 23.092 24.534 0 48.653-6.743 70.255-18.618 22.081-12.138 41.465-29.45 56.015-50.295 17.364-24.874 27.89-54.952 27.89-87.398 0-38.6-15.864-79.495-41.449-110.003-22.263-26.547-51.517-44.595-82.992-44.675l-1342.49.16a31.317 31.317 0 0 1-4.9.386c-17.501 0-31.69-14.482-31.69-32.346 0-17.864 14.189-32.346 31.69-32.346zm958.691-434.035c35.577-24.836 77.1-37.126 118.414-38.203 34.983-.913 69.895 6.21 100.937 20.55 31.61 14.602 59.432 36.767 79.613 65.678 19.776 28.326 32.001 62.816 33.04 102.638.035 1.349.056 3.005.06 4.96.138 53.666-20.315 106.35-52.864 145.876-33.683 40.908-80.642 68.321-132.131 69.663-.875.022-2.073.037-3.55.04l-1092.31.178c-1.456.21-2.942.32-4.453.32-17.502 0-31.69-14.481-31.69-32.345 0-17.864 14.188-32.346 31.69-32.346 1.802 0 3.569.156 5.289.451l1091.47-.178c.388 0 1.063-.014 2.045-.04 31.738-.827 61.796-19.075 84.256-46.351 23.596-28.654 38.423-66.682 38.326-105.268 0-.846-.022-2-.061-3.456-.69-26.449-8.648-49.124-21.51-67.545-13.373-19.161-32.283-34.068-54.045-44.122-22.331-10.315-47.448-15.439-72.612-14.782-29.183.76-58.335 9.296-83.11 26.526-5.629 5.227-13.109 8.41-21.317 8.41-17.502 0-31.69-14.48-31.69-32.345 0-12.14 6.552-22.715 16.242-28.247l-.043-.062zm-670.412 562.024c1.37 0 2.72.089 4.044.261h747.278v.125l.5.001h.125c43.303.248 75.487 22.753 96.637 54.997 19.109 29.136 28.742 66.589 28.742 101.273h-.127l-.002.91v.126c-.175 30.542-15.751 63.624-39.834 87.708-22.444 22.444-52.874 38.076-86.04 38.045-20.54-.019-42.305-2.574-63.251-9.557-18.756-6.252-36.635-15.858-52.22-30.021l.176-.194c-7.255-5.928-11.902-15.04-11.902-25.263 0-17.864 14.188-32.345 31.69-32.345 9.52 0 18.061 4.287 23.87 11.071 8.5 7.526 18.225 12.688 28.438 16.09 13.802 4.602 28.764 6.286 43.198 6.3 14.63.012 29.171-7.998 40.67-19.497 12.883-12.884 21.208-29 21.286-42.588l.002-.785h-.126c0-23.19-6.103-47.719-18.211-66.18-10.07-15.351-24.6-26.063-43.246-26.169l-.375-.001v.125H558.405c-1.322.171-2.668.26-4.036.26-17.501 0-31.69-14.482-31.69-32.346 0-17.864 14.189-32.346 31.69-32.346zm-86.452-320.361a31.19 31.19 0 0 1-6.55.693c-17.502 0-31.69-14.481-31.69-32.345 0-17.554 13.699-31.84 30.779-32.332v-.188h563.489v.126h.33v-.125c21.51 0 44.479-12.082 62.474-30.008 18.064-17.995 30.37-41.018 30.455-62.79v-.339h-.125c0-22.5-5.767-40.676-15.415-54.49-8.315-11.908-19.671-21.015-32.796-27.183-13.67-6.425-29.474-9.701-46.057-9.701-24.006 0-48.97 6.961-70.93 21.262-5.589 5.047-12.938 8.112-20.987 8.112-17.501 0-31.69-14.482-31.69-32.346 0-11.915 6.313-22.323 15.709-27.936 33.395-22.376 71.455-33.263 107.899-33.263 25.546 0 50.628 5.392 73.128 15.967 23.042 10.831 43.15 27.064 58.113 48.492 17.024 24.375 27.198 54.895 27.198 91.086h-.127v.34c-.15 39.644-20.054 79.07-49.254 108.16-29.271 29.158-68.632 48.81-107.594 48.81v-.127l-.33-.001v.126H467.916z" style="fill:#000;fill-rule:nonzero"/>
    </svg>`;

    this.btn.onclick = async () => {
      if (!this._isAdded) {
        const proj = this.map.getProjection()?.type || "mercator";

        // если меркатор — временно переключаем на globe
        if (proj === "mercator") {
          const oldPitch = this.map.getPitch();
          const oldBearing = this.map.getBearing();
          const oldMaxPitch = this.map.transform.maxPitch;

          // панорама в globe
          this.map.setProjection({ type: "globe" });

          // ждём прогонки кадра
          setTimeout(() => {
            this._overlay = this._createOverlay();
            this.map.addControl(this._overlay);

            // возвращаем обратно mercator + исходные настройки
            this.map.setProjection({ type: "mercator" });
            setTimeout(() => {
              this.map.setPitch(oldPitch);
              this.map.setBearing(oldBearing);
              this.map.setMaxPitch(oldMaxPitch);
            }, 100);
          }, 100);
        } else {
          // уже globe — просто добавляем
          this._overlay = this._createOverlay();
          this.map.addControl(this._overlay);
        }

        this._isAdded = true;
        this.btn.classList.add("active");
        this.onToggle(true);
      } else {
        // удаляем overlay
        if (this._overlay) {
          this.map.removeControl(this._overlay);
          this._overlay = null;
        }
        this._isAdded = false;
        this.btn.classList.remove("active");
        this.onToggle(false);
      }
    };

    this.ctrl.appendChild(this.btn);
    return this.ctrl;
  }

  onRemove() {
    this.ctrl.remove();
    this.map = null;
  }

  getDefaultPosition() {
    return "top-left";
  }

  _createOverlay() {
    return new MapboxOverlay({
      layers: [
        new RasterLayer({
          id: "wind-raster",
          image: this.raster.image,
          imageType: this.raster.imageType,
          imageUnscale: this.raster.imageUnscale,
          bounds: this.raster.bounds,
          palette: this.meta.palette,
          opacity: 0.3,
        }),
        new ParticleLayer({
          id: "wind-particles",
          image: this.raster.image,
          imageType: this.raster.imageType,
          imageUnscale: this.raster.imageUnscale,
          bounds: this.raster.bounds,
          numParticles: 8000,
          maxAge: 15,
          speedFactor: 8,
          width: 2,
          opacity: 0.4,
          animate: true,
        }),
      ],
      deck: new Deck({
        gl: this.map.painter.context.gl,
        // чтобы Deck не пытался сам ресайзить canvas
        useDevicePixels: false,
      }),
    });
  }
}

// ====================== MapComponent ======================
export default function MapComponent() {
  const { setRouteGeoJson } = useRoute();
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

  // WEATHERLAYERS-STATE
  const [windActive, setWindActive] = useState(false);
  const [windMeta, setWindMeta] = useState(null);
  const [windRaster, setWindRaster] = useState(null);
  const [windDatetimes, setWindDatetimes] = useState([]);
  const legendRef = useRef(null);
  const timelineRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    async function loadWind() {
      try {
        const meta = await weatherClient.loadDataset(WIND_DATASET_ID);
        const slice = await weatherClient.loadDatasetSlice(
          WIND_DATASET_ID,
          offsetDatetimeRange(INITIAL_DATETIME_ISO, 0, 24)
        );
        const dt = slice.datetimes[0];
        const raster = await weatherClient.loadDatasetData(WIND_DATASET_ID, dt);

        setWindMeta(meta);
        setWindDatetimes(slice.datetimes);
        setWindRaster(raster);
      } catch (err) {
        console.error("Ошибка ветра:", err);
      }
    }
    loadWind();
  }, []);

  useEffect(() => {
    if (!windMeta || !windDatetimes.length) return;

    legendRef.current = new LegendControl({
      title: "Скорость ветра",
      unitFormat: { unit: "м/с" },
      palette: windMeta.palette,
    });

    timelineRef.current = new TimelineControl({
      datetimes: windDatetimes,
      datetime: windDatetimes[0],
      format: "DD MMM HH:mm",
      language: "ru",
      onChange: async (newDt) => {
        const newRaster = await weatherClient.loadDatasetData(
          WIND_DATASET_ID,
          newDt
        );
        setWindRaster(newRaster);
      },
    });

    tooltipRef.current = new TooltipControl({
      unitFormat: { unit: "м/с" },
      directionFormat: DirectionFormat.CARDINAL3,
      followCursor: true,
    });
  }, [windMeta, windDatetimes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controls = [
      legendRef.current,
      timelineRef.current,
      tooltipRef.current,
    ];
    if (windActive) {
      // добавляем все три
      controls.forEach(
        (ctrl) =>
          ctrl &&
          map.addControl(
            ctrl,
            ctrl instanceof LegendControl
              ? "bottom-left"
              : ctrl instanceof TimelineControl
              ? "bottom-left"
              : "top-left"
          )
      );
    } else {
      // убираем их
      controls.forEach((ctrl) => ctrl && map.removeControl(ctrl));
    }
  }, [windActive]);

  const stopGeomanEdit = () => {
    const gm = geomanRef.current;
    if (!gm || !routeGmIdRef.current) return;
    gm.features.delete(routeGmIdRef.current);
    routeGmIdRef.current = null;
    gm.disableGlobalEditMode();
  };

  // ─── INIT MAP & GEOMAN ───────────────────────────────────────────────────────
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

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`,
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
      renderWorldCopies: false,
      projection: initialProjection,
      maxPitch: 60,
    });
    mapRef.current = map;

    const geoman = new Geoman(map, {
      settings: { controlsPosition: "top-right" },
      layerStyles: {
        // Прямоугольники и полигоны
        polygon: {
          gm_main: [
            // Заливка
            {
              type: "fill",
              paint: {
                "fill-color": "#f00",
                "fill-opacity": 0.3
              }
            },
            // Контур
            {
              type: "line",
              paint: {
                "line-color": "#f00",
                "line-width": 2
              }
            }
          ]
        },
    
        // Линии (для drawing mode = line)
        line: {
          gm_main: [
            {
              type: "line",
              paint: {
                "line-color": "#00f",
                "line-width": 2
              }
            }
          ]
        },
    
        // Окружности (circle)
        circle: {
          gm_main: [
            // Заливка окружности
            {
              type: "fill",
              paint: {
                "fill-color": "#f00",
                "fill-opacity": 0.3
              }
            },
            // Контур окружности
            {
              type: "line",
              paint: {
                "line-color": "#f00",
                "line-width": 2
              }
            }
          ]
        },
    
        // Прямоугольники (rectangle) — то же, что полигоны
        rectangle: {
          gm_main: [
            {
              type: "fill",
              paint: {
                "fill-color": "#f00",
                "fill-opacity": 0.3
              }
            },
            {
              type: "line",
              paint: {
                "line-color": "#f00",
                "line-width": 2
              }
            }
          ]
        }
      }
    });
    
    
    geomanRef.current = geoman;

    // currently (this blows up)
    map.on("gm:create", (e) => {
      // e.feature is a Geoman FeatureData, not a raw GeoJSON
      console.log(e.feature);
      const feat = e.feature.getGeoJson();
      if (
        feat.geometry.type === "Polygon" ||
        feat.geometry.type === "MultiPolygon"
      ) {
        setNoFlyZones((zs) => [...zs, feat]);
      }
    });
    map.on("gm:remove", (e) => {
      const removed = e.feature.getGeoJson();
      setNoFlyZones((zs) =>
        zs.filter((z) => z.properties._gmId !== removed.properties._gmId)
      );
    });

    map.on("load", () => {
      if (map.getProjection())
        if (map.getProjection().type === "globe") {
          map.setPitch(0);
          map.setMaxPitch(0);
          map.dragRotate.disable();
          map.touchZoomRotate.disableRotation();
        }
      // route source/layer
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: null },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-width": 4, "line-color": "#00f" },
      });

      // corridor
      map.addSource("corridor", {
        type: "geojson",
        data: { type: "Feature", geometry: null },
      });
      map.addLayer({
        id: "corridor-fill",
        type: "fill",
        source: "corridor",
        paint: { "fill-color": "#0ff", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "corridor-outline",
        type: "line",
        source: "corridor",
        paint: { "line-color": "#0cc", "line-width": 2 },
      });

      // no-fly
      map.addSource("no-fly", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "nf-fill",
        type: "fill",
        source: "no-fly",
        paint: { "fill-color": "#f00", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "nf-outline",
        type: "line",
        source: "no-fly",
        paint: { "line-color": "#f00", "line-width": 2 },
      });

      // terrain
      const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
      map.addSource("dem", {
        type: "raster-dem",
        tiles: [
          `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`,
        ],
        tileSize: 512,
        maxzoom: 14,
        bounds: [-180, -90, 180, 90],
      });
      map.setTerrain({ source: "dem", exaggeration: 1.0 });
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
            const currentProj = map.getProjection().type; // "globe" или "mercator"
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
    return () => {
      map.off("gm:create");
      map.off("gm:remove");
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !windMeta || !windRaster) return;

    // 1) кнопка ветра
    const windCtrl = new WeatherWindControl(
      windMeta,
      windRaster,
      setWindActive
    );
    map.addControl(windCtrl, "top-left");

    // 2) легенда
    const legend = new LegendControl({
      title: "Скорость ветра",
      unitFormat: { unit: "м/с" },
      palette: windMeta.palette,
    });
    // map.addControl(legend, "bottom-left");

    // 3) таймлайн
    const timeline = new TimelineControl({
      datetimes: windDatetimes,
      datetime: windDatetimes[0],
      format: "DD MMM HH:mm",
      language: "ru",
      onChange: async (newDt) => {
        const newRaster = await weatherClient.loadDatasetData(
          WIND_DATASET_ID,
          newDt
        );
        setWindRaster(newRaster);
      },
    });
    // map.addControl(timeline, "bottom-left");

    // 4) тултип
    const tooltip = new TooltipControl({
      unitFormat: { unit: "м/с" },
      directionFormat: DirectionFormat.CARDINAL3,
      followCursor: true,
    });
    // map.addControl(tooltip, "top-left");
  }, [windMeta, windRaster, windDatetimes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource("no-fly");
    src && src.setData(turf.featureCollection(noFlyZones));
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
    if (
      isPanelOpen &&
      (panelStep === "startSelect" || panelStep === "endSelect")
    ) {
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
    upd(
      startMark,
      panelStep === "startSelect" ? tempStart : frozenStart,
      "#0a0"
    );
    upd(tempEndMark, panelStep === "endSelect" ? tempEnd : null, "#00f");
    upd(endMark, frozenEnd, "#a00");
  }, [panelStep, tempStart, frozenStart, tempEnd, frozenEnd]);

  // синхронизация route/corridor в карту
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getSource("route")?.setData(
      routeFeature || { type: "Feature", geometry: null }
    );
    m.getSource("corridor")?.setData(
      corridorFeature || { type: "Feature", geometry: null }
    );
  }, [routeFeature, corridorFeature]);

  // клики вне панели
  useEffect(() => {
    const handler = (e) => {
      if (!isPanelOpen || isDragging.current) return;
      if (panelRef.current?.contains(e.target)) return;
      if (routeBtnRef.current?.contains(e.target)) return;
      setIsPanelOpen(false);
      setPanelStep(null);
      setTempStart(null);
      setTempEnd(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen) {
      tempEndMark.current?.remove();
      tempEndMark.current = null;
    }
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
    const map = mapRef.current;
    if (!gm || !map) return;
    
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
        properties: { ...(routeFeature.properties || {}), shape: "line" },
      });
      routeGmIdRef.current = fd.id;
      // gm.enableGlobalEditMode();
      map.once('idle', () => {
              gm.enableGlobalEditMode();
        });
        
    }
  }, [routeFeature]);

  // обработка правки из Geoman
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onEditEnd = (evt) => {
      if (evt.feature?.id !== routeGmIdRef.current) return;
      const updated = evt.feature.getGeoJson();

      const violates = noFlyZones.some(
        (zone) => !turf.booleanDisjoint(updated, zone)
      );
      if (violates) {
        alert("Маршрут пересекает запретную зону — отмена правок");
        // revert back
        clearGeoman();
        setRouteFeature(lastGoodRoute.current);
        return;
      }

      const coords = updated.geometry.coordinates;
      const start = coords[0];
      const end = coords[coords.length - 1];

      // 3) перемещаем маркеры «старт» и «финиш»
      if (startMark.current) startMark.current.setLngLat(start);
      if (endMark.current) endMark.current.setLngLat(end);

      setRouteFeature(updated);
      setRouteGeoJson(updated);
      setCorridorFeature(
        turf.buffer(updated, corridorWidth, { units: "meters" })
      );
    };
    map.on("gm:editend", onEditEnd);
    map.on("gm:update", onEditEnd);
    return () => {
      map.off("gm:editend", onEditEnd);
      map.off("gm:update", onEditEnd);
    };
  }, [corridorWidth]);

  // пересчёт коридора при изменении ширины
  useEffect(() => {
    if (!routeFeature) return;
    setCorridorFeature(
      turf.buffer(routeFeature, corridorWidth, { units: "meters" })
    );
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
      console.log("→ POST /api/route", {
        start: frozenStart,
        end: tempEnd,
        zones: noFlyZones.length,
        corridorWidth,
      });

      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: frozenStart,
          end: tempEnd,
          noFlyZones: noFlyZones.map((f) => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {},
          })),
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
      setRouteGeoJson(route);
      setFrozenEnd(tempEnd);

      try {
        const [minX, minY, maxX, maxY] = turf.bbox(corridor);
        mapRef.current?.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          { padding: 40 }
        );
      } catch {}
    } catch (err) {
      console.error(err);
      alert("Сетевая ошибка");
    } finally {
      setIsCalculating(false);
    }
  }

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 150px)",
      }}
    >
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {isPanelOpen && (
        <Card
          ref={panelRef}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 300,
            zIndex: 9999,
          }}
        >
          {panelStep === "startSelect" ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <b>Начало (Lon,Lat):</b>
              <Space>
                <InputNumber
                  placeholder="Lon"
                  value={tempStart?.[0]}
                  onChange={(v) => setTempStart(([_, lat]) => [v || 0, lat])}
                />
                <InputNumber
                  placeholder="Lat"
                  value={tempStart?.[1]}
                  onChange={(v) => setTempStart(([lon, _]) => [lon, v || 0])}
                />
              </Space>
              <Space>
                <Button danger onClick={handleCancelStart}>
                  Отменить
                </Button>
                <Button type="primary" onClick={handleNextFromStart}>
                  Далее
                </Button>
              </Space>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              <b>Конец (Lon,Lat):</b>
              <Space>
                <InputNumber
                  placeholder="Lon"
                  value={tempEnd?.[0]}
                  onChange={(v) => setTempEnd(([_, lat]) => [v || 0, lat])}
                />
                <InputNumber
                  placeholder="Lat"
                  value={tempEnd?.[1]}
                  onChange={(v) => setTempEnd(([lon, _]) => [lon, v || 0])}
                />
              </Space>
              <div>
                <b>Ширина коридора:</b>
                <InputNumber
                  min={0}
                  step={10}
                  value={corridorWidth}
                  onChange={setCorridorWidth}
                />
              </div>
              <Space>
                <Button danger onClick={handleCancelEnd}>
                  Отменить
                </Button>
                <Button
                  type="primary"
                  loading={isCalculating}
                  onClick={handleCalculateRoute}
                >
                  Рассчитать
                </Button>
              </Space>
            </Space>
          )}
        </Card>
      )}
    </div>
  );
}
