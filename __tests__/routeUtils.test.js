const turf = require('@turf/turf');
const { computeRoute } = require('../src/utils/routeUtils');

test('прямая без зон возвращается как есть', () => {
  const start = [0,0], end = [1,1];
  const route = computeRoute(start, end, [], 0);
  expect(route.geometry.coordinates).toEqual([[0,0],[1,1]]);
});

test('обход круглой зоны', () => {
  const start = [0,0], end = [2,0];
  // круглая зона радиус 0.5 в центре [1,0]
  const zone = turf.circle([1,0], 0.5, { steps: 16, units: 'meters' });
  const route = computeRoute(start, end, [zone], 0);
  expect(route).not.toBeNull();
  // маршрут не пересекает зону
  expect(turf.booleanDisjoint(route, zone)).toBe(true);
});

test('маршрут не найден при полном блоке', () => {
  const start = [0,0], end = [1,0];
  // зона полностью покрывает путь
  const zone = turf.buffer(turf.lineString([start, end]), 10, { units: 'meters' });
  const route = computeRoute(start, end, [zone], 0);
  expect(route).toBeNull();
});
