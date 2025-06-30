// src/utils/testRoute.js
const { computeRoute } = require("./routeUtils");
const turf = require("@turf/turf");

// Пример
const start = [71.7, 39.76];
const end   = [71.8, 39.77];
const noFlyZones = [
  turf.polygon([[
    [71.72, 39.755],
    [71.72, 39.765],
    [71.73, 39.765],
    [71.73, 39.755],
    [71.72, 39.755]
  ]]),
  turf.polygon([[
    [71.75, 39.76],
    [71.75, 39.77],
    [71.76, 39.77],
    [71.76, 39.76],
    [71.75, 39.76]
  ]])
];

const route = computeRoute(start, end, noFlyZones, 50);
if (!route) {
  console.error("🚫 Маршрут не найден");
} else {
  console.log("✔ Длина (км):", turf.length(route, { units: "kilometers" }).toFixed(3));
  console.log("Коорд. маршрута:", route.geometry.coordinates);
}
