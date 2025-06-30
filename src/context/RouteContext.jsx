import React, { createContext, useContext, useState } from 'react';

const RouteContext = createContext();

export function RouteProvider({ children }) {
  const [routeGeoJson, setRouteGeoJson] = useState(null);   // GeoJSON LineString
  return (
    <RouteContext.Provider value={{ routeGeoJson, setRouteGeoJson }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  return useContext(RouteContext);
}
