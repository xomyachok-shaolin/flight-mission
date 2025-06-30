// src/components/MapComponent/RouteControl.js

export default class RouteControl {
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